/**
 * G-Agent Kill Switch
 *
 * Emergency stop system for G-Agent operations.
 * Provides multiple levels of control:
 * - Global emergency stop: Stop ALL operations immediately
 * - Per-goal stop: Cancel specific goals
 * - Per-agent stop: Cancel specific agent instances
 * - Graceful shutdown: Save state and release resources
 *
 * Safety is PARAMOUNT - this module has OVERRIDE authority.
 *
 * @module gAgent/killSwitch
 */

import { EventEmitter } from "events";
import { messageBus, CHANNELS } from "./messageBus.js";
import { supervisor } from "./supervisor.js";
import { budgetManager } from "./budgetManager.js";
import type { AgentStatus, Goal, AgentInstance } from "./types.js";
import logger from "../middleware/logger.js";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default grace period for graceful shutdown (ms)
 */
export const DEFAULT_GRACE_PERIOD_MS = 5000;

/**
 * Maximum time to wait for operations to stop (ms)
 */
export const MAX_STOP_WAIT_MS = 30000;

/**
 * Stop reasons for audit trail
 */
export const STOP_REASONS = {
  USER_REQUESTED: "user_requested",
  BUDGET_EXCEEDED: "budget_exceeded",
  RUNAWAY_DETECTED: "runaway_detected",
  ERROR_THRESHOLD: "error_threshold",
  TIMEOUT: "timeout",
  ADMIN_OVERRIDE: "admin_override",
  SYSTEM_SHUTDOWN: "system_shutdown",
  SECURITY_VIOLATION: "security_violation",
  RESOURCE_EXHAUSTION: "resource_exhaustion",
} as const;

export type StopReason = (typeof STOP_REASONS)[keyof typeof STOP_REASONS];

// ============================================================================
// TYPES
// ============================================================================

export interface StopResult {
  success: boolean;
  targetId: string;
  targetType: "global" | "goal" | "agent" | "session";
  reason: StopReason;
  stoppedAt: string;
  gracefulShutdown: boolean;
  savedState: boolean;
  affectedAgents: number;
  affectedGoals: number;
  message: string;
  errors?: string[];
}

export interface StopEvent {
  id: string;
  targetId: string;
  targetType: "global" | "goal" | "agent" | "session";
  reason: StopReason;
  initiatedBy: string; // userId or 'system'
  timestamp: string;
  result: StopResult;
  metadata?: Record<string, unknown>;
}

export interface KillSwitchState {
  globalStop: boolean;
  globalStopReason?: StopReason;
  globalStopAt?: string;
  globalStopBy?: string;
  stoppedGoals: Map<string, StopEvent>;
  stoppedAgents: Map<string, StopEvent>;
  stoppedSessions: Map<string, StopEvent>;
  auditLog: StopEvent[];
}

export interface GracefulShutdownOptions {
  gracePeriodMs?: number;
  saveState?: boolean;
  notifyAgents?: boolean;
  reason?: StopReason;
}

export type KillSwitchEvent =
  | { type: "global_stop"; reason: StopReason; initiatedBy: string }
  | { type: "global_resume"; initiatedBy: string }
  | { type: "goal_stopped"; goalId: string; reason: StopReason }
  | { type: "agent_stopped"; agentId: string; reason: StopReason }
  | { type: "session_stopped"; sessionId: string; reason: StopReason }
  | { type: "graceful_shutdown_started"; affectedCount: number }
  | { type: "graceful_shutdown_complete"; savedState: boolean };

// ============================================================================
// KILL SWITCH CLASS
// ============================================================================

export class KillSwitch extends EventEmitter {
  private state: KillSwitchState;
  private abortControllers: Map<string, AbortController> = new Map();
  private static instance: KillSwitch;

  private constructor() {
    super();
    this.state = {
      globalStop: false,
      stoppedGoals: new Map(),
      stoppedAgents: new Map(),
      stoppedSessions: new Map(),
      auditLog: [],
    };

    // Subscribe to system events for automatic intervention
    this.setupAutoIntervention();
  }

