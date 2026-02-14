/**
 * Scalable Session Service
 * Handles distributed sessions, locks, and coordination for horizontal scaling
 *
 * Features:
 * - Redis-based distributed locking
 * - Session affinity helpers
 * - Cluster-wide rate limiting
 * - Instance health tracking
 */

import { getRedisClient, isRedisConnected } from '../infra/redis.js';
import logger from '../../middleware/logger.js';

// ========== Configuration ==========

const INSTANCE_ID = process.env.INSTANCE_ID || `instance_${process.pid}`;
const CLUSTER_MODE = process.env.CLUSTER_MODE === 'true';

const LOCK_PREFIX = 'lock:';
const RATE_LIMIT_PREFIX = 'ratelimit:';
const INSTANCE_PREFIX = 'instance:';
const SESSION_PREFIX = 'session:';

// ========== Types ==========

export interface DistributedLock {
  key: string;
  token: string;
  expiresAt: number;
}

export interface InstanceInfo {
  id: string;
  startedAt: string;
  lastHeartbeat: string;
  sessionsCount: number;
  requestsPerMinute: number;
  healthy: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  instanceId: string;
  createdAt: string;
  lastActivity: string;
  data: Record<string, unknown>;
}

// ========== Distributed Locking ==========

/**
 * Acquire a distributed lock
 * Uses Redis SET NX with expiration (Redlock algorithm simplified)
 */
