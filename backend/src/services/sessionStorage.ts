/**
 * Session Storage Abstraction
 * Provides unified interface for session storage (SQLite/Redis)
 */

import { getDatabase } from '../db/database.js';
import { getRedisClient, isRedisConnected } from './redis.js';
import logger from '../middleware/logger.js';
import type { GenerationSession } from '../types/agents.js';
import type { ShipSession } from '../types/ship.js';
import type { Plan } from '../types/plan.js';
import type { SpecSession } from '../types/spec.js';

export type StorageType = 'sqlite' | 'redis' | 'auto';

export interface SessionStorage {
  saveSession(session: GenerationSession): Promise<void>;
  getSession(sessionId: string): Promise<GenerationSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(limit?: number): Promise<string[]>;
  
  saveShipSession(session: ShipSession): Promise<void>;
  getShipSession(sessionId: string): Promise<ShipSession | null>;
  
  savePlan(plan: Plan): Promise<void>;
  getPlan(planId: string): Promise<Plan | null>;
  
  saveSpecSession(session: SpecSession): Promise<void>;
  getSpecSession(sessionId: string): Promise<SpecSession | null>;
}

/**
 * SQLite Session Storage Implementation
 */
class SQLiteSessionStorage implements SessionStorage {
  async saveSession(session: GenerationSession): Promise<void> {
    const db = getDatabase();
    await db.saveSession(session);
  }

  async getSession(sessionId: string): Promise<GenerationSession | null> {
    const db = getDatabase();
    return await db.getSession(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const db = getDatabase();
    await db.deleteSession(sessionId);
  }

  async listSessions(limit = 100): Promise<string[]> {
    const db = getDatabase();
    // SQLite implementation would need to be added to database service
    return [];
  }

  async saveShipSession(session: ShipSession): Promise<void> {
    const db = getDatabase();
    await db.saveShipSession(session);
  }

  async getShipSession(sessionId: string): Promise<ShipSession | null> {
    const db = getDatabase();
    return await db.getShipSession(sessionId);
  }

  async savePlan(plan: Plan): Promise<void> {
    const db = getDatabase();
    await db.savePlan(plan);
  }

  async getPlan(planId: string): Promise<Plan | null> {
    const db = getDatabase();
    return await db.getPlan(planId);
  }

  async saveSpecSession(session: SpecSession): Promise<void> {
    const db = getDatabase();
    await db.saveSpecSession(session);
  }

  async getSpecSession(sessionId: string): Promise<SpecSession | null> {
    const db = getDatabase();
    return await db.getSpecSession(sessionId);
  }
}

/**
 * Redis Session Storage Implementation
 */
class RedisSessionStorage implements SessionStorage {
  private redis = getRedisClient();
  private readonly SESSION_PREFIX = 'session:';
  private readonly SHIP_SESSION_PREFIX = 'ship:';
  private readonly PLAN_PREFIX = 'plan:';
  private readonly SPEC_PREFIX = 'spec:';
  private readonly SESSION_TTL = 86400; // 24 hours in seconds

  private getSessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`;
  }

  private getShipSessionKey(sessionId: string): string {
    return `${this.SHIP_SESSION_PREFIX}${sessionId}`;
  }

  private getPlanKey(planId: string): string {
    return `${this.PLAN_PREFIX}${planId}`;
  }

  private getSpecSessionKey(sessionId: string): string {
    return `${this.SPEC_PREFIX}${sessionId}`;
  }

  async saveSession(session: GenerationSession): Promise<void> {
    const key = this.getSessionKey(session.sessionId);
    await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(session));
  }

  async getSession(sessionId: string): Promise<GenerationSession | null> {
    const key = this.getSessionKey(sessionId);
    const data = await this.redis.get(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as GenerationSession;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const key = this.getSessionKey(sessionId);
    await this.redis.del(key);
  }

  async listSessions(limit = 100): Promise<string[]> {
    const keys = await this.redis.keys(`${this.SESSION_PREFIX}*`);
    return keys.slice(0, limit).map(key => key.replace(this.SESSION_PREFIX, ''));
  }

  async saveShipSession(session: ShipSession): Promise<void> {
    const key = this.getShipSessionKey(session.sessionId);
    await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(session));
  }

  async getShipSession(sessionId: string): Promise<ShipSession | null> {
    const key = this.getShipSessionKey(sessionId);
    const data = await this.redis.get(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as ShipSession;
  }

  async savePlan(plan: Plan): Promise<void> {
    const key = this.getPlanKey(plan.id);
    await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(plan));
  }

  async getPlan(planId: string): Promise<Plan | null> {
    const key = this.getPlanKey(planId);
    const data = await this.redis.get(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as Plan;
  }

  async saveSpecSession(session: SpecSession): Promise<void> {
    const key = this.getSpecSessionKey(session.sessionId);
    await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(session));
  }

  async getSpecSession(sessionId: string): Promise<SpecSession | null> {
    const key = this.getSpecSessionKey(sessionId);
    const data = await this.redis.get(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as SpecSession;
  }
}

/**
 * Factory function to create session storage based on configuration
 */
let storageInstance: SessionStorage | null = null;

export function getSessionStorage(type: StorageType = 'auto'): SessionStorage {
  if (storageInstance) {
    return storageInstance;
  }

  // Auto-detect storage type
  if (type === 'auto') {
    const useRedis = process.env.SESSION_STORAGE === 'redis' || 
                     (process.env.REDIS_HOST && process.env.NODE_ENV === 'production');
    
    if (useRedis) {
      // Check if Redis is available
      isRedisConnected().then(connected => {
        if (connected) {
          logger.info('Using Redis for session storage');
          storageInstance = new RedisSessionStorage();
        } else {
          logger.warn('Redis not available, falling back to SQLite');
          storageInstance = new SQLiteSessionStorage();
        }
      }).catch(() => {
        logger.warn('Redis check failed, falling back to SQLite');
        storageInstance = new SQLiteSessionStorage();
      });
      
      // Default to SQLite if Redis check is pending
      storageInstance = new SQLiteSessionStorage();
    } else {
      storageInstance = new SQLiteSessionStorage();
    }
  } else if (type === 'redis') {
    storageInstance = new RedisSessionStorage();
  } else {
    storageInstance = new SQLiteSessionStorage();
  }

  return storageInstance;
}

/**
 * Initialize session storage
 */
export async function initializeSessionStorage(type: StorageType = 'auto'): Promise<SessionStorage> {
  const storage = getSessionStorage(type);
  
  // If using Redis, verify connection
  if (type === 'redis' || (type === 'auto' && process.env.SESSION_STORAGE === 'redis')) {
    const connected = await isRedisConnected();
    if (!connected) {
      logger.warn('Redis not connected, session storage may not work correctly');
    }
  }
  
  return storage;
}
