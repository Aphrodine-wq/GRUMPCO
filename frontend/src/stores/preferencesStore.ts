import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { fetchApi } from '../lib/api.js';
import { session } from './authStore.js';

export interface UserPreferences {
  diagramStyle: 'minimal' | 'detailed' | 'comprehensive';
  primaryTechStack: string[];
  theme: 'light' | 'dark' | 'auto';
  analyticsOptIn: boolean;
  apiKey?: string;
  setupComplete: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  diagramStyle: 'detailed',
  primaryTechStack: ['React', 'Node.js', 'PostgreSQL'],
  theme: 'auto',
  analyticsOptIn: true,
  setupComplete: false,
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
    await fetchApi('/settings', {
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
    const res = await fetchApi('/settings', {
      headers: {
        Authorization: `Bearer ${currentSession.access_token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.settings?.preferences) {
        preferences.update(current => {
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
export const diagramStyle = derived(
  preferences,
  ($preferences) => $preferences.diagramStyle
);

export const primaryTechStack = derived(
  preferences,
  ($preferences) => $preferences.primaryTechStack
);

export const theme = derived(
  preferences,
  ($preferences) => $preferences.theme
);

export const analyticsOptIn = derived(
  preferences,
  ($preferences) => $preferences.analyticsOptIn
);

export const setupComplete = derived(
  preferences,
  ($preferences) => $preferences.setupComplete
);

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

  // Set theme
  setTheme: (t: 'light' | 'dark' | 'auto') => {
    preferences.update((p) => ({ ...p, theme: t }));
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
  sync: syncPreferences
};

export default preferences;
