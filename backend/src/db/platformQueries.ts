/**
 * Platform-domain database queries
 * Extracted from database.ts — heartbeats, approvals, swarm, skills, memory, budgets, rate limits, browser allowlist
 */

import type { DatabaseService } from './database.js';
import type {
  HeartbeatRecord,
  ApprovalRequestRecord,
  SwarmAgentRecord,
  SkillRecord,
  MemoryRecord,
  CostBudgetRecord,
  RateLimitRecord,
  BrowserAllowlistRecord,
} from '../types/integrations.js';

// ========== Heartbeats ==========

/** Save heartbeat */
export async function saveHeartbeat(this: DatabaseService, record: HeartbeatRecord): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO heartbeats (id, user_id, name, cron_expression, enabled, payload, last_run_at, next_run_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      cron_expression = excluded.cron_expression,
      enabled = excluded.enabled,
      payload = excluded.payload,
      last_run_at = excluded.last_run_at,
      next_run_at = excluded.next_run_at,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.name,
    record.cron_expression,
    record.enabled ? 1 : 0,
    record.payload ?? null,
    record.last_run_at ?? null,
    record.next_run_at ?? null,
    record.created_at,
    record.updated_at
  );
}

/** Get heartbeat by ID */
export async function getHeartbeat(
  this: DatabaseService,
  id: string
): Promise<HeartbeatRecord | null> {
  const stmt = this.getStatement('SELECT * FROM heartbeats WHERE id = ?');
  const row = stmt.get(id) as HeartbeatRecord | undefined;
  if (!row) return null;
  return { ...row, enabled: Boolean(row.enabled) };
}

/** Get enabled heartbeats */
export async function getEnabledHeartbeats(this: DatabaseService): Promise<HeartbeatRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM heartbeats WHERE enabled = 1 ORDER BY next_run_at ASC'
  );
  const rows = stmt.all() as HeartbeatRecord[];
  return rows.map((r) => ({ ...r, enabled: Boolean(r.enabled) }));
}

/** Get heartbeats for user */
export async function getHeartbeatsForUser(
  this: DatabaseService,
  userId: string
): Promise<HeartbeatRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM heartbeats WHERE user_id = ? ORDER BY created_at DESC'
  );
  const rows = stmt.all(userId) as HeartbeatRecord[];
  return rows.map((r) => ({ ...r, enabled: Boolean(r.enabled) }));
}

/** Delete heartbeat */
export async function deleteHeartbeat(this: DatabaseService, id: string): Promise<void> {
  const stmt = this.getStatement('DELETE FROM heartbeats WHERE id = ?');
  stmt.run(id);
}

// ========== Approvals ==========

/** Save approval request */
export async function saveApprovalRequest(
  this: DatabaseService,
  record: ApprovalRequestRecord
): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO approval_requests (id, user_id, status, action, risk_level, reason, payload, expires_at, created_at, resolved_at, resolved_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      resolved_at = excluded.resolved_at,
      resolved_by = excluded.resolved_by
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.status,
    record.action,
    record.risk_level,
    record.reason ?? null,
    record.payload ?? null,
    record.expires_at ?? null,
    record.created_at,
    record.resolved_at ?? null,
    record.resolved_by ?? null
  );
}

/** Get approval request by ID */
export async function getApprovalRequest(
  this: DatabaseService,
  id: string
): Promise<ApprovalRequestRecord | null> {
  const stmt = this.getStatement('SELECT * FROM approval_requests WHERE id = ?');
  return (stmt.get(id) as ApprovalRequestRecord | undefined) ?? null;
}

/** Get pending approvals for user */
export async function getPendingApprovals(
  this: DatabaseService,
  userId: string
): Promise<ApprovalRequestRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM approval_requests WHERE user_id = ? AND status = ? ORDER BY created_at DESC'
  );
  return stmt.all(userId, 'pending') as ApprovalRequestRecord[];
}

// ========== Swarm Agents ==========

