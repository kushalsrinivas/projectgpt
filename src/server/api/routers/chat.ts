import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { chatMessages, users, conversationFolders } from "@/server/db/schema";
import { OpenRouterClient, TIER_CONFIGS } from "@/lib/openrouter";
import { rateLimiter } from "@/lib/rate-limiter";
import { buildContext, buildSystemPrompt, getModelLimits } from "@/lib/context-manager";
import { eq, desc, and } from "drizzle-orm";

const openRouterClient = new OpenRouterClient();

export const chatRouter = createTRPCRouter({
  // Guest messaging procedure - allows unauthenticated users to send messages
  sendGuest: publicProcedure
    .input(
      z.object({
        message: z.string().min(1),
        model: z.string().min(1),
        conversationId: z.string().min(1),
        guestSessionId: z.string().min(1),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().min(1).max(4000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // For guest users, we don't have a userId, so we'll use null
      const userId = null;
      const guestSessionId = input.guestSessionId;

      // Build system prompt for guest users
      const systemPrompt = buildSystemPrompt(
        "You are ProjectGPT's assistant. You're helping a guest user who is trying out the platform. Be helpful and concise. Let them know they can sign in for unlimited access."
      );

      // Create a simple message context for guests (no conversation history for now)
      const conversationMessages = [
        {
          role: "user" as const,
          content: input.message,
        },
      ];

      const modelLimits = getModelLimits(input.model);
      const context = buildContext(conversationMessages, systemPrompt, modelLimits);
      const messages = context.messages;

      try {
        // Use basic configuration for guest users
        const config = TIER_CONFIGS.free;

        // Make OpenRouter API call
        const response = await openRouterClient.chat({
          model: input.model,
          messages,
          temperature: input.temperature ?? config.temperature,
          max_tokens: input.maxTokens ?? config.maxTokens,
          top_p: 0.9,
          presence_penalty: 0.6,
          frequency_penalty: 0.0,
          user: guestSessionId, // Use guest session ID for tracking
        });

        const assistantMessage = response.choices[0]?.message.content;
        if (!assistantMessage) {
          throw new Error("No response from AI model");
        }

        // Save guest messages to database for optional tracking
        await ctx.db.insert(chatMessages).values({
          userId: null,
          conversationId: input.conversationId,
          guestSessionId: input.guestSessionId,
          role: "user",
          content: input.message,
          model: input.model,
          tokensUsed: 0,
        });

        await ctx.db.insert(chatMessages).values({
          userId: null,
          conversationId: input.conversationId,
          guestSessionId: input.guestSessionId,
          role: "assistant",
          content: assistantMessage,
          model: input.model,
          tokensUsed: response.usage.total_tokens,
        });

        return {
          message: assistantMessage,
          model: input.model,
          tokensUsed: response.usage.total_tokens,
        };
      } catch (error) {
        console.error("OpenRouter API error for guest:", error);
        
        if (error instanceof Error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message.includes("rate") 
              ? "AI service is temporarily unavailable. Please try again later."
              : "Failed to get response from AI model. Please try again.",
          });
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    }),

  send: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1),
        model: z.string().min(1),
        conversationId: z.string().min(1),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().min(1).max(4000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Check burst limits first
      const canBurst = await rateLimiter.checkBurstLimit(userId);
      if (!canBurst) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please wait a moment before trying again.",
        });
      }

      // Get conversation context (last 10 messages)
      const recentMessages = await ctx.db.query.chatMessages.findMany({
        where: and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.conversationId, input.conversationId)
        ),
        orderBy: [desc(chatMessages.createdAt)],
        limit: 10,
      });

      // Build message context for OpenRouter using context manager
      const conversationMessages = [
        // Add recent messages in chronological order
        ...recentMessages.reverse().map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        // Add the new user message
        {
          role: "user" as const,
          content: input.message,
        },
      ];

      const systemPrompt = buildSystemPrompt(
        "You are ProjectGPT's assistant. Always reference the user's uploaded docs and project context. Be concise, helpful, and clarify when you're uncertain."
      );

      const modelLimits = getModelLimits(input.model);
      const context = buildContext(conversationMessages, systemPrompt, modelLimits);
      const messages = context.messages;

      // Use actual token count from context manager
      const estimatedTokens = context.totalTokens;

      // Check rate limits
      const rateLimitResult = await rateLimiter.checkAndConsume(userId, estimatedTokens);
      
      if (!rateLimitResult.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitResult.tier === "free" 
            ? "You've hit your free quota for today. Watch an ad to unlock more chats or upgrade to Pro."
            : "Rate limit exceeded. Please try again later.",
        });
      }

      // Save user message
      await ctx.db.insert(chatMessages).values({
        userId,
        conversationId: input.conversationId,
        role: "user",
        content: input.message,
        model: input.model,
        tokensUsed: 0,
      });

      try {
        // Get user tier for model configuration
        const user = await ctx.db.query.users.findFirst({
          where: eq(users.id, userId),
        });

        const tier = (user?.tier as keyof typeof TIER_CONFIGS) || "free";
        const config = TIER_CONFIGS[tier];

        // Make OpenRouter API call
        const response = await openRouterClient.chat({
          model: input.model,
          messages,
          temperature: input.temperature ?? config.temperature,
          max_tokens: input.maxTokens ?? config.maxTokens,
          top_p: 0.9,
          presence_penalty: 0.6,
          frequency_penalty: 0.0,
          user: userId,
        });

        const assistantMessage = response.choices[0]?.message.content;
        if (!assistantMessage) {
          throw new Error("No response from AI model");
        }

        // Save assistant message
        await ctx.db.insert(chatMessages).values({
          userId,
          conversationId: input.conversationId,
          role: "assistant",
          content: assistantMessage,
          model: input.model,
          tokensUsed: response.usage.total_tokens,
        });

        // Update quota with actual token usage
        const actualTokens = response.usage.total_tokens;
        if (actualTokens !== estimatedTokens) {
          // Adjust the quota based on actual usage
          await rateLimiter.checkAndConsume(userId, actualTokens - estimatedTokens);
        }

        return {
          message: assistantMessage,
          model: input.model,
          tokensUsed: response.usage.total_tokens,
          remaining: rateLimitResult.remaining,
        };
      } catch (error) {
        console.error("OpenRouter API error:", error);
        
        if (error instanceof Error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message.includes("rate") 
              ? "AI service is temporarily unavailable. Please try again later."
              : "Failed to get response from AI model. Please try again.",
          });
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    }),

  getConversation: protectedProcedure
    .input(z.object({
      conversationId: z.string().min(1),
      limit: z.number().min(1).max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const messages = await ctx.db.query.chatMessages.findMany({
        where: and(
          eq(chatMessages.userId, ctx.session.user.id),
          eq(chatMessages.conversationId, input.conversationId)
        ),
        orderBy: [desc(chatMessages.createdAt)],
        limit: input.limit ?? 50,
      });

      return messages.reverse(); // Return in chronological order
    }),

  getQuotaStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      return rateLimiter.getQuotaStatus(userId);
    }),

  watchAd: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      
      // In a real implementation, you would verify the ad was actually watched
      // For now, we'll just add the bonus credits
      await rateLimiter.addBonusCredits(userId, 10);
      
      return {
        success: true,
        creditsAdded: 10,
      };
    }),

  getConversations: protectedProcedure
    .input(z.object({
      folderId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      // Get unique conversations with their latest message
      const conversations = await ctx.db.query.chatMessages.findMany({
        where: eq(chatMessages.userId, userId),
        orderBy: [desc(chatMessages.createdAt)],
      });

      // Get folder assignments for all conversations
      const folderAssignments = await ctx.db.query.conversationFolders.findMany({
        where: eq(conversationFolders.userId, userId),
      });

      // Create a map of conversation ID to folder ID
      const conversationFolderMap = new Map();
      for (const assignment of folderAssignments) {
        conversationFolderMap.set(assignment.conversationId, assignment.folderId);
      }

      // Group by conversation ID and get the latest message for each
      const conversationMap = new Map();
      
      for (const message of conversations) {
        if (!conversationMap.has(message.conversationId)) {
          const folderId = conversationFolderMap.get(message.conversationId);
          
          // Filter by folder if specified
          if (input?.folderId && folderId !== input.folderId) {
            continue;
          }
          
          // If filtering by "no folder" (null), skip conversations that are in folders
          if (input?.folderId === null && folderId !== undefined) {
            continue;
          }

          conversationMap.set(message.conversationId, {
            id: message.conversationId,
            title: message.role === "user" 
              ? message.content.slice(0, 50) + (message.content.length > 50 ? "..." : "")
              : "New Conversation",
            lastMessage: message.content,
            lastMessageTime: message.createdAt,
            model: message.model,
            folderId: folderId || null,
          });
        }
      }

      return Array.from(conversationMap.values())
        .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    }),
}); 