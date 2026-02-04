/**
 * Central API client – single source for base URL and fetch with defaults.
 * Use getApiBase() or fetchApi() everywhere instead of inline VITE_API_URL.
 */

const DEFAULT_BASE = import.meta.env?.PROD ? '' : 'http://localhost:3000';

/** Normalize env to root URL (no trailing /api). */
function normalizedBase(): string {
  // If running in Electron (via window.grump), always use localhost:3000
  // regardless of PROD/DEV mode, because the backend is local.
  if (
    typeof window !== 'undefined' &&
    (window as { grump?: { isElectron?: boolean } }).grump?.isElectron
  ) {
    return 'http://localhost:3000';
  }

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
export async function fetchApi(path: string, options: FetchApiOptions = {}): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, retries = 0, ...init } = options;
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-GRump-Client': 'desktop',
    ...init.headers,
  };

  const doFetch = (): Promise<Response> => {
    if (timeout > 0 && !init.signal) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      return fetch(url, { ...init, headers, signal: ctrl.signal }).finally(() => clearTimeout(t));
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

// --- Skills API ---

export interface SkillSummary {
  id: string;
  name: string;
  version?: string;
  description?: string;
  category?: string;
  icon?: string;
  tags?: string[];
  capabilities?: string[];
}

export interface SkillDetail extends SkillSummary {
  tools?: string[];
  hasRoutes?: boolean;
  hasPrompts?: boolean;
}

export interface SkillsListResponse {
  skills: SkillSummary[];
}

export async function getSkills(): Promise<SkillSummary[]> {
  const res = await fetchApi('/api/skills');
  if (!res.ok) throw new Error(`Failed to fetch skills: ${res.status}`);
  const data = (await res.json()) as SkillsListResponse;
  return data.skills ?? [];
}

export async function getSkill(id: string): Promise<SkillDetail | null> {
  const res = await fetchApi(`/api/skills/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch skill: ${res.status}`);
  return (await res.json()) as SkillDetail;
}

export async function generateSkillMd(description: string): Promise<string> {
  const res = await fetchApi('/api/skills-api/generate-skill-md', {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error(`Failed to generate skill: ${res.status}`);
  const data = (await res.json()) as { content?: string };
  return data.content ?? '';
}

// --- Share API ---

export interface ShareResponse {
  success: boolean;
  shareId: string;
  shareUrl: string;
  expiresAt: string;
}

export async function createShareLink(payload: {
  type: 'diagram' | 'architecture' | 'prd' | 'code' | 'bundle';
  content: string;
  title?: string;
  description?: string;
  mermaidCode?: string;
  expiresIn?: number;
}): Promise<ShareResponse> {
  const res = await fetchApi('/api/share', {
    method: 'POST',
    body: JSON.stringify({ ...payload, expiresIn: payload.expiresIn ?? 168 }),
  });
  if (!res.ok) throw new Error(`Failed to create share link: ${res.status}`);
  return res.json() as Promise<ShareResponse>;
}
