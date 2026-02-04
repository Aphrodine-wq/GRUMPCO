/**
 * Holographic Memory Service Tests
 *
 * Tests for Holographic Reduced Representations (HRR) implementation.
 * Tests HRRVector, HolographicMemory, HoloKVCache, and HolographicMemoryService.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HRRVector,
  HolographicMemory,
  HoloKVCache,
  HolographicMemoryService,
} from '../../src/services/holographicMemory.js';

describe('HRRVector', () => {
  describe('constructor', () => {
    it('should create vector with default dimension', () => {
      const vec = new HRRVector();
      expect(vec.dimension).toBe(4096);
      expect(vec.real.length).toBe(4096);
      expect(vec.imag.length).toBe(4096);
    });

    it('should create vector with custom dimension', () => {
      const vec = new HRRVector(2048);
      expect(vec.dimension).toBe(2048);
    });

    it('should round up dimension to power of 2', () => {
      const vec = new HRRVector(1000);
      expect(vec.dimension).toBe(1024); // Next power of 2
    });

    it('should initialize arrays with zeros', () => {
      const vec = new HRRVector(256);
      for (let i = 0; i < vec.dimension; i++) {
        expect(vec.real[i]).toBe(0);
        expect(vec.imag[i]).toBe(0);
      }
    });
  });

  describe('fromText', () => {
    it('should create vector from text', () => {
      const vec = HRRVector.fromText('hello world', 256);
      expect(vec.dimension).toBe(256);
      expect(vec.real.length).toBe(256);
    });

    it('should produce deterministic vectors for same text', () => {
      const vec1 = HRRVector.fromText('test string', 256);
      const vec2 = HRRVector.fromText('test string', 256);

      for (let i = 0; i < vec1.dimension; i++) {
        expect(vec1.real[i]).toBeCloseTo(vec2.real[i], 10);
        expect(vec1.imag[i]).toBeCloseTo(vec2.imag[i], 10);
      }
    });

    it('should produce different vectors for different text', () => {
      const vec1 = HRRVector.fromText('hello', 256);
      const vec2 = HRRVector.fromText('world', 256);

      let sameCount = 0;
      for (let i = 0; i < vec1.dimension; i++) {
        if (Math.abs(vec1.real[i] - vec2.real[i]) < 0.0001) {
          sameCount++;
        }
      }
      // Should have mostly different values
      expect(sameCount).toBeLessThan(vec1.dimension * 0.5);
    });

    it('should produce normalized unit vectors', () => {
      const vec = HRRVector.fromText('test', 256);
      const magnitude = vec.magnitude();
      expect(magnitude).toBeCloseTo(1, 5);
    });
  });

  describe('fromEmbedding', () => {
    it('should create vector from embedding array', () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const vec = HRRVector.fromEmbedding(embedding, 256);

      expect(vec.dimension).toBe(256);
      for (let i = 0; i < embedding.length; i++) {
        expect(vec.real[i]).toBe(embedding[i]);
      }
    });

    it('should truncate embedding if larger than dimension', () => {
      const embedding = new Array(512).fill(0).map((_, i) => i * 0.01);
      const vec = HRRVector.fromEmbedding(embedding, 256);

      expect(vec.dimension).toBe(256);
      for (let i = 0; i < 256; i++) {
        expect(vec.real[i]).toBe(embedding[i]);
      }
    });

    it('should pad with small random values if embedding is smaller', () => {
      const embedding = [0.1, 0.2, 0.3];
      const vec = HRRVector.fromEmbedding(embedding, 256);

      expect(vec.real[0]).toBe(0.1);
      expect(vec.real[1]).toBe(0.2);
      expect(vec.real[2]).toBe(0.3);
      // Remaining values should be small random
      for (let i = 3; i < 256; i++) {
        expect(Math.abs(vec.real[i])).toBeLessThan(0.1);
      }
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const original = HRRVector.fromText('test', 256);
      const clone = original.clone();

      expect(clone.dimension).toBe(original.dimension);

      // Modify original
      original.real[0] = 999;

      // Clone should be unchanged
      expect(clone.real[0]).not.toBe(999);
    });
  });

  describe('bind', () => {
    it('should bind two vectors together', () => {
      const key = HRRVector.fromText('key', 256);
      const value = HRRVector.fromText('value', 256);
      const bound = key.bind(value);

      expect(bound.dimension).toBe(256);
      expect(bound).not.toBe(key);
      expect(bound).not.toBe(value);
    });

    it('should throw for mismatched dimensions', () => {
      const vec1 = new HRRVector(256);
      const vec2 = new HRRVector(512);

      expect(() => vec1.bind(vec2)).toThrow('Vectors must have same dimension');
    });

    it('should be associative with unbind', () => {
      const key = HRRVector.fromText('key', 256);
      const value = HRRVector.fromText('value', 256);

      const bound = key.bind(value);
      const retrieved = bound.unbind(key);

      // Retrieved should be similar to original value
      const similarity = retrieved.similarity(value);
      expect(similarity).toBeGreaterThan(0.1); // Some correlation expected
    });
  });

  describe('unbind', () => {
    it('should unbind vector using key', () => {
      const key = HRRVector.fromText('key', 256);
      const value = HRRVector.fromText('value', 256);

      const bound = key.bind(value);
      const unbound = bound.unbind(key);

      expect(unbound.dimension).toBe(256);
    });
  });

  describe('inverse', () => {
    it('should compute inverse vector', () => {
      const vec = HRRVector.fromText('test', 256);
      const inv = vec.inverse();

      expect(inv.dimension).toBe(vec.dimension);
      expect(inv).not.toBe(vec);
    });

    it('should preserve first element with conjugate', () => {
      const vec = HRRVector.fromText('test', 256);
      const inv = vec.inverse();

      expect(inv.real[0]).toBe(vec.real[0]);
      expect(inv.imag[0]).toBe(-vec.imag[0]);
    });
  });

  describe('add', () => {
    it('should add two vectors', () => {
      const vec1 = new HRRVector(256);
      const vec2 = new HRRVector(256);
      vec1.real[0] = 1;
      vec2.real[0] = 2;

      const sum = vec1.add(vec2);

      expect(sum.real[0]).toBe(3);
    });

    it('should not modify original vectors', () => {
      const vec1 = HRRVector.fromText('a', 256);
      const vec2 = HRRVector.fromText('b', 256);
      const originalReal0 = vec1.real[0];

      vec1.add(vec2);

      expect(vec1.real[0]).toBe(originalReal0);
    });
  });

  describe('addInPlace', () => {
    it('should modify original vector', () => {
      const vec1 = new HRRVector(256);
      const vec2 = new HRRVector(256);
      vec1.real[0] = 1;
      vec2.real[0] = 2;

      vec1.addInPlace(vec2);

      expect(vec1.real[0]).toBe(3);
    });
  });

  describe('scale', () => {
    it('should scale vector by factor', () => {
      const vec = new HRRVector(256);
      vec.real[0] = 2;
      vec.imag[0] = 3;

      const scaled = vec.scale(2);

      expect(scaled.real[0]).toBe(4);
      expect(scaled.imag[0]).toBe(6);
    });

    it('should not modify original', () => {
      const vec = new HRRVector(256);
      vec.real[0] = 2;

      vec.scale(10);

      expect(vec.real[0]).toBe(2);
    });
  });

  describe('magnitude', () => {
    it('should compute correct magnitude', () => {
      const vec = new HRRVector(256);
      vec.real[0] = 3;
      vec.imag[0] = 4;

      const mag = vec.magnitude();

      expect(mag).toBe(5);
    });

    it('should return 0 for zero vector', () => {
      const vec = new HRRVector(256);
      expect(vec.magnitude()).toBe(0);
    });
  });

  describe('normalize', () => {
    it('should normalize to unit vector', () => {
      const vec = new HRRVector(256);
      vec.real[0] = 3;
      vec.imag[0] = 4;

      const normalized = vec.normalize();

      expect(normalized.magnitude()).toBeCloseTo(1, 10);
    });

    it('should handle zero vector', () => {
      const vec = new HRRVector(256);
      const normalized = vec.normalize();

      expect(normalized.magnitude()).toBe(0);
    });
  });

  describe('similarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = HRRVector.fromText('test', 256);
      const similarity = vec.similarity(vec);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return high similarity for similar text', () => {
      const vec1 = HRRVector.fromText('hello world', 256);
      const vec2 = HRRVector.fromText('hello world', 256);

      expect(vec1.similarity(vec2)).toBeCloseTo(1, 5);
    });

    it('should return 0 for zero vectors', () => {
      const vec1 = new HRRVector(256);
      const vec2 = new HRRVector(256);

      expect(vec1.similarity(vec2)).toBe(0);
    });

    it('should return value between -1 and 1', () => {
      const vec1 = HRRVector.fromText('apple', 256);
      const vec2 = HRRVector.fromText('orange', 256);

      const sim = vec1.similarity(vec2);
      expect(sim).toBeGreaterThanOrEqual(-1);
      expect(sim).toBeLessThanOrEqual(1);
    });
  });

  describe('toJSON and fromJSON', () => {
    it('should serialize to JSON', () => {
      const vec = HRRVector.fromText('test', 256);
      const json = vec.toJSON();

      expect(json.dimension).toBe(256);
      expect(json.real).toHaveLength(256);
      expect(json.imag).toHaveLength(256);
    });

    it('should deserialize from JSON', () => {
      const original = HRRVector.fromText('test', 256);
      const json = original.toJSON();
      const restored = HRRVector.fromJSON(json);

      expect(restored.dimension).toBe(original.dimension);
      expect(restored.similarity(original)).toBeCloseTo(1, 10);
    });

    it('should handle round-trip serialization', () => {
      const original = HRRVector.fromText('round trip test', 256);
      const restored = HRRVector.fromJSON(original.toJSON());

      for (let i = 0; i < original.dimension; i++) {
        expect(restored.real[i]).toBe(original.real[i]);
        expect(restored.imag[i]).toBe(original.imag[i]);
      }
    });
  });
});

describe('HolographicMemory', () => {
  let memory: HolographicMemory;

  beforeEach(() => {
    memory = new HolographicMemory(256, 0.999);
  });

  describe('constructor', () => {
    it('should create memory with default parameters', () => {
      const mem = new HolographicMemory();
      const stats = mem.getStats();
      expect(stats.dimension).toBe(4096);
    });

    it('should create memory with custom dimension', () => {
      const mem = new HolographicMemory(512);
      expect(mem.getStats().dimension).toBe(512);
    });
  });

  describe('store', () => {
    it('should store string key-value pair', () => {
      memory.store('key1', 'value1');
      const stats = memory.getStats();
      expect(stats.entryCount).toBe(1);
    });

    it('should store HRRVector key-value pair', () => {
      const key = HRRVector.fromText('key', 256);
      const value = HRRVector.fromText('value', 256);
      memory.store(key, value);

      const stats = memory.getStats();
      expect(stats.entryCount).toBe(1);
    });

    it('should store multiple pairs', () => {
      memory.store('key1', 'value1');
      memory.store('key2', 'value2');
      memory.store('key3', 'value3');

      const stats = memory.getStats();
      expect(stats.entryCount).toBe(3);
    });

    it('should increase memory magnitude with storage', () => {
      const initialMag = memory.getStats().memoryMagnitude;
      memory.store('key', 'value');
      const afterMag = memory.getStats().memoryMagnitude;

      expect(afterMag).toBeGreaterThan(initialMag);
    });
  });

  describe('retrieve', () => {
    it('should retrieve stored value by string key', () => {
      memory.store('apple', 'fruit');
      const retrieved = memory.retrieve('apple');

      expect(retrieved).toBeInstanceOf(HRRVector);
      expect(retrieved.dimension).toBe(256);
    });

    it('should retrieve stored value by vector key', () => {
      const key = HRRVector.fromText('mykey', 256);
      const value = HRRVector.fromText('myvalue', 256);
      memory.store(key, value);

      const retrieved = memory.retrieve(key);
      expect(retrieved).toBeInstanceOf(HRRVector);
    });
  });

  describe('retrieveWithSimilarity', () => {
    it('should return retrieved vector with similarity score', () => {
      memory.store('database', 'storage');
      const result = memory.retrieveWithSimilarity('database', 'storage');

      expect(result.retrieved).toBeInstanceOf(HRRVector);
      expect(typeof result.similarity).toBe('number');
    });

    it('should show higher similarity for correct key-value', () => {
      memory.store('correct_key', 'correct_value');
      memory.store('other_key', 'other_value');

      const correctResult = memory.retrieveWithSimilarity('correct_key', 'correct_value');
      const wrongResult = memory.retrieveWithSimilarity('correct_key', 'wrong_value');

      // Correct retrieval should have higher similarity
      expect(correctResult.similarity).toBeGreaterThan(wrongResult.similarity);
    });
  });

  describe('queryMultiple', () => {
    it('should query with multiple keys', () => {
      memory.store('key1', 'value1');
      memory.store('key2', 'value2');

      const result = memory.queryMultiple(['key1', 'key2']);

      expect(result).toBeInstanceOf(HRRVector);
    });

    it('should apply custom weights', () => {
      memory.store('key1', 'value1');
      memory.store('key2', 'value2');

      const result = memory.queryMultiple(['key1', 'key2'], [0.8, 0.2]);

      expect(result).toBeInstanceOf(HRRVector);
    });

    it('should use equal weights by default', () => {
      memory.store('a', 'va');
      memory.store('b', 'vb');
      memory.store('c', 'vc');

      const result = memory.queryMultiple(['a', 'b', 'c']);

      expect(result).toBeInstanceOf(HRRVector);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      memory.store('k1', 'v1');
      memory.store('k2', 'v2');

      const stats = memory.getStats();

      expect(stats.dimension).toBe(256);
      expect(stats.entryCount).toBe(2);
      expect(stats.memoryMagnitude).toBeGreaterThan(0);
      expect(stats.estimatedCapacity).toBe(Math.floor(256 / 10));
      expect(stats.memoryUsageBytes).toBe(256 * 16);
    });
  });

  describe('clear', () => {
    it('should reset memory to empty state', () => {
      memory.store('key1', 'value1');
      memory.store('key2', 'value2');

      memory.clear();

      const stats = memory.getStats();
      expect(stats.entryCount).toBe(0);
      expect(stats.memoryMagnitude).toBe(0);
    });
  });

  describe('toJSON and fromJSON', () => {
    it('should serialize memory state', () => {
      memory.store('key1', 'value1');
      memory.store('key2', 'value2');

      const json = memory.toJSON();

      expect(json).toHaveProperty('dimension');
      expect(json).toHaveProperty('decayFactor');
      expect(json).toHaveProperty('entryCount');
      expect(json).toHaveProperty('memory');
    });

    it('should deserialize memory state', () => {
      memory.store('key1', 'value1');
      memory.store('key2', 'value2');

      const json = memory.toJSON() as any;
      const restored = HolographicMemory.fromJSON(json);

      expect(restored.getStats().entryCount).toBe(2);
      expect(restored.getStats().dimension).toBe(256);
    });
  });
});

describe('HoloKVCache', () => {
  let cache: HoloKVCache;

  beforeEach(() => {
    cache = new HoloKVCache(4, 256); // 4 layers, 256 dimension
  });

  describe('constructor', () => {
    it('should create cache with specified layers', () => {
      const stats = cache.getStats();
      expect(stats.numLayers).toBe(4);
      expect(stats.dimension).toBe(256);
    });

    it('should create cache with default values', () => {
      const defaultCache = new HoloKVCache();
      const stats = defaultCache.getStats();
      expect(stats.numLayers).toBe(32);
      expect(stats.dimension).toBe(4096);
    });
  });

  describe('encodeToken', () => {
    it('should encode token key-value at specified layer', () => {
      const key = [0.1, 0.2, 0.3];
      const value = [0.4, 0.5, 0.6];

      cache.encodeToken(0, 0, key, value);

      const stats = cache.getStats();
      expect(stats.tokenCount).toBe(1);
    });

    it('should encode with HRRVector inputs', () => {
      const key = HRRVector.fromText('key', 256);
      const value = HRRVector.fromText('value', 256);

      cache.encodeToken(0, 0, key, value);

      expect(cache.getStats().tokenCount).toBe(1);
    });

    it('should throw for invalid layer', () => {
      expect(() => cache.encodeToken(10, 0, [0.1], [0.2])).toThrow('Layer 10 not found');
    });

    it('should track token count only on layer 0', () => {
      cache.encodeToken(0, 0, [0.1], [0.2]);
      cache.encodeToken(1, 0, [0.1], [0.2]);
      cache.encodeToken(2, 0, [0.1], [0.2]);

      expect(cache.getStats().tokenCount).toBe(1);
    });
  });

  describe('retrieveForAttention', () => {
    it('should retrieve values for attention computation', () => {
      const key = [0.1, 0.2];
      const value = [0.3, 0.4];

      cache.encodeToken(0, 0, key, value);

      const results = cache.retrieveForAttention(0, [0], [[0.1, 0.2]]);

      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(HRRVector);
    });

    it('should retrieve multiple positions', () => {
      cache.encodeToken(0, 0, [0.1], [0.2]);
      cache.encodeToken(0, 1, [0.3], [0.4]);

      const results = cache.retrieveForAttention(0, [0, 1], [[0.1], [0.3]]);

      expect(results).toHaveLength(2);
    });

    it('should throw for invalid layer', () => {
      expect(() => cache.retrieveForAttention(10, [0], [[0.1]])).toThrow('Layer 10 not found');
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', () => {
      cache.encodeToken(0, 0, [0.1], [0.2]);
      cache.encodeToken(0, 1, [0.3], [0.4]);

      const stats = cache.getStats();

      expect(stats.numLayers).toBe(4);
      expect(stats.dimension).toBe(256);
      expect(stats.tokenCount).toBe(2);
      expect(stats.totalMemoryBytes).toBe(256 * 16 * 4);
      expect(stats.memoryPerLayer).toBe(256 * 16);
      expect(stats.traditionalKVCacheBytes).toBeGreaterThan(0);
      expect(stats.compressionRatio).toBeGreaterThan(0);
    });

    it('should show compression benefit for many tokens', () => {
      // Encode many tokens
      for (let i = 0; i < 100; i++) {
        cache.encodeToken(0, i, [0.1 * i], [0.2 * i]);
      }

      const stats = cache.getStats();

      // HoloKV cache is fixed size, traditional grows with tokens
      expect(stats.compressionRatio).toBeGreaterThan(1);
    });
  });

  describe('clear', () => {
    it('should clear all layers', () => {
      cache.encodeToken(0, 0, [0.1], [0.2]);
      cache.encodeToken(1, 0, [0.3], [0.4]);

      cache.clear();

      const stats = cache.getStats();
      expect(stats.tokenCount).toBe(0);
    });
  });
});

describe('HolographicMemoryService', () => {
  let service: HolographicMemoryService;

  beforeEach(() => {
    service = HolographicMemoryService.getInstance();
    // Clear any existing memories
    const list = service.listAll();
    list.memories.forEach((m) => service.delete(m.name));
    list.kvCaches.forEach((c) => service.delete(c.name));
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = HolographicMemoryService.getInstance();
      const instance2 = HolographicMemoryService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getMemory', () => {
    it('should create new memory if not exists', () => {
      const memory = service.getMemory('test_memory', 256);
      expect(memory).toBeInstanceOf(HolographicMemory);
      expect(memory.getStats().dimension).toBe(256);
    });

    it('should return existing memory', () => {
      const mem1 = service.getMemory('shared', 256);
      mem1.store('key', 'value');

      const mem2 = service.getMemory('shared', 256);
      expect(mem2.getStats().entryCount).toBe(1);
    });

    it('should use default dimension', () => {
      const memory = service.getMemory('default_dim');
      expect(memory.getStats().dimension).toBe(4096);
    });
  });

  describe('getKVCache', () => {
    it('should create new KV cache if not exists', () => {
      const cache = service.getKVCache('test_cache', 4, 256);
      expect(cache).toBeInstanceOf(HoloKVCache);
      expect(cache.getStats().numLayers).toBe(4);
      expect(cache.getStats().dimension).toBe(256);
    });

    it('should return existing KV cache', () => {
      const cache1 = service.getKVCache('shared_cache', 4, 256);
      cache1.encodeToken(0, 0, [0.1], [0.2]);

      const cache2 = service.getKVCache('shared_cache', 4, 256);
      expect(cache2.getStats().tokenCount).toBe(1);
    });

    it('should use default parameters', () => {
      const cache = service.getKVCache('default_cache');
      const stats = cache.getStats();
      expect(stats.numLayers).toBe(32);
      expect(stats.dimension).toBe(4096);
    });
  });

  describe('listAll', () => {
    it('should list all memories and caches', () => {
      service.getMemory('mem1', 256);
      service.getMemory('mem2', 512);
      service.getKVCache('cache1', 4, 256);

      const list = service.listAll();

      expect(list.memories).toHaveLength(2);
      expect(list.kvCaches).toHaveLength(1);
      expect(list.memories.map((m) => m.name)).toContain('mem1');
      expect(list.memories.map((m) => m.name)).toContain('mem2');
      expect(list.kvCaches.map((c) => c.name)).toContain('cache1');
    });

    it('should include stats for each item', () => {
      const mem = service.getMemory('test', 256);
      mem.store('key', 'value');

      const list = service.listAll();

      const memItem = list.memories.find((m) => m.name === 'test');
      expect(memItem?.stats.entryCount).toBe(1);
    });

    it('should return empty arrays when no items', () => {
      const list = service.listAll();
      expect(list.memories).toEqual([]);
      expect(list.kvCaches).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete memory by name', () => {
      service.getMemory('to_delete', 256);

      const result = service.delete('to_delete');

      expect(result).toBe(true);
      expect(service.listAll().memories.map((m) => m.name)).not.toContain('to_delete');
    });

    it('should delete KV cache by name', () => {
      service.getKVCache('cache_to_delete', 4, 256);

      const result = service.delete('cache_to_delete');

      expect(result).toBe(true);
      expect(service.listAll().kvCaches.map((c) => c.name)).not.toContain('cache_to_delete');
    });

    it('should return false for non-existent name', () => {
      const result = service.delete('non_existent');
      expect(result).toBe(false);
    });
  });
});
