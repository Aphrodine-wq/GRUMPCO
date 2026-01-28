import { writable } from 'svelte/store';

// UI state stores
export const showSettings = writable(false);
export const sidebarOpen = writable(true); // Default sidebar state