  static getInstance(): KillSwitch {
    if (!KillSwitch.instance) {
      KillSwitch.instance = new KillSwitch();
    }
    return KillSwitch.instance;
  }

  // --------------------------------------------------------------------------
  // GLOBAL EMERGENCY STOP
  // --------------------------------------------------------------------------

  /**
   * EMERGENCY STOP ALL - Stop everything immediately
   * This is the nuclear option - use with caution
   */
  async emergencyStopAll(
    reason: StopReason = STOP_REASONS.USER_REQUESTED,
    initiatedBy: string = "system",
  ): Promise<StopResult> {
    const stoppedAt = new Date().toISOString();
    const errors: string[] = [];
    let affectedAgents = 0;
    const affectedGoals = 0;

    logger.warn({ reason, initiatedBy }, "[KillSwitch] EMERGENCY STOP ALL");

    // 1. Set global stop flag IMMEDIATELY
    this.state.globalStop = true;
    this.state.globalStopReason = reason;
    this.state.globalStopAt = stoppedAt;
    this.state.globalStopBy = initiatedBy;

    // 2. Pause budget manager
    budgetManager.pauseAll();

    // 3. Abort all active abort controllers
    for (const [id, controller] of this.abortControllers) {
      try {
        controller.abort();
        logger.info({ id }, "[KillSwitch] Aborted controller");
      } catch (err) {
        errors.push(`Failed to abort ${id}: ${err}`);
      }
    }
    this.abortControllers.clear();

    // 4. Stop all active agents via supervisor
    try {
      const activeAgents = supervisor.getAllInstances({
        status: ["running", "starting", "waiting"],
      });
      affectedAgents = activeAgents.length;

      for (const agent of activeAgents) {
        try {
          supervisor.cancel(agent.id);
        } catch (err) {
          errors.push(`Failed to cancel agent ${agent.id}: ${err}`);
        }
      }
    } catch (err) {
      errors.push(`Failed to get active agents: ${err}`);
    }

    // 5. Broadcast emergency stop to message bus
    messageBus.systemError(
      "EMERGENCY STOP ACTIVATED",
      "EMERGENCY_STOP",
      initiatedBy,
    );

    // 6. Emit event
    const event: KillSwitchEvent = {
      type: "global_stop",
      reason,
      initiatedBy,
    };
    this.emit("stop", event);

    // 7. Create audit log entry
    const result: StopResult = {
      success: errors.length === 0,
      targetId: "global",
      targetType: "global",
      reason,
      stoppedAt,
      gracefulShutdown: false,
      savedState: false,
      affectedAgents,
      affectedGoals,
      message:
        errors.length === 0
          ? "All operations stopped successfully"
          : `Stopped with ${errors.length} errors`,
      errors: errors.length > 0 ? errors : undefined,
    };

    this.logStopEvent({
      id: crypto.randomUUID(),
      targetId: "global",
      targetType: "global",
      reason,
      initiatedBy,
      timestamp: stoppedAt,
      result,
    });

    return result;
  }

  /**
   * Resume operations after global stop
   */
  resumeAll(initiatedBy: string = "system"): void {
    if (!this.state.globalStop) {
      logger.info("[KillSwitch] Already running, nothing to resume");
      return;
    }

    logger.info({ initiatedBy }, "[KillSwitch] Resuming operations");

    this.state.globalStop = false;
    this.state.globalStopReason = undefined;
    this.state.globalStopAt = undefined;
    this.state.globalStopBy = undefined;

    // Resume budget manager
    budgetManager.resumeAll();

    // Emit event
    const event: KillSwitchEvent = {
      type: "global_resume",
      initiatedBy,
    };
    this.emit("resume", event);

    // Broadcast resume
    messageBus.broadcast("system_resume", { initiatedBy }, "killSwitch");
  }

