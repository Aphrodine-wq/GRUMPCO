<script lang="ts">
  import { codeSessionsStore } from '../stores/codeSessionsStore';

  interface Props {
    open?: boolean;
    onLoad?: (id: string) => void;
    onClose?: () => void;
  }

  let { open = $bindable(false), onLoad, onClose }: Props = $props();

  function handleSelect(id: string) {
    onLoad?.(id);
    open = false;
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      onClose?.();
      open = false;
    }
  }
</script>

<svelte:window onkeydown={handleEscape} />

{#if open}
  <div
    class="load-modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Load session"
    tabindex="-1"
    onclick={(e) => e.target === e.currentTarget && (onClose?.(), (open = false))}
  >
    <div class="load-modal" role="document" onclick={(e) => e.stopPropagation()}>
      <div class="load-modal-header">
        <h2 class="load-modal-title">Load session</h2>
        <button type="button" class="load-modal-close" onclick={() => (onClose?.(), (open = false))} aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="load-modal-list">
        {#if $codeSessionsStore.length === 0}
          <p class="load-modal-empty">No saved sessions</p>
        {:else}
          {#each $codeSessionsStore as session (session.id)}
            <button type="button" class="load-modal-item" onclick={() => handleSelect(session.id)}>
              <span class="load-modal-item-name">{session.name}</span>
              <span class="load-modal-item-meta">{new Date(session.updatedAt).toLocaleString()}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .load-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  .load-modal {
    width: 100%;
    max-width: 420px;
    max-height: 70vh;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .load-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
  }

  .load-modal-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1rem;
    font-weight: 600;
    color: #000;
    margin: 0;
  }

  .load-modal-close {
    background: #EBEBEB;
    color: #6B7280;
    border-radius: 6px;
    padding: 0.35rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .load-modal-close:hover {
    background: #E0E0E0;
    color: #000;
  }

  .load-modal-list {
    overflow-y: auto;
    padding: 0 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .load-modal-empty {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #6B7280;
    margin: 0;
    padding: 1.5rem;
    text-align: center;
  }

  .load-modal-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    padding: 0.75rem 1rem;
    background: #F5F5F5;
    border-radius: 6px;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    text-align: left;
    transition: background 0.15s;
  }

  .load-modal-item:hover {
    background: #EBEBEB;
  }

  .load-modal-item-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #000;
  }

  .load-modal-item-meta {
    font-size: 0.75rem;
    color: #6B7280;
  }
</style>
