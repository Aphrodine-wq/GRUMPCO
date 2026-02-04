/**
 * Unified Guardrails Enforcement Service
 *
 * Central integration point for all guardrail services:
 * - Code validation (TypeScript, ESLint)
 * - Runtime verification (npm, tests, app startup)
 * - Budget enforcement (tokens, costs)
 * - Security patterns (jailbreaks, injections)
 * - File system restrictions
 * - Approval gates
 *
 * @module services/guardrailsEnforcementService
 */

import logger from '../middleware/logger.js';
import { getGuardrailsConfig, isHighRiskCommand } from '../config/guardrailsConfig.js';
import { checkInput, checkOutput } from './guardrailsService.js';
import { validateCode, validateSyntax, type ValidationResult } from './codeValidationService.js';
import { runFullVerification, type FullVerificationResult } from './runtimeVerificationService.js';
import {
  checkBudgetLimits,
  recordUsage,
  preCheckBudget,
  resetRequestTracking,
  type BudgetCheckResult,
  type TokenUsage,
} from './budgetEnforcementService.js';
import {
  checkFileReadAllowed,
  checkFileWriteAllowed,
  checkFileDeleteAllowed,
  checkCommandAllowed,
} from '../gAgent/security.js';
import { createApprovalRequest, waitForApproval, assessRiskLevel } from './approvalService.js';
import { writeAuditLog } from './auditLogService.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GuardrailsContext {
  userId: string;
  sessionId: string;
  workspaceRoot?: string;
  tier?: 'free' | 'pro' | 'team' | 'enterprise';
  model?: string;
}

export interface EnforcementResult {
  allowed: boolean;
  action: 'pass' | 'warn' | 'block' | 'require_approval';
  reason?: string;
  warnings: string[];
  details: Record<string, unknown>;
  approvalRequired?: {
    approvalId: string;
    action: string;
    riskLevel: 'low' | 'medium' | 'high';
    expiresAt: string;
  };
}

export interface ToolExecutionRequest {
  tool: string;
  parameters: Record<string, unknown>;
  context: GuardrailsContext;
}

export interface CodeGenerationRequest {
  files: Array<{
    path: string;
    content: string;
  }>;
  context: GuardrailsContext;
  runVerification?: boolean;
}

// ============================================================================
// MAIN ENFORCEMENT FUNCTIONS
// ============================================================================

/**
 * Enforce guardrails on LLM input (before sending to model)
 */
export async function enforceInputGuardrails(
  content: string,
  context: GuardrailsContext
): Promise<EnforcementResult> {
  const config = getGuardrailsConfig();
  const warnings: string[] = [];
  const details: Record<string, unknown> = {};

  if (!config.enabled) {
    return { allowed: true, action: 'pass', warnings: [], details: {} };
  }

  // 1. Check security patterns
  const securityCheck = await checkInput(content, context.userId);
  details.securityCheck = securityCheck;

  if (!securityCheck.passed) {
    await writeAuditLog({
      userId: context.userId,
      action: 'guardrails.input_blocked',
      category: 'security',
      target: 'input',
      metadata: {
        triggeredPolicies: securityCheck.triggeredPolicies.map((p) => p.policyId),
      },
    });

    return {
      allowed: false,
      action: 'block',
      reason: securityCheck.triggeredPolicies.map((p) => p.reason).join('; '),
      warnings: [],
      details,
    };
  }

  // 2. Add warnings for triggered policies that didn't block
  for (const policy of securityCheck.triggeredPolicies) {
    warnings.push(`${policy.policyName}: ${policy.reason}`);
  }

  // 3. Check budget (pre-check)
  const estimatedTokens = Math.ceil(content.length / 4); // Rough estimate
  const budgetCheck = preCheckBudget(
    context.userId,
    context.sessionId,
    estimatedTokens,
    context.model
  );
  details.budgetCheck = budgetCheck;

  if (!budgetCheck.allowed && config.budgetLimits.hardCutoffEnabled) {
    return {
      allowed: false,
      action: 'block',
      reason: budgetCheck.reason,
      warnings,
      details,
    };
  }

  if (budgetCheck.warning) {
    warnings.push(budgetCheck.warning);
  }

  return {
    allowed: true,
    action: warnings.length > 0 ? 'warn' : 'pass',
    warnings,
    details,
  };
}

/**
 * Enforce guardrails on LLM output (after receiving from model)
 */
