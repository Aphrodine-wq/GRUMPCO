<script lang="ts">
  /**
   * ScreenLayout – shared layout for full-page views: back button, title, optional subtitle, scrollable content.
   * Exceptions: Chat (ChatInterface) and SHIP (ShipMode) keep their own layout.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    children: Snippet;
  }

  let { title, subtitle, onBack, children }: Props = $props();
</script>

<div class="screen-layout">
  <header class="screen-header">
    {#if onBack}
      <button type="button" class="back-btn" onclick={onBack} aria-label="Back">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
    {/if}
    <h1 class="screen-title">{title}</h1>
    {#if subtitle}
      <p class="screen-subtitle">{subtitle}</p>
    {/if}
  </header>

  <div class="screen-content">
    {@render children()}
  </div>
</div>

<style>
  .screen-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 1.5rem;
    background: var(--color-bg-app, #f9fafb);
    font-family: system-ui, sans-serif;
  }

  .screen-header {
    flex-shrink: 0;
    margin-bottom: 1.5rem;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-bottom: 1rem;
    border: none;
    border-radius: 8px;
    background: var(--color-bg-card, #ffffff);
    color: var(--color-text-secondary, #374151);
    border: 1px solid var(--color-border, #e5e7eb);
    cursor: pointer;
    transition: all 0.15s;
    box-shadow: var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.04));
  }

  .back-btn:hover {
    background: var(--color-bg-card-hover, #f3f4f6);
    border-color: var(--color-border-highlight, #d1d5db);
  }

  .screen-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0 0 0.5rem 0;
    letter-spacing: -0.02em;
  }

  .screen-subtitle {
    font-size: 1rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    line-height: 1.5;
  }

  .screen-content {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
</style>
