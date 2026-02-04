/* eslint-disable @typescript-eslint/no-non-null-assertion -- root mount target (Phase 1.1) */
import { mount } from 'svelte';
import App from './App.svelte';
import AuthGoogleStart from './components/AuthGoogleStart.svelte';
import AuthDone from './components/AuthDone.svelte';
import './style.css';

const target = document.getElementById('app')!;
const path = window.location.pathname;
const params = new URLSearchParams(window.location.search);
const route = params.get('route');

let app;

if (path === '/auth/google/start' || route === 'auth-google-start') {
  app = mount(AuthGoogleStart, { target });
} else if (path === '/auth/done' || route === 'auth-done') {
  app = mount(AuthDone, { target });
} else {
  app = mount(App, { target });

  // Signal Electron to show main window as soon as root app is mounted (don't rely on App.svelte onMount or 100ms delay)
  const grump = (window as unknown as { grump?: { closeSplashShowMain?: () => Promise<unknown> } })
    .grump;
  if (grump?.closeSplashShowMain) {
    grump.closeSplashShowMain().catch(() => {});
  }
}

export default app;
