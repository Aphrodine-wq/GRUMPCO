import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { fetchApi } from '../lib/api.js';
import { session } from './authStore.js';

/** Agent capability keys (new naming) */
export type GAgentCapabilityKey =
  | 'file'
  | 'git'
  | 'bash'
  | 'npm'
  | 'docker'
  | 'cloud'
  | 'webhooks'
  | 'heartbeats'
  | 'internet_search'
  | 'database'
  | 'api_call'
  | 'monitoring'
  | 'cicd'
  | 'skills_self_edit'
  | 'task_planning'
  | 'memory'
  | 'self_improve';

/** Capabilities that require PRO+ tier */
export const PREMIUM_CAPABILITIES: GAgentCapabilityKey[] = [
  'cloud',
  'cicd',
  'task_planning',
  'memory',
  'self_improve',
];

/** Capability descriptions for UI */
export const CAPABILITY_DESCRIPTIONS: Record<GAgentCapabilityKey, string> = {
  file: 'Read, write, and edit files in your workspace',
  git: 'Git operations: status, diff, commit, branch, push',
  bash: 'Execute shell commands',
  npm: 'Run npm/pnpm/yarn commands',
  docker: 'Docker container and compose operations',
  internet_search: 'Web search and URL screenshots',
  webhooks: 'Send and manage webhooks',
  heartbeats: 'Scheduled tasks and health checks',
  database: 'Database queries and migrations (read-only by default)',
  api_call: 'Make HTTP/GraphQL API calls (allowlisted domains)',
  monitoring: 'Query metrics, create alerts, search logs',
  cloud: 'Kubernetes deployments and cloud operations (PRO+)',
  cicd: 'CI/CD pipeline management (PRO+)',
  skills_self_edit: 'Create, edit, test, and list your own skills',
  task_planning: 'Plan-first execution with task decomposition',
  memory: 'Persistent memory across sessions',
  self_improve: 'Self-improvement and skill learning',
};

export interface GAgentModelPreference {
  source?: 'cloud' | 'ollama' | 'auto';
  provider?: string;
  modelId?: string;
}

export interface GAgentPersona {
  tone?: string;
  style?: string;
  expertise?: string[];
}

export interface UserPreferences {
  diagramStyle: 'minimal' | 'detailed' | 'comprehensive';
  primaryTechStack: string[];
  analyticsOptIn: boolean;
  apiKey?: string;
  setupComplete: boolean;
  density?: 'comfortable' | 'compact';

  // Agent preferences (new naming)
  gAgentCapabilities?: GAgentCapabilityKey[];
  gAgentExternalAllowlist?: string[];
  gAgentPreferredModelSource?: 'cloud' | 'ollama' | 'auto';
  gAgentOllamaModel?: string;
  gAgentModelPreference?: GAgentModelPreference;
  gAgentPersona?: GAgentPersona;
  gAgentGoals?: string[];
  gAgentAutoApprove?: boolean;
  gAgentPersistent?: boolean;

  /** When true, inject RAG context into chat for more tailored answers from indexed docs. */
  includeRagContext?: boolean;
}

const DEFAULT_G_AGENT_CAPABILITIES: GAgentCapabilityKey[] = [
  'file',
  'git',
  'bash',
  'npm',
  'docker',
  'webhooks',
  'heartbeats',
  'internet_search',
  'database',
  'api_call',
  'monitoring',
  // Premium capabilities not enabled by default
  // 'cloud',
  // 'cicd',
  // 'task_planning',
  // 'memory',
  // 'self_improve',
];

const DEFAULT_PREFERENCES: UserPreferences = {
  diagramStyle: 'detailed',
  primaryTechStack: ['React', 'Node.js', 'PostgreSQL'],
  analyticsOptIn: true,
  setupComplete: false,
  density: 'comfortable',
  gAgentCapabilities: DEFAULT_G_AGENT_CAPABILITIES,
  gAgentExternalAllowlist: [],
};

// Local storage key
const STORAGE_KEY = 'g-rump-preferences';

