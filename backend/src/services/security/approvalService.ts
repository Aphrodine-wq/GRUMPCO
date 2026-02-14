/**
 * Approval Service
 * Manages human-in-the-loop approval requests for risky actions
 */

import { getDatabase } from '../../db/database.js';
import { writeAuditLog } from './auditLogService.js';
import logger from '../../middleware/logger.js';
import { getGuardrailsConfig } from '../../config/guardrailsConfig.js';
import type {
  ApprovalRequestRecord,
  ApprovalStatus,
  RiskLevel,
  CreateApprovalInput,
} from '../../types/integrations.js';

// ========== Constants and Configuration ==========

// Default expiry times by risk level
const EXPIRY_HOURS: Record<RiskLevel, number> = {
  low: 24, // 24 hours
  medium: 4, // 4 hours
  high: 1, // 1 hour
};

// Critical approval categories that ALWAYS require approval
const CRITICAL_APPROVAL_CATEGORIES = {
  // File system operations
  FILE_DELETE_BULK: 'file.delete_bulk', // Deleting multiple files
  FILE_DELETE_CONFIG: 'file.delete_config', // Deleting config files
  FILE_OVERWRITE_SYSTEM: 'file.overwrite_system', // Overwriting system files
  FILE_WRITE_SENSITIVE: 'file.write_sensitive', // Writing to sensitive locations

  // Shell/command operations
  SHELL_DESTRUCTIVE: 'shell.destructive', // rm -rf, format, etc.
  SHELL_NETWORK: 'shell.network', // curl, wget, ssh, etc.
  SHELL_SUDO: 'shell.sudo', // Privileged commands
  SHELL_PACKAGE_INSTALL: 'shell.package_install', // npm install, pip install, etc.

  // Git operations
  GIT_FORCE_PUSH: 'git.force_push', // Force push to remote
  GIT_RESET_HARD: 'git.reset_hard', // Hard reset
  GIT_DELETE_BRANCH: 'git.delete_branch', // Delete remote branch
  GIT_REBASE_MAIN: 'git.rebase_main', // Rebase main/master

  // Database operations
  DB_DROP: 'db.drop', // DROP TABLE, DROP DATABASE
  DB_TRUNCATE: 'db.truncate', // TRUNCATE TABLE
  DB_DELETE_ALL: 'db.delete_all', // DELETE without WHERE
  DB_MIGRATION: 'db.migration', // Run migrations

  // External integrations
  INTEGRATION_WRITE: 'integration.write', // Write to external service
  INTEGRATION_DELETE: 'integration.delete', // Delete from external service
  INTEGRATION_PAYMENT: 'integration.payment', // Payment operations
  INTEGRATION_EMAIL: 'integration.email_bulk', // Bulk email sends

  // AI/LLM operations
  AI_CODE_EXECUTE: 'ai.code_execute', // Execute generated code
  AI_SKILL_CREATE: 'ai.skill_create', // Create new skill
  AI_SKILL_MODIFY: 'ai.skill_modify', // Modify existing skill
  AI_BUDGET_OVERRIDE: 'ai.budget_override', // Override budget limits

  // Security operations
  SECURITY_PERMISSION_GRANT: 'security.permission_grant',
  SECURITY_API_KEY_CREATE: 'security.api_key_create',
  SECURITY_CONFIG_MODIFY: 'security.config_modify',
  SECURITY_BYPASS_GUARDRAIL: 'security.bypass_guardrail',
} as const;

type CriticalCategory =
  (typeof CRITICAL_APPROVAL_CATEGORIES)[keyof typeof CRITICAL_APPROVAL_CATEGORIES];

// Pattern-based action classification
interface ActionPattern {
  pattern: RegExp;
  category: CriticalCategory;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  description: string;
}

