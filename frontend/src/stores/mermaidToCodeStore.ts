import { writable, derived } from 'svelte/store';

export interface MermaidToCodeState {
  mermaidCode: string;
  framework: string;
  language: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
  generatedCode?: string;
  error?: string;
  history: Array<{
    id: string;
    mermaidCode: string;
    framework: string;
    language: string;
    timestamp: number;
    generatedCode?: string;
    error?: string;
  }>;
}

const initialState: MermaidToCodeState = {
  mermaidCode: '',
  framework: 'react',
  language: 'typescript',
  status: 'idle',
  history: [],
};

// Load from localStorage
function loadState(): MermaidToCodeState {
  if (typeof window === 'undefined') return initialState;

  try {
    const stored = localStorage.getItem('mermaid-to-code-state');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...initialState,
        ...parsed,
        // Don't restore status, always start idle
        status: 'idle',
      };
    }
  } catch (error) {
    console.error('Failed to load mermaid-to-code state:', error);
  }

  return initialState;
}

// Save to localStorage
function saveState(state: MermaidToCodeState) {
  if (typeof window === 'undefined') return;

  try {
    const toSave = {
      mermaidCode: state.mermaidCode,
      framework: state.framework,
      language: state.language,
      history: state.history.slice(-10), // Keep last 10 generations
    };
    localStorage.setItem('mermaid-to-code-state', JSON.stringify(toSave));
  } catch (error) {
    console.error('Failed to save mermaid-to-code state:', error);
  }
}

// Create store
const createMermaidToCodeStore = () => {
  const { subscribe, set, update } = writable<MermaidToCodeState>(loadState());

  return {
    subscribe,

    // Set Mermaid code
    setMermaidCode: (code: string) => {
      update((state) => {
        const newState = { ...state, mermaidCode: code };
        saveState(newState);
        return newState;
      });
    },

    // Set framework
    setFramework: (framework: string) => {
      update((state) => {
        const newState = { ...state, framework };
        saveState(newState);
        return newState;
      });
    },

    // Set language
    setLanguage: (language: string) => {
      update((state) => {
        const newState = { ...state, language };
        saveState(newState);
        return newState;
      });
    },

    // Start generation
    startGeneration: () => {
      update((state) => ({
        ...state,
        status: 'generating' as const,
        error: undefined,
      }));
    },

    // Complete generation
    completeGeneration: (generatedCode: string) => {
      update((state) => {
        const historyEntry = {
          id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          mermaidCode: state.mermaidCode,
          framework: state.framework,
          language: state.language,
          timestamp: Date.now(),
          generatedCode,
        };

        const newState: MermaidToCodeState = {
          ...state,
          status: 'completed',
          generatedCode,
          error: undefined,
          history: [historyEntry, ...state.history].slice(0, 50), // Keep last 50
        };

        saveState(newState);
        return newState;
      });
    },

    // Set error
    setError: (error: string) => {
      update((state) => {
        const historyEntry = {
          id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          mermaidCode: state.mermaidCode,
          framework: state.framework,
          language: state.language,
          timestamp: Date.now(),
          generatedCode: undefined,
          error,
        };

        const newState: MermaidToCodeState = {
          ...state,
          status: 'error',
          error,
          history: [historyEntry, ...state.history].slice(0, 50),
        };

        saveState(newState);
        return newState;
      });
    },

    // Reset state
    reset: () => {
      const newState = initialState;
      set(newState);
      saveState(newState);
    },

    // Load from history
    loadFromHistory: (historyId: string) => {
      update((state) => {
        const entry = state.history.find((h) => h.id === historyId);
        if (entry) {
          const newState: MermaidToCodeState = {
            ...state,
            mermaidCode: entry.mermaidCode,
            framework: entry.framework,
            language: entry.language,
            generatedCode: entry.generatedCode,
            error: entry.error,
            status: entry.error ? 'error' : entry.generatedCode ? 'completed' : 'idle',
          };
          saveState(newState);
          return newState;
        }
        return state;
      });
    },
  };
};

export const mermaidToCodeStore = createMermaidToCodeStore();

// Derived stores
export const isGenerating = derived(mermaidToCodeStore, ($store) => $store.status === 'generating');
export const hasError = derived(mermaidToCodeStore, ($store) => $store.status === 'error');
export const isCompleted = derived(mermaidToCodeStore, ($store) => $store.status === 'completed');
export const recentHistory = derived(mermaidToCodeStore, ($store) => $store.history.slice(0, 10));
