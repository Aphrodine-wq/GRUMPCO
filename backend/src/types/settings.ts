/**
 * Settings types – User, Models, MCP, Skills, Accessibility, Integrations.
 * Shared shape for backend and frontends.
 */

export interface UserSettings {
  displayName?: string;
  email?: string;
  timezone?: string;
}

export interface ModelOption {
  provider: 'nim' | 'zhipu' | 'copilot' | 'openrouter';
  modelId: string;
  label?: string;
}

export type ModelPreset = 'fast' | 'quality' | 'balanced';

export interface ModelsSettings {
  defaultProvider?: 'nim' | 'zhipu' | 'copilot' | 'openrouter';
  defaultModelId?: string;
  /** Quality vs speed: fast = NIM/Kimi, quality = Claude, balanced = router default */
  modelPreset?: ModelPreset;
  options?: ModelOption[];
}

export interface McpServerConfig {
  id: string;
  name: string;
  command?: string;
  url?: string;
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface McpSettings {
  servers?: McpServerConfig[];
}

export interface SkillsSettings {
  enabledIds?: string[];
}

export interface AccessibilitySettings {
  reducedMotion?: boolean;
  highContrast?: boolean;
  fontSize?: 'normal' | 'large' | 'xlarge';
  keyboardShortcuts?: boolean;
}

export interface IntegrationsSettings {
  github?: { enabled: boolean };
  twilio?: { enabled: boolean; replyNumber?: string };
}

/** Tier override (e.g. from billing); used by feature-flags resolution when set. */
export type TierId = 'free' | 'pro' | 'team' | 'enterprise';

/** Guard rails for local file read/write: workspace, allowlist, confirm writes, autonomous. */
export interface GuardRailsSettings {
  /** Workspace root for file tools (default from request or env). */
  workspaceRoot?: string;
  /** Extra directories allowed in addition to workspace (absolute paths). */
  allowedDirs?: string[];
  /** When true, require explicit user confirmation for each write/delete (default on for safety). */
  confirmEveryWrite?: boolean;
  /** Yolo/autonomous mode: skip tool confirmations. */
  autonomousMode?: boolean;
  /** When true, allow larger message/context (200K+) for chat. */
  useLargeContext?: boolean;
}

export interface Settings {
  user?: UserSettings;
  models?: ModelsSettings;
  mcp?: McpSettings;
  skills?: SkillsSettings;
  accessibility?: AccessibilitySettings;
  integrations?: IntegrationsSettings;
  guardRails?: GuardRailsSettings;
  /** Tier override from billing or admin; used by feature-flags resolution. */
  tier?: TierId;
  /** UI Preferences synced from frontend */
  preferences?: UserPreferences;
  updatedAt?: string;
}

export interface UserPreferences {
  diagramStyle: 'minimal' | 'detailed' | 'comprehensive';
  primaryTechStack: string[];
  theme: 'light' | 'dark' | 'auto';
  analyticsOptIn: boolean;
  apiKey?: string;
  setupComplete: boolean;
}