// Load preferences from localStorage or use defaults
function loadPreferences(): UserPreferences {
  try {
    if (typeof window === 'undefined') {
      return DEFAULT_PREFERENCES;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load preferences from storage:', error);
  }
  return DEFAULT_PREFERENCES;
}

// Create the main store
const preferences = writable<UserPreferences>(loadPreferences());

// Helpers for debouncing API saves
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DELAY_MS = 1000;

// Internal save to backend
async function saveToBackend(prefs: UserPreferences) {
  const currentSession = get(session);
  if (!currentSession?.access_token) return;

  try {
    await fetchApi('/api/settings', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${currentSession.access_token}`,
      },
      body: JSON.stringify({ preferences: prefs }),
    });
  } catch (err) {
    console.warn('Failed to sync preferences to backend:', err);
  }
}

// Fetch from backend and merge
export async function syncPreferences() {
  const currentSession = get(session);
  if (!currentSession?.access_token) return;

  try {
    const res = await fetchApi('/api/settings', {
      headers: {
        Authorization: `Bearer ${currentSession.access_token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.settings?.preferences) {
        preferences.update((current) => {
          const merged = { ...current, ...data.settings.preferences };
          // Persist to local storage immediately to keep them in sync
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          }
          return merged;
        });
      }
    }
  } catch (err) {
    console.warn('Failed to fetch preferences from backend:', err);
  }
}

// Subscribe to changes and persist
preferences.subscribe((value) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    }

    // Debounce save to backend
    if (saveTimeout) clearTimeout(saveTimeout);

    // Only save if logged in
    const s = get(session);
    if (s?.access_token) {
      saveTimeout = setTimeout(() => {
        saveToBackend(value);
      }, SAVE_DELAY_MS);
    }
  } catch (error) {
    console.error('Failed to save preferences to storage:', error);
  }
});

// Watch for auth changes to sync on login
session.subscribe((s) => {
  if (s?.access_token) {
    // User logged in, fetch their preferences
    syncPreferences();
  }
});

// Derived stores for individual preferences
export const diagramStyle = derived(preferences, ($preferences) => $preferences.diagramStyle);

export const primaryTechStack = derived(
  preferences,
  ($preferences) => $preferences.primaryTechStack
);

export const analyticsOptIn = derived(preferences, ($preferences) => $preferences.analyticsOptIn);

export const setupComplete = derived(preferences, ($preferences) => $preferences.setupComplete);

export const density = derived(
  preferences,
  ($preferences) => $preferences.density ?? 'comfortable'
);

export const includeRagContext = derived(preferences, (p) => p.includeRagContext ?? false);

// Agent derived stores (new naming)
export const gAgentCapabilities = derived(
  preferences,
  (p) => p.gAgentCapabilities ?? DEFAULT_G_AGENT_CAPABILITIES
);

export const gAgentExternalAllowlist = derived(preferences, (p) => p.gAgentExternalAllowlist ?? []);

export const gAgentPreferredModelSource = derived(
  preferences,
  (p) => p.gAgentPreferredModelSource ?? 'auto'
);

export const gAgentOllamaModel = derived(preferences, (p) => p.gAgentOllamaModel ?? 'glm4');

export const gAgentPersona = derived(preferences, (p) => p.gAgentPersona ?? {});

export const gAgentGoals = derived(preferences, (p) => p.gAgentGoals ?? []);

export const gAgentAutoApprove = derived(preferences, (p) => p.gAgentAutoApprove ?? false);

export const gAgentPersistent = derived(preferences, (p) => p.gAgentPersistent ?? false);

