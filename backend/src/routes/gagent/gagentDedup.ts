/**
 * G-Agent Dedup Sub-Router
 *
 * Semantic deduplication: deduplicate, batch, expand, patterns, learn, stats,
 * cleanup, export/import.
 *
 * @module routes/gagent/gagentDedup
 */

import { Router, type Request, type Response } from 'express';
import { getSemanticDedup, type PatternType } from '../../gAgent/index.js';
import logger from '../../middleware/logger.js';

const router = Router();

/** POST /dedup/deduplicate — Deduplicate content */
router.post('/dedup/deduplicate', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || 'default';
    const { content, hints } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    const dedup = getSemanticDedup();
    const result = dedup.deduplicate(content, sessionId, hints);

    logger.info(
      {
        sessionId,
        isNew: result.isNew,
        savedTokens: result.savedTokens,
        patternId: result.patternRef?.patternId,
      },
      'Content deduplicated'
    );

    return res.json({
      success: true,
      result: {
        isNew: result.isNew,
        savedTokens: result.savedTokens,
        patternRef: result.patternRef,
        newPatternId: result.newPattern?.id,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Deduplication failed');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /dedup/batch — Batch deduplicate multiple content items */
router.post('/dedup/batch', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || 'default';
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }

    const dedup = getSemanticDedup();
    const results = dedup.deduplicateBatch(items, sessionId);

    const totalSaved = results.reduce((sum, r) => sum + r.savedTokens, 0);
    const newPatterns = results.filter((r) => r.isNew).length;

    logger.info(
      { sessionId, itemCount: items.length, totalSaved, newPatterns },
      'Batch deduplication complete'
    );

    return res.json({
      success: true,
      results: results.map((r) => ({
        isNew: r.isNew,
        savedTokens: r.savedTokens,
        patternId: r.patternRef?.patternId || r.newPattern?.id,
      })),
      summary: {
        totalItems: items.length,
        totalSaved,
        newPatterns,
        existingPatterns: items.length - newPatterns,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Batch deduplication failed');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /dedup/expand — Expand a pattern reference back to full content */
router.post('/dedup/expand', async (req: Request, res: Response) => {
  try {
    const { patternRef } = req.body;

    if (!patternRef || !patternRef.patternId) {
      return res.status(400).json({ error: 'patternRef with patternId is required' });
    }

    const dedup = getSemanticDedup();
    const expanded = dedup.expand(patternRef);

    return res.json({
      success: true,
      expanded,
      patternId: patternRef.patternId,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Pattern expansion failed');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /dedup/pattern/:id — Get a specific pattern */
router.get('/dedup/pattern/:id', async (req: Request, res: Response) => {
  try {
    const patternId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const dedup = getSemanticDedup();
    const pattern = dedup.getPattern(patternId);

    if (!pattern) {
      return res.status(404).json({ error: 'Pattern not found' });
    }

    return res.json({
      success: true,
      pattern: {
        id: pattern.id,
        content: pattern.content,
        meta: pattern.meta,
        stats: {
          useCount: pattern.stats.useCount,
          lastUsed: pattern.stats.lastUsed,
          createdAt: pattern.stats.createdAt,
          sessionCount: pattern.stats.sessions.size,
        },
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get pattern');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /dedup/patterns — List patterns by type or tags */
router.get('/dedup/patterns', async (req: Request, res: Response) => {
  try {
    const { type, tags, limit } = req.query;

    const dedup = getSemanticDedup();
    let patterns;

    if (type) {
      patterns = dedup.findByType(type as PatternType);
    } else if (tags) {
      const tagList = (tags as string).split(',');
      patterns = dedup.findByTags(tagList);
    } else {
      const stats = dedup.getStats();
      return res.json({
        success: true,
        stats,
        message: 'Use type or tags query param to filter patterns',
      });
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 20;
    patterns = patterns.slice(0, limitNum);

    return res.json({
      success: true,
      patterns: patterns.map((p) => ({
        id: p.id,
        abstract: p.content.abstract,
        type: p.meta.type,
        language: p.meta.language,
        useCount: p.stats.useCount,
      })),
      count: patterns.length,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to list patterns');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /dedup/learn — Learn a new pattern from user-provided example */
router.post('/dedup/learn', async (req: Request, res: Response) => {
  try {
    const { example, patternName, meta } = req.body;

    if (!example || typeof example !== 'string') {
      return res.status(400).json({ error: 'example is required' });
    }
    if (!patternName || typeof patternName !== 'string') {
      return res.status(400).json({ error: 'patternName is required' });
    }
    if (!meta?.type) {
      return res.status(400).json({ error: 'meta.type is required' });
    }

    const dedup = getSemanticDedup();
    const pattern = dedup.learnPattern(example, patternName, {
      type: meta.type,
      language: meta.language,
      framework: meta.framework,
      category: meta.category || 'user-defined',
      tags: meta.tags || [],
    });

    logger.info({ patternId: pattern.id, patternName, type: meta.type }, 'New pattern learned');

    return res.json({
      success: true,
      pattern: {
        id: pattern.id,
        content: pattern.content,
        meta: pattern.meta,
        parameters: pattern.content.parameters,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Pattern learning failed');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /dedup/stats — Get deduplication library statistics */
router.get('/dedup/stats', async (_req: Request, res: Response) => {
  try {
    const dedup = getSemanticDedup();
    const stats = dedup.getStats();

    return res.json({
      success: true,
      stats: {
        ...stats,
        estimatedSavingsFormatted:
          stats.estimatedSavings < 1000
            ? `${stats.estimatedSavings} tokens`
            : `${(stats.estimatedSavings / 1000).toFixed(1)}K tokens`,
      },
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get dedup stats');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /dedup/session/:sessionId — Get patterns used in a specific session */
router.get('/dedup/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;

    const dedup = getSemanticDedup();
    const patterns = dedup.getSessionPatterns(sessionId);

    return res.json({
      success: true,
      sessionId,
      patterns: patterns.map((p) => ({
        id: p.id,
        abstract: p.content.abstract,
        type: p.meta.type,
        useCount: p.stats.useCount,
      })),
      count: patterns.length,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get session patterns');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /dedup/cleanup — Cleanup old/unused patterns */
router.post('/dedup/cleanup', async (req: Request, res: Response) => {
  try {
    const { maxAge, minUseCount, keepBuiltin } = req.body;

    const dedup = getSemanticDedup();
    const removed = dedup.cleanup({
      maxAge: maxAge || 30,
      minUseCount: minUseCount || 2,
      keepBuiltin: keepBuiltin !== false,
    });

    logger.info({ removed }, 'Pattern cleanup completed');

    return res.json({
      success: true,
      removed,
      message: `Removed ${removed} unused patterns`,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Pattern cleanup failed');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /dedup/export — Export patterns for persistence */
router.post('/dedup/export', async (_req: Request, res: Response) => {
  try {
    const dedup = getSemanticDedup();
    const data = dedup.export();

    return res.json({
      success: true,
      data,
      size: data.length,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Pattern export failed');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /dedup/import — Import patterns from persistence */
router.post('/dedup/import', async (req: Request, res: Response) => {
  try {
    const { data } = req.body;

    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'data is required' });
    }

    const dedup = getSemanticDedup();
    const imported = dedup.import(data);

    logger.info({ imported }, 'Patterns imported');

    return res.json({
      success: true,
      imported,
      message: `Imported ${imported} patterns`,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Pattern import failed');
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
