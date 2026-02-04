<script lang="ts">
  /**
   * TrackFeature Component
   *
   * Wrapper component that tracks when users discover/interact with features
   *
   * ```svelte
   * <TrackFeature name="skills_panel" trigger="visible">
   *   <SkillsPanel />
   * </TrackFeature>
   * ```
   */
  import { analytics } from '$lib/analytics';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  export let name: string;
  export let trigger: 'visible' | 'click' | 'hover' | 'mount' = 'mount';
  export let properties: Record<string, unknown> = {};
  export let once: boolean = true;

  let element: HTMLElement;
  let hasTracked = false;
  let observer: IntersectionObserver | null = null;

  function trackFeature() {
    if (once && hasTracked) return;

    analytics.featureDiscovered(name, properties);
    hasTracked = true;
  }

  onMount(() => {
    if (!browser) return;

    switch (trigger) {
      case 'mount':
        trackFeature();
        break;

      case 'visible':
        if ('IntersectionObserver' in window) {
          observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  trackFeature();
                  if (once && observer) {
                    observer.disconnect();
                  }
                }
              });
            },
            { threshold: 0.5 }
          );

          if (element) {
            observer.observe(element);
          }
        }
        break;

      case 'click':
      case 'hover':
        // Handled by event listeners
        break;
    }
  });

  onDestroy(() => {
    if (observer) {
      observer.disconnect();
    }
  });

  function handleClick() {
    if (trigger === 'click') {
      trackFeature();
    }
  }

  function handleMouseEnter() {
    if (trigger === 'hover') {
      trackFeature();
    }
  }
</script>

<div
  bind:this={element}
  on:click={handleClick}
  on:mouseenter={handleMouseEnter}
  class="contents"
  data-feature-name={name}
>
  <slot />
</div>
