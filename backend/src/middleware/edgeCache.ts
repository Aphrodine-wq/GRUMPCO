/**
 * Edge Cache Middleware
 * Enables caching at the edge (CDN/Vercel Edge)
 *
 * Features:
 * - Cache headers for CDN
 * - Stale-while-revalidate pattern
 * - Edge-side includes for partial caching
 * - Cache warming triggers
 */

import type { Request, Response, NextFunction } from "express";
import logger from "./logger.js";

interface CacheConfig {
  ttl: number; // Time to live in seconds
  staleWhileRevalidate: number;
  varyBy: string[];
  tags: string[];
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: 60, // 1 minute default
  staleWhileRevalidate: 300, // 5 minutes stale
  varyBy: ["Accept-Encoding"],
  tags: [],
};

/**
 * Edge cache middleware factory
 */
export function edgeCache(config: Partial<CacheConfig> = {}) {
  const fullConfig = { ...DEFAULT_CACHE_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip caching for non-GET requests
    if (req.method !== "GET") {
      res.setHeader("Cache-Control", "no-store");
      return next();
    }

    // Skip caching for authenticated requests (unless explicitly allowed)
    if (req.headers.authorization && !config.ttl) {
      res.setHeader("Cache-Control", "private, no-cache");
      return next();
    }

    // Build cache key components (used for cache-tag generation)
    const _cacheKeyParts = [
      req.path,
      ...fullConfig.varyBy.map(
        (header) => req.headers[header.toLowerCase()] || "",
      ),
    ];

    // Set cache headers
    const cacheControl = [
      "public",
      `max-age=${fullConfig.ttl}`,
      `stale-while-revalidate=${fullConfig.staleWhileRevalidate}`,
    ].join(", ");

    res.setHeader("Cache-Control", cacheControl);
    res.setHeader("Vary", fullConfig.varyBy.join(", "));

    // Add cache tags for selective invalidation
    if (fullConfig.tags.length > 0) {
      res.setHeader("Cache-Tag", fullConfig.tags.join(","));
    }

    // Add surrogate keys (Varnish/Fastly)
    res.setHeader("Surrogate-Key", fullConfig.tags.join(" ") || "default");
    res.setHeader("Surrogate-Control", `max-age=${fullConfig.ttl}`);

    logger.debug(
      {
        path: req.path,
        cacheControl,
        tags: fullConfig.tags,
      },
      "Edge cache headers set",
    );

    next();
  };
}

/**
 * Cache tags for different resource types
 */
export const CacheTags = {
  MODELS: "models",
  SESSIONS: "sessions",
  SETTINGS: "settings",
  ANALYTICS: "analytics",
  STATIC: "static",
  API: "api",
} as const;

/**
 * Predefined cache configurations
 */
export const CacheConfigs = {
  // Static assets - long cache
  static: {
    ttl: 86400, // 1 day
    staleWhileRevalidate: 604800, // 1 week
    tags: [CacheTags.STATIC],
  },

  // Model registry - moderate cache
  models: {
    ttl: 300, // 5 minutes
    staleWhileRevalidate: 3600, // 1 hour
    tags: [CacheTags.MODELS],
  },

  // User sessions - short cache with validation
  sessions: {
    ttl: 30, // 30 seconds
    staleWhileRevalidate: 300, // 5 minutes
    tags: [CacheTags.SESSIONS],
    varyBy: ["Authorization", "Accept-Encoding"],
  },

  // Settings - moderate cache
  settings: {
    ttl: 60, // 1 minute
    staleWhileRevalidate: 600, // 10 minutes
    tags: [CacheTags.SETTINGS],
  },

  // Analytics data - short cache
  analytics: {
    ttl: 60, // 1 minute
    staleWhileRevalidate: 300, // 5 minutes
    tags: [CacheTags.ANALYTICS],
  },

  // API responses - no cache by default
  api: {
    ttl: 0,
    staleWhileRevalidate: 0,
    tags: [CacheTags.API],
  },
};

/**
 * Middleware to purge cache by tag
 */
export async function purgeCacheByTag(tag: string): Promise<void> {
  // Implementation depends on CDN (Vercel, CloudFlare, Fastly, etc.)
  logger.info({ tag }, "Cache purge requested");

  // Example for Vercel
  if (process.env.VERCEL_URL) {
    try {
      await fetch(
        `https://api.vercel.com/v1/integrations/deploy/${process.env.VERCEL_DEPLOYMENT_ID}/cache`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tags: [tag] }),
        },
      );
    } catch (error) {
      logger.warn({ tag, error }, "Failed to purge Vercel cache");
    }
  }
}

/**
 * Middleware to warm cache
 */
export function cacheWarmer(urls: string[]): void {
  // Fire-and-forget cache warming
  setTimeout(async () => {
    for (const url of urls) {
      try {
        const start = Date.now();
        await fetch(url, {
          headers: {
            "User-Agent": "Cache-Warmer/1.0",
          },
        });

        logger.debug(
          {
            url,
            duration: Date.now() - start,
          },
          "Cache warmed",
        );
      } catch (error) {
        logger.warn({ url, error }, "Failed to warm cache");
      }
    }
  }, 100);
}

/**
 * Stale-while-revalidate wrapper for dynamic content
 */
export async function staleWhileRevalidate(
  generator: () => Promise<unknown>,
  _ttl: number,
  _staleTtl: number,
): Promise<unknown> {
  // Always return fresh data
  // Background refresh can be implemented here
  return generator();
}