export async function acquireLock(
  resource: string,
  ttlMs: number = 10000
): Promise<DistributedLock | null> {
  const redis = getRedisClient();
  const key = `${LOCK_PREFIX}${resource}`;
  const token = `${INSTANCE_ID}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  try {
    const result = await redis.set(key, token, 'PX', ttlMs, 'NX');

    if (result === 'OK') {
      logger.debug({ resource, token, ttlMs }, 'Lock acquired');
      return {
        key,
        token,
        expiresAt: Date.now() + ttlMs,
      };
    }

    return null;
  } catch (err) {
    logger.error({ err, resource }, 'Failed to acquire lock');
    return null;
  }
}

/**
 * Release a distributed lock
 * Only releases if we own the lock (token matches)
 */
export async function releaseLock(lock: DistributedLock): Promise<boolean> {
  const redis = getRedisClient();

  // Lua script for atomic check-and-delete
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  try {
    const result = await redis.eval(script, 1, lock.key, lock.token);
    const released = result === 1;

    if (released) {
      logger.debug({ key: lock.key }, 'Lock released');
    } else {
      logger.warn({ key: lock.key }, 'Lock not owned or expired');
    }

    return released;
  } catch (err) {
    logger.error({ err, key: lock.key }, 'Failed to release lock');
    return false;
  }
}

/**
 * Extend a lock's TTL
 */
export async function extendLock(lock: DistributedLock, ttlMs: number): Promise<boolean> {
  const redis = getRedisClient();

  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("PEXPIRE", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;

  try {
    const result = await redis.eval(script, 1, lock.key, lock.token, ttlMs.toString());
    return result === 1;
  } catch (err) {
    logger.error({ err, key: lock.key }, 'Failed to extend lock');
    return false;
  }
}

/**
 * Execute a function with a distributed lock
 */
export async function withLock<T>(
  resource: string,
  fn: () => Promise<T>,
  options: { ttlMs?: number; retryMs?: number; maxRetries?: number } = {}
): Promise<T | null> {
  const { ttlMs = 10000, retryMs = 100, maxRetries = 50 } = options;

  let lock: DistributedLock | null = null;
  let retries = 0;

  // Try to acquire lock with retries
  while (!lock && retries < maxRetries) {
    lock = await acquireLock(resource, ttlMs);
    if (!lock) {
      retries++;
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
  }

  if (!lock) {
    logger.warn({ resource, retries }, 'Failed to acquire lock after retries');
    return null;
  }

  try {
    return await fn();
  } finally {
    await releaseLock(lock);
  }
}

// ========== Distributed Rate Limiting ==========

/**
 * Check and update rate limit (sliding window)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `${RATE_LIMIT_PREFIX}${key}`;

  try {
    // Use sorted set with timestamps as scores
    const multi = redis.multi();

    // Remove old entries
    multi.zremrangebyscore(redisKey, 0, windowStart);

    // Count current entries
    multi.zcard(redisKey);

    // Add current request
    multi.zadd(redisKey, now.toString(), `${now}_${Math.random()}`);

    // Set expiration
    multi.pexpire(redisKey, windowMs);

    const results = await multi.exec();
    const currentCount = (results?.[1]?.[1] as number) || 0;

    if (currentCount >= limit) {
      // Get oldest entry to calculate retry-after
      const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const oldestTime = oldest.length >= 2 ? parseInt(oldest[1], 10) : now;
      const retryAfter = Math.max(0, oldestTime + windowMs - now);

      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestTime + windowMs,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetAt: now + windowMs,
    };
  } catch (err) {
    logger.error({ err, key }, 'Rate limit check failed');
    // Fail open
    return { allowed: true, remaining: limit, resetAt: now + windowMs };
  }
}

/**
 * Global rate limit per user
 */
export async function checkUserRateLimit(
  userId: string,
  limit: number = 100,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  return checkRateLimit(`user:${userId}`, limit, windowMs);
}

/**
 * Global rate limit per IP
 */
export async function checkIpRateLimit(
  ip: string,
  limit: number = 200,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  return checkRateLimit(`ip:${ip}`, limit, windowMs);
}

// ========== Instance Registry ==========

/**
 * Register this instance in the cluster
 */
export async function registerInstance(): Promise<void> {
  if (!CLUSTER_MODE) return;

  const redis = getRedisClient();
  const key = `${INSTANCE_PREFIX}${INSTANCE_ID}`;

  const info: InstanceInfo = {
    id: INSTANCE_ID,
    startedAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    sessionsCount: 0,
    requestsPerMinute: 0,
    healthy: true,
  };

  try {
    await redis.setex(key, 60, JSON.stringify(info));
    logger.info({ instanceId: INSTANCE_ID }, 'Instance registered');

    // Start heartbeat
    startHeartbeat();
  } catch (err) {
    logger.error({ err }, 'Failed to register instance');
  }
}

/**
 * Start heartbeat interval
 */
let heartbeatInterval: NodeJS.Timeout | null = null;

function startHeartbeat(): void {
  if (heartbeatInterval) return;

  heartbeatInterval = setInterval(async () => {
    const redis = getRedisClient();
    const key = `${INSTANCE_PREFIX}${INSTANCE_ID}`;

    try {
      const existing = await redis.get(key);
      if (existing) {
        const info: InstanceInfo = JSON.parse(existing);
        info.lastHeartbeat = new Date().toISOString();
        await redis.setex(key, 60, JSON.stringify(info));
      }
    } catch (err) {
      logger.error({ err }, 'Heartbeat failed');
    }
  }, 30000);
}

/**
 * Deregister this instance
 */
export async function deregisterInstance(): Promise<void> {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (!CLUSTER_MODE) return;

  const redis = getRedisClient();
  const key = `${INSTANCE_PREFIX}${INSTANCE_ID}`;

  try {
    await redis.del(key);
    logger.info({ instanceId: INSTANCE_ID }, 'Instance deregistered');
  } catch (err) {
    logger.error({ err }, 'Failed to deregister instance');
  }
}

/**
 * Get all registered instances
 */
export async function getInstances(): Promise<InstanceInfo[]> {
  const redis = getRedisClient();

  try {
    const keys = await redis.keys(`${INSTANCE_PREFIX}*`);
    if (keys.length === 0) return [];

    const values = await redis.mget(keys);
    return values.filter(Boolean).map((v) => JSON.parse(v as string) as InstanceInfo);
  } catch (err) {
    logger.error({ err }, 'Failed to get instances');
    return [];
  }
}

// ========== Session Affinity ==========

/**
 * Get session with instance affinity
 */
export async function getSessionWithAffinity(sessionId: string): Promise<SessionInfo | null> {
  const redis = getRedisClient();
  const key = `${SESSION_PREFIX}${sessionId}`;

  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as SessionInfo;
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to get session');
    return null;
  }
}

/**
 * Create or update session
 */
export async function setSession(
  sessionId: string,
  userId: string,
  data: Record<string, unknown>,
  ttlSeconds: number = 86400
): Promise<void> {
  const redis = getRedisClient();
  const key = `${SESSION_PREFIX}${sessionId}`;

  const session: SessionInfo = {
    sessionId,
    userId,
    instanceId: INSTANCE_ID,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    data,
  };

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(session));
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to set session');
    throw err;
  }
}

/**
 * Update session activity
 */
export async function touchSession(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  const key = `${SESSION_PREFIX}${sessionId}`;

  try {
    const data = await redis.get(key);
    if (data) {
      const session: SessionInfo = JSON.parse(data);
      session.lastActivity = new Date().toISOString();
      // Refresh TTL
      await redis.setex(key, 86400, JSON.stringify(session));
    }
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to touch session');
  }
}

/**
 * Delete session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  const key = `${SESSION_PREFIX}${sessionId}`;

  try {
    await redis.del(key);
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to delete session');
  }
}

// ========== Cluster Health ==========

/**
 * Get cluster health status
 */
export async function getClusterHealth(): Promise<{
  healthy: boolean;
  instanceCount: number;
  instances: InstanceInfo[];
  redisConnected: boolean;
}> {
  const redisConnected = await isRedisConnected();
  const instances = await getInstances();
  const healthyInstances = instances.filter((i) => i.healthy);

  return {
    healthy: redisConnected && healthyInstances.length > 0,
    instanceCount: instances.length,
    instances,
    redisConnected,
  };
}

// ========== Exports ==========

export { INSTANCE_ID, CLUSTER_MODE };