/** Save swarm agent */
export async function saveSwarmAgent(
  this: DatabaseService,
  record: SwarmAgentRecord
): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO agent_swarm (id, user_id, parent_id, name, status, agent_type, task_description, result, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      result = excluded.result,
      updated_at = excluded.updated_at,
      completed_at = excluded.completed_at
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.parent_id ?? null,
    record.name,
    record.status,
    record.agent_type,
    record.task_description ?? null,
    record.result ?? null,
    record.created_at,
    record.updated_at,
    record.completed_at ?? null
  );
}

/** Get swarm agent by ID */
export async function getSwarmAgent(
  this: DatabaseService,
  id: string
): Promise<SwarmAgentRecord | null> {
  const stmt = this.getStatement('SELECT * FROM agent_swarm WHERE id = ?');
  return (stmt.get(id) as SwarmAgentRecord | undefined) ?? null;
}

/** Get swarm agents for parent */
export async function getSwarmChildren(
  this: DatabaseService,
  parentId: string
): Promise<SwarmAgentRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM agent_swarm WHERE parent_id = ? ORDER BY created_at ASC'
  );
  return stmt.all(parentId) as SwarmAgentRecord[];
}

/** Get running swarm agents */
export async function getRunningSwarmAgents(this: DatabaseService): Promise<SwarmAgentRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM agent_swarm WHERE status = ? ORDER BY created_at ASC'
  );
  return stmt.all('running') as SwarmAgentRecord[];
}

// ========== Skills ==========

/** Save skill */
export async function saveSkill(this: DatabaseService, record: SkillRecord): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO skills (id, user_id, name, description, language, source_code, compiled_code, status, version, approval_request_id, created_at, updated_at, approved_at, approved_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      description = excluded.description,
      source_code = excluded.source_code,
      compiled_code = excluded.compiled_code,
      status = excluded.status,
      version = excluded.version,
      updated_at = excluded.updated_at,
      approved_at = excluded.approved_at,
      approved_by = excluded.approved_by
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.name,
    record.description ?? null,
    record.language,
    record.source_code,
    record.compiled_code ?? null,
    record.status,
    record.version,
    record.approval_request_id ?? null,
    record.created_at,
    record.updated_at,
    record.approved_at ?? null,
    record.approved_by ?? null
  );
}

/** Get skill by ID */
export async function getSkill(this: DatabaseService, id: string): Promise<SkillRecord | null> {
  const stmt = this.getStatement('SELECT * FROM skills WHERE id = ?');
  return (stmt.get(id) as SkillRecord | undefined) ?? null;
}

/** Get skill by name */
export async function getSkillByName(
  this: DatabaseService,
  name: string
): Promise<SkillRecord | null> {
  const stmt = this.getStatement('SELECT * FROM skills WHERE name = ?');
  return (stmt.get(name) as SkillRecord | undefined) ?? null;
}

/** Get active skills */
export async function getActiveSkills(this: DatabaseService): Promise<SkillRecord[]> {
  const stmt = this.getStatement('SELECT * FROM skills WHERE status = ? ORDER BY name ASC');
  return stmt.all('active') as SkillRecord[];
}

// ========== Memory Records ==========

/** Save memory record */
export async function saveMemoryRecord(this: DatabaseService, record: MemoryRecord): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO memory_records (id, user_id, type, content, embedding, importance, access_count, last_accessed_at, expires_at, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      embedding = excluded.embedding,
      importance = excluded.importance,
      access_count = excluded.access_count,
      last_accessed_at = excluded.last_accessed_at,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.type,
    record.content,
    record.embedding ?? null,
    record.importance,
    record.access_count,
    record.last_accessed_at ?? null,
    record.expires_at ?? null,
    record.metadata ?? null,
    record.created_at,
    record.updated_at
  );
}

