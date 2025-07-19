import { openrouter } from '@/lib/openrouter';
import { generateText } from 'ai';
import type { NextRequest } from 'next/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { chatMessages, users, conversationFolders } from '@/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { rateLimiter } from '@/lib/rate-limiter';
import { buildContext, buildSystemPrompt, getModelLimits, type MessageContext } from '@/lib/context-manager';
import { folderContextManager } from '@/lib/folder-context-manager';
import { TIER_CONFIGS } from '@/lib/openrouter';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  conversationId: string;
  temperature?: number;
  maxTokens?: number;
  guestSessionId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ChatRequest;
    const { messages, model, conversationId, temperature, maxTokens, guestSessionId } = body;

    const session = await auth();
    const isGuest = !session;
    const userId = session?.user?.id || null;

    // Handle guest users
    if (isGuest) {
      if (!guestSessionId) {
        return new Response('Guest session ID required', { status: 400 });
      }

      // Build system prompt for guest users
      const systemPrompt = buildSystemPrompt(
        "You are ProjectGPT's assistant. You're helping a guest user who is trying out the platform. Be helpful and concise. Let them know they can sign in for unlimited access."
      );

      // Create message context for guests
      const conversationMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const modelLimits = getModelLimits(model);
      const context = buildContext(conversationMessages, systemPrompt, modelLimits);

      // Use basic configuration for guest users
      const config = TIER_CONFIGS.free;

      // Generate response using AI SDK
      const result = await generateText({
        model: openrouter(model),
        messages: context.messages,
        temperature: temperature ?? config.temperature,
      });

      // Save guest messages to database
      await db.insert(chatMessages).values({
        userId: null,
        conversationId,
        guestSessionId,
        role: 'user',
        content: messages[messages.length - 1]?.content || '',
        model,
        tokensUsed: 0,
      });

      await db.insert(chatMessages).values({
        userId: null,
        conversationId,
        guestSessionId,
        role: 'assistant',
        content: result.text,
        model,
        tokensUsed: result.usage?.totalTokens || 0,
      });

      return Response.json({
        message: result.text,
        model,
        tokensUsed: result.usage?.totalTokens || 0,
      });
    }

    // Handle authenticated users
    if (!userId) {
      return new Response('User ID not found', { status: 401 });
    }

    // Check burst limits first
    const canBurst = await rateLimiter.checkBurstLimit(userId);
    if (!canBurst) {
      return new Response('Too many requests. Please wait a moment before trying again.', { status: 429 });
    }

    // Get conversation context (last 10 messages)
    const recentMessages = await db.query.chatMessages.findMany({
      where: and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.conversationId, conversationId)
      ),
      orderBy: [desc(chatMessages.createdAt)],
      limit: 10,
    });

    // Check if this conversation belongs to a folder
    const folderAssignment = await db.query.conversationFolders.findFirst({
      where: and(
        eq(conversationFolders.conversationId, conversationId),
        eq(conversationFolders.userId, userId)
      ),
    });

    // Build message context for OpenRouter using context manager
    const conversationMessages = [
      // Add recent messages in chronological order
      ...recentMessages.reverse().map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      // Add the new user message
      ...messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    const baseSystemPrompt = "You are ProjectGPT's assistant. Always reference the user's uploaded docs and project context. Be concise, helpful, and clarify when you're uncertain.";
    const modelLimits = getModelLimits(model);
    
    let context: MessageContext;
    
    if (folderAssignment) {
      // Use folder-enhanced context with RAG integration
      const userQuery = messages[messages.length - 1]?.content || '';
      context = await folderContextManager.buildFolderContext(
        folderAssignment.folderId,
        userId,
        conversationMessages,
        userQuery,
        baseSystemPrompt,
        modelLimits
      );
    } else {
      // Use standard context for non-folder conversations
      const systemPrompt = buildSystemPrompt(baseSystemPrompt);
      context = buildContext(conversationMessages, systemPrompt, modelLimits);
    }

    // Use actual token count from context manager
    const estimatedTokens = context.totalTokens;

    // Check rate limits
    const rateLimitResult = await rateLimiter.checkAndConsume(userId, estimatedTokens);
    
    if (!rateLimitResult.allowed) {
      const message = rateLimitResult.tier === "free" 
        ? "You've hit your free quota for today. Watch an ad to unlock more chats or upgrade to Pro."
        : "Rate limit exceeded. Please try again later.";
      return new Response(message, { status: 429 });
    }

    // Get user tier for model configuration
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const tier = (user?.tier as keyof typeof TIER_CONFIGS) || "free";
    const config = TIER_CONFIGS[tier];

    // Save user message
    await db.insert(chatMessages).values({
      userId,
      conversationId,
      role: 'user',
      content: messages[messages.length - 1]?.content || '',
      model,
      tokensUsed: 0,
    });

    // Generate response using AI SDK
    const result = await generateText({
      model: openrouter(model),
      messages: context.messages,
      temperature: temperature ?? config.temperature,
    });

    // Save assistant message
    await db.insert(chatMessages).values({
      userId,
      conversationId,
      role: 'assistant',
      content: result.text,
      model,
      tokensUsed: result.usage?.totalTokens || 0,
    });

    // Update quota with actual token usage
    const actualTokens = result.usage?.totalTokens || 0;
    if (actualTokens !== estimatedTokens) {
      // Adjust the quota based on actual usage
      await rateLimiter.checkAndConsume(userId, actualTokens - estimatedTokens);
    }

    return Response.json({
      message: result.text,
      model,
      tokensUsed: result.usage?.totalTokens || 0,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    if (error instanceof Error) {
      const message = error.message.includes('rate') 
        ? 'AI service is temporarily unavailable. Please try again later.'
        : 'Failed to get response from AI model. Please try again.';
      return new Response(message, { status: 500 });
    }
    
    return new Response('An unexpected error occurred.', { status: 500 });
  }
} 