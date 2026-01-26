import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import type { ScreenType, LegacySession, AppState, Message, UserPreferences } from '../types';
import { SCREENS } from '../types';

const STORAGE_KEY = 'mermaid-app-state';

// Re-export SCREENS for convenience
export { SCREENS };

// Singleton state
const currentScreen: Ref<ScreenType> = ref(SCREENS.SPLASH);
// API key is hardwired on backend via ANTHROPIC_API_KEY env var - skip auth
const apiKeyValid: Ref<boolean> = ref(true);
const hasCompletedSetup: Ref<boolean> = ref(false);
const lastSession: Ref<LegacySession | null> = ref(null);
const preferences: Ref<UserPreferences | null> = ref(null);

// Load persisted state
function loadState(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const state: AppState = JSON.parse(stored);
      hasCompletedSetup.value = state.hasCompletedSetup || false;
      lastSession.value = state.lastSession || null;
      // apiKeyValid always true - backend handles API key via env var
      preferences.value = state.preferences || null;
    }
  } catch (e) {
    console.warn('Failed to load app state:', e);
  }
}

// Save state on changes
function saveState(): void {
  try {
    const state: AppState = {
      hasCompletedSetup: hasCompletedSetup.value,
      lastSession: lastSession.value,
      apiKeyValid: apiKeyValid.value,
      preferences: preferences.value || undefined
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save app state:', e);
  }
}

export interface UseAppFlowReturn {
  // State
  currentScreen: Ref<ScreenType>;
  apiKeyValid: Ref<boolean>;
  hasCompletedSetup: Ref<boolean>;
  lastSession: Ref<LegacySession | null>;
  preferences: Ref<UserPreferences | null>;
  
  // Computed
  isLoading: ComputedRef<boolean>;
  needsAuth: ComputedRef<boolean>;
  needsSetup: ComputedRef<boolean>;
  hasSession: ComputedRef<boolean>;
  
  // Actions
  goToScreen: (screen: ScreenType) => void;
  completeSplash: () => void;
  setApiKeyValid: (valid: boolean) => void;
  completeSetup: (prefs?: UserPreferences) => void;
  skipSetup: () => void;
  continueSession: () => void;
  startNewSession: () => void;
  saveSession: (messages: Message[]) => void;
  clearSession: () => void;
  resetApp: () => void;
  
  // Constants
  SCREENS: typeof SCREENS;
}

export function useAppFlow(): UseAppFlowReturn {
  // Initialize on first use
  loadState();

  // Auto-save on changes
  watch([hasCompletedSetup, lastSession, apiKeyValid, preferences], saveState, { deep: true });

  const isLoading = computed(() => currentScreen.value === SCREENS.SPLASH);
  const needsAuth = computed(() => !apiKeyValid.value);
  const needsSetup = computed(() => !hasCompletedSetup.value);
  const hasSession = computed(() => lastSession.value !== null);

  function goToScreen(screen: ScreenType): void {
    currentScreen.value = screen;
  }

  function completeSplash(): void {
    if (!apiKeyValid.value) {
      currentScreen.value = SCREENS.AUTH;
    } else if (!hasCompletedSetup.value) {
      currentScreen.value = SCREENS.SETUP;
    } else if (lastSession.value) {
      currentScreen.value = SCREENS.RESUME;
    } else {
      currentScreen.value = SCREENS.MAIN;
    }
  }

  function setApiKeyValid(valid: boolean): void {
    apiKeyValid.value = valid;
    if (valid) {
      if (!hasCompletedSetup.value) {
        currentScreen.value = SCREENS.SETUP;
      } else {
        currentScreen.value = SCREENS.MAIN;
      }
    }
  }

  function completeSetup(prefs?: UserPreferences): void {
    if (prefs) {
      preferences.value = prefs;
    }
    hasCompletedSetup.value = true;
    if (lastSession.value) {
      currentScreen.value = SCREENS.RESUME;
    } else {
      currentScreen.value = SCREENS.MAIN;
    }
  }

  function skipSetup(): void {
    hasCompletedSetup.value = true;
    currentScreen.value = SCREENS.MAIN;
  }

  function continueSession(): void {
    currentScreen.value = SCREENS.MAIN;
  }

  function startNewSession(): void {
    lastSession.value = null;
    currentScreen.value = SCREENS.MAIN;
  }

  function saveSession(messages: Message[]): void {
    lastSession.value = {
      messages,
      timestamp: Date.now()
    };
  }

  function clearSession(): void {
    lastSession.value = null;
    saveState();
  }

  function resetApp(): void {
    // apiKeyValid stays true - backend handles API key
    hasCompletedSetup.value = false;
    lastSession.value = null;
    preferences.value = null;
    currentScreen.value = SCREENS.SPLASH;
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    // State
    currentScreen,
    apiKeyValid,
    hasCompletedSetup,
    lastSession,
    preferences,
    
    // Computed
    isLoading,
    needsAuth,
    needsSetup,
    hasSession,
    
    // Actions
    goToScreen,
    completeSplash,
    setApiKeyValid,
    completeSetup,
    skipSetup,
    continueSession,
    startNewSession,
    saveSession,
    clearSession,
    resetApp,
    
    // Constants
    SCREENS
  };
}

// For testing - reset singleton state
export function resetAppFlowState(): void {
  currentScreen.value = SCREENS.SPLASH;
  // apiKeyValid stays true - backend handles API key
  hasCompletedSetup.value = false;
  lastSession.value = null;
  preferences.value = null;
  localStorage.removeItem(STORAGE_KEY);
}