/** Get memory record by ID */
export async function getMemoryRecord(
  this: DatabaseService,
  id: string
): Promise<MemoryRecord | null> {
  const stmt = this.getStatement('SELECT * FROM memory_records WHERE id = ?');
  return (stmt.get(id) as MemoryRecord | undefined) ?? null;
}

/** Search memory records by type */
export async function getMemoryRecordsByType(
  this: DatabaseService,
  userId: string,
  type: string,
  limit = 50
): Promise<MemoryRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM memory_records WHERE user_id = ? AND type = ? ORDER BY importance DESC, last_accessed_at DESC LIMIT ?'
  );
  return stmt.all(userId, type, limit) as MemoryRecord[];
}

/** Get recent memories */
export async function getRecentMemories(
  this: DatabaseService,
  userId: string,
  limit = 20
): Promise<MemoryRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM memory_records WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  );
  return stmt.all(userId, limit) as MemoryRecord[];
}

/** Delete memory record */
export async function deleteMemoryRecord(this: DatabaseService, id: string): Promise<void> {
  const stmt = this.getStatement('DELETE FROM memory_records WHERE id = ?');
  stmt.run(id);
}

// ========== Cost Budgets ==========

/** Save cost budget */
export async function saveCostBudget(
  this: DatabaseService,
  record: CostBudgetRecord
): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO cost_budgets (id, user_id, period, limit_cents, spent_cents, period_start, period_end, notify_at_percent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      limit_cents = excluded.limit_cents,
      spent_cents = excluded.spent_cents,
      period_start = excluded.period_start,
      period_end = excluded.period_end,
      notify_at_percent = excluded.notify_at_percent,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.period,
    record.limit_cents,
    record.spent_cents,
    record.period_start,
    record.period_end,
    record.notify_at_percent,
    record.created_at,
    record.updated_at
  );
}

/** Get current budget for user */
export async function getCurrentBudget(
  this: DatabaseService,
  userId: string
): Promise<CostBudgetRecord | null> {
  const now = new Date().toISOString();
  const stmt = this.getStatement(
    'SELECT * FROM cost_budgets WHERE user_id = ? AND period_start <= ? AND period_end >= ?'
  );
  return (stmt.get(userId, now, now) as CostBudgetRecord | undefined) ?? null;
}

// ========== Rate Limits ==========

