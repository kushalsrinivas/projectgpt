import { db } from "@/server/db";
import { userQuotas, users } from "@/server/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { TIER_CONFIGS, type UserTier } from "./openrouter";

export interface RateLimitResult {
  allowed: boolean;
  remaining: {
    requests: number;
    tokens: number;
  };
  resetTime: Date;
  tier: UserTier;
}

export interface RateLimitError {
  type: "rate_limit_exceeded";
  message: string;
  tier: UserTier;
  resetTime: Date;
}

export class RateLimiter {
  /**
   * Check if a user can make a request and consume tokens
   */
  async checkAndConsume(
    userId: string,
    tokensToConsume = 0
  ): Promise<RateLimitResult> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        quota: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const tier = (user.tier as UserTier) || "free";
    const config = TIER_CONFIGS[tier];

    // Get or create user quota
    let quota = user.quota;
    if (!quota) {
      quota = await this.createUserQuota(userId);
    }

    // Check if quota needs to be reset (daily reset)
    const now = new Date();
    const lastReset = new Date(quota.lastReset);
    const shouldReset = now.getTime() - lastReset.getTime() >= 24 * 60 * 60 * 1000; // 24 hours

    if (shouldReset) {
      quota = await this.resetUserQuota(userId);
    }

    // Check limits for free tier
    if (tier === "free") {
      const requestsRemaining = config.requestsPerDay - quota.requestsUsed;
      const tokensRemaining = config.tokensPerDay - quota.tokensUsed;

      if (requestsRemaining <= 0) {
        return {
          allowed: false,
          remaining: {
            requests: 0,
            tokens: Math.max(0, tokensRemaining),
          },
          resetTime: new Date(lastReset.getTime() + 24 * 60 * 60 * 1000),
          tier,
        };
      }

      if (tokensToConsume > 0 && tokensRemaining < tokensToConsume) {
        return {
          allowed: false,
          remaining: {
            requests: requestsRemaining,
            tokens: Math.max(0, tokensRemaining),
          },
          resetTime: new Date(lastReset.getTime() + 24 * 60 * 60 * 1000),
          tier,
        };
      }
    }

    // Consume the quota
    await this.consumeQuota(userId, 1, tokensToConsume);

    // Calculate remaining quota
    const updatedQuota = await db.query.userQuotas.findFirst({
      where: eq(userQuotas.userId, userId),
    });

    const remaining = tier === "free" && updatedQuota ? {
      requests: Math.max(0, config.requestsPerDay - updatedQuota.requestsUsed),
      tokens: Math.max(0, config.tokensPerDay - updatedQuota.tokensUsed),
    } : {
      requests: -1, // unlimited
      tokens: -1, // unlimited
    };

    return {
      allowed: true,
      remaining,
      resetTime: new Date(quota.lastReset.getTime() + 24 * 60 * 60 * 1000),
      tier,
    };
  }

  /**
   * Check burst limits (requests per minute)
   */
  async checkBurstLimit(userId: string): Promise<boolean> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return false;
    }

    const tier = (user.tier as UserTier) || "free";
    const config = TIER_CONFIGS[tier];

    // Count requests in the last minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    
    const recentRequests = await db.query.chatMessages.findMany({
      where: and(
        eq(userQuotas.userId, userId),
        gte(userQuotas.updatedAt, oneMinuteAgo)
      ),
    });

    return recentRequests.length < config.burstLimit;
  }

  /**
   * Create initial quota for a user
   */
  private async createUserQuota(userId: string) {
    const [quota] = await db.insert(userQuotas).values({
      userId,
      requestsUsed: 0,
      tokensUsed: 0,
      lastReset: new Date(),
    }).returning();

    if (!quota) {
      throw new Error("Failed to create user quota");
    }

    return quota;
  }

  /**
   * Reset user quota (daily reset)
   */
  private async resetUserQuota(userId: string) {
    const [quota] = await db.update(userQuotas)
      .set({
        requestsUsed: 0,
        tokensUsed: 0,
        lastReset: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userQuotas.userId, userId))
      .returning();

    if (!quota) {
      throw new Error("Failed to reset user quota");
    }

    return quota;
  }

  /**
   * Consume quota for a user
   */
  private async consumeQuota(userId: string, requests: number, tokens: number) {
    await db.update(userQuotas)
      .set({
        requestsUsed: userQuotas.requestsUsed + requests,
        tokensUsed: userQuotas.tokensUsed + tokens,
        updatedAt: new Date(),
      })
      .where(eq(userQuotas.userId, userId));
  }

  /**
   * Get user's current quota status
   */
  async getQuotaStatus(userId: string): Promise<RateLimitResult> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        quota: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const tier = (user.tier as UserTier) || "free";
    const config = TIER_CONFIGS[tier];
    const quota = user.quota;

    if (!quota) {
      return {
        allowed: true,
        remaining: {
          requests: tier === "free" ? config.requestsPerDay : -1,
          tokens: tier === "free" ? config.tokensPerDay : -1,
        },
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        tier,
      };
    }

    const remaining = tier === "free" ? {
      requests: Math.max(0, config.requestsPerDay - quota.requestsUsed),
      tokens: Math.max(0, config.tokensPerDay - quota.tokensUsed),
    } : {
      requests: -1,
      tokens: -1,
    };

    return {
      allowed: true,
      remaining,
      resetTime: new Date(quota.lastReset.getTime() + 24 * 60 * 60 * 1000),
      tier,
    };
  }

  /**
   * Add bonus credits (e.g., from watching ads)
   */
  async addBonusCredits(userId: string, requests = 10) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        quota: true,
      },
    });

    if (!user || user.tier !== "free") {
      return; // Only free users can get bonus credits
    }

    let quota = user.quota;
    if (!quota) {
      quota = await this.createUserQuota(userId);
    }

    // Reduce used requests to effectively add credits
    await db.update(userQuotas)
      .set({
        requestsUsed: Math.max(0, quota.requestsUsed - requests),
        updatedAt: new Date(),
      })
      .where(eq(userQuotas.userId, userId));
  }
}

export const rateLimiter = new RateLimiter(); 