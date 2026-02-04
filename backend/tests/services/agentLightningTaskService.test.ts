/**
 * Tests for Agent Lightning Task Service
 * Covers fetchPendingTasks, getTaskPollInterval, and isTaskIntegrationConfigured
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted() for mock variables used in vi.mock() factories
const { mockLogger, mockFetch } = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  mockFetch: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

// Mock fetch globally
vi.stubGlobal('fetch', mockFetch);

// Store original env
const originalEnv = { ...process.env };

describe('agentLightningTaskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Reset environment variables
    delete process.env.AGENT_LIGHTNING_TASK_URL;
    delete process.env.AGENT_LIGHTNING_TASK_POLL_INTERVAL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  describe('fetchPendingTasks', () => {
    it('should return empty array when TASK_URL not configured', async () => {
      // Ensure TASK_URL is not set
      delete process.env.AGENT_LIGHTNING_TASK_URL;

      const { fetchPendingTasks } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = await fetchPendingTasks();

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should successfully fetch tasks when configured', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = 'https://api.agent-lightning.com';

      const mockTasks = [
        {
          id: 'task-1',
          type: 'build',
          payload: { project: 'test' },
          priority: 1,
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'task-2',
          type: 'deploy',
          payload: { env: 'staging' },
          priority: 2,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const { fetchPendingTasks } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = await fetchPendingTasks();

      expect(result).toEqual(mockTasks);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.agent-lightning.com/v1/agl/tasks',
        {
          signal: expect.any(AbortSignal),
          headers: { Accept: 'application/json' },
        }
      );
    });

    it('should return empty array on non-ok response', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = 'https://api.agent-lightning.com';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { fetchPendingTasks } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = await fetchPendingTasks();

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { status: 500 },
        'Agent Lightning task API error'
      );
    });

    it('should return empty array on fetch error', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = 'https://api.agent-lightning.com';

      const networkError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(networkError);

      const { fetchPendingTasks } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = await fetchPendingTasks();

      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { err: 'Network error' },
        'Agent Lightning task fetch failed'
      );
    });

    it('should return tasks from response data', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = 'https://api.agent-lightning.com';

      const mockTasks = [
        {
          id: 'task-abc',
          type: 'test',
          payload: { suite: 'unit' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const { fetchPendingTasks } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = await fetchPendingTasks();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-abc');
      expect(result[0].type).toBe('test');
      expect(result[0].payload).toEqual({ suite: 'unit' });
    });

    it('should return empty array when response has no tasks property', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = 'https://api.agent-lightning.com';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // No tasks property
      });

      const { fetchPendingTasks } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = await fetchPendingTasks();

      expect(result).toEqual([]);
    });

    it('should return empty array when tasks is null', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = 'https://api.agent-lightning.com';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: null }),
      });

      const { fetchPendingTasks } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = await fetchPendingTasks();

      expect(result).toEqual([]);
    });

    it('should handle 404 response status', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = 'https://api.agent-lightning.com';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { fetchPendingTasks } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = await fetchPendingTasks();

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { status: 404 },
        'Agent Lightning task API error'
      );
    });

    it('should handle timeout error', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = 'https://api.agent-lightning.com';

      const timeoutError = new Error('The operation was aborted due to timeout');
      mockFetch.mockRejectedValueOnce(timeoutError);

      const { fetchPendingTasks } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = await fetchPendingTasks();

      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { err: 'The operation was aborted due to timeout' },
        'Agent Lightning task fetch failed'
      );
    });
  });

  describe('getTaskPollInterval', () => {
    it('should return default 60000 when env not set', async () => {
      delete process.env.AGENT_LIGHTNING_TASK_POLL_INTERVAL;

      const { getTaskPollInterval } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = getTaskPollInterval();

      expect(result).toBe(60000);
    });

    it('should return custom value from env', async () => {
      process.env.AGENT_LIGHTNING_TASK_POLL_INTERVAL = '30000';

      const { getTaskPollInterval } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = getTaskPollInterval();

      expect(result).toBe(30000);
    });

    it('should parse string value to number', async () => {
      process.env.AGENT_LIGHTNING_TASK_POLL_INTERVAL = '120000';

      const { getTaskPollInterval } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = getTaskPollInterval();

      expect(result).toBe(120000);
      expect(typeof result).toBe('number');
    });
  });

  describe('isTaskIntegrationConfigured', () => {
    it('should return false when TASK_URL not set', async () => {
      delete process.env.AGENT_LIGHTNING_TASK_URL;

      const { isTaskIntegrationConfigured } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = isTaskIntegrationConfigured();

      expect(result).toBe(false);
    });

    it('should return true when TASK_URL is set', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = 'https://api.agent-lightning.com';

      const { isTaskIntegrationConfigured } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = isTaskIntegrationConfigured();

      expect(result).toBe(true);
    });

    it('should return false when TASK_URL is empty string', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = '';

      const { isTaskIntegrationConfigured } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = isTaskIntegrationConfigured();

      expect(result).toBe(false);
    });
  });

  describe('AgentLightningTask interface', () => {
    it('should handle task with all optional fields', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = 'https://api.agent-lightning.com';

      const fullTask = {
        id: 'task-full',
        type: 'complete',
        payload: { data: 'test' },
        priority: 5,
        createdAt: '2024-06-15T10:30:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [fullTask] }),
      });

      const { fetchPendingTasks } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = await fetchPendingTasks();

      expect(result[0]).toEqual(fullTask);
      expect(result[0].priority).toBe(5);
      expect(result[0].createdAt).toBe('2024-06-15T10:30:00Z');
    });

    it('should handle task with only required fields', async () => {
      process.env.AGENT_LIGHTNING_TASK_URL = 'https://api.agent-lightning.com';

      const minimalTask = {
        id: 'task-min',
        type: 'minimal',
        payload: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [minimalTask] }),
      });

      const { fetchPendingTasks } = await import(
        '../../src/services/agentLightningTaskService.js'
      );

      const result = await fetchPendingTasks();

      expect(result[0]).toEqual(minimalTask);
      expect(result[0].priority).toBeUndefined();
      expect(result[0].createdAt).toBeUndefined();
    });
  });
});
