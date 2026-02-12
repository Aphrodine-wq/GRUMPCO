import { writable } from 'svelte/store';
import { setWorkspaceRoot, getWorkspaceRoot } from '../lib/api';

const ROOT_KEY = 'grump-workspace-root';
const REPO_URL_KEY = 'grump-workspace-repo-url';

interface WorkspaceState {
  root: string | null;
  repoUrl: string | null;
  isRemote: boolean;
}

function loadStored(): WorkspaceState {
  try {
    if (typeof localStorage !== 'undefined') {
      const root = localStorage.getItem(ROOT_KEY);
      const repoUrl = localStorage.getItem(REPO_URL_KEY);
      return {
        root: root && root.trim() ? root.trim() : null,
        repoUrl: repoUrl && repoUrl.trim() ? repoUrl.trim() : null,
        isRemote: !!repoUrl,
      };
    }
  } catch {
    /* ignore */
  }
  return { root: null, repoUrl: null, isRemote: false };
}

function persist(state: WorkspaceState) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (state.root) localStorage.setItem(ROOT_KEY, state.root);
      else localStorage.removeItem(ROOT_KEY);

      if (state.repoUrl) localStorage.setItem(REPO_URL_KEY, state.repoUrl);
      else localStorage.removeItem(REPO_URL_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Sync a local workspace path to the backend so the AI's
 * ToolExecutionService targets the correct directory for file writes.
 */
async function syncToBackend(root: string | null): Promise<void> {
  if (!root) return;
  try {
    await setWorkspaceRoot(root);
  } catch {
    // Backend may be unreachable; the localStorage value still persists
    // and will be synced next time.
  }
}

const { subscribe, set } = writable<WorkspaceState>(loadStored());

export const workspaceStore = {
  subscribe,
  setWorkspace(root: string | null, repoUrl: string | null = null) {
    const newState = { root, repoUrl, isRemote: !!repoUrl };
    persist(newState);
    set(newState);
    // Sync to backend so AI file writes go to this folder
    if (!repoUrl) {
      syncToBackend(root);
    }
  },
  clear() {
    const empty = { root: null, repoUrl: null, isRemote: false };
    persist(empty);
    set(empty);
  },
  /**
   * Restore workspace root from the backend (called once on app startup).
   * If the backend has an active root, use it; otherwise fall back to localStorage.
   */
  async loadFromBackend(): Promise<void> {
    try {
      const backendRoot = await getWorkspaceRoot();
      if (backendRoot) {
        const newState: WorkspaceState = {
          root: backendRoot,
          repoUrl: null,
          isRemote: false,
        };
        persist(newState);
        set(newState);
      } else {
        // If backend has nothing, sync our localStorage value up
        const stored = loadStored();
        if (stored.root && !stored.isRemote) {
          syncToBackend(stored.root);
        }
      }
    } catch {
      // Backend unreachable; localStorage value is still fine
    }
  },
};