/** Save rate limit */
export async function saveRateLimit(this: DatabaseService, record: RateLimitRecord): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO rate_limits (id, user_id, resource, max_requests, window_seconds, current_count, window_start, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, resource) DO UPDATE SET
      max_requests = excluded.max_requests,
      window_seconds = excluded.window_seconds,
      current_count = excluded.current_count,
      window_start = excluded.window_start
  `);
  stmt.run(
    record.id,
    record.user_id,
    record.resource,
    record.max_requests,
    record.window_seconds,
    record.current_count,
    record.window_start,
    record.created_at
  );
}

/** Get rate limit */
export async function getRateLimit(
  this: DatabaseService,
  userId: string,
  resource: string
): Promise<RateLimitRecord | null> {
  const stmt = this.getStatement('SELECT * FROM rate_limits WHERE user_id = ? AND resource = ?');
  return (stmt.get(userId, resource) as RateLimitRecord | undefined) ?? null;
}

/** Increment rate limit counter */
export async function incrementRateLimit(
  this: DatabaseService,
  userId: string,
  resource: string
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = await this.getRateLimit(userId, resource);
  if (!limit) return { allowed: true, remaining: 999 };

  const now = new Date();
  const windowStart = new Date(limit.window_start);
  const windowEnd = new Date(windowStart.getTime() + limit.window_seconds * 1000);

  if (now > windowEnd) {
    // Reset window
    const stmt = this.getStatement(
      'UPDATE rate_limits SET current_count = 1, window_start = ? WHERE user_id = ? AND resource = ?'
    );
    stmt.run(now.toISOString(), userId, resource);
    return { allowed: true, remaining: limit.max_requests - 1 };
  }

  if (limit.current_count >= limit.max_requests) {
    return { allowed: false, remaining: 0 };
  }

  const stmt = this.getStatement(
    'UPDATE rate_limits SET current_count = current_count + 1 WHERE user_id = ? AND resource = ?'
  );
  stmt.run(userId, resource);
  return {
    allowed: true,
    remaining: limit.max_requests - limit.current_count - 1,
  };
}

// ========== Browser Allowlist ==========

/** Save browser allowlist entry */
export async function saveBrowserAllowlist(
  this: DatabaseService,
  record: BrowserAllowlistRecord
): Promise<void> {
  const stmt = this.getStatement(`
    INSERT INTO browser_allowlist (id, user_id, domain, allowed_actions, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, domain) DO UPDATE SET
      allowed_actions = excluded.allowed_actions
  `);
  stmt.run(record.id, record.user_id, record.domain, record.allowed_actions, record.created_at);
}

/** Get browser allowlist for user */
export async function getBrowserAllowlist(
  this: DatabaseService,
  userId: string
): Promise<BrowserAllowlistRecord[]> {
  const stmt = this.getStatement(
    'SELECT * FROM browser_allowlist WHERE user_id = ? ORDER BY domain ASC'
  );
  return stmt.all(userId) as BrowserAllowlistRecord[];
}

/** Check if domain is allowed */
export async function isDomainAllowed(
  this: DatabaseService,
  userId: string,
  domain: string
): Promise<BrowserAllowlistRecord | null> {
  const stmt = this.getStatement(
    'SELECT * FROM browser_allowlist WHERE user_id = ? AND domain = ?'
  );
  return (stmt.get(userId, domain) as BrowserAllowlistRecord | undefined) ?? null;
}

/** Delete browser allowlist entry */
export async function deleteBrowserAllowlist(
  this: DatabaseService,
  userId: string,
  domain: string
): Promise<void> {
  const stmt = this.getStatement('DELETE FROM browser_allowlist WHERE user_id = ? AND domain = ?');
  stmt.run(userId, domain);
}

/**
 * Register all platform queries onto DatabaseService prototype
 */
export function registerPlatformQueries(proto: typeof DatabaseService.prototype): void {
  proto.saveHeartbeat = saveHeartbeat;
  proto.getHeartbeat = getHeartbeat;
  proto.getEnabledHeartbeats = getEnabledHeartbeats;
  proto.getHeartbeatsForUser = getHeartbeatsForUser;
  proto.deleteHeartbeat = deleteHeartbeat;
  proto.saveApprovalRequest = saveApprovalRequest;
  proto.getApprovalRequest = getApprovalRequest;
  proto.getPendingApprovals = getPendingApprovals;
  proto.saveSwarmAgent = saveSwarmAgent;
  proto.getSwarmAgent = getSwarmAgent;
  proto.getSwarmChildren = getSwarmChildren;
  proto.getRunningSwarmAgents = getRunningSwarmAgents;
  proto.saveSkill = saveSkill;
  proto.getSkill = getSkill;
  proto.getSkillByName = getSkillByName;
  proto.getActiveSkills = getActiveSkills;
  proto.saveMemoryRecord = saveMemoryRecord;
  proto.getMemoryRecord = getMemoryRecord;
  proto.getMemoryRecordsByType = getMemoryRecordsByType;
  proto.getRecentMemories = getRecentMemories;
  proto.deleteMemoryRecord = deleteMemoryRecord;
  proto.saveCostBudget = saveCostBudget;
  proto.getCurrentBudget = getCurrentBudget;
  proto.saveRateLimit = saveRateLimit;
  proto.getRateLimit = getRateLimit;
  proto.incrementRateLimit = incrementRateLimit;
  proto.saveBrowserAllowlist = saveBrowserAllowlist;
  proto.getBrowserAllowlist = getBrowserAllowlist;
  proto.isDomainAllowed = isDomainAllowed;
  proto.deleteBrowserAllowlist = deleteBrowserAllowlist;
}
