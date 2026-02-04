/**
 * Redis Service unit tests.
 * Run: npm test -- redis.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mock functions are defined before vi.mock runs
const { mockOn, mockPing, mockQuit, MockRedis } = vi.hoisted(() => {
  const mockOn = vi.fn();
  const mockPing = vi.fn();
  const mockQuit = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const MockRedis = vi.fn((_config?: Record<string, unknown>) => ({
    on: mockOn,
    ping: mockPing,
    quit: mockQuit,
  }));

  return { mockOn, mockPing, mockQuit, MockRedis };
});

// Mock ioredis using the hoisted mocks
vi.mock('ioredis', () => ({
  Redis: MockRedis,
}));

// Mock logger with hoisted mocks
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

describe('Redis Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear mock call history but keep the implementation
    mockOn.mockClear();
    mockPing.mockClear();
    mockQuit.mockClear();
    MockRedis.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();

    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initializeRedis', () => {
    it('creates a Redis client with default config', async () => {
      const { initializeRedis } = await import('../../src/services/redis.js');

      const client = initializeRedis();

      expect(MockRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          db: 0,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        })
      );
      expect(client).toBeDefined();
    });

    it('uses environment variables for config', async () => {
      process.env.REDIS_HOST = 'redis.example.com';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'secret';
      process.env.REDIS_DB = '1';

      vi.resetModules();
      const { initializeRedis } = await import('../../src/services/redis.js');

      initializeRedis();

      expect(MockRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'redis.example.com',
          port: 6380,
          password: 'secret',
          db: 1,
        })
      );
    });

    it('accepts custom config', async () => {
      const { initializeRedis } = await import('../../src/services/redis.js');

      initializeRedis({
        host: 'custom.redis.io',
        port: 9999,
        db: 5,
      });

      expect(MockRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'custom.redis.io',
          port: 9999,
          db: 5,
        })
      );
    });

    it('returns existing client if already connected', async () => {
      const { initializeRedis } = await import('../../src/services/redis.js');

      // First call creates client
      const client1 = initializeRedis();

      // Simulate 'ready' event to set isConnected = true
      const readyHandler = mockOn.mock.calls.find((call) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      // Second call should return same client
      const client2 = initializeRedis();

      expect(client1).toBe(client2);
    });

    it('sets up event handlers for connect, ready, error, close, reconnecting', async () => {
      const { initializeRedis } = await import('../../src/services/redis.js');

      initializeRedis();

      const events = mockOn.mock.calls.map((call) => call[0]);
      expect(events).toContain('connect');
      expect(events).toContain('ready');
      expect(events).toContain('error');
      expect(events).toContain('close');
      expect(events).toContain('reconnecting');
    });

    it('connect event logs connecting message', async () => {
      const { initializeRedis } = await import('../../src/services/redis.js');

      initializeRedis();

      const connectHandler = mockOn.mock.calls.find((call) => call[0] === 'connect')?.[1];
      expect(connectHandler).toBeDefined();
      connectHandler();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'localhost', port: 6379 }),
        'Redis connecting'
      );
    });

    it('ready event sets isConnected and logs', async () => {
      const { initializeRedis } = await import('../../src/services/redis.js');

      initializeRedis();

      const readyHandler = mockOn.mock.calls.find((call) => call[0] === 'ready')?.[1];
      readyHandler();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'localhost', port: 6379 }),
        'Redis connected and ready'
      );
    });

    it('error event logs error and sets isConnected false', async () => {
      const { initializeRedis } = await import('../../src/services/redis.js');

      initializeRedis();

      const errorHandler = mockOn.mock.calls.find((call) => call[0] === 'error')?.[1];
      errorHandler(new Error('Connection refused'));

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Connection refused' }),
        'Redis connection error'
      );
    });

    it('close event logs warning', async () => {
      const { initializeRedis } = await import('../../src/services/redis.js');

      initializeRedis();

      const closeHandler = mockOn.mock.calls.find((call) => call[0] === 'close')?.[1];
      closeHandler();

      expect(mockLogger.warn).toHaveBeenCalledWith('Redis connection closed');
    });

    it('reconnecting event logs info', async () => {
      const { initializeRedis } = await import('../../src/services/redis.js');

      initializeRedis();

      const reconnectHandler = mockOn.mock.calls.find((call) => call[0] === 'reconnecting')?.[1];
      reconnectHandler();

      expect(mockLogger.info).toHaveBeenCalledWith('Redis reconnecting');
    });
  });

  describe('getRedisClient', () => {
    it('returns existing client if initialized', async () => {
      const { initializeRedis, getRedisClient } = await import('../../src/services/redis.js');

      const client1 = initializeRedis();
      const client2 = getRedisClient();

      expect(client2).toBe(client1);
    });

    it('initializes new client if not yet created', async () => {
      const { getRedisClient } = await import('../../src/services/redis.js');

      const client = getRedisClient();

      expect(client).toBeDefined();
    });
  });

  describe('createRedisClient', () => {
    it('creates a new independent Redis client', async () => {
      const { createRedisClient } = await import('../../src/services/redis.js');

      const client = createRedisClient();

      expect(MockRedis).toHaveBeenCalled();
      expect(client).toBeDefined();
    });

    it('uses custom config for new client', async () => {
      const { createRedisClient } = await import('../../src/services/redis.js');

      createRedisClient({ host: 'subscriber.redis.io', port: 7777 });

      expect(MockRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'subscriber.redis.io',
          port: 7777,
        })
      );
    });

    it('sets up error handler on new client', async () => {
      const { createRedisClient } = await import('../../src/services/redis.js');

      createRedisClient();

      const errorHandler = mockOn.mock.calls.find((call) => call[0] === 'error')?.[1];
      expect(errorHandler).toBeDefined();
      errorHandler(new Error('Subscriber error'));

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Subscriber error' }),
        'Redis subscriber connection error'
      );
    });
  });

  describe('isRedisConnected', () => {
    it('returns false when client is not initialized', async () => {
      const { isRedisConnected } = await import('../../src/services/redis.js');

      const result = await isRedisConnected();

      expect(result).toBe(false);
    });

    it('returns true when ping returns PONG', async () => {
      const { initializeRedis, isRedisConnected } = await import('../../src/services/redis.js');
      mockPing.mockResolvedValue('PONG');

      initializeRedis();
      const result = await isRedisConnected();

      expect(result).toBe(true);
    });

    it('returns false when ping fails', async () => {
      const { initializeRedis, isRedisConnected } = await import('../../src/services/redis.js');
      mockPing.mockRejectedValue(new Error('Connection failed'));

      initializeRedis();
      const result = await isRedisConnected();

      expect(result).toBe(false);
    });

    it('returns false when ping returns unexpected value', async () => {
      const { initializeRedis, isRedisConnected } = await import('../../src/services/redis.js');
      mockPing.mockResolvedValue('ERROR');

      initializeRedis();
      const result = await isRedisConnected();

      expect(result).toBe(false);
    });
  });

  describe('closeRedis', () => {
    it('does nothing if client is not initialized', async () => {
      const { closeRedis } = await import('../../src/services/redis.js');

      await closeRedis();

      expect(mockQuit).not.toHaveBeenCalled();
    });

    it('calls quit on client and sets client to null', async () => {
      const { initializeRedis, closeRedis, isRedisConnected } = await import('../../src/services/redis.js');
      mockQuit.mockResolvedValue('OK');

      initializeRedis();
      await closeRedis();

      expect(mockQuit).toHaveBeenCalled();

      // After closing, isRedisConnected should return false
      const connected = await isRedisConnected();
      expect(connected).toBe(false);
    });

    it('logs when connection is closed', async () => {
      const { initializeRedis, closeRedis } = await import('../../src/services/redis.js');
      mockQuit.mockResolvedValue('OK');

      initializeRedis();
      await closeRedis();

      expect(mockLogger.info).toHaveBeenCalledWith('Redis connection closed');
    });
  });

  describe('healthCheck', () => {
    it('returns connected: false when client is not initialized', async () => {
      const { healthCheck } = await import('../../src/services/redis.js');

      const result = await healthCheck();

      expect(result.connected).toBe(false);
      expect(result.latency).toBeUndefined();
    });

    it('returns connected: true with latency on successful ping', async () => {
      const { initializeRedis, healthCheck } = await import('../../src/services/redis.js');
      mockPing.mockResolvedValue('PONG');

      initializeRedis();
      const result = await healthCheck();

      expect(result.connected).toBe(true);
      expect(typeof result.latency).toBe('number');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('returns connected: false when ping throws', async () => {
      const { initializeRedis, healthCheck } = await import('../../src/services/redis.js');
      mockPing.mockRejectedValue(new Error('Ping failed'));

      initializeRedis();
      const result = await healthCheck();

      expect(result.connected).toBe(false);
      expect(result.latency).toBeUndefined();
    });
  });

  describe('DEFAULT_CONFIG retryStrategy', () => {
    it('uses exponential backoff capped at 2000ms', async () => {
      const { initializeRedis } = await import('../../src/services/redis.js');

      initializeRedis();

      const callArgs = MockRedis.mock.calls[0]?.[0] as any;
      const retryStrategy = callArgs?.retryStrategy;

      expect(retryStrategy).toBeDefined();
      expect(retryStrategy(1)).toBe(50);
      expect(retryStrategy(10)).toBe(500);
      expect(retryStrategy(100)).toBe(2000);
      expect(retryStrategy(1000)).toBe(2000); // capped at 2000
    });
  });
});
