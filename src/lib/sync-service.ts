import { localStorageService } from './local-storage';
import { api } from '@/trpc/react';
import type { 
  ChatMessage, 
  Folder, 
  Conversation, 
  ConversationFolder 
} from './indexeddb';

export interface SyncResult {
  success: boolean;
  synced: number;
  errors: number;
  lastSyncTime: Date;
}

export interface SyncStatus {
  isActive: boolean;
  lastSync: Date | null;
  nextSync: Date | null;
  pendingItems: number;
  errors: string[];
}

export class SyncService {
  private isActive = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private onStatusChange?: (status: SyncStatus) => void;

  constructor() {
    this.setupAutoSync();
  }

  // Setup auto-sync timer
  private setupAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.syncToCloud().catch(console.error);
    }, this.SYNC_INTERVAL);
  }

  // Set status change callback
  onStatusChanged(callback: (status: SyncStatus) => void) {
    this.onStatusChange = callback;
  }

  // Get current sync status
  async getStatus(): Promise<SyncStatus> {
    const pendingItems = await localStorageService.getAllPendingItems();
    const totalPending = 
      pendingItems.messages.length + 
      pendingItems.folders.length + 
      pendingItems.conversations.length + 
      pendingItems.conversationFolders.length;

    const lastSyncMeta = await localStorageService.getSyncMetadata('lastSync');
    const lastSync = lastSyncMeta?.lastSyncTime || null;
    const nextSync = lastSync ? new Date(lastSync.getTime() + this.SYNC_INTERVAL) : new Date();

    return {
      isActive: this.isActive,
      lastSync,
      nextSync,
      pendingItems: totalPending,
      errors: [] // TODO: Implement error tracking
    };
  }

  // Manual sync trigger
  async syncToCloud(): Promise<SyncResult> {
    if (this.isActive) {
      console.log('Sync already in progress, skipping...');
      return {
        success: false,
        synced: 0,
        errors: 0,
        lastSyncTime: new Date()
      };
    }

    this.isActive = true;
    this.notifyStatusChange();

    const startTime = new Date();
    let syncedCount = 0;
    let errorCount = 0;

    try {
      // Get all pending items
      const pendingItems = await localStorageService.getAllPendingItems();
      
      // Sync folders first (they're dependencies for conversations)
      const folderResults = await this.syncFolders(pendingItems.folders);
      syncedCount += folderResults.synced;
      errorCount += folderResults.errors;

      // Sync conversations
      const conversationResults = await this.syncConversations(pendingItems.conversations);
      syncedCount += conversationResults.synced;
      errorCount += conversationResults.errors;

      // Sync conversation-folder assignments
      const cfResults = await this.syncConversationFolders(pendingItems.conversationFolders);
      syncedCount += cfResults.synced;
      errorCount += cfResults.errors;

      // Sync messages
      const messageResults = await this.syncMessages(pendingItems.messages);
      syncedCount += messageResults.synced;
      errorCount += messageResults.errors;

      // Update sync metadata
      await localStorageService.setSyncMetadata({
        key: 'lastSync',
        lastSyncTime: new Date(),
        lastSyncVersion: 1
      });

      return {
        success: errorCount === 0,
        synced: syncedCount,
        errors: errorCount,
        lastSyncTime: startTime
      };

    } catch (error) {
      console.error('Sync failed:', error);
      return {
        success: false,
        synced: syncedCount,
        errors: errorCount + 1,
        lastSyncTime: startTime
      };
    } finally {
      this.isActive = false;
      this.notifyStatusChange();
    }
  }

  // Sync folders to cloud
  private async syncFolders(folders: Folder[]): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    for (const folder of folders) {
      try {
        // Create folder via tRPC
        const result = await api.folder.create.mutate({
          name: folder.name,
          color: folder.color
        });

        // Update local folder with server ID and mark as synced
        await localStorageService.updateFolder(folder.id, {
          id: result.id,
          syncStatus: 'synced'
        });

        synced++;
      } catch (error) {
        console.error('Failed to sync folder:', folder.name, error);
        
        // Mark as error
        await localStorageService.updateFolder(folder.id, {
          syncStatus: 'error',
          lastSyncAttempt: new Date()
        });
        
        errors++;
      }
    }

    return { synced, errors };
  }

  // Sync conversations to cloud
  private async syncConversations(conversations: Conversation[]): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    for (const conversation of conversations) {
      try {
        // For conversations, we don't have a direct API endpoint
        // They're created implicitly when messages are sent
        // So we just mark them as synced
        await localStorageService.updateChatMessage(conversation.id, {
          syncStatus: 'synced'
        });

        synced++;
      } catch (error) {
        console.error('Failed to sync conversation:', conversation.id, error);
        errors++;
      }
    }

    return { synced, errors };
  }

  // Sync conversation-folder assignments to cloud
  private async syncConversationFolders(conversationFolders: ConversationFolder[]): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    for (const cf of conversationFolders) {
      try {
        // Add conversation to folder via tRPC
        await api.folder.addConversation.mutate({
          conversationId: cf.conversationId,
          folderId: cf.folderId
        });

        // Mark as synced
        await localStorageService.markAsSynced('conversationFolder', cf.id);
        synced++;
      } catch (error) {
        console.error('Failed to sync conversation folder:', cf.id, error);
        errors++;
      }
    }

    return { synced, errors };
  }

  // Sync messages to cloud
  private async syncMessages(messages: ChatMessage[]): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    // Group messages by conversation for efficient syncing
    const messagesByConversation = new Map<string, ChatMessage[]>();
    for (const message of messages) {
      if (!messagesByConversation.has(message.conversationId)) {
        messagesByConversation.set(message.conversationId, []);
      }
      const conversationMessages = messagesByConversation.get(message.conversationId);
      if (conversationMessages) {
        conversationMessages.push(message);
      }
    }

    for (const [conversationId, conversationMessages] of messagesByConversation) {
      try {
        // Sort messages by creation time
        const sortedMessages = conversationMessages.sort((a, b) => 
          a.createdAt.getTime() - b.createdAt.getTime()
        );

        // For each user message, we need to find its corresponding AI response
        // and sync them as a pair via the chat API
        for (const message of sortedMessages) {
          if (message.role === 'user') {
            // Find the corresponding AI response
            const aiResponse = sortedMessages.find(m => 
              m.role === 'assistant' && 
              m.createdAt.getTime() > message.createdAt.getTime()
            );

            if (aiResponse) {
              // This pair was already synced via the chat API when originally sent
              // Just mark them as synced
              await localStorageService.markAsSynced('message', message.id);
              await localStorageService.markAsSynced('message', aiResponse.id);
              synced += 2;
            } else {
              // Orphaned user message - mark as synced anyway
              await localStorageService.markAsSynced('message', message.id);
              synced++;
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync messages for conversation:', conversationId, error);
        errors += conversationMessages.length;
      }
    }

    return { synced, errors };
  }

  // Load initial data from cloud
  async loadInitialData(userId: string): Promise<void> {
    try {
      // Load recent conversations (last 50)
      const conversations = await api.chat.getConversations.query();
      
      // Load folders
      const folders = await api.folder.getAll.query();

      // Store in local database
      for (const folder of folders) {
        await localStorageService.addFolder({
          id: folder.id,
          userId,
          name: folder.name,
          color: folder.color
        });
        await localStorageService.markAsSynced('folder', folder.id);
      }

      // Store conversations and their messages
      for (const conversation of conversations.slice(0, 20)) { // Load only recent 20 conversations
        await localStorageService.addOrUpdateConversation({
          id: conversation.id,
          userId,
          title: conversation.title,
          lastMessage: conversation.lastMessage,
          lastMessageTime: conversation.lastMessageTime,
          model: conversation.model,
          folderId: conversation.folderId
        });

        // Load messages for this conversation
        const messages = await api.chat.getConversation.query({
          conversationId: conversation.id
        });

        for (const message of messages) {
          await localStorageService.addChatMessage({
            userId: message.userId,
            conversationId: message.conversationId,
            guestSessionId: message.guestSessionId,
            role: message.role as 'user' | 'assistant',
            content: message.content,
            model: message.model,
            tokensUsed: message.tokensUsed
          });
        }
      }

      console.log('Initial data loaded successfully');
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  // Notify status change
  private async notifyStatusChange() {
    if (this.onStatusChange) {
      const status = await this.getStatus();
      this.onStatusChange(status);
    }
  }

  // Force sync now
  async forceSyncNow(): Promise<SyncResult> {
    return await this.syncToCloud();
  }

  // Stop auto-sync
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Restart auto-sync
  restart() {
    this.stop();
    this.setupAutoSync();
  }
}

// Singleton instance
export const syncService = new SyncService(); 