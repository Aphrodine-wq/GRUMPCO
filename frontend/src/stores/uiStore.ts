import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export type ViewType =
  | 'chat'
  | 'settings'
  | 'projects'
  | 'askDocs'
  | 'voiceCode'
  | 'talkMode'
  | 'canvas'
  | 'designToCode'
  | 'cost'
  | 'credits'
  | 'integrations'
  | 'approvals'
  | 'gAgent'
  | 'heartbeats'
  | 'memory'
  | 'auditLog'
  | 'docker'
  | 'docker-setup'
  | 'cloud'
  | 'troubleshooting'
  | 'github'
  | 'analytics'
  | 'reset';

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
export const showProjects = createViewStore(currentView, 'projects');
export const showAskDocs = createViewStore(currentView, 'askDocs');
export const showVoiceCode = createViewStore(currentView, 'voiceCode');
export const showTalkMode = createViewStore(currentView, 'talkMode');
export const showCanvas = createViewStore(currentView, 'canvas');
export const showDesignToCode = createViewStore(currentView, 'designToCode');
export const showCostDashboard = createViewStore(currentView, 'cost');
export const showCredits = createViewStore(currentView, 'credits');
export const showIntegrations = createViewStore(currentView, 'integrations');
export const showApprovals = createViewStore(currentView, 'approvals');
export const showHeartbeats = createViewStore(currentView, 'heartbeats');

export const showMemory = createViewStore(currentView, 'memory');
export const showAuditLog = createViewStore(currentView, 'auditLog');
export const showDocker = createViewStore(currentView, 'docker');
export const showCloudDashboard = createViewStore(currentView, 'cloud');

export const sidebarOpen = writable(true);

export function setCurrentView(view: ViewType): void {
  currentView.set(view);
}

/** Sidebar collapsed state (for keyboard shortcut Ctrl/Cmd+B). */
export const sidebarCollapsed = writable(false);

/** When set, Settings opens with this tab (e.g. 'ai' from Model Picker "Connect more models"). Cleared after use. */
export const settingsInitialTab = writable<string | undefined>(undefined);

/** When true, show the Pricing/Upgrade modal. */
export const showPricing = writable(false);
/** When incremented, ChatInterface should focus the chat input (for keyboard shortcut Ctrl/Cmd+Shift+L). */
export const focusChatTrigger = writable(0);

/** When true, show the Command Palette (Ctrl/Cmd+K). */
export const commandPaletteOpen = writable(false);

/** When true, the chat is actively streaming a response. Used to lock navigation. */
export const chatStreaming = writable(false);
