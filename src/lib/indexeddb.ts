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

// RAG System Interfaces - Local Only, Never Synced
export interface FolderDocument {
  id: string; // unique document ID
  folderId: number;
  userId: string;
  name: string;
  type: 'text' | 'pdf' | 'md' | 'code' | 'url' | 'json';
  content: string; // original document content
  size: number; // content size in bytes
  metadata: Record<string, unknown>; // custom metadata
  createdAt: Date;
  updatedAt: Date;
  // No syncStatus - these are local only
}

export interface FolderChunk {
  id: string; // unique chunk ID
  documentId: string; // reference to parent document
  folderId: number;
  userId: string;
  content: string; // chunk content
  startOffset: number; // start position in original document
  endOffset: number; // end position in original document
  chunkIndex: number; // index within document
  tokenCount: number; // estimated token count
  embedding?: number[]; // vector embedding (optional, computed async)
  metadata: Record<string, unknown>; // chunk-specific metadata
  createdAt: Date;
  // No syncStatus - these are local only
}

export interface FolderEmbedding {
  id: string; // chunk ID reference
  folderId: number;
  userId: string;
  vector: number[]; // embedding vector
  dimensions: number; // vector dimensions
  model: string; // embedding model used
  createdAt: Date;
  // No syncStatus - these are local only
}

export interface FolderKnowledgeGraph {
  id: string; // unique graph ID
  folderId: number;
  userId: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  // No syncStatus - these are local only
}

export interface KnowledgeNode {
  id: string;
  type: 'concept' | 'entity' | 'document' | 'topic';
  label: string;
  content: string;
  documentIds: string[]; // source documents
  chunkIds: string[]; // source chunks
  metadata: Record<string, unknown>;
  position?: { x: number; y: number }; // for mind map visualization
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string; // source node ID
  targetId: string; // target node ID
  type: 'relates_to' | 'contains' | 'references' | 'derived_from';
  weight: number; // relationship strength (0-1)
  metadata: Record<string, unknown>;
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
  // RAG System Stores - Local Only
  folderDocuments: {
    key: string;
    value: FolderDocument;
    indexes: {
      'by-folder': number;
      'by-user': string;
      'by-folder-user': [number, string];
      'by-created-at': Date;
    };
  };
  folderChunks: {
    key: string;
    value: FolderChunk;
    indexes: {
      'by-document': string;
      'by-folder': number;
      'by-user': string;
      'by-folder-user': [number, string];
      'by-document-index': [string, number];
    };
  };
  folderEmbeddings: {
    key: string;
    value: FolderEmbedding;
    indexes: {
      'by-folder': number;
      'by-user': string;
      'by-folder-user': [number, string];
      'by-model': string;
    };
  };
  folderKnowledgeGraphs: {
    key: string;
    value: FolderKnowledgeGraph;
    indexes: {
      'by-folder': number;
      'by-user': string;
      'by-folder-user': [number, string];
      'by-updated-at': Date;
    };
  };
}

const DB_NAME = 'ProjectGPTDB';
const DB_VERSION = 2; // Incremented for RAG system

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

        // RAG System Stores - Local Only (Never Synced)
        
        // Folder Documents store
        const folderDocumentsStore = db.createObjectStore('folderDocuments', {
          keyPath: 'id',
        });
        folderDocumentsStore.createIndex('by-folder', 'folderId');
        folderDocumentsStore.createIndex('by-user', 'userId');
        folderDocumentsStore.createIndex('by-folder-user', ['folderId', 'userId']);
        folderDocumentsStore.createIndex('by-created-at', 'createdAt');

        // Folder Chunks store
        const folderChunksStore = db.createObjectStore('folderChunks', {
          keyPath: 'id',
        });
        folderChunksStore.createIndex('by-document', 'documentId');
        folderChunksStore.createIndex('by-folder', 'folderId');
        folderChunksStore.createIndex('by-user', 'userId');
        folderChunksStore.createIndex('by-folder-user', ['folderId', 'userId']);
        folderChunksStore.createIndex('by-document-index', ['documentId', 'chunkIndex']);

        // Folder Embeddings store
        const folderEmbeddingsStore = db.createObjectStore('folderEmbeddings', {
          keyPath: 'id', // references chunk ID
        });
        folderEmbeddingsStore.createIndex('by-folder', 'folderId');
        folderEmbeddingsStore.createIndex('by-user', 'userId');
        folderEmbeddingsStore.createIndex('by-folder-user', ['folderId', 'userId']);
        folderEmbeddingsStore.createIndex('by-model', 'model');

        // Folder Knowledge Graphs store
        const folderKnowledgeGraphsStore = db.createObjectStore('folderKnowledgeGraphs', {
          keyPath: 'id',
        });
        folderKnowledgeGraphsStore.createIndex('by-folder', 'folderId');
        folderKnowledgeGraphsStore.createIndex('by-user', 'userId');
        folderKnowledgeGraphsStore.createIndex('by-folder-user', ['folderId', 'userId']);
        folderKnowledgeGraphsStore.createIndex('by-updated-at', 'updatedAt');
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
  const stores = ['chatMessages', 'folders', 'conversationFolders', 'conversations', 'syncMetadata', 'userPreferences', 'folderDocuments', 'folderChunks', 'folderEmbeddings', 'folderKnowledgeGraphs'];
  const tx = db.transaction(stores, 'readwrite');
  
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  
  await tx.done;
}

// Helper function to generate composite keys
export function generateConversationFolderId(conversationId: string, folderId: number): string {
  return `${conversationId}-${folderId}`;
} 