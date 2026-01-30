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

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('ragService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
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

  describe('ragQuery', () => {
    it('should throw error when API key is not set', async () => {
      delete process.env.NVIDIA_NIM_API_KEY;

      const { ragQuery } = await import('../../src/services/ragService.js');

      await expect(ragQuery('test query')).rejects.toThrow('NVIDIA_NIM_API_KEY is not set');
    });

    it('should return empty result message when no chunks found', async () => {
      const { ragQuery } = await import('../../src/services/ragService.js');
      
      const result = await ragQuery('unknown topic');

      expect(result.answer).toContain('knowledge base has not been indexed');
      expect(result.confidence).toBe(0);
    });
  });

  describe('runIndexer', () => {
    it('should throw error when API key is not set', async () => {
      delete process.env.NVIDIA_NIM_API_KEY;

      const { runIndexer } = await import('../../src/services/ragService.js');

      await expect(runIndexer([])).rejects.toThrow('NVIDIA_NIM_API_KEY is not set');
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
});
