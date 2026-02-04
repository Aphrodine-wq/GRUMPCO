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
  import { analytics } from '$lib/analytics';

  export function initializeAnalytics(apiKey: string, host?: string, debug = false) {
    analytics.initialize({
      apiKey,
      host,
      debug,
      capture_pageview: true,
    });
  }
</script>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { analytics, isAnalyticsReady } from '$lib/analytics';

  // Props
  export let apiKey: string | undefined = undefined;
  export let host: string | undefined = undefined;
  export let debug: boolean = false;
  export let trackPageViews: boolean = true;

  let unsubscribe: (() => void) | undefined;

  onMount(() => {
    if (!browser) return;

    // Initialize with props if provided, otherwise use env vars
    const key = apiKey || import.meta.env.VITE_POSTHOG_API_KEY;
    const hostUrl = host || import.meta.env.VITE_POSTHOG_HOST;

    if (key && !analytics.isInitialized()) {
      analytics.initialize({
        apiKey: key,
        host: hostUrl,
        debug: debug || import.meta.env.DEV,
        capture_pageview: trackPageViews,
      });
    }

    // Track page views if enabled
    if (trackPageViews) {
      unsubscribe = page.subscribe(($page) => {
        if ($page.url) {
          const pageName = $page.url.pathname.split('/').pop() || 'home';
          analytics.pageView(pageName, {
            route: $page.route.id,
            params: $page.params,
          });
        }
      });
    }
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
</script>

<!-- This component doesn't render anything visible -->
{#if $isAnalyticsReady}
  <!-- Analytics initialized -->
{/if}
