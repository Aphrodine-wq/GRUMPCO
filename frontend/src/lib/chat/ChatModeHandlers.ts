/**
 * Chat mode toggle handlers extracted from RefactoredChatInterface.
 * Pure functions that take store references and state setters as params.
 */
import { get } from 'svelte/store';
import type { Readable, Writable } from 'svelte/store';
import { startDesignWorkflow } from '../../lib/api';
import { showToast } from '../../stores/toastStore';

export type ChatMode =
  | 'normal'
  | 'plan'
  | 'spec'
  | 'ship'
  | 'execute'
  | 'design'
  | 'argument'
  | 'code';

export type StoreChatMode = 'none' | 'design' | 'code' | 'argument';

export interface ModeHandlerDeps {
  chatModeStore: {
    setMode: (mode: StoreChatMode) => void;
    clearMode: () => void;
    subscribe: Readable<StoreChatMode>['subscribe'];
  };
  chatPhaseStore: {
    startWorkflow: (desc: string) => void;
    reset: () => void;
    subscribe: Readable<{ isActive: boolean }>['subscribe'];
  };
  currentSession: Readable<{ id?: string; description?: string } | null>;
  setChatMode: (mode: ChatMode) => void;
  getChatMode: () => ChatMode;
}

export function setModeArchitecture(deps: ModeHandlerDeps) {
  const storeVal = get(deps.chatModeStore as unknown as Readable<StoreChatMode>);
  if (storeVal === 'design') {
    deps.chatModeStore.clearMode();
    deps.setChatMode('normal');
    deps.chatPhaseStore.reset();
  } else {
    deps.chatModeStore.setMode('design');
    deps.setChatMode('design');
    // Start design workflow if not already active
    const phaseState = get(deps.chatPhaseStore as unknown as Readable<{ isActive: boolean }>);
    const session = get(deps.currentSession);
    if (!phaseState.isActive && session) {
      startDesignWorkflow(session.description || 'New Project', session.id!)
        .then((result) => {
          deps.chatPhaseStore.startWorkflow(
            result.workflowState.projectDescription || 'New Project'
          );
          showToast('Design workflow started! Describe your project to begin.', 'success');
        })
        .catch((err) => {
          console.error('Failed to start design workflow:', err);
        });
    }
  }
}

export function setModeCode(deps: ModeHandlerDeps) {
  const storeVal = get(deps.chatModeStore as unknown as Readable<StoreChatMode>);
  if (storeVal === 'code') {
    deps.chatModeStore.clearMode();
    deps.setChatMode('normal');
  } else {
    deps.chatModeStore.setMode('code');
    deps.setChatMode('code');
  }
}

export function setModeShip(deps: ModeHandlerDeps) {
  if (deps.getChatMode() === 'ship') {
    const storeMode = get(deps.chatModeStore as unknown as Readable<StoreChatMode>);
    deps.setChatMode(storeMode === 'design' ? 'design' : storeMode === 'code' ? 'code' : 'normal');
  } else {
    deps.setChatMode('ship');
  }
}

export function setModeArgument(deps: ModeHandlerDeps) {
  const storeVal = get(deps.chatModeStore as unknown as Readable<StoreChatMode>);
  if (storeVal === 'argument') {
    deps.chatModeStore.clearMode();
    deps.setChatMode('normal');
  } else {
    deps.chatModeStore.setMode('argument');
    deps.setChatMode('argument');
  }
}

export function setModePlan(deps: ModeHandlerDeps) {
  if (deps.getChatMode() === 'plan') {
    deps.chatModeStore.clearMode();
    deps.setChatMode('normal');
  } else {
    deps.chatModeStore.setMode('code');
    deps.setChatMode('plan');
    window.dispatchEvent(new CustomEvent('switch-plan-mode'));
  }
}

export function setModeSpec(deps: ModeHandlerDeps) {
  if (deps.getChatMode() === 'spec') {
    deps.chatModeStore.clearMode();
    deps.setChatMode('normal');
  } else {
    deps.chatModeStore.setMode('code');
    deps.setChatMode('spec');
    window.dispatchEvent(new CustomEvent('switch-spec-mode'));
  }
}
