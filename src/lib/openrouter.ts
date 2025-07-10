import { env } from "@/env";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stream?: boolean;
  user?: string;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterError {
  error: {
    type: string;
    message: string;
    code?: string;
  };
}

export class OpenRouterClient {
  private baseUrl = "https://openrouter.ai/api/v1";
  private apiKey: string;

  constructor() {
    this.apiKey = env.OPENROUTER_API_KEY;
  }

  async chat(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    const response = await this.makeRequest("/chat/completions", {
      method: "POST",
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = (await response.json()) as OpenRouterError;
      throw new OpenRouterAPIError(error.error.message, response.status, error.error.code);
    }

    return response.json() as Promise<OpenRouterResponse>;
  }

  private async makeRequest(endpoint: string, options: RequestInit, retries = 2): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://projectgpt.dev", // Replace with your actual domain
        "X-Title": "ProjectGPT",
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, requestOptions);
      
      // Retry on 5xx errors
      if (response.status >= 500 && retries > 0) {
        const delay = 2 ** (2 - retries) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, options, retries - 1);
      }
      
      return response;
    } catch (error) {
      if (retries > 0) {
        const delay = 2 ** (2 - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, options, retries - 1);
      }
      throw error;
    }
  }
}

export class OpenRouterAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "OpenRouterAPIError";
  }
}

// Default configurations for different tiers
export const TIER_CONFIGS = {
  free: {
    requestsPerDay: 100,
    tokensPerDay: 50000,
    burstLimit: 10, // requests per minute
    defaultModel: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 1500,
  },
  pro: {
    requestsPerDay: -1, // unlimited
    tokensPerDay: -1, // unlimited
    burstLimit: 30, // requests per minute
    defaultModel: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 1500,
  },
} as const;

export type UserTier = keyof typeof TIER_CONFIGS; 