const ACTION_PATTERNS: ActionPattern[] = [
  // File operations
  {
    pattern: /^file\.(delete|remove).*bulk/i,
    category: CRITICAL_APPROVAL_CATEGORIES.FILE_DELETE_BULK,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Bulk file deletion',
  },
  {
    pattern: /^file\.(delete|remove).*(config|env|settings)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.FILE_DELETE_CONFIG,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Configuration file deletion',
  },
  {
    pattern: /^file\.write.*(system|root|admin)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.FILE_OVERWRITE_SYSTEM,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'System file modification',
  },
  {
    pattern: /^file\.write.*(\\.env|secrets?|credentials?|keys?)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.FILE_WRITE_SENSITIVE,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Sensitive file modification',
  },

  // Shell commands
  {
    pattern: /^shell\.(rm|del|remove).*(-rf|--force|--recursive)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.SHELL_DESTRUCTIVE,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Destructive shell command',
  },
  {
    pattern: /^shell\.(curl|wget|ssh|nc|netcat|telnet)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.SHELL_NETWORK,
    riskLevel: 'medium',
    requiresApproval: true,
    description: 'Network command',
  },
  {
    pattern: /^shell\.(sudo|doas|pkexec|runas)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.SHELL_SUDO,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Privileged command',
  },
  {
    pattern: /^shell\.(npm|yarn|pnpm|pip|gem|cargo|go)\s+(install|add)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.SHELL_PACKAGE_INSTALL,
    riskLevel: 'medium',
    requiresApproval: false, // Will check config
    description: 'Package installation',
  },

  // Git operations
  {
    pattern: /^git\.(push).*--force/i,
    category: CRITICAL_APPROVAL_CATEGORIES.GIT_FORCE_PUSH,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Force push to remote',
  },
  {
    pattern: /^git\.(reset).*--hard/i,
    category: CRITICAL_APPROVAL_CATEGORIES.GIT_RESET_HARD,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Hard reset',
  },
  {
    pattern: /^git\.(branch).*(-d|-D|--delete).*(main|master|develop)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.GIT_DELETE_BRANCH,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Delete protected branch',
  },
  {
    pattern: /^git\.(rebase).*(main|master)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.GIT_REBASE_MAIN,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Rebase main branch',
  },

  // Database operations
  {
    pattern: /^db\.(drop|DROP)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.DB_DROP,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Drop database or table',
  },
  {
    pattern: /^db\.(truncate|TRUNCATE)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.DB_TRUNCATE,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Truncate table',
  },
  {
    pattern: /^db\.(delete|DELETE)(?!.*WHERE)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.DB_DELETE_ALL,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Delete without WHERE clause',
  },
  {
    pattern: /^db\.(migrate|migration)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.DB_MIGRATION,
    riskLevel: 'medium',
    requiresApproval: true,
    description: 'Database migration',
  },

  // External integrations
  {
    pattern: /^integration\.(write|post|put|patch)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.INTEGRATION_WRITE,
    riskLevel: 'medium',
    requiresApproval: true,
    description: 'External service write',
  },
  {
    pattern: /^integration\.(delete|remove)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.INTEGRATION_DELETE,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'External service deletion',
  },
  {
    pattern: /^integration\.(payment|charge|billing)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.INTEGRATION_PAYMENT,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Payment operation',
  },
  {
    pattern: /^integration\.(email|mail).*bulk/i,
    category: CRITICAL_APPROVAL_CATEGORIES.INTEGRATION_EMAIL,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Bulk email operation',
  },

  // AI operations
  {
    pattern: /^(ai|llm)\.(execute|run).*code/i,
    category: CRITICAL_APPROVAL_CATEGORIES.AI_CODE_EXECUTE,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Execute AI-generated code',
  },
  {
    pattern: /^skill\.(create|new)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.AI_SKILL_CREATE,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Create new skill',
  },
  {
    pattern: /^skill\.(update|modify|edit)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.AI_SKILL_MODIFY,
    riskLevel: 'medium',
    requiresApproval: true,
    description: 'Modify skill',
  },
  {
    pattern: /^(budget|cost)\.(override|bypass|exceed)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.AI_BUDGET_OVERRIDE,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Budget override',
  },

  // Security operations
  {
    pattern: /^(security|permission)\.(grant|allow|enable)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.SECURITY_PERMISSION_GRANT,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Grant permission',
  },
  {
    pattern: /^(api[_-]?key|token)\.(create|generate)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.SECURITY_API_KEY_CREATE,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Create API key',
  },
  {
    pattern: /^(config|settings)\.(modify|change|update)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.SECURITY_CONFIG_MODIFY,
    riskLevel: 'medium',
    requiresApproval: true,
    description: 'Modify configuration',
  },
  {
    pattern: /^guardrail\.(bypass|disable|skip)/i,
    category: CRITICAL_APPROVAL_CATEGORIES.SECURITY_BYPASS_GUARDRAIL,
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Bypass guardrail',
  },
];

