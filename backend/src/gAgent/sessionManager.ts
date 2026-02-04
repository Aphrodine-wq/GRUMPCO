/**
 * Session Manager Module
 *
 * Manages G-Agent sessions - creation, retrieval, cleanup, and persistence.
 */

import type { AgentMode } from "./types.js";

/**
 * Session structure
 */
export interface Session {
  /** Unique session identifier */
  id: string;
  /** User ID associated with this session */
  userId: string;
  /** Current operating mode */
  mode: AgentMode;
  /** Associated goal ID if any */
  goalId?: string;
  /** Associated plan ID if any */
  planId?: string;
  /** Conversation history */
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  }>;
  /** Session creation timestamp */
  createdAt: string;
  /** Last activity timestamp */
  lastActivityAt: string;
  /** Session-specific context data */
  context: Record<string, unknown>;
}

/**
 * Options for session manager
 */
export interface SessionManagerOptions {
  /** Session timeout in milliseconds */
  sessionTimeoutMs: number;
  /** Maximum sessions to keep in memory */
  maxSessions: number;
}

const DEFAULT_OPTIONS: SessionManagerOptions = {
  sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  maxSessions: 1000,
};

/**
 * Manages G-Agent sessions
 */
export class SessionManager {
  private sessions: Map<string, Session>;
  private options: SessionManagerOptions;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options?: Partial<SessionManagerOptions>) {
    this.sessions = new Map();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Start automatic session cleanup
   */
  startCleanup(intervalMs = 60_000): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this.cleanup(), intervalMs);
  }

  /**
   * Stop automatic session cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get an existing session by ID
   */
  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get or create a session
   */
  getOrCreate(params: {
    sessionId?: string;
    userId: string;
    mode?: AgentMode;
  }): Session {
    const { sessionId, userId, mode = "chat" } = params;

    // Return existing session if found
    if (sessionId) {
      const existing = this.sessions.get(sessionId);
      if (existing) {
        existing.lastActivityAt = new Date().toISOString();
        return existing;
      }
    }

    // Create new session
    const id = sessionId ?? this.generateSessionId();
    const now = new Date().toISOString();

    const session: Session = {
      id,
      userId,
      mode,
      messages: [],
      createdAt: now,
      lastActivityAt: now,
      context: {},
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Add a message to a session
   */
  addMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });
    session.lastActivityAt = new Date().toISOString();
  }

  /**
   * Update session mode
   */
  setMode(sessionId: string, mode: AgentMode): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.mode = mode;
      session.lastActivityAt = new Date().toISOString();
    }
  }

  /**
   * Update session context
   */
  updateContext(sessionId: string, context: Record<string, unknown>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.context = { ...session.context, ...context };
      session.lastActivityAt = new Date().toISOString();
    }
  }

  /**
   * Set goal ID for session
   */
  setGoalId(sessionId: string, goalId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.goalId = goalId;
    }
  }

  /**
   * Set plan ID for session
   */
  setPlanId(sessionId: string, planId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.planId = planId;
    }
  }

  /**
   * Delete a session
   */
  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   */
  get size(): number {
    return this.sessions.size;
  }

  /**
   * Clean up expired sessions
   */
  cleanup(): number {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, session] of this.sessions) {
      const lastActivity = new Date(session.lastActivityAt).getTime();
      if (now - lastActivity > this.options.sessionTimeoutMs) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      this.sessions.delete(id);
    }

    return expiredIds.length;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
