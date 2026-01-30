import { mount } from 'svelte'
import App from './App.svelte'
import './style.css'
import { analytics, consentStore } from './lib/analytics'

// Initialize analytics consent from stored preferences
const storedConsent = localStorage.getItem('grump-consent')
if (storedConsent) {
  const parsed = JSON.parse(storedConsent)
  consentStore.grantConsent({
    analytics: parsed.analytics,
    marketing: parsed.marketing,
    functional: parsed.functional
  })
  analytics.updateConsent(parsed)
}

// Track initial page load performance
if (window.__GRUMP_PERF_START) {
  const loadTime = performance.now() - window.__GRUMP_PERF_START
  analytics.trackPerformance('app_initial_load', loadTime)
}

// Mark init complete
if ('performance' in window) {
  performance.mark('grump_init_complete')
  performance.measure('grump_init', 'grump_init_start', 'grump_init_complete')
}

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app

declare global {
  interface Window {
    __GRUMP_PERF_START: number
  }
}
