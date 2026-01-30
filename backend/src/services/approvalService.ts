/**
 * Approval Service
 * Manages human-in-the-loop approval requests for risky actions
 */

import { getDatabase } from '../db/database.js';
import { writeAuditLog } from './auditLogService.js';
import logger from '../middleware/logger.js';
import type {
  ApprovalRequestRecord,
  ApprovalStatus,
  RiskLevel,
  CreateApprovalInput,
} from '../types/integrations.js';

// Default expiry times by risk level
const EXPIRY_HOURS: Record<RiskLevel, number> = {
  low: 24,      // 24 hours
  medium: 4,    // 4 hours
  high: 1,      // 1 hour
};

/**
 * Create an approval request
 */
export async function createApprovalRequest(input: CreateApprovalInput): Promise<ApprovalRequestRecord> {
  const db = getDatabase();
  const now = new Date();
  
  // Calculate expiry time
  const expiryHours = EXPIRY_HOURS[input.riskLevel];
  const expiresAt = input.expiresAt ?? new Date(now.getTime() + expiryHours * 60 * 60 * 1000).toISOString();
  
  const record: ApprovalRequestRecord = {
    id: `apr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: input.userId,
    status: 'pending',
    action: input.action,
    risk_level: input.riskLevel,
    reason: input.reason ?? null,
    payload: input.payload ? JSON.stringify(input.payload) : null,
    expires_at: expiresAt,
    created_at: now.toISOString(),
    resolved_at: null,
    resolved_by: null,
  };
  
  await db.saveApprovalRequest(record);
  
  await writeAuditLog({
    userId: input.userId,
    action: 'approval.requested',
    category: 'security',
    target: input.action,
    metadata: { riskLevel: input.riskLevel, approvalId: record.id },
  });
  
  logger.info(
    { id: record.id, action: input.action, riskLevel: input.riskLevel },
    'Approval request created'
  );
  
  return record;
}

/**
 * Get approval request by ID
 */
export async function getApprovalRequest(id: string): Promise<ApprovalRequestRecord | null> {
  const db = getDatabase();
  return db.getApprovalRequest(id);
}

/**
 * Get pending approvals for a user
 */
export async function getPendingApprovals(userId: string): Promise<ApprovalRequestRecord[]> {
  const db = getDatabase();
  const pending = await db.getPendingApprovals(userId);
  
  // Filter out expired ones and mark them as expired
  const now = new Date();
  const valid: ApprovalRequestRecord[] = [];
  
  for (const request of pending) {
    if (request.expires_at && new Date(request.expires_at) < now) {
      await expireApprovalRequest(request.id);
    } else {
      valid.push(request);
    }
  }
  
  return valid;
}

/**
 * Approve a request
 */
export async function approveRequest(
  id: string,
  approvedBy: string
): Promise<ApprovalRequestRecord | null> {
  const db = getDatabase();
  const record = await db.getApprovalRequest(id);
  
  if (!record) {
    logger.warn({ id }, 'Approval request not found');
    return null;
  }
  
  if (record.status !== 'pending') {
    logger.warn({ id, status: record.status }, 'Approval request not pending');
    return record;
  }
  
  // Check if expired
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    await expireApprovalRequest(id);
    return await db.getApprovalRequest(id);
  }
  
  const updated: ApprovalRequestRecord = {
    ...record,
    status: 'approved',
    resolved_at: new Date().toISOString(),
    resolved_by: approvedBy,
  };
  
  await db.saveApprovalRequest(updated);
  
  await writeAuditLog({
    userId: record.user_id,
    actor: approvedBy,
    action: 'approval.approved',
    category: 'security',
    target: record.action,
    metadata: { approvalId: id },
  });
  
  logger.info({ id, action: record.action, approvedBy }, 'Approval request approved');
  return updated;
}

/**
 * Reject a request
 */
export async function rejectRequest(
  id: string,
  rejectedBy: string,
  reason?: string
): Promise<ApprovalRequestRecord | null> {
  const db = getDatabase();
  const record = await db.getApprovalRequest(id);
  
  if (!record) {
    logger.warn({ id }, 'Approval request not found');
    return null;
  }
  
  if (record.status !== 'pending') {
    logger.warn({ id, status: record.status }, 'Approval request not pending');
    return record;
  }
  
  const existingReason = record.reason ?? '';
  const updated: ApprovalRequestRecord = {
    ...record,
    status: 'rejected',
    reason: reason ? `${existingReason}\nRejection: ${reason}`.trim() : record.reason,
    resolved_at: new Date().toISOString(),
    resolved_by: rejectedBy,
  };
  
  await db.saveApprovalRequest(updated);
  
  await writeAuditLog({
    userId: record.user_id,
    actor: rejectedBy,
    action: 'approval.rejected',
    category: 'security',
    target: record.action,
    metadata: { approvalId: id, reason },
  });
  
  logger.info({ id, action: record.action, rejectedBy }, 'Approval request rejected');
  return updated;
}

/**
 * Mark a request as expired
 */
async function expireApprovalRequest(id: string): Promise<void> {
  const db = getDatabase();
  const record = await db.getApprovalRequest(id);
  if (!record || record.status !== 'pending') return;
  
  const updated: ApprovalRequestRecord = {
    ...record,
    status: 'expired',
    resolved_at: new Date().toISOString(),
  };
  
  await db.saveApprovalRequest(updated);
  
  await writeAuditLog({
    userId: record.user_id,
    action: 'approval.expired',
    category: 'security',
    target: record.action,
    metadata: { approvalId: id },
  });
  
  logger.info({ id, action: record.action }, 'Approval request expired');
}

/**
 * Check if an action requires approval
 */
export function requiresApproval(action: string, riskLevel: RiskLevel): boolean {
  // All high-risk actions require approval
  if (riskLevel === 'high') return true;
  
  // Medium-risk actions for certain categories
  if (riskLevel === 'medium') {
    const alwaysApprove = [
      'skill.activate',
      'integration.delete',
      'browser.write',
      'sandbox.execute',
      'cost.exceed_budget',
    ];
    return alwaysApprove.some(a => action.startsWith(a));
  }
  
  return false;
}

/**
 * Wait for approval (with timeout)
 */
export async function waitForApproval(
  id: string,
  timeoutMs = 60000,
  pollIntervalMs = 1000
): Promise<ApprovalStatus> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const request = await getApprovalRequest(id);
    if (!request) return 'expired';
    
    if (request.status !== 'pending') {
      return request.status;
    }
    
    // Check if expired
    if (request.expires_at && new Date(request.expires_at) < new Date()) {
      await expireApprovalRequest(id);
      return 'expired';
    }
    
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  return 'pending';
}

/**
 * Request approval and wait for response
 * Returns true if approved, false otherwise
 */
export async function requestAndWaitForApproval(
  input: CreateApprovalInput,
  timeoutMs = 60000
): Promise<{ approved: boolean; request: ApprovalRequestRecord }> {
  const request = await createApprovalRequest(input);
  const status = await waitForApproval(request.id, timeoutMs);
  
  const finalRequest = await getApprovalRequest(request.id);
  return {
    approved: status === 'approved',
    request: finalRequest ?? request,
  };
}

// ========== Risk Assessment ==========

/**
 * Assess risk level for an action
 */
export function assessRiskLevel(action: string, context?: Record<string, unknown>): RiskLevel {
  // High-risk actions
  const highRisk = [
    'skill.create',
    'skill.activate',
    'sandbox.execute_untrusted',
    'browser.navigate_untrusted',
    'integration.write_external',
    'system.modify_config',
  ];
  
  if (highRisk.some(r => action.startsWith(r))) {
    return 'high';
  }
  
  // Medium-risk actions
  const mediumRisk = [
    'skill.update',
    'sandbox.execute',
    'browser.write',
    'integration.send_message',
    'memory.delete_bulk',
    'heartbeat.create',
  ];
  
  if (mediumRisk.some(r => action.startsWith(r))) {
    return 'medium';
  }
  
  // Context-based risk elevation
  if (context?.external === true) return 'medium';
  if (context?.destructive === true) return 'medium';
  
  return 'low';
}
