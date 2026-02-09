/**
 * Agent Deduplication Store Tests
 *
 * Tests for semantic deduplication and pattern management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

// Mock fetch and fetchApi
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
  getApiBase: vi.fn(() => 'http://localhost:3000'),
}));

describe('gAgentDedupStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockLibraryStats = (overrides = {}) => ({
    totalPatterns: 150,
    byType: {
      function: 50,
      class: 30,
      component: 40,
      api_endpoint: 20,
      test_case: 10,
    },
    byLanguage: {
      typescript: 100,
      javascript: 30,
      python: 20,
    },
    totalUses: 1500,
    estimatedSavings: 50000,
    estimatedSavingsFormatted: '$500.00',
    activeSessions: 5,
    ...overrides,
  });

  const createMockPatternSummary = (overrides = {}) => ({
    id: 'pattern-123',
    abstract: 'React component with useState hook',
    type: 'component' as const,
    language: 'typescript',
    useCount: 25,
    ...overrides,
  });

  const createMockPatternDetails = (overrides = {}) => ({
    id: 'pattern-123',
    content: {
      abstract: 'React component with useState hook',
      summary: 'A functional React component using the useState hook for state management',
      template:
        'function ${ComponentName}() { const [${state}, set${State}] = useState(${initialValue}); }',
      parameters: ['ComponentName', 'state', 'State', 'initialValue'],
    },
    meta: {
      type: 'component' as const,
      language: 'typescript',
      framework: 'react',
      category: 'state-management',
      tags: ['react', 'hooks', 'state'],
    },
    stats: {
      useCount: 25,
      lastUsed: new Date().toISOString(),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      sessionCount: 10,
    },
    ...overrides,
  });

  const createMockDeduplicationResult = (overrides = {}) => ({
    isNew: false,
    savedTokens: 150,
    patternRef: {
      patternId: 'pattern-123',
      parameters: { ComponentName: 'Counter' },
      similarity: 0.95,
    },
    ...overrides,
  });

  describe('initial state', () => {
    it('should have null stats initially', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const state = get(gAgentDedupStore);
      expect(state.stats).toBeNull();
    });

    it('should have empty patterns initially', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const state = get(gAgentDedupStore);
      expect(state.patterns).toEqual([]);
    });

    it('should have null selectedPattern initially', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const state = get(gAgentDedupStore);
      expect(state.selectedPattern).toBeNull();
    });

    it('should have default sessionId', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const state = get(gAgentDedupStore);
      expect(state.sessionId).toBe('default');
    });

    it('should not be loading initially', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const state = get(gAgentDedupStore);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('derived stores', () => {
    it('dedupStats should reflect store state', async () => {
      const { dedupStats, gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stats: createMockLibraryStats() }),
      });

      await gAgentDedupStore.fetchStats();
      expect(get(dedupStats)?.totalPatterns).toBe(150);
    });

    it('totalSaved should reflect estimated savings', async () => {
      const { totalSaved, gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stats: createMockLibraryStats({ estimatedSavings: 75000 }) }),
      });

      await gAgentDedupStore.fetchStats();
      expect(get(totalSaved)).toBe(75000);
    });

    it('patternCount should reflect total patterns', async () => {
      const { patternCount, gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stats: createMockLibraryStats({ totalPatterns: 200 }) }),
      });

      await gAgentDedupStore.fetchStats();
      expect(get(patternCount)).toBe(200);
    });

    it('patterns should reflect store patterns', async () => {
      const { patterns, gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            patterns: [createMockPatternSummary(), createMockPatternSummary({ id: 'pattern-456' })],
          }),
      });

      await gAgentDedupStore.listByType('component');
      expect(get(patterns)).toHaveLength(2);
    });
  });

  describe('setSessionId', () => {
    it('should update session ID', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');

      gAgentDedupStore.setSessionId('new-session');

      const state = get(gAgentDedupStore);
      expect(state.sessionId).toBe('new-session');
    });
  });

  describe('fetchStats', () => {
    it('should fetch and store library stats', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockStats = createMockLibraryStats();
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stats: mockStats }),
      });

      const result = await gAgentDedupStore.fetchStats();

      expect(mockFetchApi).toHaveBeenCalledWith('/api/gagent/dedup/stats');
      expect(result).toEqual(mockStats);
    });

    it('should handle fetch error', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await gAgentDedupStore.fetchStats();

      expect(result).toBeNull();
      expect(get(gAgentDedupStore).error).toBe('Failed to fetch stats: 500');
    });
  });

  describe('deduplicate', () => {
    it('should deduplicate content and return result', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockResult = createMockDeduplicationResult();
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: mockResult }),
      });

      const result = await gAgentDedupStore.deduplicate(
        'function Counter() { const [count, setCount] = useState(0); }',
        { type: 'component', language: 'typescript' }
      );

      expect(result).toEqual(mockResult);
      expect(result?.savedTokens).toBe(150);
    });

    it('should add result to recentResults', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: createMockDeduplicationResult() }),
      });

      await gAgentDedupStore.deduplicate('some code');

      const state = get(gAgentDedupStore);
      expect(state.recentResults).toHaveLength(1);
    });

    it('should handle deduplication error', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await gAgentDedupStore.deduplicate('code');

      expect(result).toBeNull();
      expect(get(gAgentDedupStore).error).toBe('Deduplication failed: 500');
    });
  });

  describe('deduplicateBatch', () => {
    it('should batch deduplicate items', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              createMockDeduplicationResult(),
              createMockDeduplicationResult({ isNew: true, savedTokens: 0 }),
            ],
            summary: { totalSaved: 150, newPatterns: 1 },
          }),
      });

      const result = await gAgentDedupStore.deduplicateBatch([
        { content: 'code1' },
        { content: 'code2' },
      ]);

      expect(result?.results).toHaveLength(2);
      expect(result?.summary.totalSaved).toBe(150);
      expect(result?.summary.newPatterns).toBe(1);
    });
  });

  describe('expand', () => {
    it('should expand pattern reference', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            expanded: 'function Counter() { const [count, setCount] = useState(0); }',
          }),
      });

      const result = await gAgentDedupStore.expand({
        patternId: 'pattern-123',
        parameters: { ComponentName: 'Counter', state: 'count', State: 'Count', initialValue: '0' },
        similarity: 1.0,
      });

      expect(result).toBe('function Counter() { const [count, setCount] = useState(0); }');
    });

    it('should return null on expand failure', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({ ok: false });

      const result = await gAgentDedupStore.expand({
        patternId: 'invalid',
        parameters: {},
        similarity: 0,
      });

      expect(result).toBeNull();
    });
  });

  describe('getPattern', () => {
    it('should fetch pattern details', async () => {
      const { gAgentDedupStore, selectedPattern } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockPattern = createMockPatternDetails();
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ pattern: mockPattern }),
      });

      const result = await gAgentDedupStore.getPattern('pattern-123');

      expect(result).toEqual(mockPattern);
      expect(get(selectedPattern)).toEqual(mockPattern);
    });

    it('should handle pattern not found', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await gAgentDedupStore.getPattern('nonexistent');

      expect(result).toBeNull();
      expect(get(gAgentDedupStore).error).toBe('Failed to get pattern: 404');
    });
  });

  describe('listByType', () => {
    it('should list patterns by type', async () => {
      const { gAgentDedupStore, patterns } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockPatterns = [
        createMockPatternSummary({ id: 'p1', type: 'function' }),
        createMockPatternSummary({ id: 'p2', type: 'function' }),
      ];
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ patterns: mockPatterns }),
      });

      const result = await gAgentDedupStore.listByType('function', 10);

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/api/gagent/dedup/patterns?type=function&limit=10'
      );
      expect(result).toHaveLength(2);
      expect(get(patterns)).toEqual(mockPatterns);
    });
  });

  describe('listByTags', () => {
    it('should list patterns by tags', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockPatterns = [createMockPatternSummary()];
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ patterns: mockPatterns }),
      });

      const result = await gAgentDedupStore.listByTags(['react', 'hooks']);

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/api/gagent/dedup/patterns?tags=react%2Chooks&limit=20'
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getSessionPatterns', () => {
    it('should get patterns for current session', async () => {
      const { gAgentDedupStore, sessionPatterns } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      gAgentDedupStore.setSessionId('test-session');

      const mockPatterns = [createMockPatternSummary()];
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ patterns: mockPatterns }),
      });

      const result = await gAgentDedupStore.getSessionPatterns();

      expect(mockFetchApi).toHaveBeenCalledWith('/api/gagent/dedup/session/test-session');
      expect(result).toHaveLength(1);
      expect(get(sessionPatterns)).toEqual(mockPatterns);
    });
  });

  describe('learnPattern', () => {
    it('should learn a new pattern', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockPattern = createMockPatternDetails();
      // First call for learn, second for fetchStats refresh
      mockFetchApi
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ pattern: mockPattern }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ stats: createMockLibraryStats() }),
        });

      const result = await gAgentDedupStore.learnPattern(
        'function Counter() { const [count, setCount] = useState(0); }',
        'ReactStateComponent',
        { type: 'component', language: 'typescript', framework: 'react' }
      );

      expect(result).toEqual(mockPattern);
      expect(mockFetchApi).toHaveBeenCalledWith('/api/gagent/dedup/learn', {
        method: 'POST',
        body: JSON.stringify({
          example: 'function Counter() { const [count, setCount] = useState(0); }',
          patternName: 'ReactStateComponent',
          meta: { type: 'component', language: 'typescript', framework: 'react' },
        }),
      });
    });

    it('should handle learn error', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Pattern already exists' }),
      });

      const result = await gAgentDedupStore.learnPattern('code', 'name', { type: 'function' });

      expect(result).toBeNull();
      expect(get(gAgentDedupStore).error).toBe('Pattern already exists');
    });
  });

  describe('cleanup', () => {
    it('should cleanup old patterns', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ removed: 15 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ stats: createMockLibraryStats({ totalPatterns: 135 }) }),
        });

      const result = await gAgentDedupStore.cleanup({ maxAge: 30, minUseCount: 2 });

      expect(result).toBe(15);
    });

    it('should return 0 on cleanup failure', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({ ok: false });

      const result = await gAgentDedupStore.cleanup();

      expect(result).toBe(0);
    });
  });

  describe('export/import', () => {
    it('should export patterns', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'base64encodeddata' }),
      });

      const result = await gAgentDedupStore.exportPatterns();

      expect(result).toBe('base64encodeddata');
    });

    it('should import patterns', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ imported: 25 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ stats: createMockLibraryStats() }),
        });

      const result = await gAgentDedupStore.importPatterns('base64data');

      expect(result).toBe(25);
    });
  });

  describe('clearError', () => {
    it('should clear error', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      // Cause an error
      mockFetchApi.mockResolvedValue({ ok: false, status: 500 });
      await gAgentDedupStore.fetchStats();
      expect(get(gAgentDedupStore).error).not.toBeNull();

      // Clear error
      gAgentDedupStore.clearError();
      expect(get(gAgentDedupStore).error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', async () => {
      const { gAgentDedupStore } = await import('./gAgentDedupStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      // Populate state
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stats: createMockLibraryStats() }),
      });
      await gAgentDedupStore.fetchStats();
      gAgentDedupStore.setSessionId('custom-session');

      // Reset
      gAgentDedupStore.reset();

      const state = get(gAgentDedupStore);
      expect(state.stats).toBeNull();
      expect(state.patterns).toEqual([]);
      expect(state.selectedPattern).toBeNull();
      expect(state.sessionId).toBe('default');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
