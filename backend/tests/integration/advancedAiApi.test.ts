/**
 * Advanced AI API integration tests.
 * Tests /api/advanced-ai endpoints for holographic memory, context compression,
 * swarm orchestration, predictive preloading, and recursive distillation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';
process.env.NVIDIA_NIM_API_KEY = 'test_key';

// Mock memory instances
const mockMemory = {
  store: vi.fn(),
  retrieve: vi.fn().mockReturnValue({ magnitude: () => 0.95 }),
  retrieveWithSimilarity: vi.fn().mockReturnValue({ 
    similarity: 0.95, 
    retrieved: { magnitude: () => 0.95 } 
  }),
  getStats: vi.fn().mockReturnValue({ dimension: 512, entryCount: 100 }),
};

const mockHoloService = {
  getMemory: vi.fn().mockReturnValue(mockMemory),
  listAll: vi.fn().mockReturnValue({
    memories: [{ name: 'default', stats: { dimension: 512, entryCount: 100 } }],
    kvCaches: [],
  }),
};

// Mock context compressor
const mockCompressedContext = {
  id: 'ctx_123',
  vector: { similarity: vi.fn().mockReturnValue(0.87) },
  stats: { originalTokens: 100 },
  metadata: { source: 'api' },
};

const mockContextService = {
  compress: vi.fn().mockReturnValue(mockCompressedContext),
  get: vi.fn().mockReturnValue(mockCompressedContext),
  findSimilar: vi.fn().mockReturnValue([
    { id: 'ctx_1', similarity: 0.9 },
    { id: 'ctx_2', similarity: 0.8 },
  ]),
  listAll: vi.fn().mockReturnValue([]),
};

// Mock swarm
const mockSwarm = {
  getStats: vi.fn().mockReturnValue({ totalAgents: 5, activeAgents: 0 }),
  getTopologyVisualization: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
  submitTask: vi.fn().mockReturnValue('task_123'),
  startGossip: vi.fn(),
  stopGossip: vi.fn(),
  getTask: vi.fn().mockReturnValue({
    id: 'task_123',
    query: 'test',
    status: 'completed',
    results: [],
    synthesizedResult: 'done',
    createdAt: Date.now(),
    completedAt: Date.now(),
  }),
  injectDiscovery: vi.fn(),
};

const mockSwarmService = {
  getSwarm: vi.fn().mockReturnValue(mockSwarm),
  listSwarms: vi.fn().mockReturnValue([]),
};

// Mock supervised swarm
const mockSupervisedSwarm = {
  getStats: vi.fn().mockReturnValue({ totalAgents: 5, activeAgents: 0 }),
  getVisualization: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
  submitTask: vi.fn().mockResolvedValue({
    id: 'task_123',
    query: 'test',
    status: 'completed',
    plan: 'Plan here',
    subtasks: [],
    synthesizedResult: 'done',
    events: [],
    createdAt: Date.now(),
    completedAt: Date.now(),
  }),
  getTask: vi.fn().mockReturnValue({
    id: 'task_123',
    query: 'test',
    status: 'completed',
    plan: 'Plan here',
    subtasks: [],
    synthesizedResult: 'done',
    events: [],
    createdAt: Date.now(),
    completedAt: Date.now(),
  }),
};

const mockSupervisedSwarmService = {
  getSwarm: vi.fn().mockReturnValue(mockSupervisedSwarm),
  listSwarms: vi.fn().mockReturnValue([]),
};

// Mock preloader
const mockPreloader = {
  startSession: vi.fn(),
  recordQuery: vi.fn(),
  getCurrentSession: vi.fn().mockReturnValue('session_123'),
  getStats: vi.fn().mockReturnValue({
    totalQueries: 100,
    uniqueQueries: 50,
    sessions: 10,
    ngramCount: 500,
    transitionCount: 100,
  }),
  generatePredictions: vi.fn().mockReturnValue([
    { query: 'How do I...', confidence: 0.85, source: 'ngram' },
  ]),
  preload: vi.fn().mockResolvedValue(3),
  getTopicTransitions: vi.fn().mockReturnValue([]),
  getTemporalPatterns: vi.fn().mockReturnValue([]),
};

const mockPreloaderService = {
  getPreloader: vi.fn().mockReturnValue(mockPreloader),
  getDefault: vi.fn().mockReturnValue(mockPreloader),
};

// Mock distiller
const mockDistiller = {
  getStats: vi.fn().mockReturnValue({
    bufferSize: 50,
    userCount: 1,
    totalPatterns: 10,
  }),
  getKnowledgeGraph: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
};

const mockDistillService = {
  addTurn: vi.fn(),
  distill: vi.fn().mockReturnValue({
    patternsExtracted: 5,
    preferencesUpdated: 3,
    constraintsFound: 2,
    compressionRatio: 0.7,
  }),
  getModel: vi.fn().mockReturnValue({
    userId: 'default',
    version: 1,
    summary: 'Test user',
    styleProfile: {},
    preferences: [],
    constraints: [],
    patterns: [],
    totalConversations: 10,
    totalTurns: 50,
    distillationCycles: 5,
    nodes: new Map(),
    edges: [],
  }),
  getDistiller: vi.fn().mockReturnValue(mockDistiller),
};

// Mock holographic memory service
vi.mock('../../src/services/holographicMemory.js', () => ({
  HolographicMemoryService: {
    getInstance: vi.fn(() => mockHoloService),
  },
}));

// Mock context compressor service
vi.mock('../../src/services/contextCompressor.js', () => ({
  ContextCompressorService: {
    getInstance: vi.fn(() => mockContextService),
  },
  ContextCompressor: vi.fn(),
}));

// Mock swarm orchestrator service
vi.mock('../../src/services/swarmOrchestrator.js', () => ({
  SwarmOrchestratorService: {
    getInstance: vi.fn(() => mockSwarmService),
  },
}));

// Mock supervised swarm service
vi.mock('../../src/services/supervisedSwarm.js', () => ({
  SupervisedSwarmService: {
    getInstance: vi.fn(() => mockSupervisedSwarmService),
  },
}));

// Mock predictive preloader
vi.mock('../../src/services/predictivePreloader.js', () => ({
  PredictivePreloaderService: {
    getInstance: vi.fn(() => mockPreloaderService),
  },
}));

// Mock recursive distillation service
vi.mock('../../src/services/recursiveDistillation.js', () => ({
  RecursiveDistillationService: {
    getInstance: vi.fn(() => mockDistillService),
  },
}));

// Mock the database
vi.mock('../../src/db/database.js', () => ({
  getDatabase: vi.fn(() => ({
    getDb: () => ({
      prepare: () => ({
        get: () => null,
        run: () => ({ changes: 1 }),
        all: () => [],
      }),
    }),
  })),
}));

// Import and setup
const advancedAiRoutes = (await import('../../src/routes/advanced-ai.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/advanced-ai', advancedAiRoutes);

describe('Advanced AI API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/advanced-ai/overview', () => {
    it('returns 200 with system overview', async () => {
      const res = await request(app)
        .get('/api/advanced-ai/overview')
        .expect(200);
      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('systems');
    });
  });

  // ====== Holographic Memory ======
  describe('Holographic Memory', () => {
    describe('POST /api/advanced-ai/holographic/store', () => {
      it('returns 400 when key is missing', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/holographic/store')
          .send({ value: 'test' })
          .expect(400);
        expect(res.body).toHaveProperty('error');
      });

      it('returns 400 when value is missing', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/holographic/store')
          .send({ key: 'test' })
          .expect(400);
        expect(res.body).toHaveProperty('error');
      });

      it('stores key-value pair successfully', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/holographic/store')
          .send({ key: 'user:preferences', value: 'dark mode enabled' })
          .expect(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('memoryId');
        expect(mockMemory.store).toHaveBeenCalled();
      });
    });

    describe('POST /api/advanced-ai/holographic/retrieve', () => {
      it('retrieves stored value', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/holographic/retrieve')
          .send({ key: 'user:preferences' })
          .expect(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('key');
      });
    });

    describe('GET /api/advanced-ai/holographic/stats', () => {
      it('returns memory statistics', async () => {
        const res = await request(app)
          .get('/api/advanced-ai/holographic/stats')
          .expect(200);
        expect(res.body).toHaveProperty('memories');
        expect(Array.isArray(res.body.memories)).toBe(true);
      });
    });
  });

  // ====== Context Compression ======
  describe('Context Compression', () => {
    describe('POST /api/advanced-ai/context/compress', () => {
      it('returns 400 when text is missing', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/context/compress')
          .send({})
          .expect(400);
        expect(res.body).toHaveProperty('error');
      });

      it('compresses text successfully', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/context/compress')
          .send({ text: 'This is a long conversation that needs to be compressed for efficient storage and retrieval.' })
          .expect(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('stats');
      });
    });

    describe('POST /api/advanced-ai/context/similarity', () => {
      it('computes similarity between texts', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/context/similarity')
          .send({ text1: 'Hello world', text2: 'Hi there world' })
          .expect(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('similarity');
        expect(typeof res.body.similarity).toBe('number');
      });
    });

    describe('POST /api/advanced-ai/context/query', () => {
      it('queries similar contexts', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/context/query')
          .send({ query: 'How to implement authentication?' })
          .expect(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('results');
        expect(Array.isArray(res.body.results)).toBe(true);
      });
    });
  });

  // ====== Swarm Orchestration ======
  describe('Swarm Orchestration', () => {
    describe('POST /api/advanced-ai/swarm/create', () => {
      it('creates a new swarm', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/swarm/create')
          .send({ maxAgents: 10 })
          .expect(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('swarmId');
        expect(res.body).toHaveProperty('stats');
      });
    });

    describe('POST /api/advanced-ai/swarm/task', () => {
      it('returns 400 when query is missing', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/swarm/task')
          .send({})
          .expect(400);
        expect(res.body).toHaveProperty('error');
      });

      it('submits task to swarm', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/swarm/task')
          .send({ query: 'Analyze this codebase and suggest improvements' })
          .expect(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('taskId');
      });
    });

    describe('GET /api/advanced-ai/swarm/status/:swarmId', () => {
      it('returns swarm status', async () => {
        const res = await request(app)
          .get('/api/advanced-ai/swarm/status/default')
          .expect(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('stats');
        expect(res.body).toHaveProperty('topology');
      });
    });

    describe('GET /api/advanced-ai/swarm/list', () => {
      it('lists all swarms', async () => {
        const res = await request(app)
          .get('/api/advanced-ai/swarm/list')
          .expect(200);
        expect(res.body).toHaveProperty('swarms');
        expect(Array.isArray(res.body.swarms)).toBe(true);
      });
    });
  });

  // ====== Predictive Preloader ======
  describe('Predictive Preloader', () => {
    describe('POST /api/advanced-ai/preloader/record', () => {
      it('returns 400 when query is missing', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/preloader/record')
          .send({})
          .expect(400);
        expect(res.body).toHaveProperty('error');
      });

      it('records query for prediction', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/preloader/record')
          .send({ query: 'How do I create a React component?' })
          .expect(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('session');
      });
    });

    describe('GET /api/advanced-ai/preloader/predict', () => {
      it('returns predictions', async () => {
        const res = await request(app)
          .get('/api/advanced-ai/preloader/predict')
          .expect(200);
        expect(res.body).toHaveProperty('predictions');
        expect(Array.isArray(res.body.predictions)).toBe(true);
      });

      it('accepts topK parameter', async () => {
        const res = await request(app)
          .get('/api/advanced-ai/preloader/predict?topK=5')
          .expect(200);
        expect(res.body).toHaveProperty('predictions');
      });
    });

    describe('GET /api/advanced-ai/preloader/stats', () => {
      it('returns preloader statistics', async () => {
        const res = await request(app)
          .get('/api/advanced-ai/preloader/stats')
          .expect(200);
        expect(res.body).toHaveProperty('stats');
        expect(res.body.stats).toHaveProperty('totalQueries');
      });
    });
  });

  // ====== Recursive Distillation ======
  describe('Recursive Distillation', () => {
    describe('POST /api/advanced-ai/distill/turn', () => {
      it('returns 400 when role is missing', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/distill/turn')
          .send({ content: 'Hello' })
          .expect(400);
        expect(res.body).toHaveProperty('error');
      });

      it('returns 400 when content is missing', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/distill/turn')
          .send({ role: 'user' })
          .expect(400);
        expect(res.body).toHaveProperty('error');
      });

      it('adds conversation turn', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/distill/turn')
          .send({ role: 'user', content: 'I prefer TypeScript over JavaScript' })
          .expect(200);
        expect(res.body).toHaveProperty('ok', true);
      });
    });

    describe('POST /api/advanced-ai/distill/run', () => {
      it('runs distillation process', async () => {
        const res = await request(app)
          .post('/api/advanced-ai/distill/run')
          .send({})
          .expect(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('result');
        expect(res.body.result).toHaveProperty('patternsExtracted');
      });
    });

    describe('GET /api/advanced-ai/distill/model/:userId', () => {
      it('returns user model', async () => {
        const res = await request(app)
          .get('/api/advanced-ai/distill/model/default')
          .expect(200);
        expect(res.body).toHaveProperty('userId');
        expect(res.body).toHaveProperty('preferences');
      });
    });

    describe('GET /api/advanced-ai/distill/knowledge/:userId', () => {
      it('returns knowledge graph', async () => {
        const res = await request(app)
          .get('/api/advanced-ai/distill/knowledge/default')
          .expect(200);
        expect(res.body).toHaveProperty('nodes');
        expect(res.body).toHaveProperty('edges');
      });
    });

    describe('GET /api/advanced-ai/distill/stats', () => {
      it('returns distillation statistics', async () => {
        const res = await request(app)
          .get('/api/advanced-ai/distill/stats')
          .expect(200);
        expect(res.body).toHaveProperty('bufferSize');
        expect(res.body).toHaveProperty('userCount');
      });
    });
  });
});
