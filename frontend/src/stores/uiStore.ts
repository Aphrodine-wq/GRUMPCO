import { writable } from 'svelte/store';

// UI state stores
export const showSettings = writable(false);
export const sidebarOpen = writable(true); // Default sidebar state
/** Sidebar collapsed state (for keyboard shortcut Ctrl/Cmd+B). */
export const sidebarCollapsed = writable(false);
/** When incremented, ChatInterface should focus the chat input (for keyboard shortcut Ctrl/Cmd+Shift+L). */
export const focusChatTrigger = writable(0);
