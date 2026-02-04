<script lang="ts">
  /**
   * ChatHeader Component
   *
   * Header bar for the chat interface with G-Agent controls.
   */
  import { Bot, Brain } from 'lucide-svelte';
  import KillSwitchButton from '../gAgent/KillSwitchButton.svelte';

  interface Props {
    /** Whether this is a G-Agent session */
    isGAgentSession?: boolean;
    /** Whether connected to G-Agent */
    isConnected?: boolean;
    /** Whether status panel is shown */
    showStatusPanel?: boolean;
    /** Whether memory panel is shown */
    showMemoryPanel?: boolean;
    /** Current model display name (shown in header when provided) */
    modelName?: string;
    /** Whether the model picker dropdown is open (shows active state on model button) */
    modelPickerOpen?: boolean;
    /** Called when G-Agent button clicked */
    onGAgentClick?: () => void;
    /** Called when status toggle clicked */
    onStatusToggle?: () => void;
    /** Called when memory toggle clicked */
    onMemoryToggle?: () => void;
    /** Called when model selector clicked */
    onModelClick?: () => void;
  }

  let {
    isGAgentSession = false,
    isConnected = false,
    showStatusPanel = false,
    showMemoryPanel = false,
    modelName,
    modelPickerOpen = false,
    onGAgentClick,
    onStatusToggle,
    onMemoryToggle,
    onModelClick,
  }: Props = $props();
</script>

<header class="chat-header">
  <button type="button" class="header-btn g-agent-btn" onclick={() => onGAgentClick?.()}>
    <span class="icon"><Bot size={16} /></span>
    <span>G-Agent</span>
  </button>

  {#if isGAgentSession}
    <button
      type="button"
      class="header-btn status-btn"
      class:active={showStatusPanel}
      onclick={() => onStatusToggle?.()}
    >
      <span class="status-dot" class:connected={isConnected}></span>
      <span>Status</span>
    </button>

    <button
      type="button"
      class="header-btn memory-btn"
      class:active={showMemoryPanel}
      onclick={() => onMemoryToggle?.()}
    >
      <span><Brain size={16} /></span>
      <span>Memory</span>
    </button>

    <div class="header-kill-switch">
      <KillSwitchButton size="sm" showLabel={false} />
    </div>
  {/if}

  <span class="header-spacer"></span>

  {#if modelName !== undefined && onModelClick}
    <div class="model-block">
      <span class="model-label-heading">Model</span>
      <div class="model-row">
        <span class="model-value">{modelName}</span>
        <button
          type="button"
          class="header-btn model-btn"
          class:active={modelPickerOpen}
          onclick={() => onModelClick()}
          title="Change model"
        >
          Change
        </button>
      </div>
    </div>
  {/if}
</header>

<style>
  .chat-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-bg-subtle, #faf5ff);
    border-bottom: 1px solid var(--color-border, #e9d5ff);
    flex-shrink: 0;
  }

  .header-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted, #6d28d9);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .header-btn:hover {
    background: rgba(124, 58, 237, 0.08);
    border-color: rgba(124, 58, 237, 0.2);
  }

  .header-btn.active {
    background: var(--color-primary, #7c3aed);
    color: white;
    border-color: var(--color-primary, #7c3aed);
  }

  .header-btn.g-agent-btn {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(99, 102, 241, 0.1));
    border: 1px solid rgba(124, 58, 237, 0.25);
    font-weight: 600;
  }

  .model-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.125rem;
    margin-top: -0.2rem;
  }

  .model-label-heading {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .model-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .model-value {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary, #4a4a5a);
  }

  .header-btn.model-btn {
    font-size: 0.75rem;
    color: var(--color-text-secondary, #4a4a5a);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
  }

  .status-dot.connected {
    background: #10b981;
    box-shadow: 0 0 4px #10b981;
  }

  .header-kill-switch {
    margin-left: 0.25rem;
  }

  .header-spacer {
    flex: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .header-btn {
      transition: none;
    }
  }
</style>
