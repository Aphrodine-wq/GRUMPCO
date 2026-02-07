/**
 * Models API - returns model registry grouped by provider for UI.
 * Powered by NVIDIA NIM - https://build.nvidia.com/
 * Also supports dynamic Ollama and Jan model detection when configured.
 * Shows all providers with `configured` flag for API key gating in the frontend.
 */
import { Router } from "express";
import {
  MODEL_REGISTRY,
  PROVIDER_METADATA,
  getModelsByProvider,
  type LLMProvider,
  type ModelConfig,
} from "@grump/ai-core";
import { env, isProviderConfigured, getConfiguredProviders } from "../config/env.js";

const router = Router();

export interface ModelListGroup {
  provider: string;
  displayName: string;
  icon: string;
  configured: boolean;
  configNote?: string;
  models: (Partial<ModelConfig> & { id: string; isRecommended?: boolean })[];
}

// Default to Llama 3.1 70B - the balanced choice for most tasks
const DEFAULT_MODEL_ID = "meta/llama-3.1-70b-instruct";

/**
 * Fetch available Ollama models from local instance
 * Tries configured URL, falls back to default localhost:11434
 */
async function getOllamaModels(): Promise<{ id: string; description?: string }[]> {
  // Try configured URL first, then default localhost
  const urlsToTry = [
    env.OLLAMA_BASE_URL,
    process.env.OLLAMA_HOST,
    "http://localhost:11434", // Default Ollama port
  ].filter(Boolean) as string[];

  for (const host of urlsToTry) {
    try {
      const baseUrl = host.startsWith("http") ? host : `http://${host}`;
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) continue;

      const data = (await res.json()) as { models?: Array<{ name: string; size?: number; modified_at?: string }> };
      if (data.models && data.models.length > 0) {
        return data.models.map((m) => ({
          id: m.name,
          description: `Local Ollama model`,
        }));
      }
    } catch {
      // Try next URL
      continue;
    }
  }

  return [];
}

/**
 * Fetch available Jan models from local instance
 * Jan uses OpenAI-compatible /v1/models endpoint
 * Tries configured URL, falls back to default localhost:1337
 */
