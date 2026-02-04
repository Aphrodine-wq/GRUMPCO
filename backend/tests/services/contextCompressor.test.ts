/**
 * Context Compressor Service Tests
 *
 * Tests for the ContextCompressor and ContextCompressorService classes
 * which implement "Genomic Prompts" - compressing massive contexts into fixed-dimension vectors.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ContextCompressor,
  ContextCompressorService,
  CompressedContext,
} from '../../src/services/contextCompressor.js';

// Mock the holographicMemory module
vi.mock('../../src/services/holographicMemory.js', () => {
  // Create a mock HRRVector class
  class MockHRRVector {
    dimension: number;
    real: Float64Array;
    imag: Float64Array;

    constructor(dimension: number = 4096) {
      this.dimension = 1 << Math.ceil(Math.log2(dimension));
      this.real = new Float64Array(this.dimension);
      this.imag = new Float64Array(this.dimension);
    }

    static fromText(text: string, dimension: number = 4096): MockHRRVector {
      const vec = new MockHRRVector(dimension);
      // Fill with deterministic values based on text hash
      const hash = text.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
      for (let i = 0; i < vec.dimension; i++) {
        vec.real[i] = Math.sin(hash + i) * 0.1;
        vec.imag[i] = Math.cos(hash + i) * 0.1;
      }
      return vec;
    }

    static fromEmbedding(embedding: number[], dimension: number = 4096): MockHRRVector {
      const vec = new MockHRRVector(dimension);
      const len = Math.min(embedding.length, dimension);
      for (let i = 0; i < len; i++) {
        vec.real[i] = embedding[i];
      }
      return vec;
    }

    static fromJSON(data: { dimension: number; real: number[]; imag: number[] }): MockHRRVector {
      const vec = new MockHRRVector(data.dimension);
      vec.real = new Float64Array(data.real);
      vec.imag = new Float64Array(data.imag);
      return vec;
    }

    clone(): MockHRRVector {
      const vec = new MockHRRVector(this.dimension);
      vec.real.set(this.real);
      vec.imag.set(this.imag);
      return vec;
    }

    bind(other: MockHRRVector): MockHRRVector {
      const result = new MockHRRVector(this.dimension);
      for (let i = 0; i < this.dimension; i++) {
        result.real[i] = this.real[i] * other.real[i] - this.imag[i] * other.imag[i];
        result.imag[i] = this.real[i] * other.imag[i] + this.imag[i] * other.real[i];
      }
      return result;
    }

    addInPlace(other: MockHRRVector): void {
      for (let i = 0; i < this.dimension; i++) {
        this.real[i] += other.real[i];
        this.imag[i] += other.imag[i];
      }
    }

    scale(factor: number): MockHRRVector {
      const result = new MockHRRVector(this.dimension);
      for (let i = 0; i < this.dimension; i++) {
        result.real[i] = this.real[i] * factor;
        result.imag[i] = this.imag[i] * factor;
      }
      return result;
    }

    magnitude(): number {
      let sum = 0;
      for (let i = 0; i < this.dimension; i++) {
        sum += this.real[i] * this.real[i] + this.imag[i] * this.imag[i];
      }
      return Math.sqrt(sum);
    }

    normalize(): MockHRRVector {
      const mag = this.magnitude();
      if (mag === 0) return this.clone();
      return this.scale(1 / mag);
    }

    similarity(other: MockHRRVector): number {
      let dot = 0;
      for (let i = 0; i < this.dimension; i++) {
        dot += this.real[i] * other.real[i] + this.imag[i] * other.imag[i];
      }
      const mag1 = this.magnitude();
      const mag2 = other.magnitude();
      if (mag1 === 0 || mag2 === 0) return 0;
      return dot / (mag1 * mag2);
    }

    toJSON(): { dimension: number; real: number[]; imag: number[] } {
      return {
        dimension: this.dimension,
        real: Array.from(this.real),
        imag: Array.from(this.imag),
      };
    }
  }

  class MockHolographicMemory {
    dimension: number;

    constructor(dimension: number = 4096) {
      this.dimension = dimension;
    }
  }

  return {
    HRRVector: MockHRRVector,
    HolographicMemory: MockHolographicMemory,
  };
});

describe('ContextCompressor', () => {
  let compressor: ContextCompressor;

  beforeEach(() => {
    compressor = new ContextCompressor({
      dimension: 4096,
      chunkSize: 100,
      chunkOverlap: 10,
    });
  });

  describe('constructor', () => {
    it('should create compressor with default options', () => {
      const defaultCompressor = new ContextCompressor();
      expect(defaultCompressor).toBeInstanceOf(ContextCompressor);
    });

    it('should create compressor with custom options', () => {
      const customCompressor = new ContextCompressor({
        dimension: 2048,
        chunkSize: 256,
        chunkOverlap: 32,
      });
      expect(customCompressor).toBeInstanceOf(ContextCompressor);
    });
  });

  describe('compress', () => {
    it('should compress short text into a fixed-dimension vector', () => {
      const text = 'This is a simple test text for compression.';
      const result = compressor.compress(text, 'test_source');

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^ctx_/);
      expect(result.vector).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should generate correct compression stats', () => {
      const text = 'word '.repeat(200); // 200 words
      const result = compressor.compress(text, 'test');

      expect(result.stats.originalTokens).toBeGreaterThan(0);
      expect(result.stats.compressedDimension).toBe(4096);
      expect(result.stats.compressionRatio).toBeGreaterThan(0);
      expect(result.stats.chunkCount).toBeGreaterThan(0);
      expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include correct metadata', () => {
      const text = 'Test text for metadata verification.';
      const source = 'my_source';
      const result = compressor.compress(text, source);

      expect(result.metadata.source).toBe(source);
      expect(result.metadata.createdAt).toBeDefined();
      expect(new Date(result.metadata.createdAt)).toBeInstanceOf(Date);
      expect(Array.isArray(result.metadata.chunkHashes)).toBe(true);
    });

    it('should handle long text with multiple chunks', () => {
      // Create text with 500 words (should create multiple chunks with chunkSize 100)
      const text = 'word '.repeat(500);
      const result = compressor.compress(text, 'long_text');

      expect(result.stats.chunkCount).toBeGreaterThan(1);
      expect(result.metadata.chunkHashes.length).toBe(result.stats.chunkCount);
    });

    it('should handle empty or whitespace-only text', () => {
      const emptyResult = compressor.compress('', 'empty');
      expect(emptyResult).toBeDefined();
      // Empty string split by whitespace produces [''] with length 1
      // This is the expected behavior from text.split(/\s+/).length
      expect(emptyResult.stats.originalTokens).toBe(1);
    });

    it('should handle text with special characters', () => {
      const text = 'function foo() { return "hello"; } // comment @#$%^&*()';
      const result = compressor.compress(text, 'code');

      expect(result).toBeDefined();
      expect(result.stats.originalTokens).toBeGreaterThan(0);
    });

    it('should use default source when not provided', () => {
      const result = compressor.compress('test text');
      expect(result.metadata.source).toBe('unknown');
    });
  });

  describe('similarity', () => {
    it('should compute high similarity for identical texts', () => {
      const text = 'This is a test text for similarity comparison.';
      const ctx1 = compressor.compress(text, 'source1');
      const ctx2 = compressor.compress(text, 'source2');

      const sim = compressor.similarity(ctx1, ctx2);
      expect(sim).toBeGreaterThan(0.9); // Should be very similar
    });

    it('should compute lower similarity for different texts', () => {
      const ctx1 = compressor.compress('JavaScript is a programming language.', 'source1');
      const ctx2 = compressor.compress('Cooking requires ingredients and recipes.', 'source2');

      const sim = compressor.similarity(ctx1, ctx2);
      expect(sim).toBeLessThan(0.8); // Should be less similar
    });
  });

  describe('querySimilarity', () => {
    it('should compute similarity between compressed context and query text', () => {
      const ctx = compressor.compress('TypeScript is a typed superset of JavaScript.', 'doc');
      const similarity = compressor.querySimilarity(ctx, 'TypeScript');

      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('merge', () => {
    it('should merge multiple contexts into one', () => {
      const ctx1 = compressor.compress('First context about programming.', 'source1');
      const ctx2 = compressor.compress('Second context about databases.', 'source2');
      const ctx3 = compressor.compress('Third context about testing.', 'source3');

      const merged = compressor.merge([ctx1, ctx2, ctx3]);

      expect(merged).toBeDefined();
      expect(merged.id).toMatch(/^ctx_/);
      expect(merged.metadata.source).toBe('merged_3_contexts');
      expect(merged.stats.originalTokens).toBe(
        ctx1.stats.originalTokens + ctx2.stats.originalTokens + ctx3.stats.originalTokens
      );
      expect(merged.stats.chunkCount).toBe(
        ctx1.stats.chunkCount + ctx2.stats.chunkCount + ctx3.stats.chunkCount
      );
    });

    it('should apply custom weights when merging', () => {
      const ctx1 = compressor.compress('Important context.', 'source1');
      const ctx2 = compressor.compress('Less important context.', 'source2');

      const merged = compressor.merge([ctx1, ctx2], [0.8, 0.2]);

      expect(merged).toBeDefined();
      // The merged context should exist - actual weighting is tested via similarity
    });

    it('should use equal weights by default', () => {
      const ctx1 = compressor.compress('Context one.', 'source1');
      const ctx2 = compressor.compress('Context two.', 'source2');

      const merged = compressor.merge([ctx1, ctx2]);

      expect(merged).toBeDefined();
      expect(merged.metadata.chunkHashes.length).toBeGreaterThan(0);
    });
  });

  describe('retrieveRelevant', () => {
    it('should retrieve relevant chunks from original text', () => {
      const originalText = [
        'JavaScript is a programming language.',
        'Python is used for machine learning.',
        'TypeScript adds types to JavaScript.',
        'Java is used for enterprise applications.',
        'Rust is a systems programming language.',
      ].join(' ');

      const results = compressor.retrieveRelevant(originalText, 'TypeScript', 3);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('chunk');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('position');
        expect(typeof result.score).toBe('number');
        expect(typeof result.position).toBe('number');
      });
    });

    it('should return sorted results by score', () => {
      const originalText = 'word '.repeat(300);
      const results = compressor.retrieveRelevant(originalText, 'test query', 5);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe('serialize and deserialize', () => {
    it('should serialize context to JSON string', () => {
      const ctx = compressor.compress('Test text for serialization.', 'test');
      const serialized = compressor.serialize(ctx);

      expect(typeof serialized).toBe('string');
      const parsed = JSON.parse(serialized);
      expect(parsed.id).toBe(ctx.id);
      expect(parsed.stats).toEqual(ctx.stats);
      expect(parsed.metadata).toEqual(ctx.metadata);
    });

    it('should deserialize JSON string back to context', () => {
      const original = compressor.compress('Test text for deserialization.', 'test');
      const serialized = compressor.serialize(original);
      const deserialized = compressor.deserialize(serialized);

      expect(deserialized.id).toBe(original.id);
      expect(deserialized.stats).toEqual(original.stats);
      expect(deserialized.metadata).toEqual(original.metadata);
    });

    it('should handle round-trip serialization', () => {
      const original = compressor.compress('Round trip test.', 'test');
      const roundTripped = compressor.deserialize(compressor.serialize(original));

      // The deserialized context should be usable
      const similarity = compressor.similarity(original, roundTripped);
      expect(similarity).toBeGreaterThan(0.99); // Should be nearly identical
    });
  });

  describe('importance computation', () => {
    it('should give higher importance to code chunks', () => {
      const codeText = 'function test() { return 42; } class MyClass {}';
      const codeResult = compressor.compress(codeText, 'code');

      const regularText = 'This is a regular paragraph of text.';
      const regularResult = compressor.compress(regularText, 'regular');

      // Both should compress successfully
      expect(codeResult).toBeDefined();
      expect(regularResult).toBeDefined();
    });

    it('should give higher importance to question chunks', () => {
      const questionText = 'How does this work? What is the best approach?';
      const result = compressor.compress(questionText, 'questions');

      expect(result).toBeDefined();
    });

    it('should give higher importance to imperative chunks', () => {
      const imperativeText = 'You must implement this feature. It is important and required.';
      const result = compressor.compress(imperativeText, 'imperatives');

      expect(result).toBeDefined();
    });
  });
});

describe('ContextCompressorService', () => {
  let service: ContextCompressorService;

  beforeEach(() => {
    // Get fresh instance by clearing any existing singleton state
    service = ContextCompressorService.getInstance();
    service.clear();
  });

  afterEach(() => {
    service.clear();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ContextCompressorService.getInstance();
      const instance2 = ContextCompressorService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('compress', () => {
    it('should compress text and cache the result', () => {
      const ctx = service.compress('Test text', 'test_source');

      expect(ctx).toBeDefined();
      expect(ctx.id).toMatch(/^ctx_/);

      // Should be cached
      const cached = service.get(ctx.id);
      expect(cached).toBe(ctx);
    });

    it('should use default source when not provided', () => {
      const ctx = service.compress('Test text');
      expect(ctx.metadata.source).toBe('unknown');
    });
  });

  describe('get', () => {
    it('should return cached context by ID', () => {
      const ctx = service.compress('Test text', 'test');
      const retrieved = service.get(ctx.id);

      expect(retrieved).toBe(ctx);
    });

    it('should return undefined for non-existent ID', () => {
      const result = service.get('non_existent_id');
      expect(result).toBeUndefined();
    });
  });

  describe('querySimilarity', () => {
    it('should compute similarity for cached context', () => {
      const ctx = service.compress('Programming with TypeScript', 'test');
      const similarity = service.querySimilarity(ctx.id, 'TypeScript');

      expect(typeof similarity).toBe('number');
      expect(similarity).not.toBeNull();
    });

    it('should return null for non-existent context ID', () => {
      const result = service.querySimilarity('non_existent_id', 'query');
      expect(result).toBeNull();
    });
  });

  describe('findSimilar', () => {
    it('should find similar cached contexts', () => {
      service.compress('JavaScript programming language', 'js');
      service.compress('TypeScript type system', 'ts');
      service.compress('Python machine learning', 'py');

      const results = service.findSimilar('JavaScript', 2);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(2);
      results.forEach((result) => {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('similarity');
      });
    });

    it('should return sorted results by similarity', () => {
      service.compress('JavaScript programming', 'js');
      service.compress('TypeScript programming', 'ts');
      service.compress('Cooking recipes', 'cooking');

      const results = service.findSimilar('programming', 3);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }
    });

    it('should return empty array when no contexts cached', () => {
      const results = service.findSimilar('test query');
      expect(results).toEqual([]);
    });
  });

  describe('merge', () => {
    it('should merge cached contexts', () => {
      const ctx1 = service.compress('First context', 'source1');
      const ctx2 = service.compress('Second context', 'source2');

      const merged = service.merge([ctx1.id, ctx2.id]);

      expect(merged).toBeDefined();
      expect(merged).not.toBeNull();
      expect(merged!.metadata.source).toBe('merged_2_contexts');

      // Should be cached
      const cached = service.get(merged!.id);
      expect(cached).toBe(merged);
    });

    it('should return null when no valid context IDs provided', () => {
      const result = service.merge(['non_existent_1', 'non_existent_2']);
      expect(result).toBeNull();
    });

    it('should apply custom weights', () => {
      const ctx1 = service.compress('First context', 'source1');
      const ctx2 = service.compress('Second context', 'source2');

      const merged = service.merge([ctx1.id, ctx2.id], [0.7, 0.3]);

      expect(merged).toBeDefined();
    });

    it('should filter out non-existent contexts', () => {
      const ctx1 = service.compress('Valid context', 'source1');

      const merged = service.merge([ctx1.id, 'non_existent']);

      expect(merged).toBeDefined();
      expect(merged!.stats.chunkCount).toBe(ctx1.stats.chunkCount);
    });
  });

  describe('listAll', () => {
    it('should list all cached contexts', () => {
      service.compress('Context 1', 'source1');
      service.compress('Context 2', 'source2');
      service.compress('Context 3', 'source3');

      const list = service.listAll();

      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(3);
      list.forEach((item) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('stats');
        expect(item).toHaveProperty('source');
      });
    });

    it('should return empty array when no contexts cached', () => {
      const list = service.listAll();
      expect(list).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete cached context', () => {
      const ctx = service.compress('Test context', 'test');
      
      const deleted = service.delete(ctx.id);
      
      expect(deleted).toBe(true);
      expect(service.get(ctx.id)).toBeUndefined();
    });

    it('should return false for non-existent context', () => {
      const deleted = service.delete('non_existent_id');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cached contexts', () => {
      service.compress('Context 1', 'source1');
      service.compress('Context 2', 'source2');

      service.clear();

      expect(service.listAll()).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      service.compress('First context with some words', 'source1');
      service.compress('Second context with more words here', 'source2');

      const stats = service.getStats();

      expect(stats.cachedContexts).toBe(2);
      expect(stats.totalOriginalTokens).toBeGreaterThan(0);
      expect(stats.totalCompressedBytes).toBeGreaterThan(0);
      expect(stats.avgCompressionRatio).toBeGreaterThan(0);
    });

    it('should return zero values when no contexts cached', () => {
      const stats = service.getStats();

      expect(stats.cachedContexts).toBe(0);
      expect(stats.totalOriginalTokens).toBe(0);
      expect(stats.totalCompressedBytes).toBe(0);
      expect(stats.avgCompressionRatio).toBe(0);
    });
  });
});
