/**
 * Models API - returns model registry grouped by provider for UI.
 * Powered by NVIDIA NIM - https://build.nvidia.com/
 */
import { Router } from 'express';
import {
  MODEL_REGISTRY,
  PROVIDER_METADATA,
  getModelsByProvider,
  type LLMProvider,
  type ModelConfig,
} from '@grump/ai-core';

const router = Router();

export interface ModelListGroup {
  provider: LLMProvider;
  displayName: string;
  icon: string;
  models: (ModelConfig & { isRecommended?: boolean })[];
}

// Default to Llama 3.1 70B - the balanced choice for most tasks
const DEFAULT_MODEL_ID = 'meta/llama-3.1-70b-instruct';

/**
 * GET /api/models/list
 * Returns model registry grouped by provider with display metadata.
 */
router.get('/list', (_req, res) => {
  try {
    // NVIDIA NIM is the exclusive provider
    const providerOrder: LLMProvider[] = ['nim', 'mock'];

    const groups: ModelListGroup[] = providerOrder
      .filter((p) => getModelsByProvider(p).length > 0)
      .map((provider) => {
        const metadata = PROVIDER_METADATA[provider] ?? {
          displayName: provider,
          icon: '/icons/providers/default.svg',
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

    res.json({ groups, defaultModelId: DEFAULT_MODEL_ID, poweredBy: 'NVIDIA NIM' });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to list models',
      details: (err as Error).message,
    });
  }
});

/**
 * GET /api/models/registry
 * Returns full flat model registry (legacy).
 */
router.get('/registry', (_req, res) => {
  res.json({ models: MODEL_REGISTRY });
});

export default router;
