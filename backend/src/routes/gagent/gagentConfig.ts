/**
 * G-Agent Config Sub-Router
 *
 * Configuration management, feature flags, presets, and autonomy levels.
 *
 * @module routes/gagent/gagentConfig
 */

import { Router, type Request, type Response } from 'express';
import {
  configManager,
  FEATURES,
  CONFIG_PRESETS,
  type Feature,
  type ConfigPreset,
  type BudgetConfig,
} from '../../gAgent/index.js';
import logger from '../../middleware/logger.js';

const router = Router();

/** GET /config — Get current G-Agent configuration */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = configManager.getConfig();
    return res.json({ config });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get config');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** PUT /config/budget — Update budget configuration */
router.put('/config/budget', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || 'default';
    const updates: Partial<BudgetConfig> = req.body;

    configManager.updateBudget(updates, userId);
    const config = configManager.getConfig();

    logger.info({ userId }, 'Budget config updated via API');

    return res.json({ config: config.budget });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to update budget config');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** PUT /config/autonomy — Update autonomy level */
router.put('/config/autonomy', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || 'default';
    const { level } = req.body;

    const validLevels = ['supervised', 'semi-autonomous', 'autonomous', 'fully-autonomous'];
    if (!level || !validLevels.includes(level)) {
      return res.status(400).json({
        error: 'Invalid autonomy level. Available: ' + validLevels.join(', '),
      });
    }

    configManager.setAutonomyLevel(level, userId);
    const config = configManager.getConfig();

    logger.info({ userId, level }, 'Autonomy level updated via API');

    return res.json({
      autonomyLevel: config.autonomyLevel,
      autonomyConfig: config.autonomyConfig,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to update autonomy level');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /config/preset — Apply a configuration preset */
router.post('/config/preset', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || 'default';
    const { preset } = req.body;

    const validPresets = Object.keys(CONFIG_PRESETS);
    if (!preset || !validPresets.includes(preset)) {
      return res.status(400).json({
        error: 'Invalid preset. Available: ' + validPresets.join(', '),
      });
    }

    configManager.applyPreset(preset as ConfigPreset, userId);
    const config = configManager.getConfig();

    logger.info({ userId, preset }, 'Config preset applied via API');

    return res.json({ config, preset });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to apply preset');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /config/presets — Get available configuration presets */
router.get('/config/presets', async (_req: Request, res: Response) => {
  try {
    const presets = Object.entries(CONFIG_PRESETS).map(([key, value]) => ({
      id: key,
      autonomyLevel: value.autonomyLevel,
    }));

    return res.json({ presets });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get presets');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /config/features — Get feature flags status */
router.get('/config/features', async (_req: Request, res: Response) => {
  try {
    const config = configManager.getConfig();

    const features = Object.entries(FEATURES).map(([key, featureId]) => ({
      id: featureId,
      name: key,
      enabled: config.features[featureId as Feature] ?? false,
    }));

    return res.json({ features });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get features');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** PUT /config/feature/:id — Toggle a feature flag */
router.put('/config/feature/:id', async (req: Request, res: Response) => {
  try {
    const featureId = req.params.id as Feature;
    const { enabled } = req.body;
    const userId = (req as Request & { userId?: string }).userId || 'default';

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const validFeatures = Object.values(FEATURES);
    if (!validFeatures.includes(featureId)) {
      return res.status(400).json({
        error: 'Invalid feature. Available: ' + validFeatures.join(', '),
      });
    }

    configManager.setFeature(featureId, enabled, userId);
    const config = configManager.getConfig();

    logger.info({ userId, featureId, enabled }, 'Feature flag toggled via API');

    return res.json({
      feature: featureId,
      enabled: config.features[featureId],
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to toggle feature');
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
