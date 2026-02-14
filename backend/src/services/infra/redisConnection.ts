/**
 * Shared Redis connection config for BullMQ and other Redis clients.
 * Parses REDIS_URL (redis://...) or REDIS_HOST + REDIS_PORT.
 * BullMQ queue names cannot contain ':' - use sanitizeQueueName for any dynamic names.
 */

export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
}

/** BullMQ queue names cannot contain ':'. Sanitize any name. */
export function sanitizeQueueName(name: string): string {
  return String(name).replace(/:/g, '-');
}

/**
 * Get Redis connection config from env.
 * Supports REDIS_URL (redis://[user:pass@]host:port) or REDIS_HOST + REDIS_PORT.
 * When REDIS_HOST contains "host:port", parses and overrides REDIS_PORT.
 */
export function getRedisConnectionConfig(): RedisConnectionConfig {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'redis:' || parsed.protocol === 'rediss:') {
        const password =
          parsed.password && parsed.password !== ''
            ? decodeURIComponent(parsed.password)
            : undefined;
        return {
          host: parsed.hostname,
          port: parsed.port ? parseInt(parsed.port, 10) : 6379,
          password,
        };
      }
    } catch {
      // Fall through to REDIS_HOST
    }
  }

  let host = (process.env.REDIS_HOST || 'localhost').trim();
  let port = parseInt(process.env.REDIS_PORT || '6379', 10);

  // REDIS_HOST may be "host:port"
  const match = host.match(/^(.+):(\d+)$/);
  if (match) {
    host = match[1];
    port = parseInt(match[2], 10);
  }

  return {
    host,
    port,
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
  };
}

export function useRedis(): boolean {
  return !!(
    (process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '') ||
    (process.env.REDIS_HOST && process.env.REDIS_HOST.trim() !== '')
  );
}
