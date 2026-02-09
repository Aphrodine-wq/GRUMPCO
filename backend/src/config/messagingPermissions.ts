/**
 * Messaging Permissions Configuration
 * Defines per-platform and per-user permissions for G-Agent via messaging
 */

import type { GAgentCapabilityKey } from "../types/settings.js";

// ========== Types ==========

export type MessagingPlatform =
  | "telegram"
  | "discord"
  | "twilio"
  | "slack"
  | "web"
  | "electron";

export interface PlatformPermissions {
  /** Whether G-Agent is enabled on this platform */
  gAgentEnabled: boolean;
  /** Allowed capabilities for this platform (subset of user's enabled capabilities) */
  allowedCapabilities: GAgentCapabilityKey[];
  /** Whether write operations require confirmation via messaging */
  requireConfirmation: boolean;
  /** Maximum tool execution timeout in seconds */
  timeoutSeconds: number;
  /** Whether to enforce Docker sandbox for this platform */
  requireSandbox: boolean;
  /** Rate limit: max tool executions per hour */
  rateLimitPerHour: number;
}

export interface UserMessagingPermissions {
  userId: string;
  /** Per-platform overrides */
  platforms: Partial<Record<MessagingPlatform, Partial<PlatformPermissions>>>;
  /** Global G-Agent enabled state */
  gAgentEnabled: boolean;
  /** Global capabilities (can be further restricted per platform) */
  capabilities: GAgentCapabilityKey[];
  /** External domain allowlist */
  allowlist: string[];
}

// ========== Default Permissions ==========

/**
 * Default permissions by platform
 * These are conservative defaults that can be overridden per-user
 */
export const DEFAULT_PLATFORM_PERMISSIONS: Record<
  MessagingPlatform,
  PlatformPermissions
> = {
  telegram: {
    gAgentEnabled: false, // Disabled by default for security
    allowedCapabilities: ["file", "git", "internet_search"], // Read-mostly
    requireConfirmation: true,
    timeoutSeconds: 30,
    requireSandbox: true,
    rateLimitPerHour: 20,
  },
  discord: {
    gAgentEnabled: false,
    allowedCapabilities: ["file", "git", "internet_search"],
    requireConfirmation: true,
    timeoutSeconds: 30,
    requireSandbox: true,
    rateLimitPerHour: 20,
  },
  twilio: {
    gAgentEnabled: false,
    allowedCapabilities: ["file", "git"], // More limited for SMS
    requireConfirmation: true,
    timeoutSeconds: 20, // Shorter for SMS
    requireSandbox: true,
    rateLimitPerHour: 10,
  },
  slack: {
    gAgentEnabled: false,
    allowedCapabilities: ["file", "git", "internet_search"],
    requireConfirmation: true,
    timeoutSeconds: 30,
    requireSandbox: true,
    rateLimitPerHour: 20,
  },
  web: {
    gAgentEnabled: true, // Enabled for web by default
    allowedCapabilities: [
      "file",
      "git",
      "bash",
      "npm",
      "docker",
      "webhooks",
      "heartbeats",
      "internet_search",
      "database",
      "api_call",
      "monitoring",
    ],
    requireConfirmation: false,
    timeoutSeconds: 60,
    requireSandbox: false, // Recommended but not required
    rateLimitPerHour: 100,
  },
  electron: {
    gAgentEnabled: true,
    allowedCapabilities: [
      "file",
      "git",
      "bash",
      "npm",
      "docker",
      "webhooks",
      "heartbeats",
      "internet_search",
      "database",
      "api_call",
      "monitoring",
      "cloud",
      "cicd", // Premium features available
    ],
    requireConfirmation: false,
    timeoutSeconds: 60,
    requireSandbox: true, // Sandboxed via Docker container
    rateLimitPerHour: 200,
  },
};

/**
 * Read-only capabilities that don't require confirmation
 */
export const READ_ONLY_CAPABILITIES: GAgentCapabilityKey[] = [
  "file", // file_read, list_directory, codebase_search
  "git", // git_status, git_diff, git_log
  "internet_search",
  "monitoring", // metrics_query, alert_list, health_check
];

/**
 * Write capabilities that should require confirmation when requireConfirmation is true
 */
export const WRITE_CAPABILITIES: GAgentCapabilityKey[] = [
  "bash",
  "npm",
  "docker",
  "cloud",
  "cicd",
  "webhooks",
  "database",
  "api_call",
];

// ========== Permission Resolution ==========

/**
 * Get effective permissions for a user on a platform
 */
export function getEffectivePermissions(
  platform: MessagingPlatform,
  userPermissions?: UserMessagingPermissions,
): PlatformPermissions {
  const defaults = DEFAULT_PLATFORM_PERMISSIONS[platform];

  if (!userPermissions) {
    return defaults;
  }

  const platformOverrides = userPermissions.platforms[platform] || {};

  // Merge with defaults, user overrides take precedence
  return {
    gAgentEnabled:
      platformOverrides.gAgentEnabled ??
      userPermissions.gAgentEnabled ??
      defaults.gAgentEnabled,
    allowedCapabilities: intersectCapabilities(
      userPermissions.capabilities,
      platformOverrides.allowedCapabilities ?? defaults.allowedCapabilities,
    ),
    requireConfirmation:
      platformOverrides.requireConfirmation ?? defaults.requireConfirmation,
    timeoutSeconds: platformOverrides.timeoutSeconds ?? defaults.timeoutSeconds,
    requireSandbox: platformOverrides.requireSandbox ?? defaults.requireSandbox,
    rateLimitPerHour:
      platformOverrides.rateLimitPerHour ?? defaults.rateLimitPerHour,
  };
}

