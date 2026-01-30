/**
 * Memory API: POST /api/memory/recall, POST /api/memory/remember, POST /api/memory/feedback.
 */

import { Router, Request, Response } from 'express';
import { recall, remember, learnFromFeedback } from '../services/memoryService.js';
import logger from '../middleware/logger.js';

const router = Router();

/**
 * POST /api/memory/recall
 * Body: { userId: string, query: string }
 * Returns: { memories: MemoryRecord[] }
 */
router.post('/recall', async (req: Request, res: Response) => {
  try {
    const { userId, query } = req.body as { userId?: string; query?: string };
    if (typeof userId !== 'string' || !userId.trim() || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'userId and query are required non-empty strings' });
    }
    const memories = await recall(userId.trim(), query.trim());
    return res.json({ memories });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'Memory recall error');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/memory/remember
 * Body: { userId: string, type: 'interaction' | 'correction' | 'preference', content: string, summary?: string, metadata?: object }
 */
router.post('/remember', async (req: Request, res: Response) => {
  try {
    const { userId, type, content, summary, metadata } = req.body as {
      userId?: string;
      type?: 'interaction' | 'correction' | 'preference';
      content?: string;
      summary?: string;
      metadata?: Record<string, unknown>;
    };
    if (typeof userId !== 'string' || !userId.trim() || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'userId and content are required non-empty strings' });
    }
    const validType = type === 'correction' || type === 'preference' ? type : 'interaction';
    await remember({ userId: userId.trim(), type: validType, content: content.trim(), summary, metadata });
    return res.status(201).json({ ok: true });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'Memory remember error');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/memory/feedback
 * Body: { userId: string, originalResponse: string, correctedResponse: string, context?: string }
 * Learn from user correction.
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { userId, originalResponse, correctedResponse, context } = req.body as {
      userId?: string;
      originalResponse?: string;
      correctedResponse?: string;
      context?: string;
    };
    if (
      typeof userId !== 'string' ||
      !userId.trim() ||
      typeof originalResponse !== 'string' ||
      typeof correctedResponse !== 'string'
    ) {
      return res.status(400).json({ error: 'userId, originalResponse, and correctedResponse are required' });
    }
    await learnFromFeedback({
      userId: userId.trim(),
      originalResponse,
      correctedResponse,
      context,
    });
    return res.status(201).json({ ok: true });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'Memory feedback error');
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
