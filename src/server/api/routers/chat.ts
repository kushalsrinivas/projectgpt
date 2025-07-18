import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { chatMessages, users, conversationFolders } from "@/server/db/schema";
import { TIER_CONFIGS } from "@/lib/openrouter";
import { rateLimiter } from "@/lib/rate-limiter";
import { eq, desc, and } from "drizzle-orm";

export const chatRouter = createTRPCRouter({
  // Legacy endpoint - deprecated in favor of streaming API at /api/chat
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
    .mutation(async () => {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "This endpoint is deprecated. Please use the streaming API at /api/chat for better performance.",
      });
    }),

  // Legacy endpoint - deprecated in favor of streaming API at /api/chat
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
    .mutation(async () => {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "This endpoint is deprecated. Please use the streaming API at /api/chat for better performance.",
      });
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