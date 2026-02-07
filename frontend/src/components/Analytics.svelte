<script context="module" lang="ts">
  /**
   * Analytics Component
   *
   * Usage: Add this component to your root layout to automatically track page views
   *
   * ```svelte
   * <Analytics />
   * ```
   *
   * Or with custom configuration:
   * ```svelte
   * <Analytics
   *   apiKey={yourKey}
   *   host={yourHost}
   *   debug={true}
   * />
   * ```
   */
  import { track, trackScreenView } from '../lib/analytics';

  export function initializeAnalytics(_apiKey: string, _host?: string, _debug = false) {
    // Analytics is initialized by the module itself — no explicit init needed
    track('analytics_init', { host: _host, debug: _debug });
  }
</script>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Props
  export let apiKey: string | undefined = undefined;
  export let host: string | undefined = undefined;
  export let debug: boolean = false;
  export let trackPageViews: boolean = true;

  let _initialized = false;
  let unsubscribe: (() => void) | undefined;

  onMount(() => {
    if (typeof window === 'undefined') return;

    // Initialize with props if provided
    const _key = apiKey || import.meta.env.VITE_POSTHOG_API_KEY;
    const _hostUrl = host || import.meta.env.VITE_POSTHOG_HOST;

    if (_key && !_initialized) {
      track('analytics_setup', {
        host: _hostUrl,
        debug: debug || import.meta.env.DEV,
        capturePageview: trackPageViews,
      });
      _initialized = true;
    }

    // Track page views if enabled
    if (trackPageViews) {
      // Use a simple location-based tracker instead of SvelteKit's page store
      const handlePopState = () => {
        const pageName = window.location.pathname.split('/').pop() || 'home';
        trackScreenView(pageName);
      };
      window.addEventListener('popstate', handlePopState);
      // Track initial page
      handlePopState();
      unsubscribe = () => window.removeEventListener('popstate', handlePopState);
    }
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
</script>

<!-- This component doesn't render anything visible -->
