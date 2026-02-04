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
  provider: "nim" | "mock";
  modelId: string;
  label?: string;
}

export type ModelPreset = "fast" | "quality" | "balanced";

export interface ModelsSettings {
  defaultProvider?: "nim" | "mock";
  defaultModelId?: string;
  /** Quality vs speed: fast = Llama/Mistral, quality = Llama 405B, balanced = router default. Powered by NVIDIA NIM. */
  modelPreset?: ModelPreset;
  options?: ModelOption[];
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
}

export interface SkillsSettings {
  enabledIds?: string[];
}

export interface AccessibilitySettings {
  reducedMotion?: boolean;
  highContrast?: boolean;
  fontSize?: "normal" | "large" | "xlarge";
  keyboardShortcuts?: boolean;
}

export interface IntegrationsSettings {
  github?: { enabled: boolean };
  twilio?: { enabled: boolean; replyNumber?: string };
}

/** Tier override (e.g. from billing); used by feature-flags resolution when set. */
export type TierId = "free" | "pro" | "team" | "enterprise";

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

/**
 * G-Agent Capability Keys
 * G-Agent is the flagship autonomous AI agent - the "brain" of G-Rump
 */
export type GAgentCapabilityKey =
  | "file"
  | "git"
  | "bash"
  | "npm"
  | "docker"
  | "cloud"
  | "webhooks"
  | "heartbeats"
  | "internet_search"
  | "database"
  | "api_call"
  | "monitoring"
  | "cicd"
  | "skills_self_edit"
  | "task_planning" // NEW: Rust-powered task decomposition
  | "memory" // NEW: Unified memory system
  | "self_improve"; // NEW: Self-improvement loop

/** @deprecated Use GAgentCapabilityKey instead */
export type FreeAgentCapabilityKey = GAgentCapabilityKey;

/** Capabilities that require a PRO+ tier license */
export const PREMIUM_CAPABILITIES: GAgentCapabilityKey[] = [
  "cloud",
  "cicd",
  "task_planning",
];

/** Capabilities that require a TEAM+ tier license */
export const TEAM_CAPABILITIES: GAgentCapabilityKey[] = [
  "memory",
  "self_improve",
];

/** Maximum agents in swarm by tier (free=3, pro=5, team=10, enterprise=unlimited) */
export const SWARM_LIMITS: Record<string, number> = {
  free: 3,
  pro: 5,
  team: 10,
  enterprise: 100,
};

/**
 * G-Agent Model Preference
 */
export interface GAgentModelPreference {
  source?: "cloud" | "ollama" | "auto";
  provider?: string;
  modelId?: string;
}

/** @deprecated Use GAgentModelPreference instead */
export type FreeAgentModelPreference = GAgentModelPreference;

/**
 * G-Agent Persona - customizable agent personality
 */
export interface GAgentPersona {
  tone?: string;
  style?: string;
  expertise?: string[];
}

/** @deprecated Use GAgentPersona instead */
export type FreeAgentPersona = GAgentPersona;

/**
 * G-Agent Task - represents a planned task in the execution queue
 */
export interface GAgentTask {
  id: string;
  description: string;
  status:
    | "pending"
    | "approved"
    | "in_progress"
    | "completed"
    | "failed"
    | "cancelled";
  priority: number;
  dependencies: string[];
  estimatedDuration?: number;
  tools: string[];
  riskLevel: "safe" | "moderate" | "risky";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

/**
 * G-Agent Plan - the full execution plan shown to user for approval
 */
export interface GAgentPlan {
  id: string;
  goal: string;
  tasks: GAgentTask[];
  status:
    | "planning"
    | "awaiting_approval"
    | "executing"
    | "completed"
    | "failed";
  confidence: number;
  estimatedTotalDuration?: number;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
  /** Feasibility verification: actionable feedback from intent-to-execution check. */
  feasibilityFeedback?: string;
}

export interface UserPreferences {
  diagramStyle: "minimal" | "detailed" | "comprehensive";
  primaryTechStack: string[];
  theme: "light" | "dark" | "auto";
  analyticsOptIn: boolean;
  apiKey?: string;
  setupComplete: boolean;
  density?: "comfortable" | "compact";

  // G-Agent Configuration
  gAgentCapabilities?: GAgentCapabilityKey[];
  gAgentExternalAllowlist?: string[];
  gAgentPreferredModelSource?: "cloud" | "ollama" | "auto";
  gAgentOllamaModel?: string;
  gAgentModelPreference?: GAgentModelPreference;
  gAgentPersona?: GAgentPersona;
  gAgentGoals?: string[];
  gAgentAutoApprove?: boolean; // Auto-approve safe tasks
  gAgentPersistent?: boolean; // Enable 24/7 mode

  /** @deprecated Use gAgentCapabilities instead */
  freeAgentCapabilities?: GAgentCapabilityKey[];
  /** @deprecated Use gAgentExternalAllowlist instead */
  freeAgentExternalAllowlist?: string[];
  /** @deprecated Use gAgentPreferredModelSource instead */
  freeAgentPreferredModelSource?: "cloud" | "ollama" | "auto";
  /** @deprecated Use gAgentOllamaModel instead */
  freeAgentOllamaModel?: string;
  /** @deprecated Use gAgentModelPreference instead */
  freeAgentModelPreference?: GAgentModelPreference;
  /** @deprecated Use gAgentPersona instead */
  freeAgentPersona?: GAgentPersona;
  /** @deprecated Use gAgentGoals instead */
  freeAgentGoals?: string[];
}
