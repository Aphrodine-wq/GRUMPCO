/**
 * @fileoverview Global keyboard shortcut registration.
 *
 * Extracted from App.svelte so shortcuts are declared in one place and
 * easily discoverable / testable.
 * @module lib/keyboardShortcuts
 */

import {
    commandPaletteOpen,
    sidebarCollapsed,
    focusChatTrigger,
} from '../stores/uiStore';

/**
 * Register all global keyboard shortcuts.
 *
 * | Shortcut                | Action                   |
 * |-------------------------|--------------------------|
 * | `Ctrl/⌘ + K`           | Toggle command palette   |
 * | `Ctrl/⌘ + B`           | Toggle sidebar           |
 * | `Ctrl/⌘ + Shift + L`   | Focus chat input         |
 * | `/` (outside inputs)    | Focus chat input         |
 *
 * @returns A cleanup function that removes the listener.
 */
export function registerKeyboardShortcuts(): () => void {
    function onKeydown(e: KeyboardEvent) {
        const mod = e.metaKey || e.ctrlKey;

        if (mod && e.key === 'k') {
            e.preventDefault();
            commandPaletteOpen.update((v) => !v);
            return;
        }

        if (mod && e.key === 'b') {
            e.preventDefault();
            sidebarCollapsed.update((v) => !v);
            return;
        }

        if (
            (mod && e.shiftKey && e.key === 'L') ||
            (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey)
        ) {
            const target = e.target as HTMLElement;
            if (target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                focusChatTrigger.update((n) => n + 1);
            }
        }
    }

    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
}
