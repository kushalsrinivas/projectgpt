import { getDB, isIndexedDBAvailable } from './indexeddb';
import type { 
  FolderDocument, 
  FolderChunk, 
  FolderEmbedding, 
  FolderKnowledgeGraph,
  KnowledgeNode,
  KnowledgeEdge
} from './indexeddb';

// Embedding models configuration
const EMBEDDING_MODELS = {
  'text-embedding-3-small': {
    dimensions: 1536,
    maxTokens: 8192,
    costPer1kTokens: 0.00002
  },
  'local-sentence-transformer': {
    dimensions: 384,
    maxTokens: 512,
    costPer1kTokens: 0 // Local model
  }
} as const;

type EmbeddingModel = keyof typeof EMBEDDING_MODELS;

// Chunking configuration
const CHUNK_CONFIG = {
  maxTokens: 512,
  overlap: 50,
  minChunkSize: 100
};

export class FolderRAGService {
  private fallbackToMemory = false;
  private memoryStore: Map<string, unknown> = new Map();

  constructor() {
    this.fallbackToMemory = !isIndexedDBAvailable();
    if (this.fallbackToMemory) {
      console.warn('IndexedDB not available, RAG will use memory storage');
    }
  }

  // Document Management
  async addDocument(
    folderId: number,
    userId: string,
    file: File | { name: string; content: string; type: string }
  ): Promise<FolderDocument> {
    const content = file instanceof File ? await this.extractContent(file) : file.content;
    const size = new Blob([content]).size;
    
    const document: FolderDocument = {
      id: crypto.randomUUID(),
      folderId,
      userId,
      name: file.name,
      type: this.getDocumentType(file.name, content),
      content,
      size,
      metadata: {
        originalFile: file instanceof File ? file.name : undefined,
        mimeType: file instanceof File ? file.type : 'text/plain'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.storeDocument(document);
    
    // Process document into chunks asynchronously
    this.processDocumentAsync(document);
    
    return document;
  }

  async getDocuments(folderId: number, userId: string): Promise<FolderDocument[]> {
    if (this.fallbackToMemory) {
      const key = `docs-${folderId}-${userId}`;
      return (this.memoryStore.get(key) as FolderDocument[]) || [];
    }

    try {
      const db = await getDB();
      return await db.getAllFromIndex('folderDocuments', 'by-folder-user', [folderId, userId]);
    } catch (error) {
      console.error('Error getting folder documents:', error);
      return [];
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    // Delete document and all associated chunks and embeddings
    await Promise.all([
      this.removeDocument(documentId),
      this.removeChunksByDocument(documentId),
      this.removeEmbeddingsByDocument(documentId)
    ]);
  }

  // Chunking and Processing
  private async processDocumentAsync(document: FolderDocument): Promise<void> {
    try {
      const chunks = await this.chunkDocument(document);
      
      // Store chunks
      for (const chunk of chunks) {
        await this.storeChunk(chunk);
      }

      // Generate embeddings for chunks
      await this.generateEmbeddingsForChunks(chunks);
      
      // Update knowledge graph
      await this.updateKnowledgeGraph(document, chunks);
    } catch (error) {
      console.error('Error processing document:', document.id, error);
    }
  }

  private async chunkDocument(document: FolderDocument): Promise<FolderChunk[]> {
    const content = document.content;
    const chunks: FolderChunk[] = [];
    
    // Simple text chunking - can be enhanced with more sophisticated strategies
    const sentences = this.splitIntoSentences(content);
    let currentChunk = '';
    let chunkIndex = 0;
    let startOffset = 0;

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (this.estimateTokens(potentialChunk) > CHUNK_CONFIG.maxTokens && currentChunk) {
        // Create chunk from current content
        const chunk: FolderChunk = {
          id: crypto.randomUUID(),
          documentId: document.id,
          folderId: document.folderId,
          userId: document.userId,
          content: currentChunk.trim(),
          startOffset,
          endOffset: startOffset + currentChunk.length,
          chunkIndex,
          tokenCount: this.estimateTokens(currentChunk),
          metadata: {
            documentName: document.name,
            documentType: document.type
          },
          createdAt: new Date()
        };
        
        chunks.push(chunk);
        
        // Start new chunk with overlap
        const overlapSentences = sentences.slice(-CHUNK_CONFIG.overlap);
        currentChunk = overlapSentences.join(' ') + ' ' + sentence;
        startOffset = chunk.endOffset - overlapSentences.join(' ').length;
        chunkIndex++;
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add final chunk if there's remaining content
    if (currentChunk.trim() && this.estimateTokens(currentChunk) >= CHUNK_CONFIG.minChunkSize) {
      const chunk: FolderChunk = {
        id: crypto.randomUUID(),
        documentId: document.id,
        folderId: document.folderId,
        userId: document.userId,
        content: currentChunk.trim(),
        startOffset,
        endOffset: startOffset + currentChunk.length,
        chunkIndex,
        tokenCount: this.estimateTokens(currentChunk),
        metadata: {
          documentName: document.name,
          documentType: document.type
        },
        createdAt: new Date()
      };
      
      chunks.push(chunk);
    }

    return chunks;
  }

  // Embedding Generation
  private async generateEmbeddingsForChunks(chunks: FolderChunk[]): Promise<void> {
    // For now, we'll simulate embedding generation
    // In a real implementation, this would call an embedding API or local model
    
    for (const chunk of chunks) {
      try {
        const embedding = await this.generateEmbedding(chunk.content);
        await this.storeEmbedding({
          id: chunk.id,
          folderId: chunk.folderId,
          userId: chunk.userId,
          vector: embedding,
          dimensions: embedding.length,
          model: 'local-sentence-transformer',
          createdAt: new Date()
        });
      } catch (error) {
        console.error('Error generating embedding for chunk:', chunk.id, error);
      }
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Simulated embedding generation - replace with actual embedding model
    // This creates a normalized random vector for demonstration
    const dimensions = EMBEDDING_MODELS['local-sentence-transformer'].dimensions;
    const vector = Array.from({ length: dimensions }, () => Math.random() - 0.5);
    
    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
  }

  // Semantic Search and Retrieval
  async searchSimilarContent(
    folderId: number,
    userId: string,
    query: string,
    limit: number = 5
  ): Promise<{ chunk: FolderChunk; similarity: number }[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Get all embeddings for the folder
      const embeddings = await this.getEmbeddings(folderId, userId);
      const chunks = await this.getChunks(folderId, userId);
      
      // Calculate similarities
      const similarities = embeddings.map(embedding => ({
        chunkId: embedding.id,
        similarity: this.cosineSimilarity(queryEmbedding, embedding.vector)
      }));
      
      // Sort by similarity and get top results
      similarities.sort((a, b) => b.similarity - a.similarity);
      const topResults = similarities.slice(0, limit);
      
      // Map to chunks with similarity scores
      const results = topResults.map(result => {
        const chunk = chunks.find(c => c.id === result.chunkId);
        return chunk ? { chunk, similarity: result.similarity } : null;
      }).filter(Boolean) as { chunk: FolderChunk; similarity: number }[];
      
      return results;
    } catch (error) {
      console.error('Error searching similar content:', error);
      return [];
    }
  }

  async buildContextForQuery(
    folderId: number,
    userId: string,
    query: string,
    maxTokens: number = 2000
  ): Promise<string> {
    const relevantChunks = await this.searchSimilarContent(folderId, userId, query, 10);
    
    let context = '';
    let totalTokens = 0;
    
    for (const { chunk, similarity } of relevantChunks) {
      const chunkTokens = chunk.tokenCount;
      if (totalTokens + chunkTokens > maxTokens) break;
      
      if (similarity > 0.7) { // Only include highly relevant chunks
        context += `\n--- ${chunk.metadata.documentName} ---\n${chunk.content}\n`;
        totalTokens += chunkTokens;
      }
    }
    
    return context.trim();
  }

  // Knowledge Graph Management
  private async updateKnowledgeGraph(document: FolderDocument, chunks: FolderChunk[]): Promise<void> {
    // Simplified knowledge graph extraction
    // In a real implementation, this would use NLP to extract entities and relationships
    
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];
    
    // Create document node
    const documentNode: KnowledgeNode = {
      id: document.id,
      type: 'document',
      label: document.name,
      content: document.content.substring(0, 200) + '...',
      documentIds: [document.id],
      chunkIds: chunks.map(c => c.id),
      metadata: {
        type: document.type,
        size: document.size
      },
      position: { x: Math.random() * 400, y: Math.random() * 400 }
    };
    
    nodes.push(documentNode);
    
    // Extract key concepts from chunks
    chunks.forEach((chunk, index) => {
      const concepts = this.extractConcepts(chunk.content);
      
      concepts.forEach(concept => {
        const conceptNode: KnowledgeNode = {
          id: `${chunk.id}-concept-${concept}`,
          type: 'concept',
          label: concept,
          content: concept,
          documentIds: [document.id],
          chunkIds: [chunk.id],
          metadata: { chunkIndex: index },
          position: { 
            x: documentNode.position!.x + (Math.random() - 0.5) * 200, 
            y: documentNode.position!.y + (Math.random() - 0.5) * 200 
          }
        };
        
        nodes.push(conceptNode);
        
        // Create edge from document to concept
        edges.push({
          id: `${document.id}-contains-${conceptNode.id}`,
          sourceId: document.id,
          targetId: conceptNode.id,
          type: 'contains',
          weight: 0.8,
          metadata: {}
        });
      });
    });
    
    // Store or update knowledge graph
    const graph: FolderKnowledgeGraph = {
      id: `${document.folderId}-graph`,
      folderId: document.folderId,
      userId: document.userId,
      nodes,
      edges,
      metadata: {
        documentCount: 1,
        lastUpdated: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await this.storeKnowledgeGraph(graph);
  }

  async getKnowledgeGraph(folderId: number, userId: string): Promise<FolderKnowledgeGraph | null> {
    if (this.fallbackToMemory) {
      const key = `graph-${folderId}-${userId}`;
      return (this.memoryStore.get(key) as FolderKnowledgeGraph) || null;
    }

    try {
      const db = await getDB();
      const graphs = await db.getAllFromIndex('folderKnowledgeGraphs', 'by-folder-user', [folderId, userId]);
      return graphs[0] || null;
    } catch (error) {
      console.error('Error getting knowledge graph:', error);
      return null;
    }
  }

  // Utility Methods
  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  private estimateTokens(text: string): number {
    // Rough token estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private getDocumentType(fileName: string, content: string): FolderDocument['type'] {
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'pdf': return 'pdf';
      case 'md': case 'markdown': return 'md';
      case 'js': case 'ts': case 'jsx': case 'tsx': case 'py': case 'java': case 'cpp': case 'c': return 'code';
      case 'json': return 'json';
      default: return 'text';
    }
  }

  private async extractContent(file: File): Promise<string> {
    if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
      return await file.text();
    }
    
    // For other file types, we'd need specific parsers
    // For now, just return the file name as content
    return `File: ${file.name}\nType: ${file.type}\nSize: ${file.size} bytes`;
  }

  private extractConcepts(text: string): string[] {
    // Simple concept extraction - can be enhanced with NLP
    const words = text.toLowerCase().split(/\W+/);
    const concepts = words.filter(word => 
      word.length > 4 && 
      !['the', 'and', 'this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'have', 'their'].includes(word)
    );
    
    return [...new Set(concepts)].slice(0, 5); // Top 5 unique concepts
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Storage Operations
  private async storeDocument(document: FolderDocument): Promise<void> {
    if (this.fallbackToMemory) {
      const key = `docs-${document.folderId}-${document.userId}`;
      const existing = (this.memoryStore.get(key) as FolderDocument[]) || [];
      this.memoryStore.set(key, [...existing, document]);
      return;
    }

    try {
      const db = await getDB();
      await db.add('folderDocuments', document);
    } catch (error) {
      console.error('Error storing document:', error);
      throw error;
    }
  }

  private async storeChunk(chunk: FolderChunk): Promise<void> {
    if (this.fallbackToMemory) {
      const key = `chunks-${chunk.folderId}-${chunk.userId}`;
      const existing = (this.memoryStore.get(key) as FolderChunk[]) || [];
      this.memoryStore.set(key, [...existing, chunk]);
      return;
    }

    try {
      const db = await getDB();
      await db.add('folderChunks', chunk);
    } catch (error) {
      console.error('Error storing chunk:', error);
      throw error;
    }
  }

  private async storeEmbedding(embedding: FolderEmbedding): Promise<void> {
    if (this.fallbackToMemory) {
      const key = `embeddings-${embedding.folderId}-${embedding.userId}`;
      const existing = (this.memoryStore.get(key) as FolderEmbedding[]) || [];
      this.memoryStore.set(key, [...existing, embedding]);
      return;
    }

    try {
      const db = await getDB();
      await db.add('folderEmbeddings', embedding);
    } catch (error) {
      console.error('Error storing embedding:', error);
      throw error;
    }
  }

  private async storeKnowledgeGraph(graph: FolderKnowledgeGraph): Promise<void> {
    if (this.fallbackToMemory) {
      const key = `graph-${graph.folderId}-${graph.userId}`;
      this.memoryStore.set(key, graph);
      return;
    }

    try {
      const db = await getDB();
      await db.put('folderKnowledgeGraphs', graph); // Use put to allow updates
    } catch (error) {
      console.error('Error storing knowledge graph:', error);
      throw error;
    }
  }

  private async getChunks(folderId: number, userId: string): Promise<FolderChunk[]> {
    if (this.fallbackToMemory) {
      const key = `chunks-${folderId}-${userId}`;
      return (this.memoryStore.get(key) as FolderChunk[]) || [];
    }

    try {
      const db = await getDB();
      return await db.getAllFromIndex('folderChunks', 'by-folder-user', [folderId, userId]);
    } catch (error) {
      console.error('Error getting chunks:', error);
      return [];
    }
  }

  private async getEmbeddings(folderId: number, userId: string): Promise<FolderEmbedding[]> {
    if (this.fallbackToMemory) {
      const key = `embeddings-${folderId}-${userId}`;
      return (this.memoryStore.get(key) as FolderEmbedding[]) || [];
    }

    try {
      const db = await getDB();
      return await db.getAllFromIndex('folderEmbeddings', 'by-folder-user', [folderId, userId]);
    } catch (error) {
      console.error('Error getting embeddings:', error);
      return [];
    }
  }

  // Cleanup operations
  private async removeDocument(documentId: string): Promise<void> {
    if (this.fallbackToMemory) {
      // Remove from memory store - implementation would need to iterate through all folders
      return;
    }

    try {
      const db = await getDB();
      await db.delete('folderDocuments', documentId);
    } catch (error) {
      console.error('Error removing document:', error);
    }
  }

  private async removeChunksByDocument(documentId: string): Promise<void> {
    if (this.fallbackToMemory) {
      // Implementation for memory store
      return;
    }

    try {
      const db = await getDB();
      const chunks = await db.getAllFromIndex('folderChunks', 'by-document', documentId);
      
      for (const chunk of chunks) {
        await db.delete('folderChunks', chunk.id);
      }
    } catch (error) {
      console.error('Error removing chunks:', error);
    }
  }

  private async removeEmbeddingsByDocument(documentId: string): Promise<void> {
    if (this.fallbackToMemory) {
      return;
    }

    try {
      const db = await getDB();
      const chunks = await db.getAllFromIndex('folderChunks', 'by-document', documentId);
      
      for (const chunk of chunks) {
        try {
          await db.delete('folderEmbeddings', chunk.id);
        } catch (error) {
          // Embedding might not exist, that's ok
        }
      }
    } catch (error) {
      console.error('Error removing embeddings:', error);
    }
  }

  // Folder deletion cleanup
  async cleanupFolder(folderId: number, userId: string): Promise<void> {
    if (this.fallbackToMemory) {
      // Clean up memory store
      const patterns = [`docs-${folderId}-${userId}`, `chunks-${folderId}-${userId}`, `embeddings-${folderId}-${userId}`, `graph-${folderId}-${userId}`];
      patterns.forEach(pattern => this.memoryStore.delete(pattern));
      return;
    }

    try {
      const db = await getDB();
      
      // Get all documents for this folder
      const documents = await db.getAllFromIndex('folderDocuments', 'by-folder-user', [folderId, userId]);
      
      // Clean up each document and its associated data
      for (const document of documents) {
        await this.deleteDocument(document.id);
      }
      
      // Clean up knowledge graph
      const graphs = await db.getAllFromIndex('folderKnowledgeGraphs', 'by-folder-user', [folderId, userId]);
      for (const graph of graphs) {
        await db.delete('folderKnowledgeGraphs', graph.id);
      }
    } catch (error) {
      console.error('Error cleaning up folder:', error);
    }
  }
}

// Singleton instance
export const folderRAGService = new FolderRAGService(); 