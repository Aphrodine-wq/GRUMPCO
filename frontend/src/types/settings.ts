/**
 * Settings types – aligned with backend GET/PUT /api/settings.
 */

export interface UserSettings {
  displayName?: string;
  email?: string;
  timezone?: string;
}

export type ModelPreset = 'fast' | 'quality' | 'balanced';

export interface CustomModelConfig {
  id: string;
  modelId: string;
  apiEndpoint: string;
  apiKey?: string;
  contextLength?: number;
}

export interface ModelsSettings {
  defaultProvider?: 'nim' | 'zhipu' | 'copilot' | 'openrouter' | 'ollama' | 'mock';
  defaultModelId?: string;
  /** Embedding model ID (e.g. BAAI/bge-small-en-v1.5, nvidia/nv-embed-v2) */
  embeddingModelId?: string;
  /** Custom / fine-tuned models (user-defined) */
  customModels?: CustomModelConfig[];
  /** Quality vs speed: fast = NIM/Kimi, quality = Claude, balanced = router default */
  modelPreset?: ModelPreset;
  /** Advanced: temperature (0–2). Higher = more creative. */
  temperature?: number;
  /** Advanced: max tokens per response. */
  maxTokens?: number;
}

export interface McpServerConfig {
  id: string;
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface McpSettings {
  servers?: McpServerConfig[];
  /** Request timeout in seconds for MCP calls. */
  requestTimeoutSeconds?: number;
  /** Max retries for MCP requests. */
  maxRetries?: number;
}

export interface MemorySettings {
  /** Max number of memories to keep (optional cap for UI/recall). */
  maxMemoriesToKeep?: number;
}

export interface GitSettings {
  /** Default branch name for new repos or suggestions. */
  defaultBranch?: string;
  /** Auto-fetch interval in minutes (0 = disabled). */
  autoFetchIntervalMinutes?: number;
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

/** Guard rails for local file read/write: allowlist, confirm writes, autonomous. */
export interface GuardRailsSettings {
  /** Extra directories allowed in addition to workspace (absolute paths). */
  allowedDirs?: string[];
  /** When true, require explicit user confirmation for each write/delete (default on). */
  confirmEveryWrite?: boolean;
  /** Yolo/autonomous mode: skip tool confirmations; backend runs tools without per-step approval. */
  autonomousMode?: boolean;
  /** When true, allow larger message/context (200K+ chars) for chat requests. */
  useLargeContext?: boolean;
}

/** UI/billing preferences stored with settings */
export interface SettingsPreferences {
  /** Alert when usage exceeds this percent of limit (0–100). */
  usageAlertPercent?: number;
  /** Show desktop notifications for completed tasks, etc. */
  desktopNotifications?: boolean;
  /** Play sound effects for events (send, receive, error). */
  soundEffects?: boolean;
  /** Automatically save files on change. */
  autoSave?: boolean;
  /** Show line numbers in code editors/blocks. */
  showLineNumbers?: boolean;
  /** Enable word-wrap in code editors/blocks. */
  wordWrap?: boolean;
}

export interface Settings {
  user?: UserSettings;
  models?: ModelsSettings;
  mcp?: McpSettings;
  memory?: MemorySettings;
  git?: GitSettings;
  skills?: SkillsSettings;
  accessibility?: AccessibilitySettings;
  integrations?: IntegrationsSettings;
  guardRails?: GuardRailsSettings;
  preferences?: SettingsPreferences;
  updatedAt?: string;
}
