import type { OpenRouterMessage } from "./openrouter";

export interface MessageContext {
  messages: OpenRouterMessage[];
  totalTokens: number;
  truncated: boolean;
}

export interface TokenLimits {
  maxTokens: number;
  maxMessages: number;
  reserveTokens: number; // Reserve tokens for the response
}

const DEFAULT_LIMITS: TokenLimits = {
  maxTokens: 8000, // Conservative limit for most models
  maxMessages: 20,
  reserveTokens: 1500,
};

/**
 * Estimate token count for a message (rough approximation)
 * Real implementation would use a proper tokenizer
 */
function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token count for a message object
 */
function estimateMessageTokens(message: OpenRouterMessage): number {
  return estimateTokens(message.content) + 10; // +10 for role and formatting
}

/**
 * Truncate text to fit within token limit
 */
function truncateText(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4; // Rough approximation
  if (text.length <= maxChars) return text;

  // Try to truncate at word boundaries
  const truncated = text.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  
  if (lastSpace > maxChars * 0.8) {
    return `${truncated.substring(0, lastSpace)}...`;
  }
  
  return `${truncated}...`;
}

/**
 * Build context window with rolling message management
 */
export function buildContext(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  limits: Partial<TokenLimits> = {}
): MessageContext {
  const finalLimits = { ...DEFAULT_LIMITS, ...limits };
  
  // Always include system message
  const systemMessage: OpenRouterMessage = {
    role: "system",
    content: systemPrompt,
  };

  const systemTokens = estimateMessageTokens(systemMessage);
  const availableTokens = finalLimits.maxTokens - finalLimits.reserveTokens - systemTokens;

  // If no messages, return just system prompt
  if (messages.length === 0) {
    return {
      messages: [systemMessage],
      totalTokens: systemTokens,
      truncated: false,
    };
  }

  // Start with the most recent messages and work backwards
  const reversedMessages = [...messages].reverse();
  const selectedMessages: OpenRouterMessage[] = [];
  let usedTokens = 0;
  let truncated = false;

  // Always include the latest user message if it exists
  const latestMessage = reversedMessages[0];
  if (latestMessage && latestMessage.role === "user") {
    const tokens = estimateMessageTokens(latestMessage);
    if (tokens <= availableTokens) {
      selectedMessages.unshift(latestMessage);
      usedTokens += tokens;
    } else {
      // If even the latest message is too long, truncate it
      const truncatedContent = truncateText(
        latestMessage.content,
        availableTokens - 10
      );
      selectedMessages.unshift({
        ...latestMessage,
        content: truncatedContent,
      });
      usedTokens += estimateTokens(truncatedContent) + 10;
      truncated = true;
    }
  }

  // Add previous messages in pairs (assistant + user) to maintain context
  for (let i = 1; i < reversedMessages.length; i += 2) {
    const assistantMessage = reversedMessages[i];
    const userMessage = reversedMessages[i + 1];

    if (!assistantMessage || !userMessage) break;

    const assistantTokens = estimateMessageTokens(assistantMessage);
    const userTokens = estimateMessageTokens(userMessage);
    const pairTokens = assistantTokens + userTokens;

    if (usedTokens + pairTokens <= availableTokens && 
        selectedMessages.length + 2 <= finalLimits.maxMessages) {
      selectedMessages.unshift(assistantMessage);
      selectedMessages.unshift(userMessage);
      usedTokens += pairTokens;
    } else {
      truncated = true;
      break;
    }
  }

  // Build final message array
  const finalMessages = [systemMessage, ...selectedMessages];
  const totalTokens = systemTokens + usedTokens;

  return {
    messages: finalMessages,
    totalTokens,
    truncated,
  };
}

/**
 * Get model-specific token limits
 */
export function getModelLimits(model: string): TokenLimits {
  const modelLimits: Record<string, Partial<TokenLimits>> = {
    "gpt-4o": { maxTokens: 120000, reserveTokens: 4000 },
    "gpt-4o-mini": { maxTokens: 120000, reserveTokens: 1500 },
    "gpt-4": { maxTokens: 8000, reserveTokens: 2000 },
    "gpt-3.5-turbo": { maxTokens: 4000, reserveTokens: 1000 },
    "claude-3-sonnet": { maxTokens: 200000, reserveTokens: 4000 },
    "claude-3-haiku": { maxTokens: 200000, reserveTokens: 2000 },
    "llama-2-70b": { maxTokens: 4000, reserveTokens: 1000 },
  };

  return {
    ...DEFAULT_LIMITS,
    ...modelLimits[model],
  };
}

/**
 * Validate that context fits within model limits
 */
export function validateContext(
  context: MessageContext,
  model: string
): { valid: boolean; reason?: string } {
  const limits = getModelLimits(model);
  
  if (context.totalTokens > limits.maxTokens) {
    return {
      valid: false,
      reason: `Context too long: ${context.totalTokens} tokens exceeds ${limits.maxTokens} limit`,
    };
  }

  if (context.messages.length > limits.maxMessages) {
    return {
      valid: false,
      reason: `Too many messages: ${context.messages.length} exceeds ${limits.maxMessages} limit`,
    };
  }

  return { valid: true };
}

/**
 * Build project context system prompt
 */
export function buildSystemPrompt(
  basePrompt: string,
  projectContext?: {
    files?: string[];
    description?: string;
    tech_stack?: string[];
  }
): string {
  let prompt = basePrompt;

  if (projectContext) {
    prompt = `${prompt}\n\n## Project Context\n`;
    
    if (projectContext.description) {
      prompt = `${prompt}Project Description: ${projectContext.description}\n`;
    }
    
    if (projectContext.tech_stack?.length) {
      prompt = `${prompt}Tech Stack: ${projectContext.tech_stack.join(", ")}\n`;
    }
    
    if (projectContext.files?.length) {
      prompt = `${prompt}Relevant Files: ${projectContext.files.slice(0, 10).join(", ")}`;
      if (projectContext.files.length > 10) {
        prompt = `${prompt} (and ${projectContext.files.length - 10} more)`;
      }
    }
  }

  return prompt;
} 