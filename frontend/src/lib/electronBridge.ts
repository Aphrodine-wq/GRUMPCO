/**
 * @fileoverview Electron bridge — tray commands, wake word,
 * and `grump://` protocol URL handling.
 *
 * Extracted from App.svelte so the root component stays
 * framework-agnostic and testable without Electron.
 * @module lib/electronBridge
 */

import { get } from 'svelte/store';
import { setCurrentView } from '../stores/uiStore';
import { workspaceStore } from '../stores/workspaceStore';
import { setUserAndSession } from '../stores/authStore';

// ─── Type helpers ─────────────────────────────────────────────────────────────

interface GrumpBridge {
  isElectron?: boolean;
  onAppCommand?: (event: string, callback: () => void) => () => void;
  onProtocolUrl?: (callback: (url: string) => void) => () => void;
  openPath?: (path: string) => Promise<{ error?: string }>;
}

interface GrumpWithWakeWord extends GrumpBridge {
  wakeWord?: { onDetected?: (cb: () => void) => () => void };
}

function getGrump(): GrumpBridge | undefined {
  return (window as { grump?: GrumpBridge }).grump;
}

// ─── Protocol handler ─────────────────────────────────────────────────────────

function handleProtocolUrl(url: string): void {
  if (url.startsWith('grump://auth/done')) {
    try {
      const parsed = new URL(url);
      const accessToken = parsed.searchParams.get('access_token');
      const userId = parsed.searchParams.get('user_id');
      const email = parsed.searchParams.get('email') ?? '';
      if (accessToken && userId) {
        setUserAndSession(
          { id: userId, email, name: email.split('@')[0] },
          { access_token: accessToken }
        );
      }
    } catch (_) {
      /* ignore parse errors */
    }
    return;
  }
  const path = url.replace(/^grump:\/\//i, '').split('/')[0] || '';
  if (path === 'settings') setCurrentView('settings');
  else if (path === 'chat' || !path) setCurrentView('chat');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise all Electron-specific integrations.
 *
 * - Registers tray quick-action handlers (focus chat, settings, open workspace).
 * - Listens for wake-word detection and switches to Talk Mode.
 * - Handles `grump://` protocol URLs (auth callback, deep links).
 *
 * This is a no-op when running in a regular browser.
 *
 * @returns A cleanup function that removes all subscriptions.
 */
export function initElectronBridge(): () => void {
  const grump = getGrump();
  if (!grump?.isElectron) return () => {};

  const unsubs: (() => void)[] = [];

  // Wake word → Talk Mode
  const grumpAny = grump as GrumpWithWakeWord;
  if (grumpAny.wakeWord?.onDetected) {
    unsubs.push(grumpAny.wakeWord.onDetected(() => setCurrentView('talkMode')));
  }

  // Tray quick actions
  if (grump.onAppCommand) {
    unsubs.push(grump.onAppCommand('app:focus-chat', () => setCurrentView('chat')));
    unsubs.push(grump.onAppCommand('app:focus-settings', () => setCurrentView('settings')));
    unsubs.push(
      grump.onAppCommand('app:open-workspace', () => {
        const root = get(workspaceStore).root;
        if (root && grump.openPath) grump.openPath(root).catch(() => {});
      })
    );
  }

  // Protocol URL handler
  if (grump.onProtocolUrl) {
    unsubs.push(grump.onProtocolUrl(handleProtocolUrl));
  }

  return () => unsubs.forEach((u) => u());
}
