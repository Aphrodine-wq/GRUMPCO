/**
 * Chat response cache – key generation and get/set for plan-mode completions.
 * Uses tiered cache namespace `chat:completion` to avoid re-calling the LLM for identical plan requests.
 */

import { createHash } from "crypto";
import { getTieredCache } from "./tieredCache.js";

const CHAT_CACHE_NAMESPACE = "chat:completion";
const CHAT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface CachedChatResponse {
  text: string;
  fromCache: true;
}

/**
 * Generate a cache key from mode and messages (stable JSON stringify).
 */
export function getChatCacheKey(
  mode: string,
  messages: Array<{ role: string; content: string | unknown }>,
): string {
  const payload = JSON.stringify({ mode, messages });
  return createHash("sha256").update(payload).digest("hex").substring(0, 32);
}

/**
 * Get cached plan completion if present.
 */
export async function getCachedChatResponse(
  mode: string,
  messages: Array<{ role: string; content: string | unknown }>,
): Promise<CachedChatResponse | null> {
  const key = getChatCacheKey(mode, messages);
  const cache = getTieredCache();
  const cached = await cache.get<CachedChatResponse>(CHAT_CACHE_NAMESPACE, key);
  return cached ?? null;
}

/**
 * Store a plan completion in the cache.
 */
export async function setCachedChatResponse(
  mode: string,
  messages: Array<{ role: string; content: string | unknown }>,
  text: string,
): Promise<void> {
  const key = getChatCacheKey(mode, messages);
  const cache = getTieredCache();
  await cache.set(
    CHAT_CACHE_NAMESPACE,
    key,
    { text, fromCache: true } as CachedChatResponse,
    CHAT_CACHE_TTL_MS,
  );
}