export async function enforceOutputGuardrails(
  content: string,
  context: GuardrailsContext,
  usage?: TokenUsage
): Promise<EnforcementResult> {
  const config = getGuardrailsConfig();
  const warnings: string[] = [];
  const details: Record<string, unknown> = {};

  if (!config.enabled) {
    return { allowed: true, action: 'pass', warnings: [], details: {} };
  }

  // 1. Record token usage
  if (usage) {
    const budgetResult = recordUsage(context.userId, context.sessionId, usage, context.model);
    details.budgetUsage = budgetResult;

    if (!budgetResult.allowed) {
      warnings.push(`Budget limit reached: ${budgetResult.reason}`);
    }
    if (budgetResult.warning) {
      warnings.push(budgetResult.warning);
    }
  }

  // 2. Check security patterns
  const securityCheck = await checkOutput(content, context.userId);
  details.securityCheck = securityCheck;

  if (!securityCheck.passed) {
    await writeAuditLog({
      userId: context.userId,
      action: 'guardrails.output_blocked',
      category: 'security',
      target: 'output',
      metadata: {
        triggeredPolicies: securityCheck.triggeredPolicies.map((p) => p.policyId),
      },
    });

    return {
      allowed: false,
      action: 'block',
      reason: securityCheck.triggeredPolicies.map((p) => p.reason).join('; '),
      warnings,
      details,
    };
  }

  // 3. Add warnings
  for (const policy of securityCheck.triggeredPolicies) {
    warnings.push(`${policy.policyName}: ${policy.reason}`);
  }

  return {
    allowed: true,
    action: warnings.length > 0 ? 'warn' : 'pass',
    warnings,
    details,
  };
}

/**
 * Enforce guardrails on tool execution (file ops, shell, etc.)
 */
export async function enforceToolGuardrails(
  request: ToolExecutionRequest
): Promise<EnforcementResult> {
  const config = getGuardrailsConfig();
  const warnings: string[] = [];
  const details: Record<string, unknown> = {};

  if (!config.enabled) {
    return { allowed: true, action: 'pass', warnings: [], details: {} };
  }

  const { tool, parameters, context } = request;

  // Handle different tool types
  switch (tool) {
    case 'read_file':
    case 'file_read': {
      const filePath = (parameters.path as string) || (parameters.filePath as string);
      const check = checkFileReadAllowed(filePath);
      details.fileCheck = check;

      if (!check.allowed) {
        return {
          allowed: false,
          action: 'block',
          reason: check.reason,
          warnings,
          details,
        };
      }
      break;
    }

    case 'write_file':
    case 'file_write':
    case 'create_file': {
      const filePath = (parameters.path as string) || (parameters.filePath as string);
      const content = (parameters.content as string) || '';
      const check = checkFileWriteAllowed(filePath, content.length);
      details.fileCheck = check;

      if (!check.allowed) {
        return {
          allowed: false,
          action: 'block',
          reason: check.reason,
          warnings,
          details,
        };
      }

      // Check for approval if needed
      if (config.approvalGates.requireApprovalForDelete && tool === 'create_file') {
        // Creating files is generally lower risk, but check the risk level
      }
      break;
    }

    case 'delete_file':
    case 'file_delete':
    case 'remove_file': {
      const filePath = (parameters.path as string) || (parameters.filePath as string);
      const check = checkFileDeleteAllowed(filePath);
      details.fileCheck = check;

      if (!check.allowed) {
        return {
          allowed: false,
          action: 'block',
          reason: check.reason,
          warnings,
          details,
        };
      }

      // Require approval for deletions if configured
      if (config.approvalGates.requireApprovalForDelete) {
        return await requestToolApproval('file.delete', filePath, context, details);
      }
      break;
    }

    case 'bash':
    case 'shell':
    case 'execute':
    case 'run_command': {
      const command = (parameters.command as string) || (parameters.cmd as string) || '';
      const cmdCheck = checkCommandAllowed(command);
      details.commandCheck = cmdCheck;

      if (!cmdCheck.allowed) {
        return {
          allowed: false,
          action: 'block',
          reason: cmdCheck.reason,
          warnings,
          details,
        };
      }

      // Check for high-risk commands
      if (isHighRiskCommand(command)) {
        return await requestToolApproval('command.high_risk', command, context, details);
      }

      // Require approval for shell if configured
      if (config.approvalGates.requireApprovalForShell && cmdCheck.riskLevel !== 'low') {
        return await requestToolApproval('command.execute', command, context, details);
      }
      break;
    }

    case 'git_push':
    case 'push': {
      if (config.approvalGates.requireApprovalForGitPush) {
        const branch = (parameters.branch as string) || 'unknown';
        return await requestToolApproval('git.push', `Push to ${branch}`, context, details);
      }
      break;
    }

    case 'npm_install':
    case 'install_package': {
      if (config.approvalGates.requireApprovalForPackageInstall) {
        const packages =
          (parameters.packages as string[]) || (parameters.package as string) || 'unknown';
        return await requestToolApproval('package.install', String(packages), context, details);
      }
      break;
    }

    case 'http_request':
    case 'fetch':
    case 'web_request': {
      if (config.approvalGates.requireApprovalForNetwork) {
        const url = (parameters.url as string) || 'unknown';
        return await requestToolApproval('network.request', url, context, details);
      }
      break;
    }
  }

  return {
    allowed: true,
    action: warnings.length > 0 ? 'warn' : 'pass',
    warnings,
    details,
  };
}

/**
 * Enforce guardrails on code generation
 */
