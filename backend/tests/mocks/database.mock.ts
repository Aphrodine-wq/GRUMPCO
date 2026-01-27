/**
 * Mock Database Service
 * In-memory database for testing
 */

import type {
  GenerationSession,
  AgentWorkReport,
} from '../../src/types/agents.js';
import type { ShipSession } from '../../src/types/ship.js';
import type { Plan } from '../../src/types/plan.js';
import type { SpecSession } from '../../src/types/spec.js';

export class MockDatabaseService {
  private sessions: Map<string, GenerationSession> = new Map();
  private shipSessions: Map<string, ShipSession> = new Map();
  private plans: Map<string, Plan> = new Map();
  private specs: Map<string, SpecSession> = new Map();
  private workReports: Map<string, AgentWorkReport[]> = new Map();
  private shouldFail = false;
  private failOperation: string | null = null;

  /**
   * Configure to fail on specific operation
   */
  setFailOperation(operation: string | null): void {
    this.shouldFail = true;
    this.failOperation = operation;
  }

  /**
   * Reset all data
   */
  reset(): void {
    this.sessions.clear();
    this.shipSessions.clear();
    this.plans.clear();
    this.specs.clear();
    this.workReports.clear();
    this.shouldFail = false;
    this.failOperation = null;
  }

  /**
   * Get all sessions (for testing)
   */
  getAllSessions(): GenerationSession[] {
    return Array.from(this.sessions.values());
  }

  // ========== Sessions ==========

  async saveSession(session: GenerationSession): Promise<void> {
    if (this.shouldFail && this.failOperation === 'saveSession') {
      throw new Error('Mock database saveSession failure');
    }
    this.sessions.set(session.sessionId, session);
  }

  async getSession(sessionId: string): Promise<GenerationSession | null> {
    if (this.shouldFail && this.failOperation === 'getSession') {
      throw new Error('Mock database getSession failure');
    }
    return this.sessions.get(sessionId) || null;
  }

  async listSessions(options: {
    type?: 'generation' | 'ship' | 'spec' | 'plan';
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<GenerationSession[]> {
    if (this.shouldFail && this.failOperation === 'listSessions') {
      throw new Error('Mock database listSessions failure');
    }

    let sessions = Array.from(this.sessions.values());

    if (options.type) {
      sessions = sessions.filter(s => s.type === options.type);
    }

    if (options.status) {
      sessions = sessions.filter(s => s.status === options.status);
    }

    if (options.offset) {
      sessions = sessions.slice(options.offset);
    }

    if (options.limit) {
      sessions = sessions.slice(0, options.limit);
    }

    return sessions;
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (this.shouldFail && this.failOperation === 'deleteSession') {
      throw new Error('Mock database deleteSession failure');
    }
    this.sessions.delete(sessionId);
  }

  // ========== Ship Sessions ==========

  async saveShipSession(session: ShipSession): Promise<void> {
    if (this.shouldFail && this.failOperation === 'saveShipSession') {
      throw new Error('Mock database saveShipSession failure');
    }
    this.shipSessions.set(session.id, session);
  }

  async getShipSession(sessionId: string): Promise<ShipSession | null> {
    if (this.shouldFail && this.failOperation === 'getShipSession') {
      throw new Error('Mock database getShipSession failure');
    }
    return this.shipSessions.get(sessionId) || null;
  }

  async listShipSessions(options: {
    phase?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<ShipSession[]> {
    if (this.shouldFail && this.failOperation === 'listShipSessions') {
      throw new Error('Mock database listShipSessions failure');
    }

    let sessions = Array.from(this.shipSessions.values());

    if (options.phase) {
      sessions = sessions.filter(s => s.phase === options.phase);
    }

    if (options.status) {
      sessions = sessions.filter(s => s.status === options.status);
    }

    if (options.limit) {
      sessions = sessions.slice(0, options.limit);
    }

    return sessions;
  }

  // ========== Plans ==========

  async savePlan(plan: Plan): Promise<void> {
    if (this.shouldFail && this.failOperation === 'savePlan') {
      throw new Error('Mock database savePlan failure');
    }
    this.plans.set(plan.id, plan);
  }

  async getPlan(planId: string): Promise<Plan | null> {
    if (this.shouldFail && this.failOperation === 'getPlan') {
      throw new Error('Mock database getPlan failure');
    }
    return this.plans.get(planId) || null;
  }

  async listPlans(options: {
    status?: string;
    limit?: number;
  } = {}): Promise<Plan[]> {
    if (this.shouldFail && this.failOperation === 'listPlans') {
      throw new Error('Mock database listPlans failure');
    }

    let plans = Array.from(this.plans.values());

    if (options.status) {
      plans = plans.filter(p => p.status === options.status);
    }

    if (options.limit) {
      plans = plans.slice(0, options.limit);
    }

    return plans;
  }

  // ========== Specs ==========

  async saveSpec(spec: SpecSession): Promise<void> {
    if (this.shouldFail && this.failOperation === 'saveSpec') {
      throw new Error('Mock database saveSpec failure');
    }
    this.specs.set(spec.id, spec);
  }

  async getSpec(specId: string): Promise<SpecSession | null> {
    if (this.shouldFail && this.failOperation === 'getSpec') {
      throw new Error('Mock database getSpec failure');
    }
    return this.specs.get(specId) || null;
  }

  // ========== Work Reports ==========

  async saveWorkReport(report: AgentWorkReport): Promise<void> {
    if (this.shouldFail && this.failOperation === 'saveWorkReport') {
      throw new Error('Mock database saveWorkReport failure');
    }

    const reports = this.workReports.get(report.sessionId) || [];
    reports.push(report);
    this.workReports.set(report.sessionId, reports);
  }

  async getWorkReports(sessionId: string): Promise<AgentWorkReport[]> {
    if (this.shouldFail && this.failOperation === 'getWorkReports') {
      throw new Error('Mock database getWorkReports failure');
    }
    return this.workReports.get(sessionId) || [];
  }

  // ========== Transactions ==========

  transaction<T>(fn: (db: any) => T): T {
    if (this.shouldFail && this.failOperation === 'transaction') {
      throw new Error('Mock database transaction failure');
    }
    // Simple mock - just execute the function
    return fn(this);
  }
}

/**
 * Create a mock database service instance
 */
export function createMockDatabaseService(): MockDatabaseService {
  return new MockDatabaseService();
}
