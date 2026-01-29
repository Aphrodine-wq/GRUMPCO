import { writable } from 'svelte/store';

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
  } catch { /* ignore */ }
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
  } catch { /* ignore */ }
}

const { subscribe, set } = writable<WorkspaceState>(loadStored());

export const workspaceStore = {
  subscribe,
  setWorkspace(root: string | null, repoUrl: string | null = null) {
    const newState = { root, repoUrl, isRemote: !!repoUrl };
    persist(newState);
    set(newState);
  },
  clear() {
    const empty = { root: null, repoUrl: null, isRemote: false };
    persist(empty);
    set(empty);
  },
};
