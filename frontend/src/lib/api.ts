/**
 * Central API client – single source for base URL and fetch with defaults.
 * Use getApiBase() or fetchApi() everywhere instead of inline VITE_API_URL.
 */

/** Production backend URL – set VITE_API_URL to override */
const REMOTE_BACKEND = 'https://grump-backend.onrender.com';
const DEFAULT_BASE = import.meta.env?.PROD ? REMOTE_BACKEND : 'http://localhost:3000';

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

export interface CreateUserSkillPayload {
  name: string;
  description: string;
  tools?: Array<{ name: string; description: string }>;
}

export async function createUserSkill(
  payload: CreateUserSkillPayload
): Promise<{ success: boolean; skillId?: string; error?: string }> {
  const res = await fetchApi('/api/skills-api/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    success?: boolean;
    skillId?: string;
    error?: string;
  };
  if (!res.ok) {
    return {
      success: false,
      error: data.error ?? `Failed to create skill: ${res.status}`,
    };
  }
  return {
    success: data.success ?? true,
    skillId: data.skillId,
    error: data.error,
  };
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

// --- Workspace tree (file explorer) ---

export interface WorkspaceTreeEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface WorkspaceTreeResponse {
  path: string;
  entries: WorkspaceTreeEntry[];
}

export async function getWorkspaceTree(dirPath?: string): Promise<WorkspaceTreeResponse> {
  const query = dirPath != null && dirPath !== '' ? `?path=${encodeURIComponent(dirPath)}` : '';
  const res = await fetchApi(`/api/workspace/tree${query}`);
  if (!res.ok) throw new Error(`Failed to list workspace: ${res.status}`);
  return res.json() as Promise<WorkspaceTreeResponse>;
}

// --- Session attachments ---

export interface SessionAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export async function listSessionAttachments(sessionId: string): Promise<SessionAttachment[]> {
  const res = await fetchApi(`/api/session-attachments/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`Failed to list attachments: ${res.status}`);
  const data = (await res.json()) as { attachments?: SessionAttachment[] };
  return data.attachments ?? [];
}

export async function addSessionAttachments(
  sessionId: string,
  items: Array<{ name: string; mimeType: string; size: number; dataBase64?: string }>
): Promise<SessionAttachment[]> {
  const res = await fetchApi(`/api/session-attachments/${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    body: JSON.stringify({ attachments: items }),
  });
  if (!res.ok) throw new Error(`Failed to add attachments: ${res.status}`);
  const data = (await res.json()) as { attachments?: SessionAttachment[] };
  return data.attachments ?? [];
}

export async function removeSessionAttachment(
  sessionId: string,
  attachmentId: string
): Promise<void> {
  const res = await fetchApi(
    `/api/session-attachments/${encodeURIComponent(sessionId)}/${encodeURIComponent(attachmentId)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error(`Failed to remove attachment: ${res.status}`);
}

// --- Design Workflow API ---

export interface DesignWorkflowState {
  currentPhase: 'architecture' | 'prd' | 'plan' | 'code' | 'completed';
  phaseData: {
    architecture?: {
      mermaidCode: string;
      description: string;
    };
    prd?: {
      content: string;
      summary: string;
    };
    plan?: {
      tasks: Array<{
        id: string;
        title: string;
        description: string;
        status: 'pending' | 'in-progress' | 'completed';
      }>;
    };
    code?: {
      files: Array<{
        path: string;
        content: string;
        language: string;
      }>;
    };
  };
  userApprovals: Record<string, boolean>;
  isActive: boolean;
  projectDescription?: string;
}

export async function startDesignWorkflow(
  projectDescription: string,
  sessionId?: string
): Promise<{ success: boolean; workflowState: DesignWorkflowState; message: string }> {
  const res = await fetchApi('/api/chat/design/start', {
    method: 'POST',
    body: JSON.stringify({ projectDescription, sessionId }),
  });
  if (!res.ok) throw new Error(`Failed to start design workflow: ${res.status}`);
  return res.json();
}

export async function executeDesignPhase(
  sessionId: string,
  phase: 'architecture' | 'prd' | 'plan' | 'code',
  feedback?: string,
  existingProject?: boolean
): Promise<{ success: boolean; phase: string; result: unknown; message: string }> {
  const res = await fetchApi('/api/chat/design/execute', {
    method: 'POST',
    body: JSON.stringify({ sessionId, phase, feedback, existingProject }),
  });
  if (!res.ok) throw new Error(`Failed to execute design phase: ${res.status}`);
  return res.json();
}

export async function approveDesignPhase(
  sessionId: string,
  approved: boolean,
  feedback?: string
): Promise<{ success: boolean; message: string; workflowState: DesignWorkflowState; nextPhase?: string }> {
  const res = await fetchApi('/api/chat/design/approve', {
    method: 'POST',
    body: JSON.stringify({ sessionId, approved, feedback }),
  });
  if (!res.ok) throw new Error(`Failed to approve design phase: ${res.status}`);
  return res.json();
}

export async function completeDesignWorkflow(
  sessionId: string
): Promise<{ success: boolean; message: string; workflowState: DesignWorkflowState }> {
  const res = await fetchApi('/api/chat/design/complete', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(`Failed to complete design workflow: ${res.status}`);
  return res.json();
}