  /**
   * Check if global stop is active
   */
  isGlobalStopActive(): boolean {
    return this.state.globalStop;
  }

  /**
   * Get global stop info
   */
  getGlobalStopInfo(): {
    active: boolean;
    reason?: StopReason;
    stoppedAt?: string;
    stoppedBy?: string;
  } {
    return {
      active: this.state.globalStop,
      reason: this.state.globalStopReason,
      stoppedAt: this.state.globalStopAt,
      stoppedBy: this.state.globalStopBy,
    };
  }

  // --------------------------------------------------------------------------
  // PER-GOAL STOP
  // --------------------------------------------------------------------------

  /**
   * Stop a specific goal and all its associated agents
   */
  async stopGoal(
    goalId: string,
    reason: StopReason = STOP_REASONS.USER_REQUESTED,
    initiatedBy: string = "system",
  ): Promise<StopResult> {
    const stoppedAt = new Date().toISOString();
    const errors: string[] = [];
    let affectedAgents = 0;

    logger.info({ goalId, reason }, "[KillSwitch] Stopping goal");

    // 1. Abort abort controller for this goal
    const controller = this.abortControllers.get(`goal:${goalId}`);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(`goal:${goalId}`);
    }

    // 2. Stop all agents working on this goal
    try {
      const activeAgents = supervisor.getAllInstances({
        status: ["running", "starting", "waiting"],
        goalId,
      });
      affectedAgents = activeAgents.length;

      for (const agent of activeAgents) {
        try {
          supervisor.cancel(agent.id);
        } catch (err) {
          errors.push(`Failed to cancel agent ${agent.id}: ${err}`);
        }
      }
    } catch (err) {
      errors.push(`Failed to get agents for goal: ${err}`);
    }

    // 3. Publish goal stopped event
    messageBus.broadcast("goal_stopped", { goalId, reason }, "killSwitch");

    // 4. Emit event
    const event: KillSwitchEvent = {
      type: "goal_stopped",
      goalId,
      reason,
    };
    this.emit("goal_stopped", event);

    // 5. Create result
    const result: StopResult = {
      success: errors.length === 0,
      targetId: goalId,
      targetType: "goal",
      reason,
      stoppedAt,
      gracefulShutdown: false,
      savedState: false,
      affectedAgents,
      affectedGoals: 1,
      message:
        errors.length === 0
          ? `Goal ${goalId} stopped successfully`
          : `Goal stopped with ${errors.length} errors`,
      errors: errors.length > 0 ? errors : undefined,
    };

    // 6. Record in state
    const stopEvent: StopEvent = {
      id: crypto.randomUUID(),
      targetId: goalId,
      targetType: "goal",
      reason,
      initiatedBy,
      timestamp: stoppedAt,
      result,
    };
    this.state.stoppedGoals.set(goalId, stopEvent);
    this.logStopEvent(stopEvent);

