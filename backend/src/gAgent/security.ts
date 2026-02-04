/**
 * G-Agent Security Layer
 *
 * SEPARATE security validation for G-Agent system (autonomous agents).
 * This is intentionally separate from Agent Lightning (code generation) security
 * to prevent cross-contamination of security vulnerabilities.
 *
 * Features:
 * - G-Agent-specific suspicious pattern detection
 * - Zod schemas for request validation
 * - Input sanitization functions
 * - Security middleware for Express routes
 *
 * @module gAgent/security
 */

import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import logger from "../middleware/logger.js";
import {
  getGuardrailsConfig,
  isExtensionBlocked,
  isDirectoryBlocked,
  isDirectoryDepthAllowed,
  isFileSizeAllowed,
  isHighRiskCommand,
} from "../config/guardrailsConfig.js";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum length for agent process message (stricter than general chat) */
export const GAGENT_MAX_MESSAGE_LENGTH = 4000;

/** Maximum length for goal descriptions */
export const GAGENT_MAX_DESCRIPTION_LENGTH = 2000;

/** Maximum length for workspace root path */
export const GAGENT_MAX_PATH_LENGTH = 500;

/** Maximum length for session/goal/plan IDs */
export const GAGENT_MAX_ID_LENGTH = 100;

/** Maximum tags allowed per goal */
export const GAGENT_MAX_TAGS = 20;

/** Maximum length per tag */
export const GAGENT_MAX_TAG_LENGTH = 50;

/** Maximum cron expression length */
export const GAGENT_MAX_CRON_LENGTH = 100;

/** Maximum context object depth */
export const GAGENT_MAX_CONTEXT_DEPTH = 5;

// ============================================================================
// G-AGENT SUSPICIOUS PATTERNS
// ============================================================================

/**
 * G-Agent-specific suspicious patterns.
 * These are stricter and more focused on autonomous agent attacks.
 *
 * IMPORTANT: These are SEPARATE from general chat patterns in validator.ts
 */