// ========== Approval Gate Interface ==========

export interface ApprovalGate {
  required: boolean;
  category: CriticalCategory | null;
  riskLevel: RiskLevel;
  reason: string;
  autoApprove: boolean;
  autoApproveConditions?: string[];
}

export interface ApprovalContext {
  userId: string;
  sessionId?: string;
  action: string;
  parameters?: Record<string, unknown>;
  workspaceRoot?: string;
  previousApprovals?: string[]; // List of already-approved action IDs
  userRole?: 'admin' | 'user' | 'guest';
}

/**
 * Create an approval request
 */
export async function createApprovalRequest(
  input: CreateApprovalInput
): Promise<ApprovalRequestRecord> {
  const db = getDatabase();
  const now = new Date();

  // Calculate expiry time
  const expiryHours = EXPIRY_HOURS[input.riskLevel];
  const expiresAt =
    input.expiresAt ?? new Date(now.getTime() + expiryHours * 60 * 60 * 1000).toISOString();

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
    return alwaysApprove.some((a) => action.startsWith(a));
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

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
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
  // First, check against pattern-based classification
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.pattern.test(action)) {
      return pattern.riskLevel;
    }
  }

  // High-risk actions
  const highRisk = [
    'skill.create',
    'skill.activate',
    'sandbox.execute_untrusted',
    'browser.navigate_untrusted',
    'integration.write_external',
    'system.modify_config',
  ];

  if (highRisk.some((r) => action.startsWith(r))) {
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

  if (mediumRisk.some((r) => action.startsWith(r))) {
    return 'medium';
  }

  // Context-based risk elevation
  if (context?.external === true) return 'medium';
  if (context?.destructive === true) return 'medium';
  if (context?.bulk === true) return 'medium';
  if (context?.network === true) return 'medium';
  if (context?.privileged === true) return 'high';

  return 'low';
}

// ========== Enhanced Approval Gate Functions ==========

/**
 * Check if an action requires an approval gate
 * Returns detailed information about the approval requirement
 */
export function checkApprovalGate(context: ApprovalContext): ApprovalGate {
  const config = getGuardrailsConfig();

  // If guardrails are disabled, no approval required
  if (!config.enabled) {
    return {
      required: false,
      category: null,
      riskLevel: 'low',
      reason: 'Guardrails disabled',
      autoApprove: true,
    };
  }

  // Check against pattern-based classification
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.pattern.test(context.action)) {
      // Check if admin can auto-approve
      const canAutoApprove =
        context.userRole === 'admin' &&
        pattern.riskLevel !== 'high' &&
        !pattern.category.includes('security');

      return {
        required: pattern.requiresApproval,
        category: pattern.category,
        riskLevel: pattern.riskLevel,
        reason: pattern.description,
        autoApprove: canAutoApprove,
        autoApproveConditions: canAutoApprove
          ? ['User is admin', 'Risk level is not high']
          : undefined,
      };
    }
  }

  // Fall back to risk-level based assessment
  const riskLevel = assessRiskLevel(context.action, context.parameters);

  return {
    required: riskLevel === 'high' || (riskLevel === 'medium' && config.strictMode === 'enforce'),
    category: null,
    riskLevel,
    reason: `Risk level: ${riskLevel}`,
    autoApprove: riskLevel === 'low' || (riskLevel === 'medium' && context.userRole === 'admin'),
  };
}

/**
 * Classify a command into an action category
 */
