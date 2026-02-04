/**
 * Cost Dashboard Route Tests
 * Tests all API endpoints in /api/cost/*
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock data
const mockCostSummary = {
  totalCost: 125.50,
  totalRequests: 1500,
  cacheHitRate: 0.45,
  cacheSavings: 30.25,
  modelRoutingSavings: 15.75,
  totalSavings: 46.0,
  costByModel: {
    'moonshotai/kimi-k2.5': 75.25,
    'gpt-4-turbo': 50.25,
  },
  costByOperation: {
    chat: 60.0,
    ship: 45.5,
    codegen: 20.0,
  },
  costByDay: [
    { date: '2026-01-29', cost: 40.0 },
    { date: '2026-01-30', cost: 45.5 },
    { date: '2026-01-31', cost: 40.0 },
  ],
};

const mockBudgetStatus = {
  withinBudget: true,
  dailyUsed: 25.50,
  dailyLimit: 100,
  monthlyUsed: 500.25,
  monthlyLimit: 1000,
  alertTriggered: false,
};

const mockRecommendations = [
  'Cache hit rate is 45.0%. Consider enabling aggressive caching for repeated queries.',
  'Top cost operations: chat ($60.00), ship ($45.50), codegen ($20.00). Focus optimization efforts here.',
];

const mockRealTimeMetrics = {
  last24Hours: 85.50,
  lastHour: 5.25,
  currentRate: 5.25,
};

const mockSavingsData = {
  totalRequests: 5000,
  cheapModelUsed: 3500,
  cheapModelPercentage: 70,
  estimatedSavings: 250.75,
};

const mockCacheStats = {
  l1: { hits: 1000, misses: 500, size: 250 },
  l2: { hits: 300, misses: 200 },
  l3: { hits: 100, misses: 50 },
  invalidations: { sent: 10, received: 8 },
  totalHits: 1400,
  totalMisses: 750,
  hitRate: 0.65,
  instanceId: 'test-instance-001',
};

const mockWorkerPoolStats = {
  totalWorkers: 4,
  availableWorkers: 2,
  busyWorkers: 2,
  queuedTasks: { high: 1, normal: 3, low: 0, total: 4 },
  activeTasks: 2,
  metrics: {
    totalTasksProcessed: 1000,
    totalTasksFailed: 5,
    avgLatencyMs: 150,
    tasksPerSecond: 25,
    workerUtilization: 0.5,
    scaleEvents: { up: 2, down: 1 },
  },
};

const mockNimStats = {
  activeRequests: 5,
  maxParallelRequests: 32,
  utilization: 15.625,
};

const mockGpuMetrics = {
  utilization: 65,
  memoryUsed: 8000,
  memoryTotal: 16000,
};

// Create mock functions
const mockGetCostSummary = vi.fn();
const mockCheckBudget = vi.fn();
const mockSetBudget = vi.fn();
const mockGetRecommendations = vi.fn();
const mockGetRealTimeMetrics = vi.fn();
const mockGetSavings = vi.fn();
const mockCacheGetStats = vi.fn();
const mockWorkerPoolGetStats = vi.fn();
const mockNimGetStats = vi.fn();
const mockNimGetGpuMetrics = vi.fn();

// Mock the logger first
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the cost analytics service
vi.mock('../../src/services/costAnalytics.js', () => ({
  getCostAnalytics: () => ({
    getCostSummary: mockGetCostSummary,
    checkBudget: mockCheckBudget,
    setBudget: mockSetBudget,
    getRecommendations: mockGetRecommendations,
    getRealTimeMetrics: mockGetRealTimeMetrics,
  }),
}));

// Mock the cost optimizer service
vi.mock('../../src/services/costOptimizer.js', () => ({
  getCostOptimizer: () => ({
    getSavings: mockGetSavings,
  }),
}));

// Mock the tiered cache service
vi.mock('../../src/services/tieredCache.js', () => ({
  getTieredCache: () => ({
    getStats: mockCacheGetStats,
  }),
}));

// Mock the worker pool service
vi.mock('../../src/services/workerPool.js', () => ({
  getWorkerPool: () => ({
    getStats: mockWorkerPoolGetStats,
  }),
}));

// Mock the NIM accelerator service - this one can return null
let mockNimAccelerator: { getStats: typeof mockNimGetStats; getGpuMetrics: typeof mockNimGetGpuMetrics } | null = {
  getStats: mockNimGetStats,
  getGpuMetrics: mockNimGetGpuMetrics,
};

vi.mock('../../src/services/nimAccelerator.js', () => ({
  getNIMAccelerator: () => mockNimAccelerator,
}));

import costDashboardRouter from '../../src/routes/costDashboard.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cost', costDashboardRouter);
  return app;
}

describe('Cost Dashboard Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();

    // Reset NIM accelerator to default
    mockNimAccelerator = {
      getStats: mockNimGetStats,
      getGpuMetrics: mockNimGetGpuMetrics,
    };

    // Setup default mock return values
    mockGetCostSummary.mockResolvedValue(mockCostSummary);
    mockCheckBudget.mockResolvedValue(mockBudgetStatus);
    mockGetRecommendations.mockResolvedValue(mockRecommendations);
    mockGetRealTimeMetrics.mockReturnValue(mockRealTimeMetrics);
    mockGetSavings.mockReturnValue(mockSavingsData);
    mockCacheGetStats.mockReturnValue(mockCacheStats);
    mockWorkerPoolGetStats.mockReturnValue(mockWorkerPoolStats);
    mockNimGetStats.mockReturnValue(mockNimStats);
    mockNimGetGpuMetrics.mockResolvedValue(mockGpuMetrics);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/cost/snippet', () => {
    it('should return today\'s cost and request count', async () => {
      const response = await request(app).get('/api/cost/snippet');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.todayUsd).toBe(mockCostSummary.totalCost);
      expect(response.body.requestCount).toBe(mockCostSummary.totalRequests);
    });

    it('should use provided userId query parameter', async () => {
      const response = await request(app).get('/api/cost/snippet?userId=user123');

      expect(response.status).toBe(200);
      expect(mockGetCostSummary).toHaveBeenCalledWith('user123', expect.any(Date), expect.any(Date));
    });

    it('should default to "default" userId when not provided', async () => {
      const response = await request(app).get('/api/cost/snippet');

      expect(response.status).toBe(200);
      expect(mockGetCostSummary).toHaveBeenCalledWith('default', expect.any(Date), expect.any(Date));
    });

    it('should return zeros on error without breaking UI', async () => {
      mockGetCostSummary.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/api/cost/snippet');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.todayUsd).toBe(0);
      expect(response.body.requestCount).toBe(0);
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockGetCostSummary.mockRejectedValue('Unknown error string');

      const response = await request(app).get('/api/cost/snippet');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.todayUsd).toBe(0);
      expect(response.body.requestCount).toBe(0);
    });
  });

  describe('GET /api/cost/summary', () => {
    it('should return cost summary for default user', async () => {
      const response = await request(app).get('/api/cost/summary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCostSummary);
    });

    it('should use provided userId query parameter', async () => {
      const response = await request(app).get('/api/cost/summary?userId=user456');

      expect(response.status).toBe(200);
      expect(mockGetCostSummary).toHaveBeenCalledWith('user456', undefined, undefined);
    });

    it('should pass date range when provided', async () => {
      const startDate = '2026-01-01';
      const endDate = '2026-01-31';
      
      const response = await request(app)
        .get(`/api/cost/summary?userId=user789&startDate=${startDate}&endDate=${endDate}`);

      expect(response.status).toBe(200);
      expect(mockGetCostSummary).toHaveBeenCalledWith(
        'user789',
        new Date(startDate),
        new Date(endDate)
      );
    });

    it('should return 500 on error', async () => {
      mockGetCostSummary.mockRejectedValue(new Error('Database query failed'));

      const response = await request(app).get('/api/cost/summary');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get cost summary');
    });

    it('should handle non-Error exceptions', async () => {
      mockGetCostSummary.mockRejectedValue({ code: 'UNKNOWN_ERROR' });

      const response = await request(app).get('/api/cost/summary');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get cost summary');
    });
  });

  describe('GET /api/cost/budget', () => {
    it('should return budget status for default user', async () => {
      const response = await request(app).get('/api/cost/budget');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBudgetStatus);
    });

    it('should use provided userId', async () => {
      const response = await request(app).get('/api/cost/budget?userId=budgetUser');

      expect(response.status).toBe(200);
      expect(mockCheckBudget).toHaveBeenCalledWith('budgetUser');
    });

    it('should return budget with alert triggered', async () => {
      const alertBudget = {
        ...mockBudgetStatus,
        alertTriggered: true,
        dailyUsed: 85,
      };
      mockCheckBudget.mockResolvedValue(alertBudget);

      const response = await request(app).get('/api/cost/budget');

      expect(response.status).toBe(200);
      expect(response.body.data.alertTriggered).toBe(true);
    });

    it('should return budget exceeded status', async () => {
      const exceededBudget = {
        ...mockBudgetStatus,
        withinBudget: false,
        dailyUsed: 150,
      };
      mockCheckBudget.mockResolvedValue(exceededBudget);

      const response = await request(app).get('/api/cost/budget');

      expect(response.status).toBe(200);
      expect(response.body.data.withinBudget).toBe(false);
    });

    it('should return 500 on error', async () => {
      mockCheckBudget.mockRejectedValue(new Error('Budget check failed'));

      const response = await request(app).get('/api/cost/budget');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get budget status');
    });

    it('should handle non-Error exceptions', async () => {
      mockCheckBudget.mockRejectedValue('String error');

      const response = await request(app).get('/api/cost/budget');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get budget status');
    });
  });

  describe('POST /api/cost/budget', () => {
    it('should set budget successfully', async () => {
      const budgetData = {
        userId: 'user123',
        dailyLimitUsd: 50,
        monthlyLimitUsd: 500,
        alertThresholdPercent: 80,
      };

      const response = await request(app)
        .post('/api/cost/budget')
        .send(budgetData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Budget set successfully');
      expect(mockSetBudget).toHaveBeenCalledWith(budgetData);
    });

    it('should use default alert threshold of 80 when not provided', async () => {
      const budgetData = {
        userId: 'user456',
        dailyLimitUsd: 100,
        monthlyLimitUsd: 1000,
      };

      const response = await request(app)
        .post('/api/cost/budget')
        .send(budgetData);

      expect(response.status).toBe(200);
      expect(mockSetBudget).toHaveBeenCalledWith({
        ...budgetData,
        alertThresholdPercent: 80,
      });
    });

    it('should return 400 when userId is missing', async () => {
      const budgetData = {
        dailyLimitUsd: 50,
        monthlyLimitUsd: 500,
      };

      const response = await request(app)
        .post('/api/cost/budget')
        .send(budgetData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('userId is required');
    });

    it('should return 400 when userId is empty string', async () => {
      const budgetData = {
        userId: '',
        dailyLimitUsd: 50,
      };

      const response = await request(app)
        .post('/api/cost/budget')
        .send(budgetData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('userId is required');
    });

    it('should return 500 when setBudget throws', async () => {
      mockSetBudget.mockImplementation(() => {
        throw new Error('Failed to persist budget');
      });

      const budgetData = {
        userId: 'user789',
        dailyLimitUsd: 50,
      };

      const response = await request(app)
        .post('/api/cost/budget')
        .send(budgetData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to set budget');
    });

    it('should handle non-Error exceptions when setBudget throws', async () => {
      mockSetBudget.mockImplementation(() => {
        throw 'String error from setBudget';
      });

      const budgetData = {
        userId: 'user789',
        dailyLimitUsd: 50,
      };

      const response = await request(app)
        .post('/api/cost/budget')
        .send(budgetData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to set budget');
    });
  });

  describe('GET /api/cost/recommendations', () => {
    it('should return recommendations for default user', async () => {
      const response = await request(app).get('/api/cost/recommendations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toEqual(mockRecommendations);
    });

    it('should use provided userId', async () => {
      const response = await request(app).get('/api/cost/recommendations?userId=recUser');

      expect(response.status).toBe(200);
      expect(mockGetRecommendations).toHaveBeenCalledWith('recUser');
    });

    it('should return empty recommendations when none available', async () => {
      mockGetRecommendations.mockResolvedValue([]);

      const response = await request(app).get('/api/cost/recommendations');

      expect(response.status).toBe(200);
      expect(response.body.data.recommendations).toEqual([]);
    });

    it('should return 500 on error', async () => {
      mockGetRecommendations.mockRejectedValue(new Error('Recommendation engine failed'));

      const response = await request(app).get('/api/cost/recommendations');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get recommendations');
    });

    it('should handle non-Error exceptions', async () => {
      mockGetRecommendations.mockRejectedValue({ code: 'REC_ERROR' });

      const response = await request(app).get('/api/cost/recommendations');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get recommendations');
    });
  });

  describe('GET /api/cost/realtime', () => {
    it('should return real-time metrics', async () => {
      const response = await request(app).get('/api/cost/realtime');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRealTimeMetrics);
    });

    it('should return 500 on error', async () => {
      mockGetRealTimeMetrics.mockImplementation(() => {
        throw new Error('Metrics service unavailable');
      });

      const response = await request(app).get('/api/cost/realtime');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get real-time metrics');
    });

    it('should handle non-Error exceptions', async () => {
      mockGetRealTimeMetrics.mockImplementation(() => {
        throw 'Unexpected error';
      });

      const response = await request(app).get('/api/cost/realtime');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/cost/savings', () => {
    it('should return cost savings data', async () => {
      const response = await request(app).get('/api/cost/savings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSavingsData);
    });

    it('should return zeros when no savings data available', async () => {
      mockGetSavings.mockReturnValue({
        totalRequests: 0,
        cheapModelUsed: 0,
        cheapModelPercentage: 0,
        estimatedSavings: 0,
      });

      const response = await request(app).get('/api/cost/savings');

      expect(response.status).toBe(200);
      expect(response.body.data.totalRequests).toBe(0);
      expect(response.body.data.estimatedSavings).toBe(0);
    });

    it('should return 500 on error', async () => {
      mockGetSavings.mockImplementation(() => {
        throw new Error('Cost optimizer unavailable');
      });

      const response = await request(app).get('/api/cost/savings');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get savings');
    });

    it('should handle non-Error exceptions', async () => {
      mockGetSavings.mockImplementation(() => {
        throw 'Optimizer error string';
      });

      const response = await request(app).get('/api/cost/savings');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get savings');
    });
  });

  describe('GET /api/cost/stats', () => {
    it('should return comprehensive system statistics', async () => {
      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cache');
      expect(response.body.data).toHaveProperty('workerPool');
      expect(response.body.data).toHaveProperty('nim');
      expect(response.body.data).toHaveProperty('gpu');
    });

    it('should include cache statistics', async () => {
      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.cache).toEqual(mockCacheStats);
    });

    it('should include worker pool statistics', async () => {
      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.workerPool).toEqual(mockWorkerPoolStats);
    });

    it('should include NIM accelerator statistics', async () => {
      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.nim).toEqual(mockNimStats);
    });

    it('should include GPU metrics', async () => {
      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.gpu).toEqual(mockGpuMetrics);
    });

    it('should handle null NIM accelerator', async () => {
      mockNimAccelerator = null;
      // Need to recreate app to pick up the null value
      app = createTestApp();

      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.nim).toBe(null);
      expect(response.body.data.gpu).toBe(null);
    });

    it('should handle null GPU metrics', async () => {
      mockNimGetGpuMetrics.mockResolvedValue(null);

      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.gpu).toBe(null);
    });

    it('should return 500 on cache stats error', async () => {
      mockCacheGetStats.mockImplementation(() => {
        throw new Error('Cache stats unavailable');
      });

      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get stats');
    });

    it('should return 500 on worker pool stats error', async () => {
      mockWorkerPoolGetStats.mockImplementation(() => {
        throw new Error('Worker pool error');
      });

      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get stats');
    });

    it('should return 500 on NIM stats error', async () => {
      mockNimGetStats.mockImplementation(() => {
        throw new Error('NIM accelerator error');
      });

      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 on GPU metrics error', async () => {
      mockNimGetGpuMetrics.mockRejectedValue(new Error('GPU metrics unavailable'));

      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle non-Error exceptions from any service', async () => {
      mockCacheGetStats.mockImplementation(() => {
        throw 'Cache error string';
      });

      const response = await request(app).get('/api/cost/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get stats');
    });
  });
});
