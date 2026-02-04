/**
 * Database Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../../src/db/database.js';
import type { GenerationSession } from '../../src/types/agents.js';
import type { Plan } from '../../src/types/plan.js';
import type { ShipSession } from '../../src/types/ship.js';

describe('DatabaseService', () => {
  let db: DatabaseService;
  const testDbPath = './test.db';

  beforeEach(async () => {
    db = new DatabaseService({
      type: 'sqlite',
      sqlite: {
        path: testDbPath,
      },
    });
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
    // Clean up test database
    try {
      const fs = await import('fs/promises');
      await fs.unlink(testDbPath).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Sessions', () => {
    it('should save and retrieve a session', async () => {
      const session: GenerationSession = {
        sessionId: 'test-session-1',
        type: 'generation',
        status: 'active',
        createdAt: new Date().toISOString(),
        request: {
          projectDescription: 'Test project',
        },
        agents: [],
        files: [],
      };

      await db.saveSession(session);
      const retrieved = await db.getSession('test-session-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(session.sessionId);
      expect(retrieved?.status).toBe(session.status);
    });

    it('should list sessions with filters', async () => {
      const session1: GenerationSession = {
        sessionId: 'test-1',
        type: 'generation',
        status: 'active',
        createdAt: new Date().toISOString(),
        request: { projectDescription: 'Test 1' },
        agents: [],
        files: [],
      };

      const session2: GenerationSession = {
        sessionId: 'test-2',
        type: 'generation',
        status: 'completed',
        createdAt: new Date().toISOString(),
        request: { projectDescription: 'Test 2' },
        agents: [],
        files: [],
      };

      await db.saveSession(session1);
      await db.saveSession(session2);

      const activeSessions = await db.listSessions({ status: 'active' });
      expect(activeSessions.length).toBe(1);
      expect(activeSessions[0].sessionId).toBe('test-1');

      const completedSessions = await db.listSessions({ status: 'completed' });
      expect(completedSessions.length).toBe(1);
      expect(completedSessions[0].sessionId).toBe('test-2');
    });

    it('should delete a session', async () => {
      const session: GenerationSession = {
        sessionId: 'test-delete',
        type: 'generation',
        status: 'active',
        createdAt: new Date().toISOString(),
        request: { projectDescription: 'Test' },
        agents: [],
        files: [],
      };

      await db.saveSession(session);
      await db.deleteSession('test-delete');

      const retrieved = await db.getSession('test-delete');
      expect(retrieved).toBeNull();
    });
  });

  describe('Plans', () => {
    it('should save and retrieve a plan', async () => {
      const plan: Plan = {
        id: 'test-plan-1',
        title: 'Test Plan',
        description: 'Test description',
        status: 'draft',
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.savePlan(plan);
      const retrieved = await db.getPlan('test-plan-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(plan.id);
      expect(retrieved?.title).toBe(plan.title);
    });

    it('should list plans', async () => {
      const plan1: Plan = {
        id: 'plan-1',
        title: 'Plan 1',
        description: 'Description 1',
        status: 'draft',
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const plan2: Plan = {
        id: 'plan-2',
        title: 'Plan 2',
        description: 'Description 2',
        status: 'approved',
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.savePlan(plan1);
      await db.savePlan(plan2);

      const plans = await db.listPlans();
      expect(plans.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Ship Sessions', () => {
    it('should save and retrieve a ship session', async () => {
      const session: ShipSession = {
        id: 'ship-1',
        phase: 'planning',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: {},
      };

      await db.saveShipSession(session);
      const retrieved = await db.getShipSession('ship-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
      expect(retrieved?.phase).toBe(session.phase);
    });
  });

  describe('Transactions', () => {
    it('should execute transaction', async () => {
      const result = db.transaction((dbInstance) => {
        return 'transaction-result';
      });

      expect(result).toBe('transaction-result');
    });
  });
});
