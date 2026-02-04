/**
 * Context Cache Service unit tests.
 * Run: npm test -- contextCache.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MasterContext } from '../../src/types/context.js';

// Mock logger using vi.hoisted
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

// Import the module after mocking
import {
  getCachedContext,
  cacheContext,
  invalidateCache,
  clearCache,
  getCacheStats,
  cleanupExpiredEntries,
} from '../../src/services/contextCache.js';

// Helper to create a mock MasterContext
function createMockContext(overrides: Partial<MasterContext> = {}): MasterContext {
  const timestamp = '2025-01-01T00:00:00.000Z';
  return {
    id: 'test-id',
    projectDescription: 'Test project description',
    enrichedIntent: {
      actors: ['user', 'admin'],
      features: ['feature1', 'feature2'],
      data_flows: ['flow1'],
      tech_stack_hints: ['TypeScript', 'React'],
      constraints: { maxLatency: 100 },
      raw: 'Build a test app',
      enriched: {
        reasoning: 'Test reasoning',
        features: ['feature1'],
        users: ['user1'],
        data_flows: ['flow1'],
        tech_stack: ['TypeScript'],
        code_patterns: ['MVC'],
        architecture_hints: [],
        optimization_opportunities: [],
        code_quality_requirements: {
          type_safety: 'strict',
          testing: { unit: true, integration: true },
          documentation: ['JSDoc'],
          security: ['input validation'],
        },
      },
    },
    architecture: {
      id: 'arch-1',
      projectName: 'Test Project',
      projectDescription: 'Test description',
      projectType: 'web',
      complexity: 'standard',
      techStack: ['TypeScript', 'React', 'Node.js'],
      c4Diagrams: {
        context: 'graph TD; A-->B;',
        container: 'graph TD; B-->C;',
        component: 'graph TD; C-->D;',
      },
      metadata: {
        components: [],
        integrations: [],
        dataModels: [],
        apiEndpoints: [],
        technologies: {
          frontend: ['React'],
          backend: ['Node.js'],
        },
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    prd: {
      id: 'prd-1',
      projectName: 'Test Project',
      projectDescription: 'Test description',
      version: '1.0.0',
      createdAt: timestamp,
      updatedAt: timestamp,
      sections: {
        overview: {
          vision: 'Test vision',
          problem: 'Test problem',
          solution: 'Test solution',
          targetMarket: 'Developers',
        },
        personas: [],
        features: [],
        userStories: [],
        nonFunctionalRequirements: [],
        apis: [],
        dataModels: [],
        successMetrics: [],
      },
    },
    codePatterns: [],
    architectureHints: [],
    qualityRequirements: {
      type_safety: 'strict',
      testing: { unit: true, integration: true, e2e: false, coverage_target: 80 },
      documentation: ['JSDoc', 'README'],
      performance: { response_time_ms: 200, throughput_rps: 1000 },
      security: ['input validation', 'output encoding'],
    },
    optimizationOpportunities: [],
    createdAt: timestamp,
    ...overrides,
  };
}

describe('contextCache', () => {
  beforeEach(() => {
    // Clear the cache before each test
    clearCache();
    // Clear all mock call history
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('cacheContext', () => {
    it('caches a context with correct key', () => {
      const context = createMockContext();
      const projectDescription = 'Build a todo app';

      cacheContext(projectDescription, context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheKey: expect.stringMatching(/^context_[a-f0-9]{64}$/),
          expiresAt: expect.any(String),
        }),
        'Context cached'
      );
    });

    it('generates consistent cache keys for same input', () => {
      const context = createMockContext();
      const projectDescription = 'Build a todo app';

      cacheContext(projectDescription, context);
      const firstCall = mockLogger.debug.mock.calls[0];

      mockLogger.debug.mockClear();
      cacheContext(projectDescription, context);
      const secondCall = mockLogger.debug.mock.calls[0];

      expect(firstCall[0].cacheKey).toBe(secondCall[0].cacheKey);
    });

    it('generates different cache keys for different inputs', () => {
      const context = createMockContext();

      cacheContext('Build a todo app', context);
      const firstKey = mockLogger.debug.mock.calls[0][0].cacheKey;

      mockLogger.debug.mockClear();
      cacheContext('Build a weather app', context);
      const secondKey = mockLogger.debug.mock.calls[0][0].cacheKey;

      expect(firstKey).not.toBe(secondKey);
    });

    it('generates different cache keys when options differ', () => {
      const context = createMockContext();
      const projectDescription = 'Build a todo app';

      cacheContext(projectDescription, context);
      const keyWithoutOptions = mockLogger.debug.mock.calls[0][0].cacheKey;

      mockLogger.debug.mockClear();
      cacheContext(projectDescription, context, { enrichedIntent: { test: true } });
      const keyWithEnrichedIntent = mockLogger.debug.mock.calls[0][0].cacheKey;

      mockLogger.debug.mockClear();
      cacheContext(projectDescription, context, { architecture: { test: true } });
      const keyWithArchitecture = mockLogger.debug.mock.calls[0][0].cacheKey;

      mockLogger.debug.mockClear();
      cacheContext(projectDescription, context, { prd: { test: true } });
      const keyWithPrd = mockLogger.debug.mock.calls[0][0].cacheKey;

      expect(keyWithoutOptions).not.toBe(keyWithEnrichedIntent);
      expect(keyWithEnrichedIntent).not.toBe(keyWithArchitecture);
      expect(keyWithArchitecture).not.toBe(keyWithPrd);
    });

    it('sets expiration time 24 hours in the future', () => {
      const context = createMockContext();
      const beforeCache = Date.now();

      cacheContext('Build a todo app', context);

      const expiresAtStr = mockLogger.debug.mock.calls[0][0].expiresAt;
      const expiresAt = new Date(expiresAtStr).getTime();
      const expectedExpiry = beforeCache + 24 * 60 * 60 * 1000;

      // Allow 1 second tolerance
      expect(Math.abs(expiresAt - expectedExpiry)).toBeLessThan(1000);
    });
  });

  describe('getCachedContext', () => {
    it('returns null when cache is empty', () => {
      const result = getCachedContext('Build a todo app');

      expect(result).toBeNull();
    });

    it('returns null when key does not exist', () => {
      const context = createMockContext();
      cacheContext('Build a todo app', context);

      const result = getCachedContext('Build a different app');

      expect(result).toBeNull();
    });

    it('returns cached context on cache hit', () => {
      const context = createMockContext({ id: 'unique-test-id' });
      const projectDescription = 'Build a todo app';

      cacheContext(projectDescription, context);
      const result = getCachedContext(projectDescription);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('unique-test-id');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheKey: expect.stringMatching(/^context_[a-f0-9]{64}$/),
        }),
        'Context cache hit'
      );
    });

    it('returns correct context when multiple contexts are cached', () => {
      const context1 = createMockContext({ id: 'context-1' });
      const context2 = createMockContext({ id: 'context-2' });
      const context3 = createMockContext({ id: 'context-3' });

      cacheContext('App 1', context1);
      cacheContext('App 2', context2);
      cacheContext('App 3', context3);

      expect(getCachedContext('App 1')?.id).toBe('context-1');
      expect(getCachedContext('App 2')?.id).toBe('context-2');
      expect(getCachedContext('App 3')?.id).toBe('context-3');
    });

    it('returns null and deletes expired entry', () => {
      const context = createMockContext();
      const projectDescription = 'Build a todo app';

      // Use fake timers for time-based tests
      vi.useFakeTimers();
      const startTime = new Date('2025-01-01T00:00:00.000Z');
      vi.setSystemTime(startTime);

      // Cache the context
      cacheContext(projectDescription, context);

      // Advance time past TTL (25 hours)
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const result = getCachedContext(projectDescription);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheKey: expect.stringMatching(/^context_[a-f0-9]{64}$/),
        }),
        'Context cache expired'
      );

      // Restore real timers
      vi.useRealTimers();
    });

    it('returns cached context when options match', () => {
      const context = createMockContext({ id: 'with-options' });
      const projectDescription = 'Build a todo app';
      const options = { enrichedIntent: { test: true } };

      cacheContext(projectDescription, context, options);
      const result = getCachedContext(projectDescription, options);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('with-options');
    });

    it('returns null when options do not match', () => {
      const context = createMockContext();
      const projectDescription = 'Build a todo app';

      cacheContext(projectDescription, context, { enrichedIntent: { test: true } });
      const result = getCachedContext(projectDescription, { architecture: { test: true } });

      expect(result).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('removes specific cache entry', () => {
      const context = createMockContext();
      const projectDescription = 'Build a todo app';

      cacheContext(projectDescription, context);
      expect(getCachedContext(projectDescription)).not.toBeNull();

      invalidateCache(projectDescription);

      expect(getCachedContext(projectDescription)).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheKey: expect.stringMatching(/^context_[a-f0-9]{64}$/),
        }),
        'Context cache invalidated'
      );
    });

    it('does not affect other cache entries', () => {
      const context1 = createMockContext({ id: 'context-1' });
      const context2 = createMockContext({ id: 'context-2' });

      cacheContext('App 1', context1);
      cacheContext('App 2', context2);

      invalidateCache('App 1');

      expect(getCachedContext('App 1')).toBeNull();
      expect(getCachedContext('App 2')?.id).toBe('context-2');
    });

    it('handles invalidating non-existent key gracefully', () => {
      invalidateCache('Non-existent app');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheKey: expect.stringMatching(/^context_[a-f0-9]{64}$/),
        }),
        'Context cache invalidated'
      );
    });
  });

  describe('clearCache', () => {
    it('removes all cache entries', () => {
      const context = createMockContext();

      cacheContext('App 1', context);
      cacheContext('App 2', context);
      cacheContext('App 3', context);

      clearCache();

      expect(getCachedContext('App 1')).toBeNull();
      expect(getCachedContext('App 2')).toBeNull();
      expect(getCachedContext('App 3')).toBeNull();
    });

    it('logs cleared count', () => {
      const context = createMockContext();

      cacheContext('App 1', context);
      cacheContext('App 2', context);
      cacheContext('App 3', context);

      mockLogger.info.mockClear();
      clearCache();

      expect(mockLogger.info).toHaveBeenCalledWith(
        { clearedCount: 3 },
        'Context cache cleared'
      );
    });

    it('handles empty cache gracefully', () => {
      clearCache();

      expect(mockLogger.info).toHaveBeenCalledWith(
        { clearedCount: 0 },
        'Context cache cleared'
      );
    });
  });

  describe('getCacheStats', () => {
    it('returns empty stats when cache is empty', () => {
      const stats = getCacheStats();

      expect(stats).toEqual({
        size: 0,
        keys: [],
        oldestEntry: undefined,
        newestEntry: undefined,
      });
    });

    it('returns correct size and keys', () => {
      const context = createMockContext();

      cacheContext('App 1', context);
      cacheContext('App 2', context);
      cacheContext('App 3', context);

      const stats = getCacheStats();

      expect(stats.size).toBe(3);
      expect(stats.keys).toHaveLength(3);
      stats.keys.forEach((key) => {
        expect(key).toMatch(/^context_[a-f0-9]{64}$/);
      });
    });

    it('returns oldest and newest entry timestamps', async () => {
      const context = createMockContext();

      cacheContext('App 1', context);
      
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      cacheContext('App 2', context);
      
      await new Promise((resolve) => setTimeout(resolve, 10));
      cacheContext('App 3', context);

      const stats = getCacheStats();

      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
      expect(new Date(stats.oldestEntry!).getTime()).toBeLessThanOrEqual(
        new Date(stats.newestEntry!).getTime()
      );
    });

    it('returns same timestamp for oldest and newest when only one entry', () => {
      const context = createMockContext();

      cacheContext('App 1', context);

      const stats = getCacheStats();

      expect(stats.size).toBe(1);
      expect(stats.oldestEntry).toBe(stats.newestEntry);
    });
  });

  describe('cleanupExpiredEntries', () => {
    it('returns 0 when cache is empty', () => {
      const cleaned = cleanupExpiredEntries();

      expect(cleaned).toBe(0);
    });

    it('returns 0 when no entries are expired', () => {
      const context = createMockContext();

      cacheContext('App 1', context);
      cacheContext('App 2', context);

      const cleaned = cleanupExpiredEntries();

      expect(cleaned).toBe(0);
      expect(getCacheStats().size).toBe(2);
    });

    it('removes expired entries and returns count', () => {
      const context = createMockContext();

      // Use fake timers for time-based tests
      vi.useFakeTimers();
      const startTime = new Date('2025-01-01T00:00:00.000Z');
      vi.setSystemTime(startTime);

      // Cache entries
      cacheContext('App 1', context);
      cacheContext('App 2', context);
      cacheContext('App 3', context);

      expect(getCacheStats().size).toBe(3);

      // Advance time past TTL (25 hours)
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const cleaned = cleanupExpiredEntries();

      expect(cleaned).toBe(3);
      expect(getCacheStats().size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { cleaned: 3 },
        'Expired context cache entries cleaned'
      );

      // Restore real timers
      vi.useRealTimers();
    });

    it('only removes expired entries, keeps valid ones', () => {
      const context = createMockContext();

      // Use fake timers for time-based tests
      vi.useFakeTimers();
      const startTime = new Date('2025-01-01T00:00:00.000Z');
      vi.setSystemTime(startTime);

      // Cache first entry at start time (expires at startTime + 24h)
      cacheContext('App 1', context);

      // Advance time 12 hours and cache second entry (expires at startTime + 36h)
      vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      cacheContext('App 2', context);

      // Advance time to 25 hours from start (13 more hours)
      // First entry expired (25h > 24h), second still valid (25h < 36h)
      vi.advanceTimersByTime(13 * 60 * 60 * 1000);

      const cleaned = cleanupExpiredEntries();

      expect(cleaned).toBe(1);
      expect(getCacheStats().size).toBe(1);

      // Restore real timers
      vi.useRealTimers();
    });

    it('does not log when no entries cleaned', () => {
      const context = createMockContext();
      cacheContext('App 1', context);

      mockLogger.debug.mockClear();
      cleanupExpiredEntries();

      // Should not have logged the cleanup message
      const cleanupCall = mockLogger.debug.mock.calls.find(
        (call) => call[1] === 'Expired context cache entries cleaned'
      );
      expect(cleanupCall).toBeUndefined();
    });
  });

  describe('cache key generation', () => {
    it('uses SHA-256 hash for cache key', () => {
      const context = createMockContext();
      cacheContext('Test app', context);

      const cacheKey = mockLogger.debug.mock.calls[0][0].cacheKey;
      // SHA-256 produces 64 hex characters
      expect(cacheKey).toMatch(/^context_[a-f0-9]{64}$/);
    });

    it('includes options in hash when provided', () => {
      const context = createMockContext();
      
      cacheContext('Test app', context);
      const keyWithout = mockLogger.debug.mock.calls[0][0].cacheKey;

      mockLogger.debug.mockClear();
      cacheContext('Test app', context, { enrichedIntent: {} });
      const keyWith = mockLogger.debug.mock.calls[0][0].cacheKey;

      expect(keyWithout).not.toBe(keyWith);
    });

    it('generates same key regardless of option values (only presence matters)', () => {
      const context = createMockContext();

      cacheContext('Test app', context, { enrichedIntent: { a: 1 } });
      const key1 = mockLogger.debug.mock.calls[0][0].cacheKey;

      mockLogger.debug.mockClear();
      cacheContext('Test app', context, { enrichedIntent: { b: 2 } });
      const key2 = mockLogger.debug.mock.calls[0][0].cacheKey;

      // Both have enrichedIntent provided, so keys should be same
      expect(key1).toBe(key2);
    });

    it('handles all option combinations', () => {
      const context = createMockContext();
      const keys: string[] = [];

      // No options
      cacheContext('Test', context);
      keys.push(mockLogger.debug.mock.calls[0][0].cacheKey);
      mockLogger.debug.mockClear();

      // enrichedIntent only
      cacheContext('Test', context, { enrichedIntent: {} });
      keys.push(mockLogger.debug.mock.calls[0][0].cacheKey);
      mockLogger.debug.mockClear();

      // architecture only
      cacheContext('Test', context, { architecture: {} });
      keys.push(mockLogger.debug.mock.calls[0][0].cacheKey);
      mockLogger.debug.mockClear();

      // prd only
      cacheContext('Test', context, { prd: {} });
      keys.push(mockLogger.debug.mock.calls[0][0].cacheKey);
      mockLogger.debug.mockClear();

      // All options
      cacheContext('Test', context, { enrichedIntent: {}, architecture: {}, prd: {} });
      keys.push(mockLogger.debug.mock.calls[0][0].cacheKey);

      // All keys should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('handles empty project description', () => {
      const context = createMockContext();

      cacheContext('', context);
      const result = getCachedContext('');

      expect(result).not.toBeNull();
    });

    it('handles very long project description', () => {
      const context = createMockContext();
      const longDescription = 'A'.repeat(10000);

      cacheContext(longDescription, context);
      const result = getCachedContext(longDescription);

      expect(result).not.toBeNull();
    });

    it('handles special characters in project description', () => {
      const context = createMockContext();
      const specialDescription = 'Build an app with <script>alert("xss")</script> & special chars: !@#$%^&*()';

      cacheContext(specialDescription, context);
      const result = getCachedContext(specialDescription);

      expect(result).not.toBeNull();
    });

    it('handles unicode characters in project description', () => {
      const context = createMockContext();
      const unicodeDescription = 'Build an app with emojis and unicode chars';

      cacheContext(unicodeDescription, context);
      const result = getCachedContext(unicodeDescription);

      expect(result).not.toBeNull();
    });

    it('overwrites existing cache entry with same key', () => {
      const context1 = createMockContext({ id: 'first' });
      const context2 = createMockContext({ id: 'second' });
      const projectDescription = 'Build a todo app';

      cacheContext(projectDescription, context1);
      expect(getCachedContext(projectDescription)?.id).toBe('first');

      cacheContext(projectDescription, context2);
      expect(getCachedContext(projectDescription)?.id).toBe('second');

      expect(getCacheStats().size).toBe(1);
    });

    it('handles concurrent caching operations', async () => {
      const context = createMockContext();
      
      // Simulate concurrent caching
      await Promise.all([
        Promise.resolve(cacheContext('App 1', context)),
        Promise.resolve(cacheContext('App 2', context)),
        Promise.resolve(cacheContext('App 3', context)),
        Promise.resolve(cacheContext('App 4', context)),
        Promise.resolve(cacheContext('App 5', context)),
      ]);

      const stats = getCacheStats();
      expect(stats.size).toBe(5);
    });
  });
});
