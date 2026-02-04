/**
 * Tests for advancedAiApi
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSystemOverview,
  storeInHolographicMemory,
  retrieveFromHolographicMemory,
  getHolographicStats,
  compressContext,
  getContextSimilarity,
  compareTexts,
  queryContext,
  listContexts,
  createSwarm,
  submitSwarmTask,
  getSwarmTaskStatus,
  getSwarmStatus,
  injectSwarmDiscovery,
  stopSwarm,
  listSwarms,
  recordQuery,
  getPredictions,
  triggerPreload,
  getPreloaderStats,
  addConversationTurn,
  runDistillation,
  getUserModel,
  getKnowledgeGraph,
  getDistillationStats,
  createSupervisedSwarm,
  submitSupervisedTask,
  getSupervisedTaskStatus,
  getSupervisedSwarmStatus,
  listSupervisedSwarms,
} from './advancedAiApi';

// Mock the api module
vi.mock('./api', () => ({
  fetchApi: vi.fn(),
}));

import { fetchApi } from './api';

const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

describe('advancedAiApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('System Overview', () => {
    it('should get system overview', async () => {
      const mockOverview = {
        holographicMemory: { status: 'active', stats: { memories: [], kvCaches: [] } },
        contextCompressor: { status: 'active', description: 'Context compression active' },
        swarmOrchestrator: { status: 'active', description: 'Swarm orchestration active' },
        predictivePreloader: {
          status: 'active',
          stats: {
            totalQueries: 100,
            predictionsGenerated: 50,
            accuratePredictions: 40,
            cacheHits: 30,
            avgPredictionConfidence: 0.8,
            topTopics: [],
            cacheStats: { size: 100, used: 50, hitRate: 0.7 },
          },
        },
        recursiveDistillation: {
          status: 'active',
          stats: {
            bufferSize: 1000,
            userCount: 10,
            totalPatterns: 50,
            totalPreferences: 30,
            totalConstraints: 20,
          },
        },
      };

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, systems: mockOverview }),
      });

      const result = await getSystemOverview();

      expect(result.systems).toEqual(mockOverview);
      expect(mockFetchApi).toHaveBeenCalledWith('/api/advanced-ai/overview');
    });

    it('should throw on API error', async () => {
      mockFetchApi.mockResolvedValue({ ok: false, status: 500 });

      await expect(getSystemOverview()).rejects.toThrow('Failed to get overview: 500');
    });
  });

  describe('Holographic Memory', () => {
    it('should store in holographic memory', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ ok: true, memoryId: 'mem-1', entryCount: 10, dimension: 768 }),
      });

      const result = await storeInHolographicMemory('test-key', 'test-value');

      expect(result).toEqual({ ok: true, memoryId: 'mem-1', entryCount: 10, dimension: 768 });
      expect(mockFetchApi).toHaveBeenCalledWith('/api/advanced-ai/holographic/store', {
        method: 'POST',
        body: JSON.stringify({ key: 'test-key', value: 'test-value', memoryId: undefined }),
      });
    });

    it('should retrieve from holographic memory', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ ok: true, key: 'test-key', similarity: 0.95, vectorMagnitude: 1.2 }),
      });

      const result = await retrieveFromHolographicMemory('test-key');

      expect(result.key).toBe('test-key');
      expect(result.similarity).toBe(0.95);
    });

    it('should get holographic stats', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            memories: [
              {
                name: 'mem1',
                stats: {
                  dimension: 768,
                  entryCount: 100,
                  memoryMagnitude: 1.5,
                  estimatedCapacity: 1000,
                  memoryUsageBytes: 1024,
                },
              },
            ],
            kvCaches: [],
          }),
      });

      const result = await getHolographicStats();

      expect(result.memories).toHaveLength(1);
      expect(result.kvCaches).toEqual([]);
    });
  });

  describe('Context Compression', () => {
    it('should compress context', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            id: 'ctx-1',
            originalLength: 1000,
            stats: {
              originalTokens: 200,
              compressedDimension: 64,
              compressionRatio: 0.75,
              chunkCount: 5,
              processingTimeMs: 100,
            },
            metadata: {},
          }),
      });

      const result = await compressContext('Long text to compress', 'test-source');

      expect(result.id).toBe('ctx-1');
      expect(result.originalLength).toBe(1000);
    });

    it('should get context similarity', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, similarity: 0.85 }),
      });

      const result = await getContextSimilarity('ctx-1', 'ctx-2');

      expect(result.similarity).toBe(0.85);
    });

    it('should compare texts', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, similarity: 0.75 }),
      });

      const result = await compareTexts('text one', 'text two');

      expect(result.similarity).toBe(0.75);
    });

    it('should query context', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            query: 'test query',
            results: [{ id: 'ctx-1', similarity: 0.9 }],
          }),
      });

      const result = await queryContext('test query', 5);

      expect(result.query).toBe('test query');
      expect(result.results).toHaveLength(1);
    });

    it('should list contexts', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            contexts: [
              {
                id: 'ctx-1',
                stats: {
                  originalTokens: 100,
                  compressedDimension: 64,
                  compressionRatio: 0.5,
                  chunkCount: 3,
                  processingTimeMs: 50,
                },
                source: 'test',
              },
            ],
          }),
      });

      const result = await listContexts();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ctx-1');
    });
  });

  describe('Swarm Orchestration', () => {
    it('should create swarm', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            swarmId: 'swarm-1',
            stats: {
              totalAgents: 5,
              activeAgents: 3,
              agentsByRole: {} as Record<string, number>,
              totalMessages: 10,
              pheromoneTrails: 3,
              avgPheromoneStrength: 0.8,
              pendingTasks: 2,
              completedTasks: 8,
            },
            topology: { nodes: [], edges: [] },
          }),
      });

      const result = await createSwarm('my-swarm', 10);

      expect(result.swarmId).toBe('swarm-1');
    });

    it('should submit swarm task', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ ok: true, taskId: 'task-1', swarmId: 'swarm-1', status: 'pending' }),
      });

      const result = await submitSwarmTask('Process this', 'context data');

      expect(result.taskId).toBe('task-1');
    });

    it('should get swarm task status', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            task: {
              id: 'task-1',
              query: 'Process',
              status: 'completed',
              resultCount: 5,
              createdAt: Date.now(),
            },
          }),
      });

      const result = await getSwarmTaskStatus('task-1', 'swarm-1');

      expect(result.task.id).toBe('task-1');
    });

    it('should get swarm status', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            swarmId: 'swarm-1',
            stats: {
              totalAgents: 5,
              activeAgents: 3,
              agentsByRole: {} as Record<string, number>,
              totalMessages: 10,
              pheromoneTrails: 3,
              avgPheromoneStrength: 0.8,
              pendingTasks: 2,
              completedTasks: 8,
            },
            topology: { nodes: [], edges: [] },
          }),
      });

      const result = await getSwarmStatus('swarm-1');

      expect(result.swarmId).toBe('swarm-1');
    });

    it('should inject swarm discovery', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, swarmId: 'swarm-1', injected: true }),
      });

      const result = await injectSwarmDiscovery('New discovery', 0.9, ['tag1'], 'swarm-1');

      expect(result.injected).toBe(true);
    });

    it('should stop swarm', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, swarmId: 'swarm-1', status: 'stopped' }),
      });

      const result = await stopSwarm('swarm-1');

      expect(result.status).toBe('stopped');
    });

    it('should list swarms', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            swarms: [
              {
                name: 'swarm-1',
                stats: {
                  totalAgents: 5,
                  activeAgents: 3,
                  agentsByRole: {} as Record<string, number>,
                  totalMessages: 10,
                  pheromoneTrails: 3,
                  avgPheromoneStrength: 0.8,
                  pendingTasks: 2,
                  completedTasks: 8,
                },
              },
            ],
          }),
      });

      const result = await listSwarms();

      expect(result).toHaveLength(1);
    });
  });

  describe('Predictive Preloader', () => {
    it('should record query', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            session: 'session-1',
            stats: {
              totalQueries: 101,
              predictionsGenerated: 50,
              accuratePredictions: 40,
              cacheHits: 30,
              avgPredictionConfidence: 0.8,
              topTopics: [],
              cacheStats: { size: 100, used: 51, hitRate: 0.7 },
            },
          }),
      });

      const result = await recordQuery('test query', 'session-1');

      expect(result.session).toBe('session-1');
    });

    it('should get predictions', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            predictions: [
              { query: 'predicted query', confidence: 0.8, source: 'ngram', topics: ['topic1'] },
            ],
          }),
      });

      const result = await getPredictions('user-1', 5);

      expect(result).toHaveLength(1);
    });

    it('should trigger preload', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            preloadedCount: 3,
            stats: {
              totalQueries: 100,
              predictionsGenerated: 50,
              accuratePredictions: 40,
              cacheHits: 30,
              avgPredictionConfidence: 0.8,
              topTopics: [],
              cacheStats: { size: 100, used: 50, hitRate: 0.7 },
            },
          }),
      });

      const result = await triggerPreload('user-1');

      expect(result.preloadedCount).toBe(3);
    });

    it('should get preloader stats', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            stats: {
              totalQueries: 100,
              predictionsGenerated: 50,
              accuratePredictions: 40,
              cacheHits: 30,
              avgPredictionConfidence: 0.8,
              topTopics: [],
              cacheStats: { size: 100, used: 50, hitRate: 0.7 },
            },
            topicTransitions: [],
            temporalPatterns: [],
          }),
      });

      const result = await getPreloaderStats('user-1');

      expect(result.stats.totalQueries).toBe(100);
    });
  });

  describe('Recursive Distillation', () => {
    it('should add conversation turn', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            stats: {
              bufferSize: 1000,
              userCount: 10,
              totalPatterns: 50,
              totalPreferences: 30,
              totalConstraints: 20,
            },
          }),
      });

      const result = await addConversationTurn('user', 'Hello');

      expect(result.ok).toBe(true);
    });

    it('should run distillation', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            result: {
              patternsExtracted: 5,
              preferencesUpdated: 3,
              constraintsFound: 2,
              compressionRatio: 0.8,
              modelVersion: 2,
            },
            stats: {
              bufferSize: 1000,
              userCount: 10,
              totalPatterns: 55,
              totalPreferences: 33,
              totalConstraints: 22,
            },
          }),
      });

      const result = await runDistillation('user-1');

      expect(result.result.patternsExtracted).toBe(5);
    });

    it('should get user model', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            userId: 'user-1',
            version: 1,
            styleProfile: {
              formality: 0.5,
              verbosity: 0.7,
              technicality: 0.6,
              emotiveness: 0.3,
              directness: 0.8,
              samples: [],
            },
            preferences: [],
            constraints: [],
            patterns: [],
            stats: {
              totalConversations: 10,
              totalTurns: 50,
              distillationCycles: 5,
              nodeCount: 20,
              edgeCount: 15,
            },
          }),
      });

      const result = await getUserModel('user-1');

      expect(result?.userId).toBe('user-1');
    });

    it('should return null for 404 user model', async () => {
      mockFetchApi.mockResolvedValue({
        status: 404,
      });

      const result = await getUserModel('nonexistent');

      expect(result).toBeNull();
    });

    it('should get knowledge graph', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ nodes: [], edges: [] }),
      });

      const result = await getKnowledgeGraph('user-1');

      expect(result).toEqual({ nodes: [], edges: [] });
    });

    it('should return null for 404 knowledge graph', async () => {
      mockFetchApi.mockResolvedValue({
        status: 404,
      });

      const result = await getKnowledgeGraph('nonexistent');

      expect(result).toBeNull();
    });

    it('should get distillation stats', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            bufferSize: 1000,
            userCount: 10,
            totalPatterns: 50,
            totalPreferences: 30,
            totalConstraints: 20,
          }),
      });

      const result = await getDistillationStats();

      expect(result.bufferSize).toBe(1000);
    });
  });

  describe('Supervised Swarm', () => {
    it('should create supervised swarm', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            swarmId: 'supervised-1',
            stats: {
              totalAgents: 3,
              agentsByRole: {} as Record<string, number>,
              agentsByStatus: {} as Record<string, number>,
              totalTasks: 0,
              tasksByStatus: {},
              reviewStats: { totalReviews: 0, approved: 0, rejected: 0, revised: 0, avgScore: 0 },
            },
            topology: { supervisor: { id: 'kimi', status: 'active' }, agents: [] },
          }),
      });

      const result = await createSupervisedSwarm('my-supervised', { maxAgentsPerRole: 5 });

      expect(result.swarmId).toBe('supervised-1');
    });

    it('should submit supervised task', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            task: {
              id: 'task-1',
              query: 'Supervised task',
              subtasks: [],
              events: [],
              status: 'planning',
              createdAt: Date.now(),
            },
          }),
      });

      const result = await submitSupervisedTask('Supervised task', 'context');

      expect(result.task.id).toBe('task-1');
    });

    it('should get supervised task status', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            task: {
              id: 'task-1',
              query: 'Test',
              subtasks: [],
              events: [],
              status: 'completed',
              createdAt: Date.now(),
            },
            subtaskDetails: [],
            reviews: [],
          }),
      });

      const result = await getSupervisedTaskStatus('task-1', 'swarm-1');

      expect(result.task.id).toBe('task-1');
    });

    it('should get supervised swarm status', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            swarmId: 'supervised-1',
            stats: {
              totalAgents: 3,
              agentsByRole: {} as Record<string, number>,
              agentsByStatus: {} as Record<string, number>,
              totalTasks: 0,
              tasksByStatus: {},
              reviewStats: { totalReviews: 0, approved: 0, rejected: 0, revised: 0, avgScore: 0 },
            },
            topology: { supervisor: { id: 'kimi', status: 'active' }, agents: [] },
            config: {
              maxAgentsPerRole: 3,
              maxRetries: 2,
              reviewStrictness: 'moderate',
              autoApproveThreshold: 0.8,
              timeoutMs: 30000,
            },
          }),
      });

      const result = await getSupervisedSwarmStatus('supervised-1');

      expect(result.swarmId).toBe('supervised-1');
    });

    it('should list supervised swarms', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            swarms: [
              {
                name: 'supervised-1',
                stats: {
                  totalAgents: 3,
                  agentsByRole: {} as Record<string, number>,
                  agentsByStatus: {} as Record<string, number>,
                  totalTasks: 0,
                  tasksByStatus: {},
                  reviewStats: {
                    totalReviews: 0,
                    approved: 0,
                    rejected: 0,
                    revised: 0,
                    avgScore: 0,
                  },
                },
                config: {
                  maxAgentsPerRole: 3,
                  maxRetries: 2,
                  reviewStrictness: 'moderate',
                  autoApproveThreshold: 0.8,
                  timeoutMs: 30000,
                },
              },
            ],
          }),
      });

      const result = await listSupervisedSwarms();

      expect(result).toHaveLength(1);
    });
  });
});
