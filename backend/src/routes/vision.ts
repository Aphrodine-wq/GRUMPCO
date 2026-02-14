/**
 * Vision API: POST /api/vision/design-to-code – screenshot/image + description → generated code.
 */

import { Router, type Request, type Response } from 'express';
import { designToCode } from '../services/ai-providers/kimiVisionService.js';
import type { DesignToCodeFramework } from '../services/ai-providers/kimiVisionService.js';
import logger from '../middleware/logger.js';

const router = Router();

/**
 * POST /api/vision/design-to-code
 * Body: { image, figmaUrl?, description, targetFramework, styling?, theme?, outputLang?, layoutPreset?, componentStyle? }
 * Returns: { code: string, explanation?: string }
 */
router.post('/design-to-code', async (req: Request, res: Response) => {
  try {
    const {
      image,
      figmaUrl,
      description,
      targetFramework,
      styling,
      theme,
      outputLang,
      layoutPreset,
      componentStyle,
    } = req.body as {
      image?: string;
      figmaUrl?: string;
      description?: string;
      targetFramework?: string;
      styling?: string;
      theme?: string;
      outputLang?: string;
      layoutPreset?: string;
      componentStyle?: string;
    };
    if (!image && !figmaUrl) {
      return res.status(400).json({ error: 'image (base64) or figmaUrl is required' });
    }
    if (typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({
        error: 'description is required and must be a non-empty string',
      });
    }
    const validFrameworks: DesignToCodeFramework[] = [
      'svelte',
      'react',
      'vue',
      'flutter',
      'angular',
      'nextjs',
      'nuxt',
      'solid',
      'qwik',
    ];
    const framework = (
      validFrameworks.includes(targetFramework as DesignToCodeFramework)
        ? targetFramework
        : 'svelte'
    ) as DesignToCodeFramework;

    const imageData =
      typeof image === 'string' && image.trim().length > 0
        ? image.replace(/^data:image\/\w+;base64,/, '').trim()
        : undefined;
    const input = {
      description: description.trim(),
      targetFramework: framework,
      ...(imageData && { image: imageData }),
      ...(typeof figmaUrl === 'string' && figmaUrl.trim() && { figmaUrl: figmaUrl.trim() }),
      ...(typeof styling === 'string' && styling.trim() && { styling: styling.trim() }),
      ...(typeof theme === 'string' && theme.trim() && { theme: theme.trim() }),
      ...(typeof outputLang === 'string' && outputLang.trim() && { outputLang: outputLang.trim() }),
      ...(typeof layoutPreset === 'string' &&
        layoutPreset.trim() &&
        layoutPreset !== 'none' && { layoutPreset: layoutPreset.trim() }),
      ...(typeof componentStyle === 'string' &&
        componentStyle.trim() && { componentStyle: componentStyle.trim() }),
    };
    const result = await designToCode(
      input as import('../services/ai-providers/kimiVisionService.js').DesignToCodeInput
    );
    return res.json(result);
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'Vision design-to-code error');
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
