/**
 * Redis Client Service
 * Provides Redis connection with connection pooling and error handling
 */

import { Redis } from 'ioredis';
import logger from '../../middleware/logger.js';

let redisClient: Redis | null = null;
let isConnected = false;

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  retryStrategy?: (times: number) => number;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
}

const DEFAULT_CONFIG: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

/**
 * Initialize Redis connection
 */
export function initializeRedis(config?: RedisConfig): Redis {
  if (redisClient && isConnected) {
    return redisClient;
  }

  const redisConfig = { ...DEFAULT_CONFIG, ...config };

  redisClient = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
    maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
    enableReadyCheck: redisConfig.enableReadyCheck,
    lazyConnect: redisConfig.lazyConnect,
    retryStrategy: redisConfig.retryStrategy,
  });

  redisClient.on('connect', () => {
    logger.info({ host: redisConfig.host, port: redisConfig.port }, 'Redis connecting');
  });

  redisClient.on('ready', () => {
    isConnected = true;
    logger.info({ host: redisConfig.host, port: redisConfig.port }, 'Redis connected and ready');
  });

  redisClient.on('error', (error) => {
    isConnected = false;
    logger.error({ error: error.message }, 'Redis connection error');
  });

  redisClient.on('close', () => {
    isConnected = false;
    logger.warn('Redis connection closed');
  });

  redisClient.on('reconnecting', () => {
    logger.info('Redis reconnecting');
  });

  return redisClient;
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    return initializeRedis();
  }
  return redisClient;
}

/**
 * Create a new Redis client instance (for pub/sub subscribers that need separate connections)
 */
export function createRedisClient(config?: RedisConfig): Redis {
  const redisConfig = { ...DEFAULT_CONFIG, ...config };

  const client = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
    maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
    enableReadyCheck: redisConfig.enableReadyCheck,
    lazyConnect: redisConfig.lazyConnect,
    retryStrategy: redisConfig.retryStrategy,
  });

  client.on('error', (error) => {
    logger.error({ error: error.message }, 'Redis subscriber connection error');
  });

  return client;
}

/**
 * Check if Redis is connected
 */
export async function isRedisConnected(): Promise<boolean> {
  if (!redisClient) {
    return false;
  }

  try {
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Redis health check failed');
    return false;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    logger.info('Redis connection closed');
  }
}

/**
 * Health check for Redis
 */
export async function healthCheck(): Promise<{
  connected: boolean;
  latency?: number;
}> {
  if (!redisClient) {
    return { connected: false };
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;
    return { connected: true, latency };
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Redis health check failed');
    return { connected: false };
  }
}
