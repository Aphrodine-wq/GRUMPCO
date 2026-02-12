import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { commandPaletteOpen, sidebarCollapsed, focusChatTrigger } from '../stores/uiStore';

// Must import after mocks are set up
import { registerKeyboardShortcuts } from './keyboardShortcuts';

/** Helper: dispatch a keyboard event on `window`. */
function press(key: string, opts: Partial<KeyboardEvent> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
}

describe('keyboardShortcuts', () => {
  let cleanup: () => void;

  beforeEach(() => {
    // Reset stores to known state
    commandPaletteOpen.set(false);
    sidebarCollapsed.set(false);
    focusChatTrigger.set(0);
    cleanup = registerKeyboardShortcuts();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Ctrl+K → command palette ───────────────────────────────────────────────

  it('Ctrl+K should toggle commandPaletteOpen', () => {
    expect(get(commandPaletteOpen)).toBe(false);
    press('k', { ctrlKey: true });
    expect(get(commandPaletteOpen)).toBe(true);
    press('k', { ctrlKey: true });
    expect(get(commandPaletteOpen)).toBe(false);
  });

  it('Meta+K should toggle commandPaletteOpen (macOS)', () => {
    press('k', { metaKey: true });
    expect(get(commandPaletteOpen)).toBe(true);
  });

  // ── Ctrl+B → sidebar ──────────────────────────────────────────────────────

  it('Ctrl+B should toggle sidebarCollapsed', () => {
    expect(get(sidebarCollapsed)).toBe(false);
    press('b', { ctrlKey: true });
    expect(get(sidebarCollapsed)).toBe(true);
    press('b', { ctrlKey: true });
    expect(get(sidebarCollapsed)).toBe(false);
  });

  // ── Ctrl+Shift+L → focus chat ─────────────────────────────────────────────

  it('Ctrl+Shift+L should increment focusChatTrigger', () => {
    expect(get(focusChatTrigger)).toBe(0);
    press('L', { ctrlKey: true, shiftKey: true });
    expect(get(focusChatTrigger)).toBe(1);
  });

  // ── / outside inputs → focus chat ─────────────────────────────────────────

  it('/ should increment focusChatTrigger when target is not an input', () => {
    expect(get(focusChatTrigger)).toBe(0);
    press('/');
    expect(get(focusChatTrigger)).toBe(1);
  });

  it('/ should NOT trigger when target is an INPUT element', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Dispatch directly on the input to simulate typing
    const event = new KeyboardEvent('keydown', {
      key: '/',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input, writable: false });
    window.dispatchEvent(event);

    expect(get(focusChatTrigger)).toBe(0);
    document.body.removeChild(input);
  });

  it('/ should NOT trigger when target is a TEXTAREA element', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new KeyboardEvent('keydown', {
      key: '/',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: textarea, writable: false });
    window.dispatchEvent(event);

    expect(get(focusChatTrigger)).toBe(0);
    document.body.removeChild(textarea);
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────

  it('cleanup should remove event listener', () => {
    cleanup();
    const before = get(commandPaletteOpen);
    press('k', { ctrlKey: true });
    expect(get(commandPaletteOpen)).toBe(before); // unchanged
  });

  // ── Unrelated keys should not trigger anything ─────────────────────────────

  it('plain letter keys should not affect stores', () => {
    press('a');
    press('z');
    expect(get(commandPaletteOpen)).toBe(false);
    expect(get(sidebarCollapsed)).toBe(false);
    expect(get(focusChatTrigger)).toBe(0);
  });
});
