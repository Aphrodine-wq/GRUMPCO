<script lang="ts">
  /**
   * ChatHeader Component
   *
   * Header bar for the chat interface with G-Agent controls.
   */
  import { Bot, Brain } from 'lucide-svelte';
  import KillSwitchButton from '../gAgent/KillSwitchButton.svelte';

  interface Props {
    /** Project/session name to show at top when user has entered a project (blank for new chats) */
    projectName?: string;
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
    /** Called when user wants to leave G-Agent mode */
    onLeaveGAgent?: () => void;
  }

  let {
    projectName = '',
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
    onLeaveGAgent,
  }: Props = $props();
</script>

<header class="chat-header">
  {#if projectName}
    <div class="project-name-block">
      <span class="project-name-label">Project</span>
      <span class="project-name-value">{projectName}</span>
    </div>
  {/if}
  <!-- G-Agent / Use G-Agent moved to bottom-right of chat interface -->

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

    <button
      type="button"
      class="header-btn leave-g-agent-btn"
      onclick={() => onLeaveGAgent?.()}
      title="Leave G-Agent mode and return to normal chat"
    >
      <span>Leave G-Agent</span>
    </button>
  {/if}

  <span class="header-spacer"></span>

  {#if modelName !== undefined && onModelClick}
    <div
      class="model-block"
      title="Current model. Click to change."
    >
      <span class="model-label-heading">Model</span>
      <button
        type="button"
        class="model-trigger"
        class:active={modelPickerOpen}
        onclick={() => onModelClick()}
        title="Change model"
      >
        <span class="model-value">{modelName}</span>
        <span class="model-change-label">Change</span>
      </button>
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

  .model-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
    margin-right: 0.5rem;
  }

  .model-label-heading {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .model-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #1f1147);
    background: var(--color-bg-card, #ffffff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 10px;
    cursor: pointer;
    transition:
      background 0.2s,
      border-color 0.2s,
      box-shadow 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }

  .model-trigger:hover {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.08));
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.14);
  }

  .model-trigger.active {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.12));
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
    box-shadow: 0 0 0 1px var(--color-primary, #7c3aed);
  }

  .model-value {
    font-weight: 600;
    color: inherit;
  }

  .model-change-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-primary, #7c3aed);
  }

  .model-trigger.active .model-change-label {
    color: inherit;
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

  .header-btn.leave-g-agent-btn {
    color: var(--color-text-muted, #6b7280);
    font-weight: 500;
  }

  .header-btn.leave-g-agent-btn:hover {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.2);
    color: var(--color-error, #ef4444);
  }

  .header-spacer {
    flex: 1;
  }

  .project-name-block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
    margin-right: 0.5rem;
  }

  .project-name-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .project-name-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text, #1f2937);
  }

  @media (prefers-reduced-motion: reduce) {
    .header-btn {
      transition: none;
    }
  }
</style>
