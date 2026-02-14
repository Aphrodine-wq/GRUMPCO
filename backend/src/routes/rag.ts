/**
 * RAG API: POST /api/rag/query, POST /api/rag/reindex.
 */

import { createHash } from 'crypto';
import { Router, type Request, type Response } from 'express';
import { ragQuery, runIndexer } from '../services/rag/ragService.js';
import { getTieredCache } from '../services/caching/tieredCache.js';
import logger from '../middleware/logger.js';
import { timingSafeEqualString } from '../utils/security.js';

const router = Router();
const RAG_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_QUERY_LENGTH = 4000;
const MAX_SCHEMA_LENGTH = 4000;
const ALLOWED_TYPES = ['doc', 'code', 'spec'] as const;

function getRagCacheKey(
  query: string,
  options: {
    outputFormat?: string;
    structuredSchema?: string;
    types?: unknown;
    hybrid?: boolean;
    namespace?: string;
    intentGuided?: boolean;
  }
): string {
  const payload = JSON.stringify({
    query: query.trim(),
    outputFormat: options.outputFormat ?? 'natural',
    structuredSchema: options.structuredSchema ?? '',
    types: options.types ?? [],
    hybrid: options.hybrid ?? false,
    namespace: options.namespace ?? '',
    intentGuided: options.intentGuided ?? false,
  });
  return createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

/**
 * POST /api/rag/query
 * Body: { query: string, outputFormat?, structuredSchema?, types?, hybrid?, namespace?, intentGuided? }
 * Returns: { answer, sources?, confidence?, fallback?, citations?, structured?, fromCache?: boolean }
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, outputFormat, structuredSchema, types, hybrid, namespace, intentGuided } =
      req.body as {
        query?: string;
        outputFormat?: 'natural' | 'structured';
        structuredSchema?: string;
        types?: 'doc' | 'code' | 'spec' | ('doc' | 'code' | 'spec')[];
        hybrid?: boolean;
        namespace?: string;
        intentGuided?: boolean;
      };
    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'query is required and must be a non-empty string' });
    }
    const trimmedQuery = query.trim();
    if (trimmedQuery.length > MAX_QUERY_LENGTH) {
      return res.status(413).json({ error: `query exceeds ${MAX_QUERY_LENGTH} characters` });
    }
    if (
      structuredSchema &&
      typeof structuredSchema === 'string' &&
      structuredSchema.length > MAX_SCHEMA_LENGTH
    ) {
      return res.status(413).json({
        error: `structuredSchema exceeds ${MAX_SCHEMA_LENGTH} characters`,
      });
    }
    if (types !== undefined) {
      const arr = Array.isArray(types) ? types : [types];
      const invalid = arr.some((t) => !ALLOWED_TYPES.includes(t as (typeof ALLOWED_TYPES)[number]));
      if (invalid) {
        return res.status(400).json({ error: 'types must be one of doc|code|spec' });
      }
    }
    const opts = {
      ...(outputFormat && { outputFormat }),
      ...(structuredSchema && typeof structuredSchema === 'string' && { structuredSchema }),
      ...(types !== undefined && { types }),
      ...(hybrid === true && { hybrid: true }),
      ...(typeof namespace === 'string' && namespace.trim() && { namespace: namespace.trim() }),
      ...(intentGuided === true && { intentGuided: true }),
    };
    const key = getRagCacheKey(trimmedQuery, opts);
    const cache = getTieredCache();
    const cached = await cache.get<Awaited<ReturnType<typeof ragQuery>>>('rag:query', key);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }
    const result = await ragQuery(trimmedQuery, opts);
    await cache.set('rag:query', key, result, RAG_CACHE_TTL_MS);
    return res.json({ ...result, fromCache: false });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'RAG query error');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/rag/reindex
 * Body: { docs?: Array<{ content, source, type }>, namespace?: string }
 * If docs omitted, reindex does nothing (use indexer script for full reindex).
 * Optional: X-Reindex-Secret or Authorization header for REINDEX_SECRET.
 */
router.post('/reindex', async (req: Request, res: Response) => {
  const secret = process.env.REINDEX_SECRET;
  if (secret) {
    const h =
      req.headers['x-reindex-secret'] ?? req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const provided = typeof h === 'string' ? h : '';
    if (!timingSafeEqualString(provided, secret)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const { docs, namespace } = req.body as {
      docs?: Array<{
        content: string;
        source: string;
        type: 'doc' | 'code' | 'spec';
      }>;
      namespace?: string;
    };
    if (!Array.isArray(docs) || docs.length === 0) {
      return res.status(400).json({
        error:
          'docs array is required and must not be empty. Use the indexer script (npm run rag:index) for full reindex.',
      });
    }
    const result = await runIndexer(
      docs,
      typeof namespace === 'string' && namespace.trim()
        ? { namespace: namespace.trim() }
        : undefined
    );
    return res.json(result);
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'RAG reindex error');
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
