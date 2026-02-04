<script lang="ts">
  import { onMount } from 'svelte';

  /** Custom title bar for frameless Electron window. Only shown when grump?.isElectron. */

  const grump =
    typeof window !== 'undefined'
      ? (
          window as {
            grump?: {
              isElectron?: boolean;
              window?: {
                minimize: () => Promise<void>;
                maximize: () => Promise<void>;
                unmaximize: () => Promise<void>;
                close: () => Promise<void>;
                isMaximized: () => Promise<boolean>;
                setAlwaysOnTop?: (flag: boolean) => Promise<void>;
                isAlwaysOnTop?: () => Promise<boolean>;
                onMaximizedChange?: (cb: (v: boolean) => void) => () => void;
              };
            };
          }
        ).grump
      : undefined;

  let isMaximized = $state(false);
  let isAlwaysOnTop = $state(false);

  onMount(() => {
    if (!grump?.window) return;
    grump.window.isMaximized().then((v) => {
      isMaximized = v;
    });
    grump.window.isAlwaysOnTop?.().then((v) => {
      isAlwaysOnTop = v;
    });
    const unsub = grump.window.onMaximizedChange?.((v) => {
      isMaximized = v;
    });
    return () => unsub?.();
  });

  function minimize() {
    grump?.window?.minimize?.();
  }

  function toggleMaximize() {
    if (isMaximized) grump?.window?.unmaximize?.();
    else grump?.window?.maximize?.();
  }

  function toggleAlwaysOnTop() {
    const next = !isAlwaysOnTop;
    grump?.window?.setAlwaysOnTop?.(next);
    isAlwaysOnTop = next;
  }

  function close() {
    grump?.window?.close?.();
  }
</script>

{#if grump?.isElectron && grump?.window}
  <header class="electron-title-bar">
    <div
      class="title-bar-drag"
      role="button"
      tabindex="-1"
      ondblclick={(e) => {
        e.preventDefault();
        toggleMaximize();
      }}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleMaximize();
        }
      }}
    >
      <svg class="title-bar-logo" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <circle cx="50" cy="50" r="45" stroke="currentColor" stroke-width="6" opacity="0.9" />
        <circle cx="35" cy="40" r="5" fill="currentColor" />
        <circle cx="65" cy="40" r="5" fill="currentColor" />
        <path
          d="M 30 65 Q 50 55 70 65"
          stroke="currentColor"
          stroke-width="5"
          stroke-linecap="round"
          fill="none"
        />
      </svg>
      <span class="title-bar-title">G-Rump</span>
    </div>
    <div class="title-bar-controls" style="-webkit-app-region: no-drag;">
      <button type="button" class="title-bar-btn" onclick={minimize} aria-label="Minimize">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <line x1="0" y1="6" x2="12" y2="6" />
        </svg>
      </button>
      <button
        type="button"
        class="title-bar-btn"
        onclick={toggleMaximize}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
      >
        {#if isMaximized}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="1" y="3" width="8" height="8" rx="0.5" />
            <path d="M4 1v2h7v7h2" />
          </svg>
        {:else}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="0" y="0" width="12" height="12" rx="0.5" />
          </svg>
        {/if}
      </button>
      <button
        type="button"
        class="title-bar-btn"
        class:title-bar-pinned={isAlwaysOnTop}
        onclick={toggleAlwaysOnTop}
        aria-label={isAlwaysOnTop ? 'Unpin (not always on top)' : 'Pin (always on top)'}
        title={isAlwaysOnTop ? 'Unpin window' : 'Keep window on top'}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        >
          <path d="M6 2v8M4 3h4" />
        </svg>
      </button>
      <button
        type="button"
        class="title-bar-btn title-bar-close"
        onclick={close}
        aria-label="Close"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <line x1="1" y1="1" x2="11" y2="11" />
          <line x1="11" y1="1" x2="1" y2="11" />
        </svg>
      </button>
    </div>
  </header>
{/if}

<style>
  .electron-title-bar {
    -webkit-app-region: drag;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    min-height: 36px;
    padding: 0 12px;
    background: var(--color-bg-subtle, #f0f2f5);
    border-bottom: 1px solid var(--color-border, rgba(0, 0, 0, 0.12));
    flex-shrink: 0;
  }

  .title-bar-drag {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .title-bar-logo {
    width: 24px;
    height: 24px;
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .title-bar-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text, #1d1d1f);
  }

  .title-bar-controls {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .title-bar-btn {
    -webkit-app-region: no-drag;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-secondary, #6e6e73);
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .title-bar-btn:hover {
    background: rgba(0, 0, 0, 0.06);
    color: var(--color-text, #1d1d1f);
  }

  .title-bar-pinned {
    color: var(--color-primary, #7c3aed);
  }

  .title-bar-close:hover {
    background: #e81123;
    color: #fff;
  }

  .title-bar-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
  }
</style>
