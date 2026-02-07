import { writable, derived } from 'svelte/store';
import type { Readable } from 'svelte/store';

export type DesignPhase = 'architecture' | 'prd' | 'plan' | 'code' | 'completed';

export interface PhaseData {
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
}

export interface DesignWorkflowState {
  currentPhase: DesignPhase;
  phaseData: PhaseData;
  userApprovals: Record<DesignPhase, boolean>;
  isActive: boolean;
  projectDescription?: string;
}

const STORAGE_KEY = 'grump-design-workflow';

const initialState: DesignWorkflowState = {
  currentPhase: 'architecture',
  phaseData: {},
  userApprovals: {
    architecture: false,
    prd: false,
    plan: false,
    code: false,
    completed: false,
  },
  isActive: false,
};

function loadStored(): DesignWorkflowState {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...initialState, ...parsed };
      }
    }
  } catch {
    /* ignore */
  }
  return initialState;
}

function persist(state: DesignWorkflowState) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    /* ignore */
  }
}

function createChatPhaseStore() {
  const { subscribe, set, update } = writable<DesignWorkflowState>(loadStored());

  return {
    subscribe,

    /** Start a new design workflow */
    startWorkflow(projectDescription: string) {
      update((_state) => {
        const newState: DesignWorkflowState = {
          ...initialState,
          isActive: true,
          projectDescription,
        };
        persist(newState);
        return newState;
      });
    },

    /** Set data for the current phase */
    setPhaseData(phase: Exclude<DesignPhase, 'completed'>, data: PhaseData[typeof phase]) {
      update((state) => {
        const newState = {
          ...state,
          phaseData: {
            ...state.phaseData,
            [phase]: data,
          },
        };
        persist(newState);
        return newState;
      });
    },

    /** Mark current phase as approved and move to next */
    approvePhase(phase: Exclude<DesignPhase, 'completed'>) {
      update((state) => {
        const phases: DesignPhase[] = ['architecture', 'prd', 'plan', 'code', 'completed'];
        const currentIndex = phases.indexOf(state.currentPhase);
        const nextPhase = phases[currentIndex + 1] || 'completed';

        const newState: DesignWorkflowState = {
          ...state,
          currentPhase: nextPhase,
          userApprovals: {
            ...state.userApprovals,
            [phase]: true,
          },
        };
        persist(newState);
        return newState;
      });
    },

    /** Request changes to current phase (AI will iterate) */
    requestChanges(phase: Exclude<DesignPhase, 'completed'>, feedback: string) {
      // Store feedback but stay on same phase - AI will use this to iterate
      update((state) => {
        const newState = {
          ...state,
          phaseData: {
            ...state.phaseData,
            [`${phase}Feedback`]: feedback,
          },
        };
        persist(newState);
        return newState;
      });
    },

    /** Get current phase */
    getCurrentPhase(): DesignPhase {
      let current: DesignPhase = 'architecture';
      subscribe((state) => {
        current = state.currentPhase;
      })();
      return current;
    },

    /** Get phase data */
    getPhaseData(phase: Exclude<DesignPhase, 'completed'>): PhaseData[typeof phase] | undefined {
      let data: PhaseData[typeof phase] | undefined;
      subscribe((state) => {
        data = state.phaseData[phase];
      })();
      return data;
    },

    /** Check if workflow is active */
    isWorkflowActive(): boolean {
      let active = false;
      subscribe((state) => {
        active = state.isActive;
      })();
      return active;
    },

    /** Reset workflow */
    reset() {
      set(initialState);
      persist(initialState);
    },

    /** Mark workflow as complete */
    complete() {
      update((state) => {
        const newState: DesignWorkflowState = {
          ...state,
          currentPhase: 'completed',
          isActive: false,
          userApprovals: {
            ...state.userApprovals,
            completed: true,
          },
        };
        persist(newState);
        return newState;
      });
    },
  };
}

export const chatPhaseStore = createChatPhaseStore();

/** Derived store for current phase label */
export const currentPhaseLabel: Readable<string> = derived(
  chatPhaseStore,
  ($store) => {
    const labels: Record<DesignPhase, string> = {
      architecture: 'Architecture Design',
      prd: 'Product Requirements',
      plan: 'Implementation Plan',
      code: 'Code Generation',
      completed: 'Completed',
    };
    return labels[$store.currentPhase];
  }
);

/** Derived store for progress percentage */
export const workflowProgress: Readable<number> = derived(
  chatPhaseStore,
  ($store) => {
    const phases: DesignPhase[] = ['architecture', 'prd', 'plan', 'code', 'completed'];
    const currentIndex = phases.indexOf($store.currentPhase);
    return (currentIndex / (phases.length - 1)) * 100;
  }
);
