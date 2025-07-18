import { 
  getDB, 
  isIndexedDBAvailable, 
  generateConversationFolderId,
  type ChatMessage,
  type Folder,
  type ConversationFolder,
  type Conversation,
  type UserPreferences,
  type SyncMetadata
} from './indexeddb';

export class LocalStorageService {
  private fallbackToMemory = false;
  private memoryStore: Map<string, unknown> = new Map();

  constructor() {
    if (!isIndexedDBAvailable()) {
      console.warn('IndexedDB not available, falling back to memory storage');
      this.fallbackToMemory = true;
    }
  }

  // Chat Messages
  async getChatMessages(conversationId: string): Promise<ChatMessage[]> {
    if (this.fallbackToMemory) {
      const key = `messages-${conversationId}`;
      return (this.memoryStore.get(key) as ChatMessage[]) || [];
    }

    try {
      const db = await getDB();
      const messages = await db.getAllFromIndex('chatMessages', 'by-conversation', conversationId);
      return messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } catch (error) {
      console.error('Error getting chat messages:', error);
      return [];
    }
  }

  async addChatMessage(message: Omit<ChatMessage, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>): Promise<ChatMessage> {
    const now = new Date();
    const chatMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending'
    };

    if (this.fallbackToMemory) {
      const key = `messages-${message.conversationId}`;
      const existing = (this.memoryStore.get(key) as ChatMessage[]) || [];
      this.memoryStore.set(key, [...existing, chatMessage]);
      return chatMessage;
    }

