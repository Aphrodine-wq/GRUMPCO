/**
 * Central API client – single source for base URL and fetch with defaults.
 * Use getApiBase() or fetchApi() everywhere instead of inline VITE_API_URL.
 */

const DEFAULT_BASE = 'http://localhost:3000';

/** Normalize env to root URL (no trailing /api). */
function normalizedBase(): string {
  if (typeof import.meta === 'undefined' || !import.meta.env?.VITE_API_URL) {
    return DEFAULT_BASE;
  }
  const raw = import.meta.env.VITE_API_URL as string;
  return raw.replace(/\/api\/?$/, '') || DEFAULT_BASE;
}

let _base: string | null = null;

/**
 * Root API base URL (e.g. http://localhost:3000).
 * Paths should include leading slash, e.g. /api/ship/start, /auth/status.
 */
export function getApiBase(): string {
  if (_base === null) {
    _base = normalizedBase();
  }
  return _base;
}

/**
 * Reset cached base (e.g. in tests or after env change).
 */
export function resetApiBase(): void {
  _base = null;
}

export interface FetchApiOptions extends RequestInit {
  /** Request timeout in ms. */
  timeout?: number;
  /** Number of retries on network/5xx. */
  retries?: number;
}

const DEFAULT_TIMEOUT = 30_000;

/**
 * Fetch from API with default headers, optional timeout and retries.
 * When signal is provided (e.g. for streaming), timeout is not applied.
 * @param path - Path from root, e.g. '/api/ship/start' or '/auth/status'
 */
export async function fetchApi(
  path: string,
  options: FetchApiOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, retries = 0, ...init } = options;
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init.headers,
  };

  const doFetch = (): Promise<Response> => {
    if (timeout > 0 && !init.signal) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      return fetch(url, { ...init, headers, signal: ctrl.signal }).finally(() =>
        clearTimeout(t)
      );
    }
    return fetch(url, { ...init, headers });
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await doFetch();
      if (retries > 0 && res.status >= 500 && attempt < retries) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt === retries) throw e;
    }
  }
  throw lastErr;
}