export function classifyCommand(command: string): {
  action: string;
  category: CriticalCategory | null;
  riskLevel: RiskLevel;
} {
  // Parse the command to extract key components
  const normalized = command.toLowerCase().trim();

  // Destructive file operations
  if (/rm\s+(-rf?|--recursive|--force)/.test(normalized)) {
    return {
      action: `shell.rm ${command}`,
      category: CRITICAL_APPROVAL_CATEGORIES.SHELL_DESTRUCTIVE,
      riskLevel: 'high',
    };
  }

  // Force push
  if (/git\s+push\s+.*--force/.test(normalized) || /git\s+push\s+-f/.test(normalized)) {
    return {
      action: `git.push --force`,
      category: CRITICAL_APPROVAL_CATEGORIES.GIT_FORCE_PUSH,
      riskLevel: 'high',
    };
  }

  // Hard reset
  if (/git\s+reset\s+--hard/.test(normalized)) {
    return {
      action: `git.reset --hard`,
      category: CRITICAL_APPROVAL_CATEGORIES.GIT_RESET_HARD,
      riskLevel: 'high',
    };
  }

  // Network operations
  if (/^(curl|wget|ssh|nc|netcat|telnet|ftp)[\s$]/.test(normalized)) {
    return {
      action: `shell.network ${command.split(' ')[0]}`,
      category: CRITICAL_APPROVAL_CATEGORIES.SHELL_NETWORK,
      riskLevel: 'medium',
    };
  }

  // Privileged commands
  if (/^(sudo|doas|pkexec|runas)[\s]/.test(normalized)) {
    return {
      action: `shell.sudo ${command}`,
      category: CRITICAL_APPROVAL_CATEGORIES.SHELL_SUDO,
      riskLevel: 'high',
    };
  }

  // Package installation
  if (/^(npm|yarn|pnpm)\s+(install|add|i)[\s$]/.test(normalized)) {
    return {
      action: `shell.package_install ${command.split(' ')[0]}`,
      category: CRITICAL_APPROVAL_CATEGORIES.SHELL_PACKAGE_INSTALL,
      riskLevel: 'medium',
    };
  }

  // Database operations in commands
  if (/drop\s+(table|database|schema)/i.test(normalized)) {
    return {
      action: `db.drop`,
      category: CRITICAL_APPROVAL_CATEGORIES.DB_DROP,
      riskLevel: 'high',
    };
  }

  if (/truncate\s+table/i.test(normalized)) {
    return {
      action: `db.truncate`,
      category: CRITICAL_APPROVAL_CATEGORIES.DB_TRUNCATE,
      riskLevel: 'high',
    };
  }

  // Default - assess based on command content
  return {
    action: `shell.execute ${command.split(' ')[0]}`,
    category: null,
    riskLevel: 'low',
  };
}

/**
 * Classify a file operation into an action category
 */
export function classifyFileOperation(
  operation: 'read' | 'write' | 'delete' | 'move' | 'copy',
  filePath: string,
  context?: { bulk?: boolean; count?: number }
): { action: string; category: CriticalCategory | null; riskLevel: RiskLevel } {
  const normalizedPath = filePath.toLowerCase();

  // Sensitive file patterns
  const sensitivePatterns = [
    /\.env$/,
    /\.env\..+$/,
    /secrets?\..*$/,
    /credentials?\..*$/,
    /\.pem$/,
    /\.key$/,
    /id_rsa/,
    /id_ed25519/,
    /\.ssh\//,
    /\.gnupg\//,
    /passwords?\..*$/,
    /tokens?\..*$/,
  ];

  const configPatterns = [
    /package\.json$/,
    /tsconfig\.json$/,
    /\.eslintrc/,
    /webpack\.config/,
    /vite\.config/,
    /next\.config/,
    /docker-compose/,
    /dockerfile/i,
    /\.github\//,
    /\.gitlab-ci/,
  ];

  const isSensitive = sensitivePatterns.some((p) => p.test(normalizedPath));
  const isConfig = configPatterns.some((p) => p.test(normalizedPath));
  const isBulk = context?.bulk || (context?.count && context.count > 5);

  if (operation === 'delete') {
    if (isSensitive) {
      return {
        action: `file.delete_sensitive ${filePath}`,
        category: CRITICAL_APPROVAL_CATEGORIES.FILE_DELETE_CONFIG,
        riskLevel: 'high',
      };
    }
    if (isConfig) {
      return {
        action: `file.delete_config ${filePath}`,
        category: CRITICAL_APPROVAL_CATEGORIES.FILE_DELETE_CONFIG,
        riskLevel: 'high',
      };
    }
    if (isBulk) {
      return {
        action: `file.delete_bulk (${context?.count} files)`,
        category: CRITICAL_APPROVAL_CATEGORIES.FILE_DELETE_BULK,
        riskLevel: 'high',
      };
    }
  }

  if (operation === 'write') {
    if (isSensitive) {
      return {
        action: `file.write_sensitive ${filePath}`,
        category: CRITICAL_APPROVAL_CATEGORIES.FILE_WRITE_SENSITIVE,
        riskLevel: 'high',
      };
    }
    if (isConfig) {
      return {
        action: `file.write_config ${filePath}`,
        category: null,
        riskLevel: 'medium',
      };
    }
  }

  return {
    action: `file.${operation} ${filePath}`,
    category: null,
    riskLevel: 'low',
  };
}

