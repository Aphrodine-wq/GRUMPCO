/**
 * G-Agent: The flagship autonomous AI agent for G-Rump
 * Maps capability keys to tool names for filtering.
 * When sessionType is gAgent, only tools whose names are in the allowed set are exposed.
 */

import {
  PREMIUM_CAPABILITIES,
  TEAM_CAPABILITIES,
  type GAgentCapabilityKey,
} from '../types/settings.js';

const CAPABILITY_TO_TOOLS: Record<GAgentCapabilityKey, string[]> = {
  // Core capabilities (free tier)
  file: ['file_read', 'file_write', 'file_edit', 'list_directory', 'codebase_search'],
  git: ['git_status', 'git_diff', 'git_log', 'git_commit', 'git_branch', 'git_push'],
  bash: ['bash_execute', 'terminal_execute'],
  npm: ['bash_execute', 'terminal_execute'],
  docker: ['docker_ps', 'docker_logs', 'docker_exec', 'docker_compose_up', 'docker_compose_down'],
  internet_search: ['screenshot_url', 'web_search', 'web_fetch'],

  // Extended capabilities (free tier with allowlist)
  webhooks: ['webhook_send', 'webhook_register', 'webhook_list', 'webhook_delete'],
  heartbeats: ['heartbeat_create', 'heartbeat_list', 'heartbeat_trigger', 'heartbeat_delete'],
  database: ['db_query', 'db_schema', 'db_migrate_dryrun', 'db_backup'],
  api_call: ['http_get', 'http_post', 'http_put', 'http_delete', 'graphql_query'],
  monitoring: ['metrics_query', 'alert_create', 'alert_list', 'health_check', 'logs_search'],

  // Premium capabilities (PRO+ tier required)
  cloud: ['k8s_deploy', 'k8s_scale', 'k8s_logs', 'k8s_status', 'k8s_rollback', 'cloud_status'],
  cicd: ['pipeline_trigger', 'pipeline_status', 'build_logs', 'release_create', 'release_list'],

  // NEW: Rust-powered task planning (PRO+)
  task_planning: ['plan_create', 'plan_execute', 'plan_status', 'task_decompose', 'task_validate'],

  // Self-improvement (G-Agent can create/edit its own skills)
  skills_self_edit: ['skill_create', 'skill_edit', 'skill_run_test', 'skill_list'],

  // NEW: Unified memory system (TEAM+)
  memory: ['memory_store', 'memory_recall', 'memory_search', 'pattern_learn', 'context_load'],

  // NEW: Self-improvement loop (TEAM+)
  self_improve: ['lexicon_extend', 'skill_generate', 'feedback_learn', 'performance_analyze'],
};

/** Human-readable descriptions for each capability */
export const CAPABILITY_DESCRIPTIONS: Record<GAgentCapabilityKey, string> = {
  file: 'Read, write, and edit files in your workspace',
  git: 'Git operations: status, diff, commit, branch, push',
  bash: 'Execute shell commands',
  npm: 'Run npm/pnpm/yarn commands',
  docker: 'Docker container and compose operations',
  internet_search: 'Web search and URL screenshots',
  webhooks: 'Send and manage webhooks',
  heartbeats: 'Scheduled tasks and health checks',
  database: 'Database queries and migrations (read-only by default)',
  api_call: 'Make HTTP/GraphQL API calls (allowlisted domains)',
  monitoring: 'Query metrics, create alerts, search logs',
  cloud: 'Kubernetes deployments and cloud operations (PRO+)',
  cicd: 'CI/CD pipeline management (PRO+)',
  task_planning: 'Rust-powered task decomposition and planning (PRO+)',
  skills_self_edit: 'Create, edit, test, and list your own skills',
  memory: 'Unified memory: patterns, project context, learning (TEAM+)',
  self_improve: 'Self-improvement: extend lexicon, generate skills (TEAM+)',
};

/** Get tools for a capability, with tier validation */
export function getToolsForCapability(
  capability: GAgentCapabilityKey,
  userTier: string = 'free'
): string[] {
  // Check premium gating
  if (PREMIUM_CAPABILITIES.includes(capability)) {
    if (userTier === 'free') return [];
  }
  if (TEAM_CAPABILITIES.includes(capability)) {
    if (userTier === 'free' || userTier === 'pro') return [];
  }
  return CAPABILITY_TO_TOOLS[capability] || [];
}

/**
 * Given enabled G-Agent capability keys, return the set of tool names that are allowed.
 * If capabilities is empty or undefined, returns undefined (meaning no filter - all tools allowed).
 */
export function getAllowedToolNames(
  capabilities: GAgentCapabilityKey[] | undefined,
  userTier: string = 'free'
): Set<string> | undefined {
  if (!capabilities || capabilities.length === 0) return undefined;
  const names = new Set<string>();
  for (const key of capabilities) {
    const tools = getToolsForCapability(key, userTier);
    for (const t of tools) names.add(t);
  }
  return names;
}

/** Check if a capability is available for a given tier */
export function isCapabilityAvailable(
  capability: GAgentCapabilityKey,
  userTier: string = 'free'
): boolean {
  if (PREMIUM_CAPABILITIES.includes(capability)) {
    return userTier !== 'free';
  }
  if (TEAM_CAPABILITIES.includes(capability)) {
    return userTier === 'team' || userTier === 'enterprise';
  }
  return true;
}

/** Get all capabilities available for a tier */
export function getAvailableCapabilities(userTier: string = 'free'): GAgentCapabilityKey[] {
  const all: GAgentCapabilityKey[] = [
    'file',
    'git',
    'bash',
    'npm',
    'docker',
    'internet_search',
    'webhooks',
    'heartbeats',
    'database',
    'api_call',
    'monitoring',
    'cloud',
    'cicd',
    'task_planning',
    'skills_self_edit',
    'memory',
    'self_improve',
  ];
  return all.filter((cap) => isCapabilityAvailable(cap, userTier));
}

/** Preset capability configurations */
export const CAPABILITY_PRESETS = {
  safe: ['file', 'git', 'bash'] as GAgentCapabilityKey[],
  standard: [
    'file',
    'git',
    'bash',
    'npm',
    'docker',
    'webhooks',
    'heartbeats',
  ] as GAgentCapabilityKey[],
  full: Object.keys(CAPABILITY_TO_TOOLS) as GAgentCapabilityKey[],
  autonomous: [
    'file',
    'git',
    'bash',
    'npm',
    'docker',
    'task_planning',
    'memory',
  ] as GAgentCapabilityKey[],
};

// Legacy exports for backward compatibility
export { GAgentCapabilityKey as FreeAgentCapabilityKey };
