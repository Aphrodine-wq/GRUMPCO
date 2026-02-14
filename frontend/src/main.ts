/* eslint-disable @typescript-eslint/no-non-null-assertion -- root mount target (Phase 1.1) */

// CRITICAL: Catch and suppress errors from browser extensions (e.g., mce-autosize-textarea, overlay_bundle.js)
// These are not our errors but can crash the app if uncaught
window.addEventListener('error', (event) => {
  const msg = event.message || '';
  const src = event.filename || '';
  // Suppress known browser extension errors
  if (
    msg.includes('custom element') ||
    msg.includes('already been defined') ||
    src.includes('overlay_bundle') ||
    src.includes('webcomponents-ce') ||
    src.includes('extension')
  ) {
    console.warn('[G-Rump] Suppressing browser extension error:', msg);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  return;
});

import { mount } from 'svelte';
import App from './App.svelte';
import AuthGoogleStart from './components/AuthGoogleStart.svelte';
import AuthDone from './components/AuthDone.svelte';
import './style.css';
import './styles/performance.css';

// Apply theme immediately from localStorage (before first paint) so dark mode works
(function applyInitialTheme() {
  try {
    const stored = localStorage.getItem('g-rump-onboarding-v2');
    const data = stored ? JSON.parse(stored) : null;
    const theme = data?.theme ?? 'dark';
    const resolved =
      theme === 'system'
        ? typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (_) {
    /* ignore */
  }
})();

const target = document.getElementById('app')!;
const path = window.location.pathname;
const params = new URLSearchParams(window.location.search);
const route = params.get('route');

let app: ReturnType<typeof mount> | undefined;

if (path === '/auth/google/start' || route === 'auth-google-start') {
  app = mount(AuthGoogleStart, { target });
} else if (path === '/auth/done' || route === 'auth-done') {
  app = mount(AuthDone, { target });
} else {
  app = mount(App, { target });
}

export default app;