/**
 * Classify a git operation into an action category
 */
export function classifyGitOperation(
  operation: string,
  args: string[]
): { action: string; category: CriticalCategory | null; riskLevel: RiskLevel } {
  const argsStr = args.join(' ').toLowerCase();

  if (operation === 'push' && (argsStr.includes('--force') || argsStr.includes('-f'))) {
    return {
      action: `git.push --force`,
      category: CRITICAL_APPROVAL_CATEGORIES.GIT_FORCE_PUSH,
      riskLevel: 'high',
    };
  }

  if (operation === 'reset' && argsStr.includes('--hard')) {
    return {
      action: `git.reset --hard`,
      category: CRITICAL_APPROVAL_CATEGORIES.GIT_RESET_HARD,
      riskLevel: 'high',
    };
  }

  if (operation === 'branch' && (argsStr.includes('-d') || argsStr.includes('--delete'))) {
    const isProtected = ['main', 'master', 'develop', 'production'].some((b) =>
      argsStr.includes(b)
    );
    if (isProtected) {
      return {
        action: `git.delete_branch`,
        category: CRITICAL_APPROVAL_CATEGORIES.GIT_DELETE_BRANCH,
        riskLevel: 'high',
      };
    }
  }

  if (operation === 'rebase') {
    const isProtected = ['main', 'master'].some((b) => argsStr.includes(b));
    if (isProtected) {
      return {
        action: `git.rebase_main`,
        category: CRITICAL_APPROVAL_CATEGORIES.GIT_REBASE_MAIN,
        riskLevel: 'high',
      };
    }
  }

  // Clean with force
  if (operation === 'clean' && (argsStr.includes('-f') || argsStr.includes('--force'))) {
    return {
      action: `git.clean --force`,
      category: null,
      riskLevel: 'medium',
    };
  }

  return {
    action: `git.${operation}`,
    category: null,
    riskLevel: 'low',
  };
}

/**
 * Request approval for a specific action gate
 * This is a convenience function that creates an approval request
 * based on the gate check result
 */
export async function requestApprovalForGate(
  context: ApprovalContext,
  gate: ApprovalGate
): Promise<{ approved: boolean; request: ApprovalRequestRecord | null }> {
  // If no approval required, return approved
  if (!gate.required) {
    return { approved: true, request: null };
  }

  // If auto-approve is enabled and conditions are met
  if (gate.autoApprove) {
    logger.info(
      {
        action: context.action,
        category: gate.category,
        conditions: gate.autoApproveConditions,
      },
      'Action auto-approved'
    );

    await writeAuditLog({
      userId: context.userId,
      action: 'approval.auto_approved',
      category: 'security',
      target: context.action,
      metadata: {
        category: gate.category,
        riskLevel: gate.riskLevel,
        autoApproveConditions: gate.autoApproveConditions,
      },
    });

    return { approved: true, request: null };
  }

  // Create approval request and wait
  const config = getGuardrailsConfig();
  const timeoutMs = config.approvalGates.approvalTimeoutSeconds * 1000;

  return requestAndWaitForApproval(
    {
      userId: context.userId,
      action: context.action,
      riskLevel: gate.riskLevel,
      reason: gate.reason,
      payload: {
        category: gate.category,
        parameters: context.parameters,
        workspaceRoot: context.workspaceRoot,
        sessionId: context.sessionId,
      },
    },
    timeoutMs
  );
}

/**
 * Batch approval check - for multiple actions at once
 */
export async function checkBatchApproval(
  contexts: ApprovalContext[]
): Promise<{ allApproved: boolean; results: Map<string, ApprovalGate> }> {
  const results = new Map<string, ApprovalGate>();
  let allApproved = true;

  for (const context of contexts) {
    const gate = checkApprovalGate(context);
    results.set(context.action, gate);

    if (gate.required && !gate.autoApprove) {
      allApproved = false;
    }
  }

  return { allApproved, results };
}

/**
 * Export critical categories for external use
 */
export { CRITICAL_APPROVAL_CATEGORIES, ACTION_PATTERNS };
export type { CriticalCategory, ActionPattern };