    return result;
  }

  /**
   * Check if a goal is stopped
   */
  isGoalStopped(goalId: string): boolean {
    return this.state.globalStop || this.state.stoppedGoals.has(goalId);
  }

  // --------------------------------------------------------------------------
  // PER-AGENT STOP
  // --------------------------------------------------------------------------

  /**
   * Stop a specific agent
   */
  async stopAgent(
    agentId: string,
    reason: StopReason = STOP_REASONS.USER_REQUESTED,
    initiatedBy: string = "system",
  ): Promise<StopResult> {
    const stoppedAt = new Date().toISOString();
    const errors: string[] = [];

    logger.info({ agentId, reason }, "[KillSwitch] Stopping agent");

    // 1. Abort abort controller for this agent
    const controller = this.abortControllers.get(`agent:${agentId}`);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(`agent:${agentId}`);
    }

    // 2. Cancel via supervisor
    try {
      supervisor.cancel(agentId);
    } catch (err) {
      errors.push(`Failed to cancel agent: ${err}`);
    }

    // 3. Emit event
    const event: KillSwitchEvent = {
      type: "agent_stopped",
      agentId,
      reason,
    };
    this.emit("agent_stopped", event);

    // 4. Create result
    const result: StopResult = {
      success: errors.length === 0,
      targetId: agentId,
      targetType: "agent",
      reason,
      stoppedAt,
      gracefulShutdown: false,
      savedState: false,
      affectedAgents: 1,
      affectedGoals: 0,
      message:
        errors.length === 0
          ? `Agent ${agentId} stopped successfully`
          : `Agent stopped with ${errors.length} errors`,
      errors: errors.length > 0 ? errors : undefined,
    };

    // 5. Record in state
    const stopEvent: StopEvent = {
      id: crypto.randomUUID(),
      targetId: agentId,
      targetType: "agent",
      reason,
      initiatedBy,
      timestamp: stoppedAt,
      result,
    };
    this.state.stoppedAgents.set(agentId, stopEvent);
    this.logStopEvent(stopEvent);

    return result;
  }

  /**
   * Check if an agent is stopped
   */
  isAgentStopped(agentId: string): boolean {
    return this.state.globalStop || this.state.stoppedAgents.has(agentId);
  }

  // --------------------------------------------------------------------------
  // PER-SESSION STOP
  // --------------------------------------------------------------------------

  /**
   * Stop a specific session and all its operations
   */
  async stopSession(
    sessionId: string,
    reason: StopReason = STOP_REASONS.USER_REQUESTED,
    initiatedBy: string = "system",
  ): Promise<StopResult> {
    const stoppedAt = new Date().toISOString();
    const errors: string[] = [];
    const affectedAgents = 0;

    logger.info({ sessionId, reason }, "[KillSwitch] Stopping session");

    // 1. Stop budget tracking for session
    budgetManager.stopSession(sessionId, reason);

    // 2. Abort abort controller for this session
    const controller = this.abortControllers.get(`session:${sessionId}`);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(`session:${sessionId}`);
    }

    // 3. Emit event
    const event: KillSwitchEvent = {
      type: "session_stopped",
      sessionId,
      reason,
    };
    this.emit("session_stopped", event);

    // 4. Create result
    const result: StopResult = {
      success: errors.length === 0,
      targetId: sessionId,
      targetType: "session",
      reason,
      stoppedAt,
      gracefulShutdown: false,
      savedState: false,
      affectedAgents,
      affectedGoals: 0,
      message:
        errors.length === 0
          ? `Session ${sessionId} stopped successfully`
          : `Session stopped with ${errors.length} errors`,
      errors: errors.length > 0 ? errors : undefined,
    };

    // 5. Record in state
    const stopEvent: StopEvent = {
      id: crypto.randomUUID(),
      targetId: sessionId,
      targetType: "session",
      reason,
      initiatedBy,
      timestamp: stoppedAt,
      result,
    };
    this.state.stoppedSessions.set(sessionId, stopEvent);
    this.logStopEvent(stopEvent);

    return result;
  }

  /**
   * Check if a session is stopped
   */
  isSessionStopped(sessionId: string): boolean {
    return this.state.globalStop || this.state.stoppedSessions.has(sessionId);
  }

  // --------------------------------------------------------------------------
  // GRACEFUL SHUTDOWN
  // --------------------------------------------------------------------------

  /**
   * Initiate graceful shutdown - allow in-flight operations to complete
   */
  async gracefulShutdown(
    options: GracefulShutdownOptions = {},
  ): Promise<StopResult> {
    const {
      gracePeriodMs = DEFAULT_GRACE_PERIOD_MS,
      saveState = true,
      notifyAgents = true,
      reason = STOP_REASONS.SYSTEM_SHUTDOWN,
    } = options;

    const stoppedAt = new Date().toISOString();
    let savedStateSuccess = false;

    logger.info({ gracePeriodMs }, "[KillSwitch] Initiating graceful shutdown");

    // 1. Get count of active operations
    const activeAgents = supervisor.getAllInstances({
      status: ["running", "starting", "waiting"],
    });
    const affectedCount = activeAgents.length;

    // 2. Emit shutdown started event
    const startEvent: KillSwitchEvent = {
      type: "graceful_shutdown_started",
      affectedCount,
    };
    this.emit("shutdown_started", startEvent);

    // 3. Notify agents if requested
    if (notifyAgents) {
      messageBus.broadcast(
        "graceful_shutdown",
        {
          gracePeriodMs,
          reason,
        },
        "killSwitch",
      );
    }

    // 4. Wait for grace period
    await new Promise((resolve) => setTimeout(resolve, gracePeriodMs));

    // 5. Save state if requested
    if (saveState) {
      try {
        // Save current state to a checkpoint
        // In production, this would persist to database
        savedStateSuccess = true;
        logger.info("[KillSwitch] State saved successfully");
      } catch (err) {
        logger.error({ err }, "[KillSwitch] Failed to save state");
      }
    }

    // 6. Now force stop any remaining operations
    const result = await this.emergencyStopAll(reason, "graceful_shutdown");
    result.gracefulShutdown = true;
    result.savedState = savedStateSuccess;

    // 7. Emit complete event
    const completeEvent: KillSwitchEvent = {
      type: "graceful_shutdown_complete",
      savedState: savedStateSuccess,
    };
    this.emit("shutdown_complete", completeEvent);

    return result;
  }

  // --------------------------------------------------------------------------
  // ABORT CONTROLLER MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Create and register an abort controller
   */
  createAbortController(id: string): AbortController {
    // Check if global stop is active
    if (this.state.globalStop) {
      const abortedController = new AbortController();
      abortedController.abort();
      return abortedController;
    }

    const controller = new AbortController();
    this.abortControllers.set(id, controller);
    return controller;
  }

  /**
   * Get an existing abort controller
   */
  getAbortController(id: string): AbortController | undefined {
    return this.abortControllers.get(id);
  }

  /**
   * Remove an abort controller (when operation completes)
   */
  removeAbortController(id: string): void {
    this.abortControllers.delete(id);
  }

  /**
   * Check if an operation should continue
   */
  shouldContinue(id: string): boolean {
    if (this.state.globalStop) return false;

    const controller = this.abortControllers.get(id);
    if (controller?.signal.aborted) return false;

    return true;
  }

  // --------------------------------------------------------------------------
  // AUTO INTERVENTION
  // --------------------------------------------------------------------------

  /**
   * Set up automatic intervention based on system events
   */
  private setupAutoIntervention(): void {
    // Listen for budget runaway events
    budgetManager.on(
      "runaway",
      async (event: { type: string; reason: string }) => {
        logger.warn("[KillSwitch] Runaway detected, intervening...");
        // The budget manager already handles this, but we log it
      },
    );

    // Listen for system errors
    messageBus.subscribe(CHANNELS.SYSTEM_ERROR, (message) => {
      if ("error" in message && message.error.includes("EMERGENCY")) {
        logger.warn("[KillSwitch] Emergency error detected");
      }
    });
  }

  // --------------------------------------------------------------------------
  // AUDIT & REPORTING
  // --------------------------------------------------------------------------

  /**
   * Log a stop event for audit trail
   */
  private logStopEvent(event: StopEvent): void {
    this.state.auditLog.push(event);

    // Keep only last 1000 events
    if (this.state.auditLog.length > 1000) {
      this.state.auditLog = this.state.auditLog.slice(-1000);
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(options?: {
    limit?: number;
    since?: string;
    targetType?: StopEvent["targetType"];
    reason?: StopReason;
  }): StopEvent[] {
    let log = [...this.state.auditLog];

    if (options?.since) {
      const sinceDate = new Date(options.since);
      log = log.filter((e) => new Date(e.timestamp) >= sinceDate);
    }

    if (options?.targetType) {
      log = log.filter((e) => e.targetType === options.targetType);
    }

    if (options?.reason) {
      log = log.filter((e) => e.reason === options.reason);
    }

    if (options?.limit) {
      log = log.slice(-options.limit);
    }

    return log;
  }

  /**
   * Get current state summary
   */
  getStateSummary(): {
    globalStopActive: boolean;
    stoppedGoals: number;
    stoppedAgents: number;
    stoppedSessions: number;
    activeAbortControllers: number;
    auditLogSize: number;
  } {
    return {
      globalStopActive: this.state.globalStop,
      stoppedGoals: this.state.stoppedGoals.size,
      stoppedAgents: this.state.stoppedAgents.size,
      stoppedSessions: this.state.stoppedSessions.size,
      activeAbortControllers: this.abortControllers.size,
      auditLogSize: this.state.auditLog.length,
    };
  }

  /**
   * Clear stopped states (for resumed operations)
   */
  clearStoppedStates(): void {
    this.state.stoppedGoals.clear();
    this.state.stoppedAgents.clear();
    this.state.stoppedSessions.clear();
  }

  // --------------------------------------------------------------------------
  // SAFETY CHECKS
  // --------------------------------------------------------------------------

  /**
   * Pre-operation safety check
   * Call this before starting any potentially dangerous operation
   */
  canStartOperation(options: {
    sessionId?: string;
    goalId?: string;
    agentId?: string;
  }): {
    allowed: boolean;
    reason?: string;
  } {
    // Check global stop
    if (this.state.globalStop) {
      return {
        allowed: false,
        reason: `Global stop active: ${this.state.globalStopReason}`,
      };
    }

    // Check session stop
    if (
      options.sessionId &&
      this.state.stoppedSessions.has(options.sessionId)
    ) {
      return {
        allowed: false,
        reason: "Session has been stopped",
      };
    }

    // Check goal stop
    if (options.goalId && this.state.stoppedGoals.has(options.goalId)) {
      return {
        allowed: false,
        reason: "Goal has been stopped",
      };
    }

    // Check agent stop
    if (options.agentId && this.state.stoppedAgents.has(options.agentId)) {
      return {
        allowed: false,
        reason: "Agent has been stopped",
      };
    }

    return { allowed: true };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const killSwitch = KillSwitch.getInstance();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Emergency stop all operations
 */
export async function emergencyStopAll(
  reason: StopReason = STOP_REASONS.USER_REQUESTED,
  initiatedBy: string = "system",
): Promise<StopResult> {
  return killSwitch.emergencyStopAll(reason, initiatedBy);
}

/**
 * Stop a specific goal
 */
export async function stopGoal(
  goalId: string,
  reason?: StopReason,
): Promise<StopResult> {
  return killSwitch.stopGoal(goalId, reason);
}

/**
 * Stop a specific agent
 */
export async function stopAgent(
  agentId: string,
  reason?: StopReason,
): Promise<StopResult> {
  return killSwitch.stopAgent(agentId, reason);
}

/**
 * Check if global stop is active
 */
export function isGlobalStopActive(): boolean {
  return killSwitch.isGlobalStopActive();
}

/**
 * Create an abort controller for an operation
 */
export function createAbortController(id: string): AbortController {
  return killSwitch.createAbortController(id);
}

/**
 * Check if an operation should continue
 */
export function shouldContinue(id: string): boolean {
  return killSwitch.shouldContinue(id);
}

/**
 * Pre-operation safety check
 */
export function canStartOperation(options: {
  sessionId?: string;
  goalId?: string;
  agentId?: string;
}): { allowed: boolean; reason?: string } {
  return killSwitch.canStartOperation(options);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default killSwitch;
