/**
 * Zero-Config Service
 * Provides automatic configuration and sensible defaults for new users
 *
 * Features:
 * - Auto-detect API keys from environment
 * - Sensible defaults for all settings
 * - Progressive configuration based on usage
 * - Quick-start templates
 */

import logger from "../middleware/logger.js";
import { getDatabase } from "../db/database.js";
import type {
  Settings,
  UserPreferences,
  ModelsSettings,
} from "../types/settings.js";

// ========== Types ==========

export interface ZeroConfigResult {
  configured: boolean;
  provider: string | null;
  features: string[];
  warnings: string[];
  suggestions: string[];
}

export interface QuickStartTemplate {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  diagramStyle: "minimal" | "detailed" | "comprehensive";
  freeAgentCapabilities: string[];
}

// ========== Auto-Detection ==========

/**
 * Detect available API providers from environment
 * Powered by NVIDIA NIM - https://build.nvidia.com/
 */
export function detectProviders(): {
  provider: string;
  configured: boolean;
  envVar: string;
}[] {
  const providers = [
    { provider: "nim", envVar: "NVIDIA_NIM_API_KEY", name: "NVIDIA NIM" },
  ];

  return providers.map((p) => ({
    provider: p.provider,
    configured: Boolean(process.env[p.envVar]),
    envVar: p.envVar,
  }));
}

/**
 * Get the best available provider
 * Returns NVIDIA NIM with Llama 3.1 70B as the default model
 */
export function getBestProvider(): {
  provider: string;
  modelId: string;
} | null {
  const providers = detectProviders();
  const configured = providers.filter((p) => p.configured);

  if (configured.length === 0) {
    return null;
  }

  // NVIDIA NIM is the only provider - use Llama 3.1 70B as default
  const nimProvider = configured.find((c) => c.provider === "nim");
  if (nimProvider) {
    return {
      provider: "nim",
      modelId: "meta/llama-3.1-70b-instruct",
    };
  }

  return null;
}

/**
 * Detect optional features from environment
 */
export function detectFeatures(): string[] {
  const features: string[] = [];

  // Redis
  if (process.env.REDIS_HOST) {
    features.push("redis_cache");
    features.push("redis_sessions");
  }

  // Database
  if (process.env.DATABASE_URL) {
    features.push("postgres_storage");
  }

  // Supabase
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    features.push("supabase_auth");
    features.push("supabase_storage");
  }

  // NVIDIA advanced
  if (process.env.NVIDIA_RIVA_URL || process.env.NVIDIA_RIVA_API_KEY) {
    features.push("nvidia_riva_speech");
  }
  if (process.env.NVIDIA_NEMO_GUARDRAILS_URL) {
    features.push("nvidia_guardrails");
  }

  // Messaging
  if (process.env.TELEGRAM_BOT_TOKEN) {
    features.push("telegram_bot");
  }
  if (process.env.DISCORD_BOT_TOKEN) {
    features.push("discord_bot");
  }
  if (process.env.TWILIO_ACCOUNT_SID) {
    features.push("twilio_sms");
  }

  // GitHub
  if (process.env.GITHUB_TOKEN) {
    features.push("github_integration");
  }

  return features;
}

// ========== Zero-Config Setup ==========

/**
 * Perform zero-config setup for a new user
 */
export async function performZeroConfig(
  userId: string,
): Promise<ZeroConfigResult> {
  const _providers = detectProviders();
  const features = detectFeatures();
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Find best provider
  const bestProvider = getBestProvider();

  if (!bestProvider) {
    warnings.push(
      "No API provider configured. Add NVIDIA_NIM_API_KEY or another provider key to enable AI features.",
    );
    suggestions.push("Get a free NVIDIA NIM API key at build.nvidia.com");
  }

  // Check for recommended features
  if (!features.includes("redis_cache")) {
    suggestions.push("Add Redis for improved caching and session persistence");
  }

  // Create default settings
  const defaultSettings = getDefaultSettings(bestProvider);

  try {
    const db = getDatabase();
    const existing = await db.getSettings(userId);

    if (!existing) {
      // First-time user, apply defaults
      await db.saveSettings(userId, defaultSettings);
      logger.info({ userId }, "Zero-config settings applied");
    }
  } catch (err) {
    logger.error({ err, userId }, "Failed to apply zero-config settings");
  }

  return {
    configured: bestProvider !== null,
    provider: bestProvider?.provider || null,
    features,
    warnings,
    suggestions,
  };
}

/**
 * Get default settings for a provider
 */
