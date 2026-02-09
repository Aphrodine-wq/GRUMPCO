/**
 * RAG Prefetch Cache - In-memory L1 cache for prefetched RAG context.
 * Separated to avoid circular dependency with ragService.
 */

export interface CachedRagContext {
  context: string;
  sources?: Array<{ source: string; type: string }>;
}

const prefetchCache = new Map<
  string,
  { result: CachedRagContext; expiresAt: number }
>();
const CACHE_TTL_MS = 60_000;

export function cacheKey(
  query: string,
  options?: { types?: string[]; namespace?: string },
): string {
  const opts = options ? JSON.stringify(options) : "";
  return `${query.trim().toLowerCase()}|${opts}`;
}

export function getFromPrefetchCache(
  query: string,
  options?: { types?: string[]; namespace?: string },
): CachedRagContext | null {
  const key = cacheKey(query, options);
  const cached = prefetchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (cached) prefetchCache.delete(key);
  return null;
}

export function setPrefetchCache(
  query: string,
  result: CachedRagContext,
  options?: { types?: string[]; namespace?: string },
): void {
  const key = cacheKey(query, options);
  prefetchCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearPrefetchCache(): void {
  prefetchCache.clear();
}
