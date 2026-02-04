import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export type ViewType =
  | 'chat'
  | 'settings'
  | 'askDocs'
  | 'voiceCode'
  | 'talkMode'
  | 'skills'
  | 'canvas'
  | 'swarm'
  | 'designToCode'
  | 'cost'
  | 'integrations'
  | 'approvals'
  | 'heartbeats'
  | 'memory'
  | 'auditLog'
  | 'advancedAI'
  | 'docker'
  | 'docker-setup'
  | 'cloud'
  | 'model-benchmark'
  | 'troubleshooting'
  | 'reset'
  | 'gAgent'
  | 'freeAgent';

const CHAT: ViewType = 'chat';

function createViewStore(currentView: Writable<ViewType>, view: ViewType): Writable<boolean> {
  return {
    subscribe: (fn: (value: boolean) => void) => currentView.subscribe((v) => fn(v === view)),
    set: (value: boolean) => {
      currentView.update((v) => (value ? view : v === view ? CHAT : v));
    },
    update: (fn: (value: boolean) => boolean) => {
      currentView.update((v) => (fn(v === view) ? view : v === view ? CHAT : v));
    },
  };
}

export const currentView = writable<ViewType>(CHAT);

export const showSettings = createViewStore(currentView, 'settings');
export const showAskDocs = createViewStore(currentView, 'askDocs');
export const showVoiceCode = createViewStore(currentView, 'voiceCode');
export const showTalkMode = createViewStore(currentView, 'talkMode');
export const showSkills = createViewStore(currentView, 'skills');
export const showCanvas = createViewStore(currentView, 'canvas');
export const showSwarm = createViewStore(currentView, 'swarm');
export const showDesignToCode = createViewStore(currentView, 'designToCode');
export const showCostDashboard = createViewStore(currentView, 'cost');
export const showIntegrations = createViewStore(currentView, 'integrations');
export const showApprovals = createViewStore(currentView, 'approvals');
export const showHeartbeats = createViewStore(currentView, 'heartbeats');
export const showMemory = createViewStore(currentView, 'memory');
export const showAuditLog = createViewStore(currentView, 'auditLog');
export const showAdvancedAI = createViewStore(currentView, 'advancedAI');
export const showDocker = createViewStore(currentView, 'docker');
export const showCloudDashboard = createViewStore(currentView, 'cloud');
export const showGAgent = createViewStore(currentView, 'gAgent');
/** @deprecated Use showGAgent instead */
export const showFreeAgent = createViewStore(currentView, 'freeAgent');

export const sidebarOpen = writable(true);

export function setCurrentView(view: ViewType): void {
  currentView.set(view);
}

/** Sidebar collapsed state (for keyboard shortcut Ctrl/Cmd+B). */
export const sidebarCollapsed = writable(false);

/** When true, show the Pricing/Upgrade modal. */
export const showPricing = writable(false);
/** When incremented, ChatInterface should focus the chat input (for keyboard shortcut Ctrl/Cmd+Shift+L). */
export const focusChatTrigger = writable(0);