function getDefaultSettings(
  provider: { provider: string; modelId: string } | null,
): Settings {
  const modelSettings: ModelsSettings = provider
    ? {
        defaultProvider: provider.provider as "nim",
        defaultModelId: provider.modelId,
        modelPreset: "balanced",
      }
    : {
        modelPreset: "balanced",
      };

  const defaultPreferences: UserPreferences = {
    diagramStyle: "detailed",
    primaryTechStack: ["React", "Node.js", "PostgreSQL"],
    theme: "auto",
    analyticsOptIn: true,
    setupComplete: false,
    density: "comfortable",
    freeAgentCapabilities: [
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
    freeAgentExternalAllowlist: [],
  };

  return {
    models: modelSettings,
    preferences: defaultPreferences,
    guardRails: {
      confirmEveryWrite: true,
      autonomousMode: false,
      useLargeContext: false,
    },
    updatedAt: new Date().toISOString(),
  };
}

// ========== Quick-Start Templates ==========

export const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    id: "fullstack-react",
    name: "Full-Stack React App",
    description: "React + Node.js + PostgreSQL with authentication and API",
    techStack: ["React", "Node.js", "PostgreSQL", "Docker"],
    diagramStyle: "detailed",
    freeAgentCapabilities: ["file", "git", "bash", "npm", "docker"],
  },
  {
    id: "python-api",
    name: "Python API Service",
    description: "FastAPI + SQLAlchemy + Redis for a scalable API",
    techStack: ["Python", "PostgreSQL", "Redis", "Docker"],
    diagramStyle: "detailed",
    freeAgentCapabilities: ["file", "git", "bash", "docker"],
  },
  {
    id: "static-site",
    name: "Static Website",
    description: "Simple static site with modern tooling",
    techStack: ["Svelte", "Vercel"],
    diagramStyle: "minimal",
    freeAgentCapabilities: ["file", "git", "npm"],
  },
  {
    id: "microservices",
    name: "Microservices Architecture",
    description: "Kubernetes-ready microservices with observability",
    techStack: ["Go", "PostgreSQL", "Redis", "Docker", "AWS"],
    diagramStyle: "comprehensive",
    freeAgentCapabilities: [
      "file",
      "git",
      "bash",
      "docker",
      "cloud",
      "monitoring",
    ],
  },
  {
    id: "mobile-backend",
    name: "Mobile App Backend",
    description: "Backend for iOS/Android apps with push notifications",
    techStack: ["Node.js", "PostgreSQL", "Redis", "GCP"],
    diagramStyle: "detailed",
    freeAgentCapabilities: ["file", "git", "bash", "npm", "docker", "api_call"],
  },
  {
    id: "ai-agent",
    name: "AI Agent Project",
    description: "LLM-powered agent with tool use and memory",
    techStack: ["Python", "Redis", "Docker"],
    diagramStyle: "comprehensive",
    freeAgentCapabilities: [
      "file",
      "git",
      "bash",
      "docker",
      "api_call",
      "webhooks",
      "heartbeats",
    ],
  },
];

/**
 * Apply a quick-start template to user settings
 */
export async function applyQuickStartTemplate(
  userId: string,
  templateId: string,
): Promise<boolean> {
  const template = QUICK_START_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    logger.warn({ userId, templateId }, "Template not found");
    return false;
  }

  try {
    const db = getDatabase();
    const settings = (await db.getSettings(userId)) || {};

    settings.preferences = {
      ...settings.preferences,
      diagramStyle: template.diagramStyle,
      primaryTechStack: template.techStack,
      freeAgentCapabilities:
        template.freeAgentCapabilities as UserPreferences["freeAgentCapabilities"],
      theme: (settings.preferences?.theme ?? "auto") as
        | "auto"
        | "light"
        | "dark",
      analyticsOptIn: settings.preferences?.analyticsOptIn ?? false,
      setupComplete: settings.preferences?.setupComplete ?? false,
    };
    settings.updatedAt = new Date().toISOString();

    await db.saveSettings(userId, settings);
    logger.info({ userId, templateId }, "Quick-start template applied");

    return true;
  } catch (err) {
    logger.error({ err, userId, templateId }, "Failed to apply template");
    return false;
  }
}

// ========== Progressive Disclosure ==========

export interface ProgressiveConfig {
  /** Show basic features only */
  basicMode: boolean;
  /** Features that are hidden until unlocked */
  hiddenFeatures: string[];
  /** Features that are shown but disabled with upgrade prompt */
  premiumFeatures: string[];
  /** User's current experience level */
  experienceLevel: "beginner" | "intermediate" | "advanced";
}

/**
 * Get progressive disclosure config for a user
 */
export async function getProgressiveConfig(
  userId: string,
): Promise<ProgressiveConfig> {
  try {
    const db = getDatabase();
    const settings = await db.getSettings(userId);
    const tier = settings?.tier || "free";

    // Determine experience level based on usage patterns
    // This would ideally be based on actual usage metrics
    const experienceLevel = settings?.preferences?.setupComplete
      ? "intermediate"
      : "beginner";

    // Features hidden for beginners
    const beginnerHidden = [
      "agent_swarm",
      "multi_platform_msg",
      "cicd",
      "cloud",
    ];

    // Premium features (shown but gated)
    const premiumFeatures =
      tier === "free" ? ["cloud", "cicd", "large_swarm"] : [];

    return {
      basicMode: experienceLevel === "beginner",
      hiddenFeatures: experienceLevel === "beginner" ? beginnerHidden : [],
      premiumFeatures,
      experienceLevel,
    };
  } catch (err) {
    logger.error({ err, userId }, "Failed to get progressive config");
    return {
      basicMode: true,
      hiddenFeatures: [],
      premiumFeatures: [],
      experienceLevel: "beginner",
    };
  }
}

/**
 * Update user's experience level
 */
export async function updateExperienceLevel(
  userId: string,
  level: "beginner" | "intermediate" | "advanced",
): Promise<void> {
  // This would store in a user_metadata table or similar
  logger.info({ userId, level }, "Experience level updated");
}

// ========== Health Check ==========

/**
 * Get zero-config health status
 */
export async function getZeroConfigHealth(): Promise<{
  providersConfigured: number;
  bestProvider: string | null;
  featuresAvailable: string[];
}> {
  const providers = detectProviders();
  const configured = providers.filter((p) => p.configured);
  const best = getBestProvider();
  const features = detectFeatures();

  return {
    providersConfigured: configured.length,
    bestProvider: best?.provider || null,
    featuresAvailable: features,
  };
}
