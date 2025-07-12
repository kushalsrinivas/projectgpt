import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { folders, conversationFolders, chatMessages } from "@/server/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

export const folderRouter = createTRPCRouter({
  // Create a new folder
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(30),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Check if folder name already exists for this user
      const existingFolder = await ctx.db.query.folders.findFirst({
        where: and(
          eq(folders.userId, userId),
          eq(folders.name, input.name)
        ),
      });

      if (existingFolder) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A folder with this name already exists.",
        });
      }

      const [newFolder] = await ctx.db.insert(folders).values({
        userId,
        name: input.name,
        color: input.color || "#6366f1",
      }).returning();

      return newFolder;
    }),

  // Get all folders for the current user
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      
      const userFolders = await ctx.db.query.folders.findMany({
        where: eq(folders.userId, userId),
        orderBy: [desc(folders.createdAt)],
        with: {
          conversationFolders: true,
        },
      });

      // Count conversations in each folder
      const foldersWithCounts = await Promise.all(
        userFolders.map(async (folder) => {
          const conversationCount = await ctx.db
            .select({ count: chatMessages.conversationId })
            .from(conversationFolders)
            .leftJoin(chatMessages, eq(conversationFolders.conversationId, chatMessages.conversationId))
            .where(and(
              eq(conversationFolders.folderId, folder.id),
              eq(conversationFolders.userId, userId)
            ))
            .groupBy(chatMessages.conversationId)
            .then(results => results.length);

          return {
            ...folder,
            conversationCount,
          };
        })
      );

      return foldersWithCounts;
    }),

  // Update folder (rename or change color)
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(30).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify folder ownership
      const folder = await ctx.db.query.folders.findFirst({
        where: and(
          eq(folders.id, input.id),
          eq(folders.userId, userId)
        ),
      });

      if (!folder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Folder not found.",
        });
      }

      // Check for name conflicts if renaming
      if (input.name && input.name !== folder.name) {
        const existingFolder = await ctx.db.query.folders.findFirst({
          where: and(
            eq(folders.userId, userId),
            eq(folders.name, input.name)
          ),
        });

        if (existingFolder) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A folder with this name already exists.",
          });
        }
      }

      const updateData: Partial<typeof folders.$inferInsert> = {};
      if (input.name) updateData.name = input.name;
      if (input.color) updateData.color = input.color;

      const [updatedFolder] = await ctx.db
        .update(folders)
        .set(updateData)
        .where(and(
          eq(folders.id, input.id),
          eq(folders.userId, userId)
        ))
        .returning();

      return updatedFolder;
    }),

  // Delete folder
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify folder ownership
      const folder = await ctx.db.query.folders.findFirst({
        where: and(
          eq(folders.id, input.id),
          eq(folders.userId, userId)
        ),
      });

      if (!folder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Folder not found.",
        });
      }

      // Delete folder (cascade will handle conversation_folder entries)
      await ctx.db.delete(folders).where(and(
        eq(folders.id, input.id),
        eq(folders.userId, userId)
      ));

      return { success: true };
    }),

  // Add conversation to folder
  addConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        folderId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify folder ownership
      const folder = await ctx.db.query.folders.findFirst({
        where: and(
          eq(folders.id, input.folderId),
          eq(folders.userId, userId)
        ),
      });

      if (!folder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Folder not found.",
        });
      }

      // Verify conversation ownership
      const conversation = await ctx.db.query.chatMessages.findFirst({
        where: and(
          eq(chatMessages.conversationId, input.conversationId),
          eq(chatMessages.userId, userId)
        ),
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found.",
        });
      }

      // Remove conversation from any existing folder first
      await ctx.db.delete(conversationFolders).where(and(
        eq(conversationFolders.conversationId, input.conversationId),
        eq(conversationFolders.userId, userId)
      ));

      // Add to new folder
      const [assignment] = await ctx.db.insert(conversationFolders).values({
        conversationId: input.conversationId,
        folderId: input.folderId,
        userId,
      }).returning();

      return assignment;
    }),

  // Remove conversation from folder
  removeConversation: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await ctx.db.delete(conversationFolders).where(and(
        eq(conversationFolders.conversationId, input.conversationId),
        eq(conversationFolders.userId, userId)
      ));

      return { success: true };
    }),

  // Get conversations in a specific folder
  getConversations: protectedProcedure
    .input(z.object({ folderId: z.number() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify folder ownership
      const folder = await ctx.db.query.folders.findFirst({
        where: and(
          eq(folders.id, input.folderId),
          eq(folders.userId, userId)
        ),
      });

      if (!folder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Folder not found.",
        });
      }

      // Get conversation IDs in this folder
      const folderConversations = await ctx.db.query.conversationFolders.findMany({
        where: and(
          eq(conversationFolders.folderId, input.folderId),
          eq(conversationFolders.userId, userId)
        ),
      });

      const conversationIds = folderConversations.map(fc => fc.conversationId);

      if (conversationIds.length === 0) {
        return [];
      }

      // Get all messages for these conversations
      const messages = await ctx.db.query.chatMessages.findMany({
        where: and(
          eq(chatMessages.userId, userId),
          inArray(chatMessages.conversationId, conversationIds)
        ),
        orderBy: [desc(chatMessages.createdAt)],
      });

      // Group by conversation ID and get the latest message for each
      const conversationMap = new Map();
      
      for (const message of messages) {
        if (!conversationMap.has(message.conversationId)) {
          conversationMap.set(message.conversationId, {
            id: message.conversationId,
            title: message.role === "user" 
              ? message.content.slice(0, 50) + (message.content.length > 50 ? "..." : "")
              : "New Conversation",
            lastMessage: message.content,
            lastMessageTime: message.createdAt,
            model: message.model,
            folderId: input.folderId,
          });
        }
      }

      return Array.from(conversationMap.values())
        .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    }),

  // Move multiple conversations to a folder
  moveConversations: protectedProcedure
    .input(
      z.object({
        conversationIds: z.array(z.string()),
        folderId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify folder ownership
      const folder = await ctx.db.query.folders.findFirst({
        where: and(
          eq(folders.id, input.folderId),
          eq(folders.userId, userId)
        ),
      });

      if (!folder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Folder not found.",
        });
      }

      // Verify all conversations belong to the user
      const conversations = await ctx.db.query.chatMessages.findMany({
        where: and(
          eq(chatMessages.userId, userId),
          inArray(chatMessages.conversationId, input.conversationIds)
        ),
      });

      const validConversationIds = [...new Set(conversations.map(c => c.conversationId))];

      if (validConversationIds.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No valid conversations found.",
        });
      }

      // Remove conversations from any existing folders
      await ctx.db.delete(conversationFolders).where(and(
        inArray(conversationFolders.conversationId, validConversationIds),
        eq(conversationFolders.userId, userId)
      ));

      // Add to new folder
      const assignments = await ctx.db.insert(conversationFolders).values(
        validConversationIds.map(conversationId => ({
          conversationId,
          folderId: input.folderId,
          userId,
        }))
      ).returning();

      return {
        success: true,
        movedCount: assignments.length,
      };
    }),
}); 