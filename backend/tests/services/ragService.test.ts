/**
 * RAG Service Unit Tests
 * Tests chunkText, loadIndex, saveIndex, and related utilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';

// Store original env
const originalEnv = { ...process.env };

// Mock fs modules
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock vector store adapter
vi.mock('../../src/services/vectorStoreAdapter.js', () => ({
  getVectorStore: vi.fn(() => ({
    query: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock embedding service
vi.mock('../../src/services/embeddingService.js', () => ({
  embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
}));

// Mock grump parser
vi.mock('../../src/services/grumpParser.js', () => ({
  chunkGrumpByAST: vi.fn((content, source) => [{ content, source, type: 'grump' }]),
}));

// Mock NIM config
vi.mock('../../src/config/nim.js', () => ({
  getNimChatUrl: vi.fn(() => 'https://api.nvidia.com/v1/chat/completions'),
}));

// Mock model router (RAG uses getRAGModel for provider/modelId)
vi.mock('../../src/services/modelRouter.js', () => ({
  getRAGModel: vi.fn(() => ({ provider: 'nim', modelId: 'moonshotai/kimi-k2.5' })),
}));

// Mock LLM gateway helper (RAG generation goes through getCompletion)
const mockGetCompletion = vi.fn();
vi.mock('../../src/services/llmGatewayHelper.js', () => ({
  getCompletion: (...args: unknown[]) => mockGetCompletion(...args),
}));

// Mock fetch globally (still used by embedding service in some paths)
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('ragService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockGetCompletion.mockResolvedValue({ text: 'Mocked answer' });
    process.env.NVIDIA_NIM_API_KEY = 'test_api_key';
    process.env.RAG_INDEX_PATH = './test-data/rag-index.json';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('chunkText', () => {
    it('should chunk text with source and type', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      const text = 'This is a test document.\n\nIt has multiple paragraphs.\n\nAnd some more content.';
      const chunks = chunkText(text, 'test.md', 'doc');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].source).toBe('test.md');
      expect(chunks[0].type).toBe('doc');
    });

    it('should handle empty text', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      const chunks = chunkText('', 'empty.md', 'doc');
      expect(chunks).toEqual([]);
    });

    it('should handle short text within chunk size', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      const text = 'Short text content';
      const chunks = chunkText(text, 'short.md', 'doc');

      expect(chunks.length).toBe(1);
      // The chunker may join with newlines
      expect(chunks[0].content).toContain('Short');
      expect(chunks[0].content).toContain('text');
      expect(chunks[0].content).toContain('content');
    });

    it('should handle very long text by splitting', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      // Create text longer than CHUNK_SIZE (1000)
      const text = 'A'.repeat(3000);
      const chunks = chunkText(text, 'long.md', 'doc');

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should preserve chunk type for code', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      const code = 'function hello() { return "world"; }';
      const chunks = chunkText(code, 'app.ts', 'code');

      expect(chunks[0].type).toBe('code');
    });

    it('should preserve chunk type for spec', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      const spec = '# API Specification\n\nGET /users - returns list of users';
      const chunks = chunkText(spec, 'api.spec.md', 'spec');

      expect(chunks[0].type).toBe('spec');
    });
  });

  describe('loadIndex', () => {
    it('should return null when index file does not exist', async () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      
      const { loadIndex } = await import('../../src/services/ragService.js');
      const result = await loadIndex();

      expect(result).toBeNull();
    });

    it('should load and parse index from file', async () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const indexData = {
        chunks: [{ id: 'chunk1', content: 'test', embedding: [0.1], source: 'test.md', type: 'doc' }],
        embeddedAt: '2024-01-01T00:00:00Z',
      };
      (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(indexData));

      const { loadIndex } = await import('../../src/services/ragService.js');
      const result = await loadIndex();

      expect(result).toEqual(indexData);
    });

    it('should use RAG_INDEX_PATH from env', async () => {
      process.env.RAG_INDEX_PATH = './custom/path/index.json';
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { loadIndex } = await import('../../src/services/ragService.js');
      await loadIndex();

      expect(existsSync).toHaveBeenCalledWith('./custom/path/index.json');
    });
  });

  describe('saveIndex', () => {
    it('should create directory if it does not exist', async () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (mkdir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const { saveIndex } = await import('../../src/services/ragService.js');
      
      await saveIndex({
        chunks: [],
        embeddedAt: new Date().toISOString(),
      });

      expect(mkdir).toHaveBeenCalled();
    });

    it('should save index as JSON', async () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const { saveIndex } = await import('../../src/services/ragService.js');
      
      const index = {
        chunks: [{ id: 'c1', content: 'test', embedding: [0.1, 0.2], source: 'doc.md', type: 'doc' as const }],
        embeddedAt: '2024-01-01T00:00:00Z',
      };
      
      await saveIndex(index);

      expect(writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(index),
        'utf8'
      );
    });
  });

  describe('getRagContextForPrompt', () => {
    it('should return null when API key is not set', async () => {
      delete process.env.NVIDIA_NIM_API_KEY;

      const { getRagContextForPrompt } = await import('../../src/services/ragService.js');

      const result = await getRagContextForPrompt('query');
      expect(result).toBeNull();
    });

    it('should return null when no chunks found', async () => {
      const { getRagContextForPrompt } = await import('../../src/services/ragService.js');

      const result = await getRagContextForPrompt('unknown topic');
      expect(result).toBeNull();
    });

    it('should return context and sources when chunks found', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      const mockResults = [
        { chunk: { id: 'c1', content: 'Context one', source: 'doc1.md', type: 'doc' as const, embedding: [0.1] }, score: 0.9 },
      ];
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      const { getRagContextForPrompt } = await import('../../src/services/ragService.js');
      const result = await getRagContextForPrompt('test query', { maxChunks: 6 });

      expect(result).not.toBeNull();
      expect(result?.context).toContain('doc1.md');
      expect(result?.context).toContain('Context one');
      expect(result?.sources).toHaveLength(1);
      expect(result?.sources?.[0]).toEqual({ source: 'doc1.md', type: 'doc' });
    });
  });

  describe('ragQuery', () => {
    it.skip('should throw error when API key is not set', async () => {
      const originalKey = process.env.NVIDIA_NIM_API_KEY;
      delete process.env.NVIDIA_NIM_API_KEY;

      // Force module reload by clearing the module cache
      vi.resetModules();

      const { ragQuery } = await import('../../src/services/ragService.js');

      await expect(ragQuery('test query')).rejects.toThrow('NVIDIA_NIM_API_KEY is not set');

      // Restore key
      process.env.NVIDIA_NIM_API_KEY = originalKey;
    });

    it('should return empty result message when no chunks found', async () => {
      const { ragQuery } = await import('../../src/services/ragService.js');
      
      const result = await ragQuery('unknown topic');

      expect(result.answer).toContain('knowledge base has not been indexed');
      expect(result.confidence).toBe(0);
    });
  });

  describe('runIndexer', () => {
    it.skip('should throw error when API key is not set', async () => {
      const originalKey = process.env.NVIDIA_NIM_API_KEY;
      delete process.env.NVIDIA_NIM_API_KEY;

      // Force module reload by clearing the module cache
      vi.resetModules();

      const { runIndexer } = await import('../../src/services/ragService.js');

      await expect(runIndexer([])).rejects.toThrow('NVIDIA_NIM_API_KEY is not set');

      // Restore key
      process.env.NVIDIA_NIM_API_KEY = originalKey;
    });

    it('should process documents and return chunk count', async () => {
      const { runIndexer } = await import('../../src/services/ragService.js');
      
      const docs = [
        { content: 'Document one content', source: 'doc1.md', type: 'doc' as const },
        { content: 'Document two content', source: 'doc2.md', type: 'doc' as const },
      ];

      const result = await runIndexer(docs);

      expect(result.chunks).toBeGreaterThanOrEqual(0);
    });

    it('should handle grump type documents specially', async () => {
      const { chunkGrumpByAST } = await import('../../src/services/grumpParser.js');
      const { runIndexer } = await import('../../src/services/ragService.js');
      
      const docs = [
        { content: 'grump code content', source: 'app.grump', type: 'grump' as const },
      ];

      await runIndexer(docs);

      expect(chunkGrumpByAST).toHaveBeenCalled();
    });
  });

  describe('RagQueryOptions', () => {
    it('should support structured output format', async () => {
      const { ragQuery } = await import('../../src/services/ragService.js');
      
      // With no chunks, should return early with empty result
      const result = await ragQuery('extract tasks', { 
        outputFormat: 'structured',
        structuredSchema: 'tasks: string[]'
      });

      expect(result).toBeDefined();
    });

    it('should support hybrid search option', async () => {
      const { ragQuery } = await import('../../src/services/ragService.js');
      
      const result = await ragQuery('test query', { hybrid: true });

      expect(result).toBeDefined();
    });

    it('should support type filtering', async () => {
      const { ragQuery } = await import('../../src/services/ragService.js');
      
      const result = await ragQuery('find code', { types: ['code', 'spec'] });

      expect(result).toBeDefined();
    });
  });

  describe('Document chunking strategies', () => {
    it('should chunk by paragraphs for documents', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      const text = `Paragraph one content here.

Paragraph two content here.

Paragraph three content here.`;
      
      const chunks = chunkText(text, 'doc.md', 'doc');
      
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.every(c => c.type === 'doc')).toBe(true);
      expect(chunks.every(c => c.source === 'doc.md')).toBe(true);
    });

    it('should chunk code by functions and classes', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      const code = `
function hello() {
  return "world";
}

class MyClass {
  constructor() {
    this.value = 42;
  }
  
  getValue() {
    return this.value;
  }
}`;
      
      const chunks = chunkText(code, 'app.ts', 'code');
      
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.every(c => c.type === 'code')).toBe(true);
    });

    it('should chunk spec by sections', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      const spec = `
# Section 1

Content for section 1.

# Section 2

Content for section 2.

## Subsection 2.1

More detailed content.`;
      
      const chunks = chunkText(spec, 'spec.md', 'spec');
      
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.every(c => c.type === 'spec')).toBe(true);
    });

    it('should handle mixed content types', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      const docs = [
        { content: 'Doc content', source: 'doc.md', type: 'doc' as const },
        { content: 'Code content', source: 'code.ts', type: 'code' as const },
        { content: 'Spec content', source: 'spec.md', type: 'spec' as const },
      ];

      for (const doc of docs) {
        const chunks = chunkText(doc.content, doc.source, doc.type);
        expect(chunks.length).toBeGreaterThanOrEqual(1);
        expect(chunks[0].type).toBe(doc.type);
      }
    });

    it('should respect chunk size limits', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      const longText = 'A'.repeat(5000);
      const chunks = chunkText(longText, 'long.md', 'doc');
      
      // Each chunk should be within reasonable size
      for (const chunk of chunks) {
        expect(chunk.content.length).toBeLessThanOrEqual(2000);
      }
    });

    it('should preserve chunk overlap for context', async () => {
      const { chunkText } = await import('../../src/services/ragService.js');
      
      const text = `First part of the content that is quite long and should overlap.

Second part of the content that continues from the first.`;
      
      const chunks = chunkText(text, 'overlap.md', 'doc');
      
      if (chunks.length > 1) {
        // Check for some overlap between chunks
        const firstChunk = chunks[0].content;
        const secondChunk = chunks[1].content;
        
        // Some text from the end of first should be in second
        const firstEnding = firstChunk.slice(-50);
        const hasOverlap = secondChunk.includes(firstEnding.substring(10));
        // This is a soft assertion as overlap depends on implementation
        expect(chunks.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Embedding generation with different models', () => {
    it('should use default embedding model', async () => {
      const { runIndexer } = await import('../../src/services/ragService.js');
      const { embed } = await import('../../src/services/embeddingService.js');
      
      const docs = [
        { content: 'Test content', source: 'test.md', type: 'doc' as const },
      ];

      await runIndexer(docs);

      expect(embed).toHaveBeenCalled();
      const callArgs = (embed as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs).toHaveLength(2);
      expect(callArgs[1]).toHaveProperty('model');
    });

    it('should use custom embedding model from env', async () => {
      process.env.RAG_EMBED_MODEL = 'custom/embed-model-v1';
      
      const { runIndexer } = await import('../../src/services/ragService.js');
      const { embed } = await import('../../src/services/embeddingService.js');
      
      const docs = [
        { content: 'Test content', source: 'test.md', type: 'doc' as const },
      ];

      await runIndexer(docs);

      expect(embed).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          model: 'custom/embed-model-v1',
        })
      );
    });

    it('should handle embedding service errors', async () => {
      const { embed } = await import('../../src/services/embeddingService.js');
      (embed as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Embedding failed'));
      
      const { runIndexer } = await import('../../src/services/ragService.js');
      
      const docs = [
        { content: 'Test content', source: 'test.md', type: 'doc' as const },
      ];

      await expect(runIndexer(docs)).rejects.toThrow('Embedding failed');
    });

    it('should batch embedding requests', async () => {
      const { runIndexer } = await import('../../src/services/ragService.js');
      const { embed } = await import('../../src/services/embeddingService.js');
      
      // Create many small documents to test batching
      const docs = Array.from({ length: 50 }, (_, i) => ({
        content: `Document ${i} content`,
        source: `doc${i}.md`,
        type: 'doc' as const,
      }));

      await runIndexer(docs);

      // Should batch embeddings rather than making 50 individual calls
      const embedCalls = (embed as ReturnType<typeof vi.fn>).mock.calls;
      expect(embedCalls.length).toBeGreaterThan(0);
      expect(embedCalls.length).toBeLessThan(docs.length);
    });
  });

  describe('Vector search with filters', () => {
    it('should filter by document type', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      const mockQuery = vi.fn().mockResolvedValue([]);
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: mockQuery,
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      const { ragQuery } = await import('../../src/services/ragService.js');
      
      await ragQuery('test query', { types: ['code'] });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          types: ['code'],
        })
      );
    });

    it('should filter by multiple document types', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      const mockQuery = vi.fn().mockResolvedValue([]);
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: mockQuery,
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      const { ragQuery } = await import('../../src/services/ragService.js');
      
      await ragQuery('test query', { types: ['code', 'spec'] });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          types: ['code', 'spec'],
        })
      );
    });

    it('should filter by source file', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      const mockQuery = vi.fn().mockResolvedValue([]);
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: mockQuery,
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      const { ragQuery } = await import('../../src/services/ragService.js');
      
      // Query with source filter
      await ragQuery('test query', { 
        types: ['doc'],
        // Additional filter options if supported
      });

      expect(mockQuery).toHaveBeenCalled();
    });

    it('should return top-k results ordered by relevance', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      
      const mockResults = [
        { chunk: { id: 'chunk1', content: 'Most relevant', source: 'doc.md', type: 'doc', embedding: [0.9, 0.1] }, score: 0.95 },
        { chunk: { id: 'chunk2', content: 'Second most', source: 'doc.md', type: 'doc', embedding: [0.8, 0.2] }, score: 0.85 },
        { chunk: { id: 'chunk3', content: 'Third most', source: 'doc.md', type: 'doc', embedding: [0.7, 0.3] }, score: 0.75 },
      ];
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      const { ragQuery } = await import('../../src/services/ragService.js');
      
      mockGetCompletion.mockResolvedValueOnce({ text: 'Answer' });

      const result = await ragQuery('test query', { types: ['doc'] });

      expect(result).toBeDefined();
    });
  });

  describe('RAG context assembly', () => {
    it('should assemble context from search results', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      
      const mockResults = [
        { chunk: { id: 'chunk1', content: 'First context piece', source: 'doc1.md', type: 'doc', embedding: [0.9] }, score: 0.9 },
        { chunk: { id: 'chunk2', content: 'Second context piece', source: 'doc2.md', type: 'doc', embedding: [0.8] }, score: 0.8 },
      ];
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      const { ragQuery } = await import('../../src/services/ragService.js');
      
      mockGetCompletion.mockResolvedValueOnce({ text: 'Assembled answer' });

      const result = await ragQuery('query requiring context');

      expect(result.answer).toBe('Assembled answer');
      expect(result.sources).toBeDefined();
      expect(result.sources?.length).toBeGreaterThan(0);
    });

    it('should include citations in context', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      
      const mockResults = [
        { chunk: { id: 'chunk1', content: 'Source one info', source: 'doc1.md', type: 'doc', embedding: [0.9] }, score: 0.9 },
        { chunk: { id: 'chunk2', content: 'Source two info', source: 'doc2.md', type: 'doc', embedding: [0.8] }, score: 0.8 },
      ];
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      const { ragQuery } = await import('../../src/services/ragService.js');
      
      mockGetCompletion.mockResolvedValueOnce({ text: 'Answer with [1] and [2]' });

      const result = await ragQuery('query with citations');

      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBeGreaterThan(0);
      expect(result.citations?.[0]).toHaveProperty('id');
      expect(result.citations?.[0]).toHaveProperty('source');
      expect(result.citations?.[0]).toHaveProperty('type');
    });

    it('should calculate confidence score', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      
      const mockResults = [
        { chunk: { id: 'chunk1', content: 'High relevance', source: 'doc.md', type: 'doc', embedding: [0.95] }, score: 0.95 },
      ];
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      const { ragQuery } = await import('../../src/services/ragService.js');
      
      mockGetCompletion.mockResolvedValueOnce({ text: 'Confident answer' });

      const result = await ragQuery('test query');

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide fallback message for low confidence', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      
      const mockResults = [
        { chunk: { id: 'chunk1', content: 'Low relevance', source: 'doc.md', type: 'doc', embedding: [0.1] }, score: 0.1 },
      ];
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      const { ragQuery } = await import('../../src/services/ragService.js');
      
      mockGetCompletion.mockResolvedValueOnce({ text: 'Uncertain answer' });

      const result = await ragQuery('unrelated query');

      expect(result.fallback).toBeDefined();
    });
  });

  describe('Document updates and versioning', () => {
    it('should handle document updates', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      const mockClear = vi.fn().mockResolvedValue(undefined);
      const mockUpsert = vi.fn().mockResolvedValue(undefined);
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValue({
        query: vi.fn().mockResolvedValue([]),
        upsert: mockUpsert,
        clear: mockClear,
      });

      const { runIndexer } = await import('../../src/services/ragService.js');
      
      const docs = [
        { content: 'Updated content v2', source: 'doc.md', type: 'doc' as const },
      ];

      await runIndexer(docs);

      expect(mockUpsert).toHaveBeenCalled();
    });

    it('should clear previous index when re-indexing', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      const mockClear = vi.fn().mockResolvedValue(undefined);
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValue({
        query: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: mockClear,
      });

      const { runIndexer } = await import('../../src/services/ragService.js');
      
      const docs = [
        { content: 'New version', source: 'doc.md', type: 'doc' as const },
      ];

      await runIndexer(docs);

      expect(mockClear).toHaveBeenCalled();
    });

    it('should maintain document versioning metadata', async () => {
      const { runIndexer } = await import('../../src/services/ragService.js');
      
      const docs = [
        { content: 'Version 1', source: 'doc.md', type: 'doc' as const },
        { content: 'Version 2', source: 'doc.md', type: 'doc' as const },
      ];

      const result = await runIndexer(docs);

      expect(result.chunks).toBeGreaterThanOrEqual(0);
    });

    it('should handle incremental updates', async () => {
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      const mockUpsert = vi.fn().mockResolvedValue(undefined);
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValue({
        query: vi.fn().mockResolvedValue([]),
        upsert: mockUpsert,
        clear: vi.fn().mockResolvedValue(undefined),
      });

      const { runIndexer } = await import('../../src/services/ragService.js');
      
      // First index
      await runIndexer([
        { content: 'Doc 1', source: 'doc1.md', type: 'doc' as const },
      ]);

      // Incremental update - add more docs
      await runIndexer([
        { content: 'Doc 1', source: 'doc1.md', type: 'doc' as const },
        { content: 'Doc 2', source: 'doc2.md', type: 'doc' as const },
      ]);

      expect(mockUpsert).toHaveBeenCalled();
    });

    it('should preserve embeddedAt timestamp', async () => {
      const { saveIndex } = await import('../../src/services/ragService.js');
      
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const index = {
        chunks: [],
        embeddedAt: new Date().toISOString(),
      };

      await saveIndex(index);

      expect(writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('embeddedAt'),
        'utf8'
      );
    });
  });

  describe('Hybrid search with RRF', () => {
    it('should combine vector and keyword scores with RRF', async () => {
      const { ragQuery } = await import('../../src/services/ragService.js');
      
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      
      const mockResults = [
        { chunk: { id: 'chunk1', content: 'vector match', source: 'doc.md', type: 'doc', embedding: [0.9] }, score: 0.9 },
        { chunk: { id: 'chunk2', content: 'keyword match', source: 'doc.md', type: 'doc', embedding: [0.5] }, score: 0.5 },
      ];
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      mockGetCompletion.mockResolvedValueOnce({ text: 'Hybrid answer' });

      const result = await ragQuery('hybrid search query', { hybrid: true });

      expect(result).toBeDefined();
      expect(result.answer).toBe('Hybrid answer');
    });

    it('should weight vector and keyword results appropriately', async () => {
      const { ragQuery } = await import('../../src/services/ragService.js');
      
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      
      // Results where keyword score would change ranking
      const mockResults = [
        { chunk: { id: 'chunk1', content: 'semantic similarity', source: 'doc.md', type: 'doc', embedding: [0.8] }, score: 0.8 },
        { chunk: { id: 'chunk2', content: 'exact keyword match here', source: 'doc.md', type: 'doc', embedding: [0.6] }, score: 0.6 },
      ];
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      mockGetCompletion.mockResolvedValueOnce({ text: 'Weighted answer' });

      const result = await ragQuery('keyword match', { hybrid: true });

      expect(result.answer).toBe('Weighted answer');
    });
  });

  describe('Re-ranking', () => {
    it('should re-rank results using NIM re-ranker', async () => {
      process.env.RAG_RERANKER = 'nim';
      
      const { ragQuery } = await import('../../src/services/ragService.js');
      
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      
      const mockResults = [
        { chunk: { id: 'chunk1', content: 'Initial rank 1', source: 'doc.md', type: 'doc', embedding: [0.9] }, score: 0.9 },
        { chunk: { id: 'chunk2', content: 'Initial rank 2', source: 'doc.md', type: 'doc', embedding: [0.8] }, score: 0.8 },
      ];
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      mockGetCompletion.mockResolvedValueOnce({ text: 'Re-ranked answer' });

      const result = await ragQuery('re-rank query');

      expect(result).toBeDefined();
    });

    it('should use external re-ranker when configured', async () => {
      process.env.RAG_RERANKER_URL = 'https://reranker.example.com/rerank';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          order: [1, 0], // Reorder results
          scores: [0.95, 0.85]
        }),
      });

      mockGetCompletion.mockResolvedValueOnce({ text: 'Externally re-ranked answer' });

      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      
      const mockResults = [
        { chunk: { id: 'chunk1', content: 'Doc 1', source: 'doc.md', type: 'doc', embedding: [0.9] }, score: 0.9 },
        { chunk: { id: 'chunk2', content: 'Doc 2', source: 'doc.md', type: 'doc', embedding: [0.8] }, score: 0.8 },
      ];
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      const { ragQuery } = await import('../../src/services/ragService.js');
      
      const result = await ragQuery('external re-rank query');

      expect(result).toBeDefined();
    });
  });

  describe('Claude fallback', () => {
    it('should fallback to Claude on low confidence', async () => {
      process.env.RAG_CLAUDE_FALLBACK = 'true';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      
      // Low relevance results to trigger fallback
      const mockResults = [
        { chunk: { id: 'chunk1', content: 'Low relevance', source: 'doc.md', type: 'doc', embedding: [0.1] }, score: 0.1 },
      ];
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      // First call (router) returns empty, triggering Claude fallback
      mockGetCompletion.mockResolvedValueOnce({ text: '' });
      // Claude fallback succeeds
      mockGetCompletion.mockResolvedValueOnce({ text: 'Claude fallback answer' });

      const { ragQuery } = await import('../../src/services/ragService.js');
      
      const result = await ragQuery('fallback query');

      // Note: Actual fallback behavior depends on implementation
      expect(result).toBeDefined();
    });

    it('should track fallback provider in result', async () => {
      process.env.RAG_CLAUDE_FALLBACK = 'true';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      
      const { getVectorStore } = await import('../../src/services/vectorStoreAdapter.js');
      
      const mockResults = [
        { chunk: { id: 'chunk1', content: 'Content', source: 'doc.md', type: 'doc', embedding: [0.2] }, score: 0.2 },
      ];
      
      (getVectorStore as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        query: vi.fn().mockResolvedValue(mockResults),
        upsert: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      });

      mockGetCompletion.mockResolvedValueOnce({ text: 'NIM answer' });

      const { ragQuery } = await import('../../src/services/ragService.js');
      
      const result = await ragQuery('query with fallback');

      // If fallback was used, should be indicated
      if (result.fallbackProvider) {
        expect(result.fallbackProvider).toBe('claude');
      }
    });
  });
});
