import { localStorageService } from './local-storage';
import { syncService } from './sync-service';
import { api } from '@/trpc/react';
import { isIndexedDBAvailable } from './indexeddb';
import type { ChatMessage, Folder, Conversation } from './indexeddb';

// Type definitions for local-first operations
export interface LocalFirstChatMessage {
  id: string;
  userId: string | null;
  conversationId: string;
  guestSessionId?: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  tokensUsed: number;
  createdAt: Date;
  isLocal?: boolean;
}

export interface LocalFirstFolder {
  id: number;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  conversationCount?: number;
  isLocal?: boolean;
}

export interface LocalFirstConversation {
  id: string;
  userId: string;
  title: string;
  lastMessage: string;
  lastMessageTime: Date;
  model?: string;
  folderId?: number | null;
  isLocal?: boolean;
}

export class LocalFirstTRPC {
  private fallbackToCloud = false;

  constructor() {
    this.fallbackToCloud = !isIndexedDBAvailable();
  }

  // Chat operations
  async sendMessage(input: {
    message: string;
    model: string;
    conversationId: string;
    temperature?: number;
    maxTokens?: number;
    guestSessionId?: string;
  }): Promise<LocalFirstChatMessage> {
    if (this.fallbackToCloud) {
      // Fall back to non-streaming API call
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: input.message }],
          model: input.model,
          conversationId: input.conversationId,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          guestSessionId: input.guestSessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      return {
        id: Date.now().toString(),
        userId: 'current-user',
        conversationId: input.conversationId,
        role: 'assistant',
        content: result.message,
        model: result.model,
        tokensUsed: result.tokensUsed || 0,
        createdAt: new Date(),
        isLocal: false
      };
    }

    // Add user message to local storage immediately
    const userMessage = await localStorageService.addChatMessage({
      userId: 'current-user',
      conversationId: input.conversationId,
      role: 'user',
      content: input.message,
      model: input.model,
      tokensUsed: 0
    });

    // Update conversation metadata
    await localStorageService.addOrUpdateConversation({
      id: input.conversationId,
      userId: 'current-user',
      title: input.message.slice(0, 50) + (input.message.length > 50 ? '...' : ''),
      lastMessage: input.message,
      lastMessageTime: new Date(),
      model: input.model
    });

    // Queue cloud sync in background
    this.queueCloudSync(async () => {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: input.message }],
            model: input.model,
            conversationId: input.conversationId,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            guestSessionId: input.guestSessionId,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // Add AI response to local storage
        const aiMessage = await localStorageService.addChatMessage({
          userId: 'current-user',
          conversationId: input.conversationId,
          role: 'assistant',
          content: result.message,
          model: result.model,
          tokensUsed: result.tokensUsed || 0
        });

        // Update conversation with AI response
        await localStorageService.addOrUpdateConversation({
          id: input.conversationId,
          userId: 'current-user',
          title: input.message.slice(0, 50) + (input.message.length > 50 ? '...' : ''),
          lastMessage: result.message,
          lastMessageTime: new Date(),
          model: result.model
        });

        // Mark both messages as synced
        await localStorageService.markAsSynced('message', userMessage.id);
        await localStorageService.markAsSynced('message', aiMessage.id);

        return aiMessage;
      } catch (error) {
        console.error('Failed to sync message to cloud:', error);
        throw error;
      }
    });

    return {
      ...userMessage,
      isLocal: true
    };
  }

  async getConversationMessages(conversationId: string): Promise<LocalFirstChatMessage[]> {
    if (this.fallbackToCloud) {
      const messages = await api.chat.getConversation.query({ conversationId });
      return messages.map(msg => ({
        id: String(msg.id),
        userId: msg.userId,
        conversationId: msg.conversationId,
        guestSessionId: msg.guestSessionId,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        model: msg.model,
        tokensUsed: msg.tokensUsed,
        createdAt: new Date(msg.createdAt),
        isLocal: false
      }));
    }

    const messages = await localStorageService.getChatMessages(conversationId);
    return messages.map(msg => ({
      ...msg,
      isLocal: msg.syncStatus === 'pending'
    }));
  }

  async getConversations(folderId?: number): Promise<LocalFirstConversation[]> {
    if (this.fallbackToCloud) {
      const conversations = await api.chat.getConversations.query(
        folderId ? { folderId } : undefined
      );
      return conversations.map(conv => ({
        ...conv,
        isLocal: false
      }));
    }

    const userId = 'current-user'; // This should come from session
    let conversations: Conversation[];
    
    if (folderId) {
      conversations = await localStorageService.getConversationsByFolder(folderId, userId);
    } else {
      conversations = await localStorageService.getConversations(userId);
    }

    return conversations.map(conv => ({
      ...conv,
      isLocal: conv.syncStatus === 'pending'
    }));
  }

  // Folder operations
  async createFolder(input: { name: string; color?: string }): Promise<LocalFirstFolder> {
    if (this.fallbackToCloud) {
      const result = await api.folder.create.mutate(input);
      return {
        ...result,
        conversationCount: 0,
        isLocal: false
      };
    }

    // Add to local storage immediately
    const folder = await localStorageService.addFolder({
      id: Date.now(), // Temporary ID
      userId: 'current-user',
      name: input.name,
      color: input.color || '#6366f1'
    });

    // Queue cloud sync
    this.queueCloudSync(async () => {
      try {
        const result = await api.folder.create.mutate(input);
        
        // Update local folder with server ID
        await localStorageService.updateFolder(folder.id, {
          id: result.id,
          syncStatus: 'synced'
        });

        return result;
      } catch (error) {
        console.error('Failed to sync folder to cloud:', error);
        throw error;
      }
    });

    return {
      ...folder,
      conversationCount: 0,
      isLocal: true
    };
  }

  async updateFolder(input: { id: number; name?: string; color?: string }): Promise<void> {
    if (this.fallbackToCloud) {
      await api.folder.update.mutate(input);
      return;
    }

    // Update local storage immediately
    await localStorageService.updateFolder(input.id, {
      name: input.name,
      color: input.color,
      syncStatus: 'pending'
    });

    // Queue cloud sync
    this.queueCloudSync(async () => {
      try {
        await api.folder.update.mutate(input);
        await localStorageService.markAsSynced('folder', input.id);
      } catch (error) {
        console.error('Failed to sync folder update to cloud:', error);
        throw error;
      }
    });
  }

  async deleteFolder(id: number): Promise<void> {
    if (this.fallbackToCloud) {
      await api.folder.delete.mutate({ id });
      return;
    }

    // Delete from local storage immediately
    await localStorageService.deleteFolder(id);

    // Queue cloud sync
    this.queueCloudSync(async () => {
      try {
        await api.folder.delete.mutate({ id });
      } catch (error) {
        console.error('Failed to sync folder deletion to cloud:', error);
        throw error;
      }
    });
  }

  async getFolders(): Promise<LocalFirstFolder[]> {
    if (this.fallbackToCloud) {
      const folders = await api.folder.getAll.query();
      return folders.map(folder => ({
        ...folder,
        isLocal: false
      }));
    }

    const userId = 'current-user'; // This should come from session
    const folders = await localStorageService.getFolders(userId);
    
    return folders.map(folder => ({
      ...folder,
      conversationCount: 0, // TODO: Calculate this
      isLocal: folder.syncStatus === 'pending'
    }));
  }

  // Conversation-folder operations
  async addConversationToFolder(input: { conversationId: string; folderId: number }): Promise<void> {
    if (this.fallbackToCloud) {
      await api.folder.addConversation.mutate(input);
      return;
    }

    const userId = 'current-user'; // This should come from session
    
    // Update local storage immediately
    await localStorageService.addConversationToFolder(
      input.conversationId,
      input.folderId,
      userId
    );

    // Update conversation metadata
    await localStorageService.addOrUpdateConversation({
      id: input.conversationId,
      userId,
      title: 'Conversation', // This should be fetched from existing data
      lastMessage: '',
      lastMessageTime: new Date(),
      folderId: input.folderId
    });

    // Queue cloud sync
    this.queueCloudSync(async () => {
      try {
        await api.folder.addConversation.mutate(input);
        // Mark as synced
        const cfId = `${input.conversationId}-${input.folderId}`;
        await localStorageService.markAsSynced('conversationFolder', cfId);
      } catch (error) {
        console.error('Failed to sync conversation folder assignment to cloud:', error);
        throw error;
      }
    });
  }

  async removeConversationFromFolder(conversationId: string): Promise<void> {
    if (this.fallbackToCloud) {
      await api.folder.removeConversation.mutate({ conversationId });
      return;
    }

    const userId = 'current-user'; // This should come from session
    
    // Update local storage immediately
    await localStorageService.removeConversationFromFolder(conversationId, userId);

    // Update conversation metadata
    await localStorageService.addOrUpdateConversation({
      id: conversationId,
      userId,
      title: 'Conversation',
      lastMessage: '',
      lastMessageTime: new Date(),
      folderId: undefined
    });

    // Queue cloud sync
    this.queueCloudSync(async () => {
      try {
        await api.folder.removeConversation.mutate({ conversationId });
      } catch (error) {
        console.error('Failed to sync conversation folder removal to cloud:', error);
        throw error;
      }
    });
  }

  // Utility methods
  private queueCloudSync(syncFn: () => Promise<unknown>): void {
    // Execute sync function in background
    setTimeout(async () => {
      try {
        await syncFn();
      } catch (error) {
        console.error('Background sync failed:', error);
        // The sync service will retry this later
      }
    }, 0);
  }

  // Get sync status
  async getSyncStatus() {
    return await syncService.getStatus();
  }

  // Force sync now
  async forceSyncNow() {
    return await syncService.forceSyncNow();
  }

  // Load initial data
  async loadInitialData(userId: string) {
    if (this.fallbackToCloud) {
      return; // No need to load initial data when using cloud directly
    }

    return await syncService.loadInitialData(userId);
  }
}

// Singleton instance
export const localFirstTRPC = new LocalFirstTRPC(); 