/**
 * Intersect two capability lists (user's enabled AND platform's allowed)
 */
function intersectCapabilities(
  userCaps: GAgentCapabilityKey[],
  platformCaps: GAgentCapabilityKey[],
): GAgentCapabilityKey[] {
  const platformSet = new Set(platformCaps);
  return userCaps.filter((cap) => platformSet.has(cap));
}

/**
 * Check if a specific capability is allowed for a user on a platform
 */
export function isCapabilityAllowed(
  platform: MessagingPlatform,
  capability: GAgentCapabilityKey,
  userPermissions?: UserMessagingPermissions,
): boolean {
  const effective = getEffectivePermissions(platform, userPermissions);
  return (
    effective.gAgentEnabled &&
    effective.allowedCapabilities.includes(capability)
  );
}

/**
 * Check if an operation requires confirmation
 */
export function requiresConfirmation(
  platform: MessagingPlatform,
  capability: GAgentCapabilityKey,
  userPermissions?: UserMessagingPermissions,
): boolean {
  const effective = getEffectivePermissions(platform, userPermissions);

  if (!effective.requireConfirmation) {
    return false;
  }

  // Read-only capabilities never require confirmation
  if (READ_ONLY_CAPABILITIES.includes(capability)) {
    return false;
  }

  // Write capabilities require confirmation when the flag is set
  return WRITE_CAPABILITIES.includes(capability);
}

// ========== Rate Limiting ==========

const rateLimitCounters = new Map<string, { count: number; resetAt: number }>();

/**
 * Check and update rate limit
 */
export function checkRateLimit(
  platform: MessagingPlatform,
  userId: string,
  userPermissions?: UserMessagingPermissions,
): { allowed: boolean; remaining: number; resetIn: number } {
  const effective = getEffectivePermissions(platform, userPermissions);
  const key = `${platform}:${userId}`;
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  let counter = rateLimitCounters.get(key);

  if (!counter || now >= counter.resetAt) {
    counter = { count: 0, resetAt: now + hourMs };
    rateLimitCounters.set(key, counter);
  }

  const remaining = effective.rateLimitPerHour - counter.count;
  const resetIn = Math.max(0, counter.resetAt - now);

  if (remaining <= 0) {
    return { allowed: false, remaining: 0, resetIn };
  }

  counter.count++;
  return { allowed: true, remaining: remaining - 1, resetIn };
}

// ========== Pending Confirmations ==========

interface PendingConfirmation {
  id: string;
  platform: MessagingPlatform;
  userId: string;
  capability: GAgentCapabilityKey;
  tool: string;
  args: Record<string, unknown>;
  expiresAt: number;
  createdAt: number;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

/**
 * Create a pending confirmation request
 */
export function createConfirmationRequest(
  platform: MessagingPlatform,
  userId: string,
  capability: GAgentCapabilityKey,
  tool: string,
  args: Record<string, unknown>,
): { confirmationId: string; message: string } {
  const id = `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  pendingConfirmations.set(id, {
    id,
    platform,
    userId,
    capability,
    tool,
    args,
    expiresAt,
    createdAt: Date.now(),
  });

  // Clean up expired confirmations
  for (const [key, conf] of pendingConfirmations) {
    if (conf.expiresAt < Date.now()) {
      pendingConfirmations.delete(key);
    }
  }

  const argsPreview = JSON.stringify(args).slice(0, 100);
  return {
    confirmationId: id,
    message: `Confirm: Execute ${tool}?\nArgs: ${argsPreview}\n\nReply "yes ${id}" to confirm or "no" to cancel.`,
  };
}

/**
 * Confirm a pending request
 */
export function confirmRequest(
  confirmationId: string,
  userId: string,
): PendingConfirmation | null {
  const conf = pendingConfirmations.get(confirmationId);

  if (!conf) return null;
  if (conf.userId !== userId) return null;
  if (conf.expiresAt < Date.now()) {
    pendingConfirmations.delete(confirmationId);
    return null;
  }

  pendingConfirmations.delete(confirmationId);
  return conf;
}

/**
 * Cancel a pending request
 */
export function cancelRequest(confirmationId: string, userId: string): boolean {
  const conf = pendingConfirmations.get(confirmationId);
  if (!conf || conf.userId !== userId) return false;
  pendingConfirmations.delete(confirmationId);
  return true;
}

// ========== Admin API ==========

// In-memory store for user permissions (should be backed by DB in production)
const userPermissionsStore = new Map<string, UserMessagingPermissions>();

/**
 * Get user permissions (for admin dashboard)
 */
export function getUserPermissions(
  userId: string,
): UserMessagingPermissions | null {
  return userPermissionsStore.get(userId) || null;
}

/**
 * Set user permissions (for admin dashboard)
 */
export function setUserPermissions(
  permissions: UserMessagingPermissions,
): void {
  userPermissionsStore.set(permissions.userId, permissions);
}

/**
 * Update specific platform permissions for a user
 */
export function updatePlatformPermissions(
  userId: string,
  platform: MessagingPlatform,
  updates: Partial<PlatformPermissions>,
): void {
  let perms = userPermissionsStore.get(userId);
  if (!perms) {
    perms = {
      userId,
      platforms: {},
      gAgentEnabled: false,
      capabilities: [],
      allowlist: [],
    };
  }

  perms.platforms[platform] = {
    ...perms.platforms[platform],
    ...updates,
  };

  userPermissionsStore.set(userId, perms);
}