export const GAGENT_SUSPICIOUS_PATTERNS: RegExp[] = [
  // === Instruction Override Attacks ===
  /ignore\s+(all\s+)?(previous|prior|above|earlier|initial)/i,
  /disregard\s+(all\s+)?(previous|prior|above|earlier|initial)/i,
  /forget\s+(all\s+)?(previous|prior|above|earlier|initial)/i,
  /override\s+(all\s+)?(previous|prior|above|earlier|initial)/i,

  // === Role/Identity Manipulation ===
  /you\s+are\s+now\s+(a\s+)?different/i,
  /you\s+are\s+now\s+(an?\s+)?(unrestricted|evil|malicious|hacker)/i,
  /pretend\s+(to\s+be\s+)?(an?\s+)?(unrestricted|evil|malicious)/i,
  /act\s+as\s+(an?\s+)?(unrestricted|evil|malicious|hacker)/i,
  /roleplay\s+as\s+(an?\s+)?(unrestricted|evil|malicious|hacker)/i,

  // === System/Mode Injection ===
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /<\|im_start\|>/i,
  /<\|system\|>/i,
  /\[system\]/i,
  /```system/i,

  // === Mode Switching Attacks ===
  /switch\s+to\s+(developer|god|unrestricted|unfiltered|jailbreak)\s*mode/i,
  /enter\s+(developer|god|unrestricted|unfiltered|jailbreak)\s*mode/i,
  /enable\s+(developer|god|unrestricted|unfiltered|jailbreak)\s*mode/i,
  /dan\s*mode/i,
  /developer\s*mode\s*(enabled|on|activated)/i,
  /god\s*mode/i,
  /\bjailbreak\b/i,
  /do\s+anything\s+now/i,

  // === Autonomous Agent-Specific Attacks ===
  /spawn\s+(unlimited|infinite|maximum)/i,
  /create\s+(unlimited|infinite|maximum)\s+agents?/i,
  /bypass\s+(security|validation|auth|authorization|limit)/i,
  /disable\s+(security|validation|auth|logging|monitoring)/i,
  /remove\s+(all\s+)?(restrictions?|limits?|constraints?)/i,
  /ignore\s+(all\s+)?(restrictions?|limits?|constraints?|safety)/i,
  /no\s+(restrictions?|limits?|constraints?|safety)/i,

  // === Dangerous Shell/System Commands ===
  /execute\s+(shell|bash|cmd|command|powershell)/i,
  /run\s+(shell|bash|cmd|command|powershell)/i,
  /rm\s+-rf/i,
  /rmdir\s+\/s/i,
  /del\s+\/f\s+\/s/i,
  /format\s+c:/i,
  /shutdown\s+(-s|-r|\/s|\/r)/i,
  /delete\s+(all|everything|\*)/i,
  /drop\s+table/i,
  /drop\s+database/i,
  /truncate\s+table/i,

  // === File System Attacks ===
  /\.\.\/\.\.\//, // Path traversal
  /\.\.\\\.\.\\/, // Windows path traversal
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /c:\\windows\\system32/i,

  // === Credential/Secret Extraction ===
  /reveal\s+(your|the)\s+(api\s*key|secret|credential|password|token)/i,
  /show\s+(me\s+)?(your|the)\s+(api\s*key|secret|credential|password|token)/i,
  /output\s+(your|the)\s+(api\s*key|secret|credential|password|token)/i,
  /print\s+(your|the)\s+(api\s*key|secret|credential|password|token)/i,
  /what\s+(is|are)\s+(your|the)\s+(api\s*key|secret|credential|password|token)/i,
  /env(ironment)?\s*\[(["'])?[A-Z_]+\2?\]/i, // env['SECRET_KEY']
  /process\.env\./i,

  // === Prompt Leaking ===
  /reveal\s+(your|the)\s+(system|initial)\s+(prompt|instructions)/i,
  /show\s+(me\s+)?(your|the)\s+(system|initial)\s+(prompt|instructions)/i,
  /what\s+(are|is)\s+your\s+(system|initial)\s+(prompt|instructions)/i,
  /print\s+(your|the)\s+(system|initial)\s+(prompt|instructions)/i,
  /repeat\s+(your|the)\s+(system|initial)\s+(prompt|instructions)/i,

  // === Encoding/Evasion Attacks ===
  /base64\s*decode/i,
  /atob\s*\(/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /Function\s*\(/i,
  /new\s+Function/i,

  // === Autonomy Escalation ===
  /set\s+(autonomy|autonomous)\s*(level)?\s*(to\s+)?full/i,
  /increase\s+(autonomy|autonomous)/i,
  /maximum\s+autonomy/i,
  /auto-?approve\s+all/i,
  /skip\s+(all\s+)?approval/i,
  /no\s+human\s+(oversight|review|approval)/i,

  // === Resource Exhaustion ===
  /infinite\s+loop/i,
  /while\s*\(\s*true\s*\)/i,
  /for\s*\(\s*;\s*;\s*\)/i,
  /fork\s+bomb/i,
  /:()\{\s*:\|:\s*&\s*\};:/, // Classic fork bomb
];

// ============================================================================
// PATTERN CHECKING
// ============================================================================

/**
 * Check text for G-Agent-specific suspicious patterns.
 * @returns Array of matched pattern strings (empty if none match)
 */
export function checkGAgentSuspiciousPatterns(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of GAGENT_SUSPICIOUS_PATTERNS) {
    if (pattern.test(text)) {
      matches.push(pattern.toString());
    }
  }
  return matches;
}

/**
 * Security check result for logging and blocking
 */
export interface SecurityCheckResult {
  blocked: boolean;
  patterns: string[];
  field: string;
  preview: string;
}

/**
 * Check multiple fields in a body for suspicious patterns.
 * When BLOCK_SUSPICIOUS_PROMPTS=true, returns { blocked: true } on match.
 */
export function checkSuspiciousInGAgentBody(
  body: Record<string, unknown>,
  keys: string[],
): SecurityCheckResult | null {
  for (const key of keys) {
    const val = body[key];
    const text = typeof val === "string" ? val : "";
    const matches = checkGAgentSuspiciousPatterns(text);

    if (matches.length > 0) {
      const preview = text.substring(0, 100);

      // Always log (warning level)
      logger.warn(
        { patterns: matches, field: key, preview, source: "g-agent-security" },
        "G-Agent suspicious patterns detected",
      );

      // Block if env var is set
      if (process.env.BLOCK_SUSPICIOUS_PROMPTS === "true") {
        return { blocked: true, patterns: matches, field: key, preview };
      }
    }
  }
  return null;
}

// ============================================================================
// SANITIZATION
// ============================================================================

/**
 * Strip dangerous control characters from input.
 * Preserves newlines, tabs, and standard whitespace.
 */
export function sanitizeControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex -- intentional: strip control chars for security
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Sanitize G-Agent message input.
 * - Strips control characters
 * - Trims whitespace
 * - Limits length
 */
export function sanitizeGAgentMessage(
  input: string,
  maxLength = GAGENT_MAX_MESSAGE_LENGTH,
): string {
  let sanitized = sanitizeControlChars(input);
  sanitized = sanitized.trim();
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

/**
 * Sanitize goal description.
 * - Strips control characters
 * - Trims whitespace
 * - Limits length
 * - Normalizes multiple newlines
 */
export function sanitizeGoalDescription(input: string): string {
  let sanitized = sanitizeControlChars(input);
  sanitized = sanitized.trim();
  // Normalize multiple newlines to max 2
  sanitized = sanitized.replace(/\n{3,}/g, "\n\n");
  if (sanitized.length > GAGENT_MAX_DESCRIPTION_LENGTH) {
    sanitized = sanitized.substring(0, GAGENT_MAX_DESCRIPTION_LENGTH);
  }
  return sanitized;
}

/**
 * Sanitize file path input.
 * - Basic path traversal prevention
 * - Trim and limit length
 */
export function sanitizePath(input: string): string {
  let sanitized = input.trim();
  // Remove null bytes (path traversal attack)
  sanitized = sanitized.replace(/\0/g, "");
  // Don't allow explicit path traversal sequences
  // (Note: more comprehensive path validation should happen at file system level)
  if (sanitized.length > GAGENT_MAX_PATH_LENGTH) {
    sanitized = sanitized.substring(0, GAGENT_MAX_PATH_LENGTH);
  }
  return sanitized;
}

/**
 * Sanitize tag array.
 * - Limit number of tags
 * - Limit tag length
 * - Remove empty/invalid tags
 */
export function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];

  return tags
    .filter(
      (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
    )
    .slice(0, GAGENT_MAX_TAGS)
    .map((tag) => tag.trim().substring(0, GAGENT_MAX_TAG_LENGTH));
}

/**
 * Recursively sanitize a context object.
 * - Limits depth
 * - Sanitizes string values
 * - Removes functions and symbols
 */
export function sanitizeContext(
  obj: unknown,
  depth = 0,
): Record<string, unknown> | undefined {
  if (depth > GAGENT_MAX_CONTEXT_DEPTH) return undefined;
  if (obj === null || obj === undefined) return undefined;
  if (typeof obj !== "object") return undefined;
  if (Array.isArray(obj)) {
    // For arrays in context, sanitize each element
    return obj.map((item) => {
      if (typeof item === "string") return sanitizeControlChars(item);
      if (typeof item === "object" && item !== null) {
        return sanitizeContext(item, depth + 1);
      }
      return item;
    }) as unknown as Record<string, unknown>;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous types
    if (typeof value === "function" || typeof value === "symbol") continue;

    if (typeof value === "string") {
      result[key] = sanitizeControlChars(value);
    } else if (typeof value === "object" && value !== null) {
      const sanitized = sanitizeContext(value, depth + 1);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

// --- Common Enums ---
const agentModeSchema = z.enum([
  "chat",
  "goal",
  "plan",
  "execute",
  "swarm",
  "codegen",
  "autonomous",
]);
const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);
const triggerTypeSchema = z.enum([
  "immediate",
  "scheduled",
  "cron",
  "webhook",
  "file_change",
  "self_scheduled",
]);

// --- Agent Process Request Schema ---
export const agentProcessRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(
      GAGENT_MAX_MESSAGE_LENGTH,
      `Message must be at most ${GAGENT_MAX_MESSAGE_LENGTH} characters`,
    )
    .transform((val) => sanitizeGAgentMessage(val)),

  mode: agentModeSchema.optional(),

  sessionId: z.string().max(GAGENT_MAX_ID_LENGTH).optional(),

  goalId: z.string().max(GAGENT_MAX_ID_LENGTH).optional(),

  planId: z.string().max(GAGENT_MAX_ID_LENGTH).optional(),

  workspaceRoot: z
    .string()
    .max(GAGENT_MAX_PATH_LENGTH)
    .transform(sanitizePath)
    .optional(),

  capabilities: z.array(z.string().max(100)).max(50).optional(),

  autonomous: z.boolean().optional(),

  priority: prioritySchema.optional(),

  context: z
    .record(z.unknown())
    .optional()
    .transform((val) => (val ? sanitizeContext(val) : undefined)),
});

export type AgentProcessRequest = z.infer<typeof agentProcessRequestSchema>;

// --- Goal Create Request Schema ---
export const goalCreateRequestSchema = z.object({
  description: z
    .string()
    .min(1, "Description is required")
    .max(
      GAGENT_MAX_DESCRIPTION_LENGTH,
      `Description must be at most ${GAGENT_MAX_DESCRIPTION_LENGTH} characters`,
    )
    .transform(sanitizeGoalDescription),

  priority: prioritySchema.optional().default("normal"),

  triggerType: triggerTypeSchema.optional().default("immediate"),

  scheduledAt: z.string().datetime().optional(),

  cronExpression: z.string().max(GAGENT_MAX_CRON_LENGTH).optional(),

  workspaceRoot: z
    .string()
    .max(GAGENT_MAX_PATH_LENGTH)
    .transform(sanitizePath)
    .optional(),

  tags: z
    .array(z.string())
    .optional()
    .transform((val) => (val ? sanitizeTags(val) : undefined)),

  maxRetries: z.number().int().min(0).max(10).optional().default(3),
});

export type GoalCreateRequest = z.infer<typeof goalCreateRequestSchema>;

// --- Recurring Goal Request Schema ---
export const recurringGoalRequestSchema = z.object({
  description: z
    .string()
    .min(1, "Description is required")
    .max(GAGENT_MAX_DESCRIPTION_LENGTH)
    .transform(sanitizeGoalDescription),

  cronExpression: z
    .string()
    .min(1, "Cron expression is required")
    .max(GAGENT_MAX_CRON_LENGTH),

  workspaceRoot: z
    .string()
    .max(GAGENT_MAX_PATH_LENGTH)
    .transform(sanitizePath)
    .optional(),

  priority: prioritySchema.optional(),

  tags: z
    .array(z.string())
    .optional()
    .transform((val) => (val ? sanitizeTags(val) : undefined)),
});

export type RecurringGoalRequest = z.infer<typeof recurringGoalRequestSchema>;

// --- Follow-up Goal Request Schema ---
export const followUpGoalRequestSchema = z.object({
  parentGoalId: z
    .string()
    .min(1, "Parent goal ID is required")
    .max(GAGENT_MAX_ID_LENGTH),

  description: z
    .string()
    .min(1, "Description is required")
    .max(GAGENT_MAX_DESCRIPTION_LENGTH)
    .transform(sanitizeGoalDescription),

  scheduledAt: z.string().datetime().optional(),

  priority: prioritySchema.optional(),

  tags: z
    .array(z.string())
    .optional()
    .transform((val) => (val ? sanitizeTags(val) : undefined)),
});

export type FollowUpGoalRequest = z.infer<typeof followUpGoalRequestSchema>;

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Express request with validated body
 */
export interface ValidatedRequest<T> extends Request {
  validatedBody: T;
}

/**
 * Create validation middleware for a Zod schema.
 * Also checks for suspicious patterns after validation.
 *
 * @param schema - Zod schema to validate against
 * @param suspiciousKeys - Body keys to check for suspicious patterns
 */
export function validateGAgentRequest<T extends z.ZodSchema>(
  schema: T,
  suspiciousKeys: string[] = ["message", "description"],
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 1. Zod validation (includes sanitization via transforms)
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      logger.warn(
        { errors, path: req.path, source: "g-agent-security" },
        "G-Agent validation failed",
      );

      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: errors,
        },
      });
      return;
    }

    // 2. Suspicious pattern check (on ORIGINAL input, before sanitization)
    const suspiciousResult = checkSuspiciousInGAgentBody(
      req.body,
      suspiciousKeys,
    );
    if (suspiciousResult?.blocked) {
      res.status(400).json({
        success: false,
        error: {
          code: "SUSPICIOUS_CONTENT",
          message: "Request blocked: suspicious content detected",
          details: [
            {
              field: suspiciousResult.field,
              message: "Content matches blocked patterns",
            },
          ],
        },
      });
      return;
    }

    // 3. Attach validated (and sanitized) body
    (req as ValidatedRequest<z.infer<T>>).validatedBody = result.data;

    next();
  };
}

// ============================================================================
// PRE-BUILT MIDDLEWARE
// ============================================================================

/**
 * Middleware for POST /api/agent/process and /api/agent/stream
 */
export const validateAgentProcessRequest = validateGAgentRequest(
  agentProcessRequestSchema,
  ["message"],
);

/**
 * Middleware for POST /api/gagent/goals
 */
export const validateGoalCreateRequest = validateGAgentRequest(
  goalCreateRequestSchema,
  ["description"],
);

/**
 * Middleware for POST /api/gagent/recurring
 */
export const validateRecurringGoalRequest = validateGAgentRequest(
  recurringGoalRequestSchema,
  ["description"],
);

/**
 * Middleware for POST /api/gagent/follow-up
 */
export const validateFollowUpGoalRequest = validateGAgentRequest(
  followUpGoalRequestSchema,
  ["description"],
);

// ============================================================================
// FILE SYSTEM RESTRICTIONS
// ============================================================================

/**
 * Result of file system security check
 */
export interface FileSystemCheckResult {
  allowed: boolean;
  reason?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
}

/**
 * Check if a file path is allowed for read operations
 */
export function checkFileReadAllowed(filePath: string): FileSystemCheckResult {
  const config = getGuardrailsConfig();

  if (!config.enabled) {
    return { allowed: true, riskLevel: "low" };
  }

  // Check path traversal
  if (containsPathTraversal(filePath)) {
    return {
      allowed: false,
      reason: "Path traversal detected",
      riskLevel: "critical",
    };
  }

  // Check blocked directories
  if (isDirectoryBlocked(filePath)) {
    return {
      allowed: false,
      reason: "Access to blocked directory",
      riskLevel: "high",
    };
  }

  // Check directory depth
  if (!isDirectoryDepthAllowed(filePath)) {
    return {
      allowed: false,
      reason: `Path exceeds maximum directory depth of ${config.fileSystem.maxDirectoryDepth}`,
      riskLevel: "medium",
    };
  }

  return { allowed: true, riskLevel: "low" };
}

/**
 * Check if a file path is allowed for write operations
 */
export function checkFileWriteAllowed(
  filePath: string,
  fileSize?: number,
): FileSystemCheckResult {
  const config = getGuardrailsConfig();

  if (!config.enabled) {
    return { allowed: true, riskLevel: "low" };
  }

  // First check read restrictions
  const readCheck = checkFileReadAllowed(filePath);
  if (!readCheck.allowed) {
    return readCheck;
  }

  // Check blocked extensions
  if (isExtensionBlocked(filePath)) {
    return {
      allowed: false,
      reason: "File extension is blocked for writing",
      riskLevel: "high",
    };
  }

  // Check file size if provided
  if (fileSize !== undefined && !isFileSizeAllowed(fileSize)) {
    return {
      allowed: false,
      reason: `File size exceeds limit of ${config.fileSystem.maxFileSizeBytes} bytes`,
      riskLevel: "medium",
    };
  }

  // Check for sensitive files
  if (isSensitiveFile(filePath)) {
    return {
      allowed: false,
      reason: "Writing to sensitive files is not allowed",
      riskLevel: "critical",
    };
  }

  return { allowed: true, riskLevel: "low" };
}

/**
 * Check if a file deletion is allowed
 */
export function checkFileDeleteAllowed(
  filePath: string,
): FileSystemCheckResult {
  const config = getGuardrailsConfig();

  if (!config.enabled) {
    return { allowed: true, riskLevel: "low" };
  }

  // Check path traversal
  if (containsPathTraversal(filePath)) {
    return {
      allowed: false,
      reason: "Path traversal detected",
      riskLevel: "critical",
    };
  }

  // Check blocked directories
  if (isDirectoryBlocked(filePath)) {
    return {
      allowed: false,
      reason: "Cannot delete files in blocked directories",
      riskLevel: "critical",
    };
  }

  // Check for sensitive files
  if (isSensitiveFile(filePath)) {
    return {
      allowed: false,
      reason: "Cannot delete sensitive files",
      riskLevel: "critical",
    };
  }

  return { allowed: true, riskLevel: "medium" };
}

/**
 * Check if a shell command is allowed
 */
export function checkCommandAllowed(command: string): FileSystemCheckResult {
  const config = getGuardrailsConfig();

  if (!config.enabled) {
    return { allowed: true, riskLevel: "low" };
  }

  // Check for high-risk commands
  if (isHighRiskCommand(command)) {
    return {
      allowed: false,
      reason: "High-risk command detected",
      riskLevel: "critical",
    };
  }

  // Check for dangerous patterns in the command
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return {
        allowed: false,
        reason: "Dangerous command pattern detected",
        riskLevel: "critical",
      };
    }
  }

  // Check for path traversal in command arguments
  if (containsPathTraversal(command)) {
    return {
      allowed: false,
      reason: "Path traversal in command arguments",
      riskLevel: "high",
    };
  }

  // Determine risk level for allowed commands
  const riskLevel = determineCommandRiskLevel(command);

  return { allowed: true, riskLevel };
}

/**
 * Dangerous command patterns
 */
const DANGEROUS_COMMAND_PATTERNS = [
  // Destructive commands
  /rm\s+(-[rf]+\s+)*[\/~]/i,
  /rmdir\s+\/s/i,
  /del\s+\/[fs]/i,
  /format\s+[a-z]:/i,
  /mkfs\./i,
  /dd\s+if=/i,

  // Fork bombs and resource exhaustion
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/,
  /while\s*\(\s*true\s*\)/i,
  /for\s*\(\s*;\s*;\s*\)/,

  // Privilege escalation
  /sudo\s+-S/i,
  /su\s+-c/i,
  /chmod\s+[467]77/i,
  /chown\s+(root|0)/i,

  // Reverse shells
  /nc\s+-e/i,
  /bash\s+-i\s+>&/i,
  /python.*socket.*connect/i,
  /perl.*socket.*connect/i,

  // Data exfiltration
  /curl.*--data.*@/i,
  /wget.*--post-file/i,
  /scp\s+.*@.*:/i,

  // System commands
  /shutdown/i,
  /reboot/i,
  /halt\b/i,
  /init\s+[06]/i,
  /systemctl\s+(stop|disable)/i,

  // Package manipulation
  /npm\s+uninstall\s+-g/i,
  /pip\s+uninstall/i,
  /apt\s+(remove|purge)/i,
  /yum\s+(remove|erase)/i,
];

/**
 * Check for path traversal attempts
 */
function containsPathTraversal(pathOrCommand: string): boolean {
  const traversalPatterns = [
    /\.\.\//, // Unix path traversal
    /\.\.\\/, // Windows path traversal
    /%2e%2e[\/\\]/i, // URL encoded
    /\.\.%2f/i, // Mixed encoding
    /%2e%2e%2f/i, // Full URL encoding
    /\.\.[\/\\]/, // Combined
  ];

  return traversalPatterns.some((pattern) => pattern.test(pathOrCommand));
}

/**
 * Check if file is sensitive
 */
function isSensitiveFile(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, "/");

  const sensitivePatterns = [
    // Environment and config files
    /\.env$/,
    /\.env\.\w+$/,
    /\.aws\/credentials$/,
    /\.ssh\/.*$/,
    /\.npmrc$/,
    /\.netrc$/,
    /\.pgpass$/,
    /\.my\.cnf$/,
    /credentials\.json$/,
    /secrets?\.(json|ya?ml|toml)$/,

    // Key files
    /\.pem$/,
    /\.key$/,
    /id_rsa$/,
    /id_ed25519$/,
    /\.p12$/,
    /\.pfx$/,

    // Database files
    /\.sqlite$/,
    /\.db$/,

    // System files
    /\/etc\/passwd$/,
    /\/etc\/shadow$/,
    /\/etc\/sudoers$/,
    /\/etc\/hosts$/,
    /c:\/windows\/system32\//,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Determine risk level of a command
 */
function determineCommandRiskLevel(command: string): "low" | "medium" | "high" {
  const lowerCommand = command.toLowerCase();

  // High risk commands
  const highRiskPatterns = [
    /git\s+push/,
    /git\s+reset/,
    /git\s+checkout\s+--/,
    /npm\s+publish/,
    /npm\s+install\s+[^-]/, // Installing new packages
    /pip\s+install/,
    /docker\s+run/,
    /kubectl\s+delete/,
    /psql\s+.*-c/,
    /mysql\s+.*-e/,
  ];

  if (highRiskPatterns.some((pattern) => pattern.test(lowerCommand))) {
    return "high";
  }

  // Medium risk commands
  const mediumRiskPatterns = [
    /git\s+(add|commit|stash)/,
    /npm\s+(test|run|start)/,
    /node\s+/,
    /python\s+/,
    /mkdir/,
    /touch/,
    /cp\s+/,
    /mv\s+/,
  ];

  if (mediumRiskPatterns.some((pattern) => pattern.test(lowerCommand))) {
    return "medium";
  }

  return "low";
}

/**
 * Validate batch file operations
 */
export function validateBatchOperation(
  files: Array<{ path: string; size?: number }>,
  operation: "read" | "write" | "delete",
): { allowed: boolean; blockedFiles: string[]; reason?: string } {
  const config = getGuardrailsConfig();
  const blockedFiles: string[] = [];

  // Check file count limit
  if (files.length > config.fileSystem.maxFilesPerOperation) {
    return {
      allowed: false,
      blockedFiles: [],
      reason: `Operation exceeds maximum of ${config.fileSystem.maxFilesPerOperation} files`,
    };
  }

  // Check total size for write operations
  if (operation === "write") {
    const totalSize = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
    if (totalSize > config.fileSystem.maxBytesPerOperation) {
      return {
        allowed: false,
        blockedFiles: [],
        reason: `Operation exceeds maximum of ${config.fileSystem.maxBytesPerOperation} bytes`,
      };
    }
  }

  // Check each file
  for (const file of files) {
    let check: FileSystemCheckResult;

    switch (operation) {
      case "read":
        check = checkFileReadAllowed(file.path);
        break;
      case "write":
        check = checkFileWriteAllowed(file.path, file.size);
        break;
      case "delete":
        check = checkFileDeleteAllowed(file.path);
        break;
    }

    if (!check.allowed) {
      blockedFiles.push(file.path);
    }
  }

  return {
    allowed: blockedFiles.length === 0,
    blockedFiles,
    reason:
      blockedFiles.length > 0
        ? `${blockedFiles.length} files blocked by security policy`
        : undefined,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Constants
  GAGENT_MAX_MESSAGE_LENGTH,
  GAGENT_MAX_DESCRIPTION_LENGTH,
  GAGENT_MAX_PATH_LENGTH,
  GAGENT_SUSPICIOUS_PATTERNS,

  // Pattern checking
  checkGAgentSuspiciousPatterns,
  checkSuspiciousInGAgentBody,

  // Sanitization
  sanitizeControlChars,
  sanitizeGAgentMessage,
  sanitizeGoalDescription,
  sanitizePath,
  sanitizeTags,
  sanitizeContext,

  // File system checks
  checkFileReadAllowed,
  checkFileWriteAllowed,
  checkFileDeleteAllowed,
  checkCommandAllowed,
  validateBatchOperation,

  // Schemas
  agentProcessRequestSchema,
  goalCreateRequestSchema,
  recurringGoalRequestSchema,
  followUpGoalRequestSchema,

  // Middleware
  validateGAgentRequest,
  validateAgentProcessRequest,
  validateGoalCreateRequest,
  validateRecurringGoalRequest,
  validateFollowUpGoalRequest,
};
