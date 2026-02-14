<script lang="ts">
  /**
   * ChatModeHeader Component
   *
   * Displays Agent button and provides keyboard shortcut hint.
   * Mode tabs (Argument, Plan, Spec, SHIP) removed - now automatic.
   */
  import { setCurrentView } from '../../stores/uiStore';
  import { Bot, Brain } from 'lucide-svelte';

  interface Props {
    /** Whether this is an Agent session */
    isAgentSession?: boolean;
    /** Whether memory panel is shown */
    showMemoryPanel?: boolean;
    /** Callback when memory panel toggle is clicked */
    onMemoryToggle?: () => void;
  }

  let { isAgentSession = false, showMemoryPanel = false, onMemoryToggle }: Props = $props();

  function openAgent() {
    setCurrentView('gAgent');
  }
</script>

<header class="chat-mode-header">
  <button type="button" class="mode-pill agent-btn" onclick={openAgent} title="Agent">
    <span class="agent-icon"><Bot size={16} /></span> Agent
  </button>

  {#if isAgentSession}
    <button
      type="button"
      class="mode-pill memory-toggle"
      class:active={showMemoryPanel}
      onclick={() => onMemoryToggle?.()}
      title="Agent Memory"
    >
      <Brain size={16} /> Memory
    </button>
  {/if}

  <span class="mode-header-hint">
    <kbd>Ctrl</kbd>+<kbd>K</kbd> to search
  </span>
</header>

<style>
  .chat-mode-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--color-bg-subtle, #f5f3ff);
    border-bottom: 1px solid var(--color-border, #e9d5ff);
    flex-shrink: 0;
  }

  .mode-pill {
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted, #6d28d9);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 50ms ease-out;
  }

  .mode-pill:hover {
    color: var(--color-primary, #7c3aed);
    border-color: var(--color-border-highlight, #d8b4fe);
  }

  .mode-pill.agent-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(99, 102, 241, 0.1));
    border: 1px solid rgba(124, 58, 237, 0.3);
    font-weight: 600;
  }

  .mode-pill.agent-btn:hover {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(99, 102, 241, 0.2));
    border-color: var(--color-primary, #7c3aed);
  }

  .agent-icon {
    font-size: 14px;
  }

  .mode-pill.active {
    color: white;
    background: var(--color-primary, #7c3aed);
    border-color: var(--color-primary, #7c3aed);
  }

  .mode-pill.memory-toggle {
    margin-left: auto;
    margin-right: 1rem;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .mode-pill.memory-toggle.active {
    background: linear-gradient(135deg, #8b5cf6, #3b82f6);
    color: white;
  }

  .mode-header-hint {
    margin-left: auto;
    font-size: 11px;
    color: var(--color-text-muted, #6d28d9);
  }

  .mode-header-hint kbd {
    padding: 2px 4px;
    font-size: 10px;
    background: var(--color-bg-subtle, #f5f3ff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-pill {
      transition: none;
    }
  }
</style>