async function getJanModels(): Promise<{ id: string; description?: string }[]> {
  const urlsToTry = [
    env.JAN_BASE_URL,
    process.env.JAN_BASE_URL,
    "http://localhost:1337", // Default Jan port
  ].filter(Boolean) as string[];

  for (const host of urlsToTry) {
    try {
      const baseUrl = host.startsWith("http") ? host : `http://${host}`;
      const res = await fetch(`${baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) continue;

      const data = (await res.json()) as {
        data?: Array<{ id: string; object?: string; owned_by?: string }>;
      };
      if (data.data && data.data.length > 0) {
        return data.data.map((m) => ({
          id: m.id,
          description: `Local Jan model${m.owned_by ? ` (${m.owned_by})` : ""}`,
        }));
      }
    } catch {
      continue;
    }
  }

  return [];
}

/**
 * All providers and their display metadata + config requirements.
 * G-CompN1 is always configured (uses backend API keys).
 */
const ALL_PROVIDERS: Array<{
  id: string;
  displayName: string;
  icon: string;
  configNote?: string;
  isAlwaysConfigured?: boolean;
  isLocal?: boolean;
  models: Array<{
    id: string;
    description?: string;
    contextWindow?: number;
    costPerMillionInput?: number;
    costPerMillionOutput?: number;
    capabilities?: readonly string[];
    isRecommended?: boolean;
  }>;
}> = [
    {
      id: "grump",
      displayName: "G-CompN1 Model Mix",
      icon: "/icons/providers/grump.svg",
      isAlwaysConfigured: true,
      configNote: "Preconfigured — uses platform API keys",
      models: [
        {
          id: "g-compn1-auto",
          description: "Smart routing: Opus 4.6 + Kimi K2.5 + Gemini 3 Pro",
          contextWindow: 200_000,
          costPerMillionInput: 0,
          costPerMillionOutput: 0,
          capabilities: ["code", "reasoning", "vision", "creative"],
          isRecommended: true,
        },
        {
          id: "g-compn1-quality",
          description: "Routes to Anthropic Opus 4.6 for maximum quality",
          contextWindow: 200_000,
          costPerMillionInput: 15,
          costPerMillionOutput: 75,
          capabilities: ["code", "reasoning", "vision", "creative"],
        },
        {
          id: "g-compn1-fast",
          description: "Routes to Kimi K2.5 for speed & cost efficiency",
          contextWindow: 128_000,
          costPerMillionInput: 0.6,
          costPerMillionOutput: 0.6,
          capabilities: ["code", "reasoning"],
        },
        {
          id: "g-compn1-balanced",
          description: "Routes to Gemini 3 Pro for balanced workloads",
          contextWindow: 1_000_000,
          costPerMillionInput: 1.25,
          costPerMillionOutput: 5.0,
          capabilities: ["code", "reasoning", "vision"],
        },
      ],
    },
    {
      id: "anthropic",
      displayName: "Anthropic",
      icon: "/icons/providers/anthropic.svg",
      configNote: "Requires ANTHROPIC_API_KEY",
      models: [
        { id: "claude-opus-4-20250514", description: "Claude Opus 4.6 — most capable", contextWindow: 200_000, costPerMillionInput: 15, costPerMillionOutput: 75, capabilities: ["code", "reasoning", "vision", "creative"] },
        { id: "claude-sonnet-4-20250514", description: "Claude Sonnet 4 — fast & capable", contextWindow: 200_000, costPerMillionInput: 3, costPerMillionOutput: 15, capabilities: ["code", "reasoning", "vision"] },
      ],
    },
    {
      id: "google",
      displayName: "Google Gemini",
      icon: "/icons/providers/google.svg",
      configNote: "Requires GOOGLE_AI_API_KEY",
      models: [
        { id: "gemini-3-pro", description: "Gemini 3 Pro — latest, balanced", contextWindow: 1_000_000, costPerMillionInput: 1.25, costPerMillionOutput: 5.0, capabilities: ["code", "reasoning", "vision"] },
        { id: "gemini-2.5-pro", description: "Gemini 2.5 Pro — thinking model", contextWindow: 1_000_000, costPerMillionInput: 1.25, costPerMillionOutput: 10.0, capabilities: ["code", "reasoning", "vision"] },
        { id: "gemini-2.0-flash", description: "Gemini 2.0 Flash — fast & free", contextWindow: 1_000_000, costPerMillionInput: 0, costPerMillionOutput: 0, capabilities: ["code", "reasoning"] },
      ],
    },
    {
      id: "kimi",
      displayName: "Kimi (Moonshot)",
      icon: "/icons/providers/kimi.svg",
      configNote: "Requires KIMI_API_KEY",
      models: [
        { id: "kimi-k2.5", description: "Kimi K2.5 — fast coding model", contextWindow: 128_000, costPerMillionInput: 0.6, costPerMillionOutput: 0.6, capabilities: ["code", "reasoning"] },
      ],
    },
    {
      id: "groq",
      displayName: "Groq",
      icon: "/icons/providers/groq.svg",
      configNote: "Requires GROQ_API_KEY",
      models: [
        { id: "llama-3.3-70b-versatile", description: "Llama 3.3 70B on Groq (fast)", contextWindow: 128_000, costPerMillionInput: 0.59, costPerMillionOutput: 0.79, capabilities: ["code", "reasoning"] },
        { id: "mixtral-8x7b-32768", description: "Mixtral 8x7B (32K context)", contextWindow: 32_768, costPerMillionInput: 0.24, costPerMillionOutput: 0.24, capabilities: ["code", "reasoning"] },
      ],
    },
    {
      id: "openrouter",
      displayName: "OpenRouter",
      icon: "/icons/providers/openrouter.svg",
      configNote: "Requires OPENROUTER_API_KEY",
      models: [
        { id: "openrouter/auto", description: "Auto-route to best model", contextWindow: 128_000, capabilities: ["code", "reasoning"] },
      ],
    },
    {
      id: "mistral",
      displayName: "Mistral",
      icon: "/icons/providers/mistral.svg",
      configNote: "Requires MISTRAL_API_KEY",
      models: [
        { id: "mistral-large-latest", description: "Mistral Large", contextWindow: 128_000, costPerMillionInput: 2, costPerMillionOutput: 6, capabilities: ["code", "reasoning"] },
      ],
    },
  ];

/**
 * GET /api/models/list
 * Returns model registry grouped by provider with display metadata.
 * Dynamically includes Ollama and Jan models when detected.
 * All providers are listed with `configured` flag for frontend gating.
 */
router.get("/list", async (_req, res) => {
  try {
    // Build groups from ALL_PROVIDERS with configured status
    const configuredSet = new Set<string>(getConfiguredProviders());
    const groups: ModelListGroup[] = [];

    // 1. Start with NIM (primary provider from ai-core registry)
    const nimModels = getModelsByProvider("nim");
    if (nimModels.length > 0) {
      const nimMeta = PROVIDER_METADATA["nim"] ?? { displayName: "NVIDIA NIM", icon: "/icons/providers/nvidia.svg" };
      groups.push({
        provider: "nim",
        displayName: nimMeta.displayName,
        icon: nimMeta.icon,
        configured: isProviderConfigured("nvidia_nim"),
        configNote: "Requires NVIDIA_NIM_API_KEY",
        models: nimModels.map((m) => ({
          ...m,
          isRecommended: m.id === DEFAULT_MODEL_ID,
        })),
      });
    }

    // 2. Add all static providers (G-CompN1, Anthropic, Google, Kimi, Groq, etc.)
    for (const provider of ALL_PROVIDERS) {
      // Map display provider IDs to ApiProvider names for config check
      const providerToApiProvider: Record<string, string> = {
        anthropic: 'anthropic', google: 'google', kimi: 'kimi',
        groq: 'groq', openrouter: 'openrouter', mistral: 'mistral',
      };
      const apiProviderKey = providerToApiProvider[provider.id];
      const isConfigured = provider.isAlwaysConfigured || (apiProviderKey ? configuredSet.has(apiProviderKey) : false);
      groups.push({
        provider: provider.id,
        displayName: provider.displayName,
        icon: provider.icon,
        configured: isConfigured,
        configNote: isConfigured ? undefined : provider.configNote,
        models: provider.models.map((m) => ({
          id: m.id,
          provider: provider.id as LLMProvider,
          capabilities: (m.capabilities ?? ["code", "reasoning"]) as ModelConfig["capabilities"],
          contextWindow: m.contextWindow ?? 128_000,
          costPerMillionInput: m.costPerMillionInput ?? 0,
          costPerMillionOutput: m.costPerMillionOutput ?? 0,
          description: m.description,
          isRecommended: m.isRecommended ?? false,
        })),
      });
    }

    // 3. Dynamically add Ollama models if detected
    const ollamaModels = await getOllamaModels();
    if (ollamaModels.length > 0) {
      groups.push({
        provider: "ollama",
        displayName: "Ollama (Local)",
        icon: "/icons/providers/ollama.svg",
        configured: true,
        models: ollamaModels.map((m) => ({
          id: m.id,
          provider: "ollama" as LLMProvider,
          capabilities: ["code", "reasoning"] as const,
          contextWindow: 128_000,
          costPerMillionInput: 0,
          costPerMillionOutput: 0,
          description: m.description,
          isRecommended: false,
        })),
      });
    }

    // 4. Dynamically add Jan models if detected
    const janModels = await getJanModels();
    if (janModels.length > 0) {
      groups.push({
        provider: "jan",
        displayName: "Jan (Local)",
        icon: "/icons/providers/jan.svg",
        configured: true,
        models: janModels.map((m) => ({
          id: m.id,
          provider: "jan" as LLMProvider,
          capabilities: ["code", "reasoning"] as const,
          contextWindow: 128_000,
          costPerMillionInput: 0,
          costPerMillionOutput: 0,
          description: m.description,
          isRecommended: false,
        })),
      });
    } else {
      // Show Jan as unconfigured if not detected
      groups.push({
        provider: "jan",
        displayName: "Jan (Local)",
        icon: "/icons/providers/jan.svg",
        configured: false,
        configNote: "Start Jan app to auto-detect models",
        models: [
          {
            id: "jan-local",
            provider: "jan" as LLMProvider,
            capabilities: ["code", "reasoning"] as const,
            contextWindow: 128_000,
            costPerMillionInput: 0,
            costPerMillionOutput: 0,
            description: "Local Jan models (auto-detected)",
            isRecommended: false,
          },
        ],
      });
    }

    // Sort: G-CompN1 first, then configured providers, then unconfigured
    groups.sort((a, b) => {
      if (a.provider === "grump") return -1;
      if (b.provider === "grump") return 1;
      if (a.configured && !b.configured) return -1;
      if (!a.configured && b.configured) return 1;
      return 0;
    });

    res.json({
      groups,
      defaultModelId: "grump:g-compn1-auto",
      poweredBy: "G-CompN1 Model Mix",
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to list models",
      details: (err as Error).message,
    });
  }
});

/**
 * GET /api/models/registry
 * Returns full flat model registry (legacy).
 */
router.get("/registry", (_req, res) => {
  res.json({ models: MODEL_REGISTRY });
});

export default router;