// Store actions
export const preferencesStore = {
  // Get the main store
  store: preferences as Writable<UserPreferences>,

  // Update preferences
  update: (updates: Partial<UserPreferences>) => {
    preferences.update((current) => ({
      ...current,
      ...updates,
    }));
  },

  // Set diagram style
  setDiagramStyle: (style: 'minimal' | 'detailed' | 'comprehensive') => {
    preferences.update((p) => ({ ...p, diagramStyle: style }));
  },

  // Update tech stack
  setTechStack: (stack: string[]) => {
    preferences.update((p) => ({ ...p, primaryTechStack: stack }));
  },

  // Set density
  setDensity: (d: 'comfortable' | 'compact') => {
    preferences.update((p) => ({ ...p, density: d }));
  },

  setIncludeRagContext: (enabled: boolean) => {
    preferences.update((p) => ({ ...p, includeRagContext: enabled }));
  },

  // Agent methods (new naming)
  setGAgentCapabilities: (capabilities: GAgentCapabilityKey[]) => {
    preferences.update((p) => ({
      ...p,
      gAgentCapabilities: capabilities,
    }));
  },
  setGAgentExternalAllowlist: (allowlist: string[]) => {
    preferences.update((p) => ({
      ...p,
      gAgentExternalAllowlist: allowlist,
    }));
  },
  toggleGAgentCapability: (key: GAgentCapabilityKey) => {
    preferences.update((p) => {
      const current = p.gAgentCapabilities ?? DEFAULT_G_AGENT_CAPABILITIES;
      const next = current.includes(key)
        ? current.filter((k: GAgentCapabilityKey) => k !== key)
        : [...current, key];
      return {
        ...p,
        gAgentCapabilities: next,
      };
    });
  },
  addGAgentAllowlistDomain: (domain: string) => {
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed) return;
    preferences.update((p) => {
      const current = p.gAgentExternalAllowlist ?? [];
      if (current.includes(trimmed)) return p;
      const next = [...current, trimmed];
      return {
        ...p,
        gAgentExternalAllowlist: next,
      };
    });
  },
  removeGAgentAllowlistDomain: (domain: string) => {
    preferences.update((p) => {
      const current = p.gAgentExternalAllowlist ?? [];
      const next = current.filter((d: string) => d !== domain);
      return {
        ...p,
        gAgentExternalAllowlist: next,
      };
    });
  },
  setGAgentPreferredModelSource: (source: 'cloud' | 'ollama' | 'auto') => {
    preferences.update((p) => {
      const modelPref =
        source === 'ollama'
          ? {
              source: 'ollama' as const,
              provider: 'ollama',
              modelId: p.gAgentOllamaModel ?? 'glm4',
            }
          : source === 'cloud'
            ? { source: 'cloud' as const }
            : { source: 'auto' as const };
      return {
        ...p,
        gAgentPreferredModelSource: source,
        gAgentModelPreference: modelPref,
      };
    });
  },
  setGAgentOllamaModel: (model: string) => {
    preferences.update((p) => {
      const next: Partial<UserPreferences> = {
        gAgentOllamaModel: model,
      };
      const source = p.gAgentPreferredModelSource;
      if (source === 'ollama') {
        const modelPref = { source: 'ollama' as const, provider: 'ollama', modelId: model };
        next.gAgentModelPreference = modelPref;
      }
      return { ...p, ...next };
    });
  },
  setGAgentPersona: (persona: GAgentPersona) => {
    preferences.update((p) => ({
      ...p,
      gAgentPersona: persona,
    }));
  },
  setGAgentGoals: (goals: string[]) => {
    preferences.update((p) => ({
      ...p,
      gAgentGoals: goals,
    }));
  },
  setGAgentAutoApprove: (autoApprove: boolean) => {
    preferences.update((p) => ({ ...p, gAgentAutoApprove: autoApprove }));
  },
  setGAgentPersistent: (persistent: boolean) => {
    preferences.update((p) => ({ ...p, gAgentPersistent: persistent }));
  },

  // Update analytics opt-in
  setAnalyticsOptIn: (optIn: boolean) => {
    preferences.update((p) => ({ ...p, analyticsOptIn: optIn }));
  },

  // Set API key
  setApiKey: (key: string) => {
    preferences.update((p) => ({ ...p, apiKey: key }));
  },

  // Mark setup as complete
  completeSetup: () => {
    preferences.update((p) => ({ ...p, setupComplete: true }));
  },

  // Check if setup is complete
  isSetupComplete: (): boolean => {
    return get(preferences).setupComplete;
  },

  // Reset to defaults
  reset: () => {
    preferences.set(DEFAULT_PREFERENCES);
  },

  // Get current preferences
  getCurrent: (): UserPreferences => {
    return get(preferences);
  },

  // Expose sync for manual triggering
  sync: syncPreferences,
};

export default preferences;
