/**
 * Agent Governance Middleware
 * Blocks or strictly governs requests from Moltbot/OpenClaw and similar AI agents.
 * Requests from the G-Rump app (X-GRump-Client: desktop | web) are never treated as agents.
 * Default: block all detected agent requests.
 * Env: AGENT_ACCESS_POLICY=block|allowlist|audit_only, AGENT_ALLOWLIST, AGENT_RATE_LIMIT_PER_HOUR, FREE_AGENT_ENABLED
 */

import type { Request, Response, NextFunction } from "express";
import { getRequestLogger } from "./logger.js";
import { env } from "../config/env.js";
import {
  createApprovalRequest,
  getApprovalRequest,
} from "../services/approvalService.js";
import { writeAuditLog } from "../services/auditLogService.js";

// Extend Express Request for agent context
export interface AgentGovernedRequest extends Request {
  isAgentRequest?: boolean;
  agentId?: string;
  agentApprovalId?: string;
}

/** Header value that identifies the official G-Rump app (desktop or web). These requests are never blocked as agents. */
const GRUMP_CLIENT_HEADER = "x-grump-client";
const GRUMP_CLIENT_VALUES = ["desktop", "web"];

function isGrumpAppRequest(req: Request): boolean {
  const client = (req.headers[GRUMP_CLIENT_HEADER] as string) || "";
  return GRUMP_CLIENT_VALUES.includes(client.toLowerCase().trim());
}

/** User-Agent patterns that indicate Moltbot/OpenClaw or similar AI agents */
const AGENT_UA_PATTERNS = [
  /openclaw/i,
  /moltbot/i,
  /clawd/i,
  /clawdbot/i,
  /clawdbot\//i,
  /grump-agent/i,
  /ai-agent/i,
  /anthropic-claude/i,
  /automated\s*request/i,
  /bot\//i,
  /curl\/.*\s+grump/i,
];

/** Paths protected by agent governance */
const PROTECTED_PATHS = ["/api/chat", "/api/ship", "/api/codegen"];
const RISKY_PATHS = ["/api/ship", "/api/codegen"];

/** In-memory rate limit for allowlisted agents (per agentId) */
const agentRequestCounts = new Map<
  string,
  { count: number; resetAt: number }
>();

function isProtectedPath(path: string): boolean {
  return PROTECTED_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

function isRiskyPath(path: string): boolean {
  return RISKY_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

function detectAgent(req: Request): { isAgent: boolean; agentId: string } {
  const ua = (req.headers["user-agent"] as string) || "";
  const xAgent = (req.headers["x-agent-source"] as string) || "";
  const xAgentId = (req.headers["x-agent-id"] as string) || "";

  // Explicit agent header takes precedence
  if (
    xAgent &&
    (xAgent.toLowerCase().includes("moltbot") ||
      xAgent.toLowerCase().includes("openclaw") ||
      xAgent.toLowerCase().includes("clawd"))
  ) {
    const id = xAgentId || xAgent || "unknown";
    return { isAgent: true, agentId: sanitizeAgentId(id) };
  }

  // User-Agent pattern match
  for (const pattern of AGENT_UA_PATTERNS) {
    if (pattern.test(ua)) {
      const id = xAgentId || ua.slice(0, 64) || "ua-detected";
      return { isAgent: true, agentId: sanitizeAgentId(id) };
    }
  }

  return { isAgent: false, agentId: "" };
}

function sanitizeAgentId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9\-_]/g, "_").slice(0, 128) || "unknown";
}

function isAllowlisted(agentId: string): boolean {
  const list = env.AGENT_ALLOWLIST;
  if (!list || !list.trim()) return false;
  const items = list.split(",").map((s) => s.trim().toLowerCase());
  if (items.includes("*")) return true;
  return items.includes(agentId.toLowerCase());
}

