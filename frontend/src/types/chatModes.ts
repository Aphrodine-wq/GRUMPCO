/**
 * Chat Mode Types and Constants
 *
 * Centralized definitions for chat modes to eliminate magic strings
 * and provide type safety across the application.
 */

/**
 * All available chat mode types
 */
export type ChatModeType =
  | 'normal'
  | 'plan'
  | 'spec'
  | 'ship'
  | 'execute'
  | 'design'
  | 'argument'
  | 'code';

/**
 * Global mode types (from chatModeStore)
 */
export type GlobalModeType = 'code' | 'design' | 'argument';

/**
 * Session types for Agent.
 * 'freeAgent' kept for backward compatibility with stored sessions.
 */
export type SessionType = 'chat' | 'gAgent' | 'freeAgent';

/**
 * Chat mode constants - use these instead of magic strings
 */
export const ChatMode = {
  NORMAL: 'normal',
  PLAN: 'plan',
  SPEC: 'spec',
  SHIP: 'ship',
  EXECUTE: 'execute',
  DESIGN: 'design',
  ARGUMENT: 'argument',
  CODE: 'code',
} as const;

/**
 * Global mode constants
 */
export const GlobalMode = {
  CODE: 'code',
  DESIGN: 'design',
  ARGUMENT: 'argument',
} as const;

/**
 * Session type constants
 */
export const SessionTypes = {
  CHAT: 'chat',
  GAGENT: 'gAgent',
  /** @deprecated Use GAGENT. Kept for backward compat with stored sessions. */
  FREE_AGENT: 'freeAgent',
} as const;

/**
 * Slash command prefixes
 */
export const SlashCommands = {
  MODEL: '/model',
  USE: '/use ',
  HELP: '/help',
  CLEAR: '/clear',
} as const;

/**
 * Model shortcuts for /use command
 */
export const ModelShortcuts: Record<string, { provider: string; modelId: string }> = {
  kimi: { provider: 'nim', modelId: 'moonshotai/kimi-k2.5' },
  'nemotron-ultra': { provider: 'nim', modelId: 'nvidia/llama-3.1-nemotron-ultra-253b-v1' },
  'nemotron-super': { provider: 'nim', modelId: 'nvidia/llama-3.3-nemotron-super-49b-v1.5' },
  auto: { provider: 'nim', modelId: '' },
} as const;

/**
 * Default timeout for API requests in milliseconds
 */
export const API_TIMEOUT_MS = 120_000;

/**
 * Check if a mode is an Agent session type
 */
export function isGAgentSessionType(sessionType: string | undefined): boolean {
  return sessionType === SessionTypes.GAGENT || sessionType === SessionTypes.FREE_AGENT;
}

/**
 * Check if slash command is valid
 */
export function isSlashCommand(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed === SlashCommands.MODEL ||
    trimmed.startsWith(SlashCommands.USE) ||
    trimmed === SlashCommands.HELP ||
    trimmed === SlashCommands.CLEAR
  );
}
