/**
 * @fileoverview Theme management — dark/light mode, accent colors, and font sizes.
 *
 * Extracted from App.svelte to keep the root component focused on layout.
 * @module lib/themeManager
 */

import { get } from 'svelte/store';
import { newOnboardingStore } from '../stores/newOnboardingStore';

// ─── Accent palette ───────────────────────────────────────────────────────────

const ACCENT_PRIMARY: Record<string, string> = {
  purple: '#7c3aed',
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  rose: '#e11d48',
  teal: '#0d9488',
  indigo: '#4f46e5',
  orange: '#ea580c',
  cyan: '#0891b2',
  slate: '#475569',
};

const ACCENT_HOVER: Record<string, string> = {
  purple: '#6d28d9',
  blue: '#1d4ed8',
  green: '#047857',
  amber: '#b45309',
  rose: '#be123c',
  teal: '#0f766e',
  indigo: '#4338ca',
  orange: '#c2410c',
  cyan: '#0e7490',
  slate: '#334155',
};

const FONT_SCALES: Record<string, string> = {
  small: '13px',
  medium: '14px',
  large: '15px',
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve the active theme from the onboarding store and apply the
 * `data-theme` attribute to `<html>`.
 */
export function applyTheme(): void {
  const data = get(newOnboardingStore);
  const theme = data?.theme ?? 'system';
  const resolved =
    theme === 'system'
      ? typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', resolved);
  }
}

/**
 * Read the user's saved accent color and font-size preference from
 * `localStorage` and apply them as CSS custom properties on `:root`.
 */
export function applyAccentAndFont(): void {
  try {
    const a = localStorage.getItem('g-rump-accent');
    const f = localStorage.getItem('g-rump-font-size');
    const root = document.documentElement;
    if (a && ACCENT_PRIMARY[a]) {
      root.style.setProperty('--color-primary', ACCENT_PRIMARY[a]);
      if (ACCENT_HOVER[a]) root.style.setProperty('--color-primary-hover', ACCENT_HOVER[a]);
    }
    if (f === 'small' || f === 'medium' || f === 'large')
      root.style.setProperty('--app-font-size', FONT_SCALES[f]);
  } catch {
    /* ignore — localStorage may be unavailable */
  }
}

/**
 * Initialise theme management: apply saved values, subscribe to store
 * changes, and listen for OS-level `prefers-color-scheme` changes.
 *
 * @returns A cleanup function that removes all listeners/subscriptions.
 */
export function initTheme(): () => void {
  applyTheme();
  applyAccentAndFont();

  const unsubTheme = newOnboardingStore.subscribe(() => applyTheme());

  let mediaQuery: MediaQueryList | null = null;
  if (typeof window !== 'undefined') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
  }

  return () => {
    unsubTheme();
    if (mediaQuery) mediaQuery.removeEventListener('change', applyTheme);
  };
}
