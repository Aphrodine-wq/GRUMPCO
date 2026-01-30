/**
 * RAG API: POST /api/rag/query, POST /api/rag/reindex.
 */

import { createHash } from 'crypto';
import { Router, Request, Response } from 'express';
import { ragQuery, runIndexer } from '../services/ragService.js';
import { getTieredCache } from '../services/tieredCache.js';
import logger from '../middleware/logger.js';

const router = Router();
const RAG_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getRagCacheKey(
  query: string,
  options: { outputFormat?: string; structuredSchema?: string; types?: unknown; hybrid?: boolean }
): string {
  const payload = JSON.stringify({
    query: query.trim(),
    outputFormat: options.outputFormat ?? 'natural',
    structuredSchema: options.structuredSchema ?? '',
    types: options.types ?? [],
    hybrid: options.hybrid ?? false,
  });
  return createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

/**
 * POST /api/rag/query
 * Body: { query: string, outputFormat?: 'natural' | 'structured', structuredSchema?: string, types?: DocType | DocType[], hybrid?: boolean }
 * Returns: { answer, sources?, confidence?, fallback?, citations?, structured?, fromCache?: boolean }
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, outputFormat, structuredSchema, types, hybrid } = req.body as {
      query?: string;
      outputFormat?: 'natural' | 'structured';
      structuredSchema?: string;
      types?: 'doc' | 'code' | 'spec' | ('doc' | 'code' | 'spec')[];
      hybrid?: boolean;
    };
    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'query is required and must be a non-empty string' });
    }
    const opts = {
      ...(outputFormat && { outputFormat }),
      ...(structuredSchema && typeof structuredSchema === 'string' && { structuredSchema }),
      ...(types !== undefined && { types }),
      ...(hybrid === true && { hybrid: true }),
    };
    const key = getRagCacheKey(query.trim(), opts);
    const cache = getTieredCache();
    const cached = await cache.get<Awaited<ReturnType<typeof ragQuery>>>('rag:query', key);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }
    const result = await ragQuery(query.trim(), opts);
    await cache.set('rag:query', key, result, RAG_CACHE_TTL_MS);
    return res.json({ ...result, fromCache: false });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'RAG query error');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/rag/reindex
 * Body: { docs?: Array<{ content: string, source: string, type: 'doc'|'code'|'spec' }> }
 * If docs omitted, reindex does nothing (use indexer script for full reindex).
 * Optional: X-Reindex-Secret or Authorization header for REINDEX_SECRET.
 */
router.post('/reindex', async (req: Request, res: Response) => {
  const secret = process.env.REINDEX_SECRET;
  if (secret) {
    const h = req.headers['x-reindex-secret'] ?? req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (h !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const { docs } = req.body as { docs?: Array<{ content: string; source: string; type: 'doc' | 'code' | 'spec' }> };
    if (!Array.isArray(docs) || docs.length === 0) {
      return res.status(400).json({
        error: 'docs array is required and must not be empty. Use the indexer script (npm run rag:index) for full reindex.',
      });
    }
    const result = await runIndexer(docs);
    return res.json(result);
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'RAG reindex error');
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