    try {
      const db = await getDB();
      await db.add('chatMessages', chatMessage);
      return chatMessage;
    } catch (error) {
      console.error('Error adding chat message:', error);
      throw error;
    }
  }

  async updateChatMessage(id: string, updates: Partial<ChatMessage>): Promise<void> {
    if (this.fallbackToMemory) {
      // Find and update in memory store
      for (const [key, value] of this.memoryStore.entries()) {
        if (key.startsWith('messages-') && Array.isArray(value)) {
          const messages = value as ChatMessage[];
          const index = messages.findIndex(m => m.id === id);
          if (index !== -1) {
            messages[index] = { ...messages[index], ...updates, updatedAt: new Date() };
            break;
          }
        }
      }
      return;
    }

    try {
      const db = await getDB();
      const existing = await db.get('chatMessages', id);
      if (existing) {
        const updated = { ...existing, ...updates, updatedAt: new Date() };
        await db.put('chatMessages', updated);
      }
    } catch (error) {
      console.error('Error updating chat message:', error);
      throw error;
    }
  }

  async getPendingChatMessages(): Promise<ChatMessage[]> {
    if (this.fallbackToMemory) {
      const pending: ChatMessage[] = [];
      for (const [key, value] of this.memoryStore.entries()) {
        if (key.startsWith('messages-') && Array.isArray(value)) {
          const messages = value as ChatMessage[];
          pending.push(...messages.filter(m => m.syncStatus === 'pending'));
        }
      }
      return pending;
    }

    try {
      const db = await getDB();
      return await db.getAllFromIndex('chatMessages', 'by-sync-status', 'pending');
    } catch (error) {
      console.error('Error getting pending chat messages:', error);
      return [];
    }
  }

  // Folders
  async getFolders(userId: string): Promise<Folder[]> {
    if (this.fallbackToMemory) {
      const key = `folders-${userId}`;
      return (this.memoryStore.get(key) as Folder[]) || [];
    }

    try {
      const db = await getDB();
      return await db.getAllFromIndex('folders', 'by-user', userId);
    } catch (error) {
      console.error('Error getting folders:', error);
      return [];
    }
  }

  async addFolder(folder: Omit<Folder, 'createdAt' | 'updatedAt' | 'syncStatus'>): Promise<Folder> {
    const now = new Date();
    const newFolder: Folder = {
      ...folder,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending'
    };

    if (this.fallbackToMemory) {
      const key = `folders-${folder.userId}`;
      const existing = (this.memoryStore.get(key) as Folder[]) || [];
      this.memoryStore.set(key, [...existing, newFolder]);
      return newFolder;
    }

    try {
      const db = await getDB();
      await db.add('folders', newFolder);
      return newFolder;
    } catch (error) {
      console.error('Error adding folder:', error);
      throw error;
    }
  }

  async updateFolder(id: number, updates: Partial<Folder>): Promise<void> {
    if (this.fallbackToMemory) {
      for (const [key, value] of this.memoryStore.entries()) {
        if (key.startsWith('folders-') && Array.isArray(value)) {
          const folders = value as Folder[];
          const index = folders.findIndex(f => f.id === id);
          if (index !== -1) {
            folders[index] = { ...folders[index], ...updates, updatedAt: new Date() };
            break;
          }
        }
      }
      return;
    }

    try {
      const db = await getDB();
      const existing = await db.get('folders', id);
      if (existing) {
        const updated = { ...existing, ...updates, updatedAt: new Date() };
        await db.put('folders', updated);
      }
    } catch (error) {
      console.error('Error updating folder:', error);
      throw error;
    }
  }

  async deleteFolder(id: number): Promise<void> {
    if (this.fallbackToMemory) {
      for (const [key, value] of this.memoryStore.entries()) {
        if (key.startsWith('folders-') && Array.isArray(value)) {
          const folders = value as Folder[];
          const index = folders.findIndex(f => f.id === id);
          if (index !== -1) {
            folders.splice(index, 1);
            break;
          }
        }
      }
      return;
    }

    try {
      const db = await getDB();
      await db.delete('folders', id);
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  }

  async getPendingFolders(): Promise<Folder[]> {
    if (this.fallbackToMemory) {
      const pending: Folder[] = [];
      for (const [key, value] of this.memoryStore.entries()) {
        if (key.startsWith('folders-') && Array.isArray(value)) {
          const folders = value as Folder[];
          pending.push(...folders.filter(f => f.syncStatus === 'pending'));
        }
      }
      return pending;
    }

    try {
      const db = await getDB();
      return await db.getAllFromIndex('folders', 'by-sync-status', 'pending');
    } catch (error) {
      console.error('Error getting pending folders:', error);
      return [];
    }
  }

  // Conversation Folders
  async getConversationFolders(userId: string): Promise<ConversationFolder[]> {
    if (this.fallbackToMemory) {
      const key = `conversation-folders-${userId}`;
      return (this.memoryStore.get(key) as ConversationFolder[]) || [];
    }

    try {
      const db = await getDB();
      return await db.getAllFromIndex('conversationFolders', 'by-user', userId);
    } catch (error) {
      console.error('Error getting conversation folders:', error);
      return [];
    }
  }

  async addConversationToFolder(conversationId: string, folderId: number, userId: string): Promise<ConversationFolder> {
    const id = generateConversationFolderId(conversationId, folderId);
    const conversationFolder: ConversationFolder = {
      id,
      conversationId,
      folderId,
      userId,
      createdAt: new Date(),
      syncStatus: 'pending'
    };

    if (this.fallbackToMemory) {
      const key = `conversation-folders-${userId}`;
      const existing = (this.memoryStore.get(key) as ConversationFolder[]) || [];
      // Remove existing assignment for this conversation
      const filtered = existing.filter(cf => cf.conversationId !== conversationId);
      this.memoryStore.set(key, [...filtered, conversationFolder]);
      return conversationFolder;
    }

    try {
      const db = await getDB();
      // Remove existing assignment for this conversation
      const existing = await db.getAllFromIndex('conversationFolders', 'by-conversation', conversationId);
      for (const cf of existing) {
        if (cf.userId === userId) {
          await db.delete('conversationFolders', cf.id);
        }
      }
      await db.add('conversationFolders', conversationFolder);
      return conversationFolder;
    } catch (error) {
      console.error('Error adding conversation to folder:', error);
      throw error;
    }
  }

  async removeConversationFromFolder(conversationId: string, userId: string): Promise<void> {
    if (this.fallbackToMemory) {
      const key = `conversation-folders-${userId}`;
      const existing = (this.memoryStore.get(key) as ConversationFolder[]) || [];
      const filtered = existing.filter(cf => cf.conversationId !== conversationId);
      this.memoryStore.set(key, filtered);
      return;
    }

    try {
      const db = await getDB();
      const existing = await db.getAllFromIndex('conversationFolders', 'by-conversation', conversationId);
      for (const cf of existing) {
        if (cf.userId === userId) {
          await db.delete('conversationFolders', cf.id);
        }
      }
    } catch (error) {
      console.error('Error removing conversation from folder:', error);
      throw error;
    }
  }

  async getPendingConversationFolders(): Promise<ConversationFolder[]> {
    if (this.fallbackToMemory) {
      const pending: ConversationFolder[] = [];
      for (const [key, value] of this.memoryStore.entries()) {
        if (key.startsWith('conversation-folders-') && Array.isArray(value)) {
          const cfs = value as ConversationFolder[];
          pending.push(...cfs.filter(cf => cf.syncStatus === 'pending'));
        }
      }
      return pending;
    }

    try {
      const db = await getDB();
      return await db.getAllFromIndex('conversationFolders', 'by-sync-status', 'pending');
    } catch (error) {
      console.error('Error getting pending conversation folders:', error);
      return [];
    }
  }

  // Conversations
  async getConversations(userId: string): Promise<Conversation[]> {
    if (this.fallbackToMemory) {
      const key = `conversations-${userId}`;
      const conversations = (this.memoryStore.get(key) as Conversation[]) || [];
      return conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    try {
      const db = await getDB();
      const conversations = await db.getAllFromIndex('conversations', 'by-user', userId);
      return conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  }

  async getConversationsByFolder(folderId: number, userId: string): Promise<Conversation[]> {
    if (this.fallbackToMemory) {
      const key = `conversations-${userId}`;
      const conversations = (this.memoryStore.get(key) as Conversation[]) || [];
      return conversations
        .filter(c => c.folderId === folderId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    try {
      const db = await getDB();
      const conversations = await db.getAllFromIndex('conversations', 'by-folder', folderId);
      return conversations
        .filter(c => c.userId === userId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Error getting conversations by folder:', error);
      return [];
    }
  }

  async addOrUpdateConversation(conversation: Omit<Conversation, 'createdAt' | 'updatedAt' | 'syncStatus'>): Promise<Conversation> {
    const now = new Date();
    
    if (this.fallbackToMemory) {
      const key = `conversations-${conversation.userId}`;
      const existing = (this.memoryStore.get(key) as Conversation[]) || [];
      const index = existing.findIndex(c => c.id === conversation.id);
      
      if (index !== -1) {
        existing[index] = { ...existing[index], ...conversation, updatedAt: now };
        return existing[index];
      }
      
      const newConversation: Conversation = {
        ...conversation,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending'
      };
      existing.push(newConversation);
      this.memoryStore.set(key, existing);
      return newConversation;
    }

    try {
      const db = await getDB();
      const existing = await db.get('conversations', conversation.id);
      
      if (existing) {
        const updated = { ...existing, ...conversation, updatedAt: now };
        await db.put('conversations', updated);
        return updated;
      }
      
      const newConversation: Conversation = {
        ...conversation,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending'
      };
      await db.add('conversations', newConversation);
      return newConversation;
    } catch (error) {
      console.error('Error adding/updating conversation:', error);
      throw error;
    }
  }

  async getPendingConversations(): Promise<Conversation[]> {
    if (this.fallbackToMemory) {
      const pending: Conversation[] = [];
      for (const [key, value] of this.memoryStore.entries()) {
        if (key.startsWith('conversations-') && Array.isArray(value)) {
          const conversations = value as Conversation[];
          pending.push(...conversations.filter(c => c.syncStatus === 'pending'));
        }
      }
      return pending;
    }

    try {
      const db = await getDB();
      return await db.getAllFromIndex('conversations', 'by-sync-status', 'pending');
    } catch (error) {
      console.error('Error getting pending conversations:', error);
      return [];
    }
  }

  // User Preferences
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    if (this.fallbackToMemory) {
      const key = `preferences-${userId}`;
      return (this.memoryStore.get(key) as UserPreferences) || null;
    }

    try {
      const db = await getDB();
      return await db.get('userPreferences', userId);
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return null;
    }
  }

  async setUserPreferences(userId: string, preferences: Record<string, unknown>): Promise<void> {
    const userPrefs: UserPreferences = {
      userId,
      preferences,
      updatedAt: new Date(),
      syncStatus: 'pending'
    };

    if (this.fallbackToMemory) {
      const key = `preferences-${userId}`;
      this.memoryStore.set(key, userPrefs);
      return;
    }

    try {
      const db = await getDB();
      await db.put('userPreferences', userPrefs);
    } catch (error) {
      console.error('Error setting user preferences:', error);
      throw error;
    }
  }

  // Sync Metadata
  async getSyncMetadata(key: string): Promise<SyncMetadata | null> {
    if (this.fallbackToMemory) {
      return (this.memoryStore.get(`sync-${key}`) as SyncMetadata) || null;
    }

    try {
      const db = await getDB();
      return await db.get('syncMetadata', key);
    } catch (error) {
      console.error('Error getting sync metadata:', error);
      return null;
    }
  }

  async setSyncMetadata(metadata: SyncMetadata): Promise<void> {
    if (this.fallbackToMemory) {
      this.memoryStore.set(`sync-${metadata.key}`, metadata);
      return;
    }

    try {
      const db = await getDB();
      await db.put('syncMetadata', metadata);
    } catch (error) {
      console.error('Error setting sync metadata:', error);
      throw error;
    }
  }

  // Utility methods
  async markAsSynced(type: 'message' | 'folder' | 'conversation' | 'conversationFolder', id: string | number): Promise<void> {
    if (this.fallbackToMemory) {
      // Update sync status in memory
      for (const [key, value] of this.memoryStore.entries()) {
        if (Array.isArray(value)) {
          const items = value as Array<{ id: string | number; syncStatus: string }>;
          const item = items.find(i => i.id === id);
          if (item) {
            item.syncStatus = 'synced';
            break;
          }
        }
      }
      return;
    }

    try {
      const db = await getDB();
      const stores = {
        message: 'chatMessages',
        folder: 'folders',
        conversation: 'conversations',
        conversationFolder: 'conversationFolders'
      } as const;

      const storeName = stores[type];
      const existing = await db.get(storeName, id);
      if (existing) {
        (existing as { syncStatus: string }).syncStatus = 'synced';
        await db.put(storeName, existing);
      }
    } catch (error) {
      console.error('Error marking as synced:', error);
    }
  }

  async getAllPendingItems(): Promise<{
    messages: ChatMessage[];
    folders: Folder[];
    conversations: Conversation[];
    conversationFolders: ConversationFolder[];
  }> {
    const [messages, folders, conversations, conversationFolders] = await Promise.all([
      this.getPendingChatMessages(),
      this.getPendingFolders(),
      this.getPendingConversations(),
      this.getPendingConversationFolders()
    ]);

    return { messages, folders, conversations, conversationFolders };
  }
}

// Singleton instance
export const localStorageService = new LocalStorageService(); 