export async function enforceCodeGenerationGuardrails(request: CodeGenerationRequest): Promise<{
  allowed: boolean;
  validation?: ValidationResult;
  verification?: FullVerificationResult;
  blockedFiles: string[];
  warnings: string[];
}> {
  const config = getGuardrailsConfig();
  const warnings: string[] = [];
  const blockedFiles: string[] = [];

  if (!config.enabled) {
    return { allowed: true, blockedFiles: [], warnings: [] };
  }

  // 1. Check file permissions
  for (const file of request.files) {
    const check = checkFileWriteAllowed(file.path, file.content.length);
    if (!check.allowed) {
      blockedFiles.push(file.path);
      warnings.push(`${file.path}: ${check.reason}`);
    }

    // Check for sensitive patterns in file content
    const outputCheck = await checkOutput(file.content, request.context.userId);
    if (!outputCheck.passed) {
      blockedFiles.push(file.path);
      warnings.push(`${file.path}: Contains blocked patterns`);
    }
  }

  if (blockedFiles.length > 0) {
    return { allowed: false, blockedFiles, warnings };
  }

  // 2. Validate syntax for each file
  for (const file of request.files) {
    const syntaxResult = await validateSyntax(file.path, file.content);
    if (!syntaxResult.passed) {
      warnings.push(`${file.path}: ${syntaxResult.summary}`);
    }
  }

  // 3. Run full code validation if workspace is provided
  let validation: ValidationResult | undefined;
  if (request.context.workspaceRoot && config.codeValidation.requireCompilation) {
    const validationResult = await validateCode({
      workspaceRoot: request.context.workspaceRoot,
      userId: request.context.userId,
    });
    validation = validationResult.combined;

    if (!validation.passed) {
      warnings.push(validation.summary);
    }
  }

  // 4. Run runtime verification if requested
  let verification: FullVerificationResult | undefined;
  if (request.runVerification && request.context.workspaceRoot) {
    verification = await runFullVerification({
      workspaceRoot: request.context.workspaceRoot,
      userId: request.context.userId,
    });

    if (!verification.passed) {
      warnings.push(verification.summary);
    }
  }

  const allowed =
    blockedFiles.length === 0 && (validation?.passed ?? true) && (verification?.passed ?? true);

  return {
    allowed,
    validation,
    verification,
    blockedFiles,
    warnings,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Request approval for a tool action
 */
async function requestToolApproval(
  action: string,
  target: string,
  context: GuardrailsContext,
  details: Record<string, unknown>
): Promise<EnforcementResult> {
  const config = getGuardrailsConfig();
  const riskLevel = assessRiskLevel(action);

  // Check if we can auto-approve low risk
  if (riskLevel === 'low' && config.approvalGates.autoApproveLowRisk) {
    return {
      allowed: true,
      action: 'pass',
      warnings: [],
      details,
    };
  }

  // Create approval request
  const approvalRequest = await createApprovalRequest({
    userId: context.userId,
    action,
    riskLevel,
    reason: `Tool action: ${action} on ${target}`,
    payload: { target, context: details },
  });

  // Wait for approval (with timeout)
  const timeoutMs = config.approvalGates.approvalTimeoutSeconds * 1000;
  const status = await waitForApproval(approvalRequest.id, timeoutMs);

  if (status === 'approved') {
    return {
      allowed: true,
      action: 'pass',
      warnings: [`Approved: ${action}`],
      details: { ...details, approvalId: approvalRequest.id },
    };
  }

  return {
    allowed: false,
    action: 'require_approval',
    reason: status === 'rejected' ? 'Approval rejected' : 'Approval required',
    warnings: [],
    details,
    approvalRequired: {
      approvalId: approvalRequest.id,
      action,
      riskLevel,
      expiresAt: approvalRequest.expires_at ?? '',
    },
  };
}

/**
 * Initialize guardrails for a new session
 */
export function initializeSession(context: GuardrailsContext): void {
  resetRequestTracking(context.userId, context.sessionId);

  logger.info(
    {
      userId: context.userId,
      sessionId: context.sessionId,
      workspaceRoot: context.workspaceRoot,
    },
    'Guardrails session initialized'
  );
}

/**
 * Get guardrails status summary
 */
export async function getGuardrailsStatus(context: GuardrailsContext): Promise<{
  enabled: boolean;
  strictMode: string;
  budget: BudgetCheckResult;
  features: {
    codeValidation: boolean;
    runtimeVerification: boolean;
    securityPatterns: boolean;
    fileSystemRestrictions: boolean;
    approvalGates: boolean;
  };
}> {
  const config = getGuardrailsConfig();
  const budget = checkBudgetLimits(context.userId, context.sessionId);

  return {
    enabled: config.enabled,
    strictMode: config.strictMode,
    budget,
    features: {
      codeValidation:
        config.codeValidation.requireCompilation || config.codeValidation.requireLinting,
      runtimeVerification:
        config.runtimeVerification.verifyNpmInstall || config.runtimeVerification.runTests,
      securityPatterns:
        config.securityPatterns.detectJailbreaks || config.securityPatterns.detectPromptInjection,
      fileSystemRestrictions: config.fileSystem.strictPathValidation,
      approvalGates:
        config.approvalGates.requireApprovalForShell ||
        config.approvalGates.requireApprovalForDelete,
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  enforceInputGuardrails,
  enforceOutputGuardrails,
  enforceToolGuardrails,
  enforceCodeGenerationGuardrails,
  initializeSession,
  getGuardrailsStatus,
};
