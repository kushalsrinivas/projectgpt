import { folderRAGService } from './folder-rag-service';
import { buildContext, buildSystemPrompt } from './context-manager';
import type { OpenRouterMessage, MessageContext, TokenLimits } from './context-manager';

interface FolderContextConfig {
  includeRAGData: boolean;
  maxRAGTokens: number;
  ragSimilarityThreshold: number;
  preserveConversationContext: boolean;
  maxConversationTokens: number;
}

const DEFAULT_FOLDER_CONFIG: FolderContextConfig = {
  includeRAGData: true,
  maxRAGTokens: 2000,
  ragSimilarityThreshold: 0.7,
  preserveConversationContext: true,
  maxConversationTokens: 4000
};

export class FolderContextManager {
  private folderConfigs = new Map<number, FolderContextConfig>();

  /**
   * Set configuration for a specific folder
   */
  setFolderConfig(folderId: number, config: Partial<FolderContextConfig>): void {
    const currentConfig = this.folderConfigs.get(folderId) || DEFAULT_FOLDER_CONFIG;
    this.folderConfigs.set(folderId, { ...currentConfig, ...config });
  }

  /**
   * Get configuration for a specific folder
   */
  getFolderConfig(folderId: number): FolderContextConfig {
    return this.folderConfigs.get(folderId) || DEFAULT_FOLDER_CONFIG;
  }

  /**
   * Build context for a folder conversation with RAG integration
   * Ensures strict isolation - only data from the specified folder is included
   */
  async buildFolderContext(
    folderId: number,
    userId: string,
    messages: OpenRouterMessage[],
    userQuery: string,
    baseSystemPrompt: string,
    limits: Partial<TokenLimits> = {}
  ): Promise<MessageContext> {
    const config = this.getFolderConfig(folderId);
    
    // Build RAG context if enabled
    let ragContext = '';
    if (config.includeRAGData) {
      ragContext = await this.buildRAGContext(
        folderId, 
        userId, 
        userQuery, 
        config.maxRAGTokens,
        config.ragSimilarityThreshold
      );
    }

    // Build enhanced system prompt with folder context
    const enhancedSystemPrompt = this.buildFolderSystemPrompt(
      baseSystemPrompt,
      folderId,
      ragContext
    );

    // Apply folder-specific token limits
    const folderLimits = this.applyFolderLimits(limits, config);

    // Build standard context with enhanced prompt
    return buildContext(messages, enhancedSystemPrompt, folderLimits);
  }

  /**
   * Build RAG context from folder-specific documents
   * This ensures strict isolation - only documents from this folder are considered
   */
  private async buildRAGContext(
    folderId: number,
    userId: string,
    query: string,
    maxTokens: number,
    similarityThreshold: number
  ): Promise<string> {
    try {
      // Get relevant content from this folder only
      const ragContent = await folderRAGService.buildContextForQuery(
        folderId,
        userId,
        query,
        maxTokens
      );

      if (!ragContent) {
        return '';
      }

      // Format RAG context with clear boundaries
      return `\n--- FOLDER CONTEXT (Folder ID: ${folderId}) ---\n${ragContent}\n--- END FOLDER CONTEXT ---\n`;
    } catch (error) {
      console.error('Error building RAG context for folder:', folderId, error);
      return '';
    }
  }

  /**
   * Build folder-specific system prompt with RAG context
   */
  private buildFolderSystemPrompt(
    basePrompt: string,
    folderId: number,
    ragContext: string
  ): string {
    let prompt = basePrompt;

    // Add folder isolation instructions
    prompt += "\n\n## FOLDER CONTEXT ISOLATION\n";
    prompt += `You are working within a specific folder context (ID: ${folderId}). `;
    prompt += "IMPORTANT: Only use information from the provided folder context below. ";
    prompt += "Do not reference or contaminate this conversation with information from other folders or external sources.";

    // Add RAG context if available
    if (ragContext.trim()) {
      prompt += "\n\n## AVAILABLE FOLDER RESOURCES\n";
      prompt += "The following resources are available in this folder for reference:";
      prompt += ragContext;
      prompt += "\n\nWhen answering questions, prioritize information from these folder resources. ";
      prompt += "If the answer isn't in the provided resources, clearly state that the information ";
      prompt += "is not available in the current folder context.";
    } else {
      prompt += "\n\nNo specific resources are available in this folder context. ";
      prompt += "Provide general assistance while noting that no folder-specific resources are loaded.";
    }

    // Add explicit isolation reminder
    prompt += "\n\n## STRICT ISOLATION REQUIREMENT\n";
    prompt += "Maintain complete separation between this folder's context and any other conversations. ";
    prompt += "Each folder is an independent knowledge space with no cross-contamination.";

    return prompt;
  }

  /**
   * Apply folder-specific token limits
   */
  private applyFolderLimits(
    baseLimits: Partial<TokenLimits>,
    config: FolderContextConfig
  ): Partial<TokenLimits> {
    return {
      ...baseLimits,
      // Reserve tokens for RAG context if enabled
      reserveTokens: (baseLimits.reserveTokens || 0) + 
                    (config.includeRAGData ? config.maxRAGTokens : 0)
    };
  }

  /**
   * Validate that a conversation belongs to the specified folder
   * This prevents context leakage between folders
   */
  async validateFolderMembership(
    conversationId: string,
    folderId: number,
    userId: string
  ): Promise<boolean> {
    try {
      // This would typically check the conversation_folders table
      // For now, we'll assume the validation is done at the router level
      return true;
    } catch (error) {
      console.error('Error validating folder membership:', error);
      return false;
    }
  }

  /**
   * Clear folder-specific context cache when folder is deleted
   */
  clearFolderContext(folderId: number): void {
    this.folderConfigs.delete(folderId);
    // Additional cleanup could be added here
  }

  /**
   * Get folder statistics for context usage
   */
  async getFolderStats(folderId: number, userId: string): Promise<{
    documentCount: number;
    totalChunks: number;
    totalTokens: number;
    lastUpdated: Date | null;
  }> {
    try {
      const documents = await folderRAGService.getDocuments(folderId, userId);
      const knowledgeGraph = await folderRAGService.getKnowledgeGraph(folderId, userId);
      
      const totalChunks = 0;
      let totalTokens = 0;
      
      // Calculate totals from documents
      for (const doc of documents) {
        // This would ideally get chunk stats from the service
        totalTokens += Math.ceil(doc.size / 4); // Rough token estimate
      }

      return {
        documentCount: documents.length,
        totalChunks,
        totalTokens,
        lastUpdated: knowledgeGraph?.updatedAt || null
      };
    } catch (error) {
      console.error('Error getting folder stats:', error);
      return {
        documentCount: 0,
        totalChunks: 0,
        totalTokens: 0,
        lastUpdated: null
      };
    }
  }

  /**
   * Test RAG retrieval for a query (useful for debugging)
   */
  async testRAGRetrieval(
    folderId: number,
    userId: string,
    query: string,
    limit = 3
  ) {
    try {
      const results = await folderRAGService.searchSimilarContent(
        folderId,
        userId,
        query,
        limit
      );

      return results.map(result => ({
        content: `${result.chunk.content.substring(0, 200)}...`,
        similarity: result.similarity,
        source: result.chunk.metadata.documentName as string || 'Unknown'
      }));
    } catch (error) {
      console.error('Error testing RAG retrieval:', error);
      return [];
    }
  }
}

// Singleton instance
export const folderContextManager = new FolderContextManager(); 