<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  interface Props {
    message: string;
  }
  let { message }: Props = $props();

  const LOADING_TIPS = [
    'Tip: Use Ctrl+B to toggle the sidebar.',
    'Tip: Press / to focus the chat input.',
    'Tip: Ctrl+K opens the command palette.',
    'Tip: Double-click the title bar to maximize.',
  ];

  const tipIndexStore = writable(0);

  onMount(() => {
    const id = setInterval(() => {
      tipIndexStore.update((n) => (n + 1) % LOADING_TIPS.length);
    }, 4000);
    return () => clearInterval(id);
  });
</script>

<div class="view-loading" role="status" aria-live="polite">
  <div class="view-loading-spinner" aria-hidden="true"></div>
  <p class="view-loading-message">{message}</p>
  <p class="view-loading-tip">{LOADING_TIPS[$tipIndexStore]}</p>
</div>

<style>
  .view-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 2rem;
    min-height: 200px;
  }
  .view-loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border, #e5e7eb);
    border-top-color: var(--color-primary, #6366f1);
    border-radius: 50%;
    animation: view-loading-spin 0.7s linear infinite;
  }
  .view-loading-message {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted, #6b7280);
  }
  .view-loading-tip {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    opacity: 0.85;
  }
  @keyframes view-loading-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
