import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface ChatMessage {
  id: string;
  userId: string | null;
  conversationId: string;
  guestSessionId?: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  tokensUsed: number;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'pending' | 'synced' | 'error';
  lastSyncAttempt?: Date;
}

export interface Folder {
  id: number;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'pending' | 'synced' | 'error';
  lastSyncAttempt?: Date;
}

export interface ConversationFolder {
  id: string; // composite key: conversationId-folderId
  conversationId: string;
  folderId: number;
  userId: string;
  createdAt: Date;
  syncStatus: 'pending' | 'synced' | 'error';
  lastSyncAttempt?: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  lastMessage: string;
  lastMessageTime: Date;
  model?: string;
  folderId?: number;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'pending' | 'synced' | 'error';
  lastSyncAttempt?: Date;
}

export interface SyncMetadata {
  key: string;
  lastSyncTime: Date;
  lastSyncVersion: number;
}

export interface UserPreferences {
  userId: string;
  preferences: Record<string, unknown>;
  updatedAt: Date;
  syncStatus: 'pending' | 'synced' | 'error';
}

interface ProjectGPTDB extends DBSchema {
  chatMessages: {
    key: string;
    value: ChatMessage;
    indexes: {
      'by-conversation': string;
      'by-user': string;
      'by-sync-status': string;
      'by-created-at': Date;
    };
  };
  folders: {
    key: number;
    value: Folder;
    indexes: {
      'by-user': string;
      'by-sync-status': string;
    };
  };
  conversationFolders: {
    key: string;
    value: ConversationFolder;
    indexes: {
      'by-conversation': string;
      'by-folder': number;
      'by-user': string;
      'by-sync-status': string;
    };
  };
  conversations: {
    key: string;
    value: Conversation;
    indexes: {
      'by-user': string;
      'by-folder': number;
      'by-sync-status': string;
      'by-updated-at': Date;
    };
  };
  syncMetadata: {
    key: string;
    value: SyncMetadata;
  };
  userPreferences: {
    key: string;
    value: UserPreferences;
    indexes: {
      'by-sync-status': string;
    };
  };
}

const DB_NAME = 'ProjectGPTDB';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<ProjectGPTDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<ProjectGPTDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await openDB<ProjectGPTDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Chat Messages store
        const chatMessagesStore = db.createObjectStore('chatMessages', {
          keyPath: 'id',
        });
        chatMessagesStore.createIndex('by-conversation', 'conversationId');
        chatMessagesStore.createIndex('by-user', 'userId');
        chatMessagesStore.createIndex('by-sync-status', 'syncStatus');
        chatMessagesStore.createIndex('by-created-at', 'createdAt');

        // Folders store
        const foldersStore = db.createObjectStore('folders', {
          keyPath: 'id',
        });
        foldersStore.createIndex('by-user', 'userId');
        foldersStore.createIndex('by-sync-status', 'syncStatus');

        // Conversation Folders store
        const conversationFoldersStore = db.createObjectStore('conversationFolders', {
          keyPath: 'id',
        });
        conversationFoldersStore.createIndex('by-conversation', 'conversationId');
        conversationFoldersStore.createIndex('by-folder', 'folderId');
        conversationFoldersStore.createIndex('by-user', 'userId');
        conversationFoldersStore.createIndex('by-sync-status', 'syncStatus');

        // Conversations store
        const conversationsStore = db.createObjectStore('conversations', {
          keyPath: 'id',
        });
        conversationsStore.createIndex('by-user', 'userId');
        conversationsStore.createIndex('by-folder', 'folderId');
        conversationsStore.createIndex('by-sync-status', 'syncStatus');
        conversationsStore.createIndex('by-updated-at', 'updatedAt');

        // Sync Metadata store
        db.createObjectStore('syncMetadata', {
          keyPath: 'key',
        });

        // User Preferences store
        const userPreferencesStore = db.createObjectStore('userPreferences', {
          keyPath: 'userId',
        });
        userPreferencesStore.createIndex('by-sync-status', 'syncStatus');
      },
    });

    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    throw error;
  }
}

export async function getDB(): Promise<IDBPDatabase<ProjectGPTDB>> {
  if (!dbInstance) {
    return await initDB();
  }
  return dbInstance;
}

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  } catch {
    return false;
  }
}

export async function clearDB(): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  
  const db = await getDB();
  const tx = db.transaction(['chatMessages', 'folders', 'conversationFolders', 'conversations', 'syncMetadata', 'userPreferences'], 'readwrite');
  
  await Promise.all([
    tx.objectStore('chatMessages').clear(),
    tx.objectStore('folders').clear(),
    tx.objectStore('conversationFolders').clear(),
    tx.objectStore('conversations').clear(),
    tx.objectStore('syncMetadata').clear(),
    tx.objectStore('userPreferences').clear(),
  ]);
  
  await tx.done;
}

// Helper function to generate composite keys
export function generateConversationFolderId(conversationId: string, folderId: number): string {
  return `${conversationId}-${folderId}`;
} 