function checkAgentRateLimit(agentId: string): boolean {
  const limit = env.AGENT_RATE_LIMIT_PER_HOUR ?? 10;
  const windowMs = 60 * 60 * 1000;
  const now = Date.now();
  const key = agentId;

  const entry = agentRequestCounts.get(key);
  if (!entry) {
    agentRequestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (now > entry.resetAt) {
    agentRequestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

async function recordAgentAudit(
  agentId: string,
  path: string,
  action: string,
  status: "blocked" | "allowed" | "approval_required",
): Promise<void> {
  try {
    await writeAuditLog({
      userId: `agent:${agentId}`,
      action: `agent.${action}`,
      category: "security",
      target: path,
      metadata: { agentId, status },
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Agent governance middleware - must run before chat, ship, codegen routes
 */
export async function agentGovernanceMiddleware(
  req: AgentGovernedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isProtectedPath(req.path)) {
    next();
    return;
  }

  // User-initiated requests from the G-Rump app (Free Agent, desktop, web) are never governed as external agents
  if (isGrumpAppRequest(req)) {
    next();
    return;
  }

  const log = getRequestLogger();
  const { isAgent, agentId } = detectAgent(req);

  if (!isAgent) {
    next();
    return;
  }

  req.isAgentRequest = true;
  req.agentId = agentId;

  const policy = env.AGENT_ACCESS_POLICY ?? "block";

  if (policy === "audit_only") {
    await recordAgentAudit(agentId, req.path, "request", "allowed");
    log.info(
      { agentId, path: req.path },
      "Agent request (audit_only, allowed)",
    );
    next();
    return;
  }

  if (policy === "block") {
    await recordAgentAudit(agentId, req.path, "blocked", "blocked");
    log.warn({ agentId, path: req.path }, "Agent request blocked by policy");
    res.status(403).json({
      error:
        "Agent access is blocked. Moltbot/OpenClaw and similar AI agents are not permitted.",
      type: "agent_blocked",
      code: "AGENT_BLOCKED",
    });
    return;
  }

  // policy === 'allowlist'
  if (!isAllowlisted(agentId)) {
    await recordAgentAudit(agentId, req.path, "blocked", "blocked");
    log.warn({ agentId, path: req.path }, "Agent not in allowlist, blocked");
    res.status(403).json({
      error:
        "Agent not in allowlist. Add your agent ID to AGENT_ALLOWLIST to permit access.",
      type: "agent_blocked",
      code: "AGENT_NOT_ALLOWLISTED",
    });
    return;
  }

  if (!checkAgentRateLimit(agentId)) {
    await recordAgentAudit(agentId, req.path, "rate_limited", "blocked");
    log.warn({ agentId, path: req.path }, "Agent rate limit exceeded");
    res.status(429).json({
      error: `Rate limit exceeded. Max ${env.AGENT_RATE_LIMIT_PER_HOUR ?? 10} requests per hour per agent.`,
      type: "rate_limited",
      code: "AGENT_RATE_LIMIT",
    });
    return;
  }

  // Allowlisted + within rate limit
  // For risky paths (ship, codegen), require approval
  if (isRiskyPath(req.path)) {
    const approvalId = req.headers["x-approval-id"] as string | undefined;

    if (approvalId) {
      try {
        const approval = await getApprovalRequest(approvalId);
        if (approval?.status === "approved") {
          req.agentApprovalId = approvalId;
          await recordAgentAudit(agentId, req.path, "request", "allowed");
          next();
          return;
        }
      } catch {
        // Fall through to create new approval
      }
    }

    // Create approval request, block and return 202
    try {
      const approval = await createApprovalRequest({
        userId: `agent:${agentId}`,
        action: `agent.${req.method} ${req.path}`,
        riskLevel: "high",
        reason: `Agent ${agentId} requested ${req.path}. Human approval required.`,
        payload: { agentId, path: req.path, method: req.method },
      });
      await recordAgentAudit(
        agentId,
        req.path,
        "approval_required",
        "approval_required",
      );
      log.info(
        { agentId, path: req.path, approvalId: approval.id },
        "Agent approval required",
      );
      res.status(202).json({
        message: "Human approval required for this action.",
        approvalId: approval.id,
        pollUrl: `/api/approvals/${approval.id}`,
        retryWithHeader: "X-Approval-Id",
      });
      return;
    } catch (err) {
      log.error(
        { error: (err as Error).message },
        "Failed to create agent approval",
      );
      res.status(500).json({
        error: "Failed to create approval request",
        type: "internal_error",
      });
      return;
    }
  }

  await recordAgentAudit(agentId, req.path, "request", "allowed");
  next();
}
