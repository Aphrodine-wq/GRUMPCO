/**
 * Models API - returns model registry grouped by provider for UI.
 * Powered by NVIDIA NIM - https://build.nvidia.com/
 * Also supports dynamic Ollama model detection when configured.
 */
import { Router } from "express";
import {
  MODEL_REGISTRY,
  PROVIDER_METADATA,
  getModelsByProvider,
  type LLMProvider,
  type ModelConfig,
} from "@grump/ai-core";
import { env } from "../config/env.js";

const router = Router();

export interface ModelListGroup {
  provider: string;
  displayName: string;
  icon: string;
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
 * GET /api/models/list
 * Returns model registry grouped by provider with display metadata.
 * Dynamically includes Ollama models when detected.
 */
router.get("/list", async (_req, res) => {
  try {
    // NVIDIA NIM is the primary provider
    const providerOrder: LLMProvider[] = ["nim", "mock"];

    const groups: ModelListGroup[] = providerOrder
      .filter((p) => getModelsByProvider(p).length > 0)
      .map((provider) => {
        const metadata = PROVIDER_METADATA[provider] ?? {
          displayName: provider,
          icon: "/icons/providers/default.svg",
        };
        const models = getModelsByProvider(provider).map((m) => ({
          ...m,
          isRecommended: m.id === DEFAULT_MODEL_ID,
        }));
        return {
          provider,
          displayName: metadata.displayName,
          icon: metadata.icon,
          models,
        };
      });

    // Dynamically add Ollama models if configured
    const ollamaModels = await getOllamaModels();
    if (ollamaModels.length > 0) {
      groups.push({
        provider: "ollama",
        displayName: "Ollama (Local)",
        icon: "/icons/providers/ollama.svg",
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

    res.json({
      groups,
      defaultModelId: DEFAULT_MODEL_ID,
      poweredBy: "NVIDIA NIM",
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
