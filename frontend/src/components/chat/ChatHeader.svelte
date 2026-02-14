<script lang="ts">
  /**
   * ChatHeader Component
   *
   * Header bar for the chat interface.
   */

  interface Props {
    /** Project/session name to show at top when user has entered a project (blank for new chats) */
    projectName?: string;
    /** Current model display name (shown in header when provided) */
    modelName?: string;
    /** Whether the model picker dropdown is open (shows active state on model button) */
    modelPickerOpen?: boolean;
    /** Current chat mode (normal, code, plan, design, etc.) */
    chatMode?: string;
    /** Workspace path for code mode */
    workspacePath?: string;
    /** Called when model selector clicked */
    onModelClick?: () => void;
  }

  let {
    projectName = '',
    modelName,
    modelPickerOpen = false,
    chatMode = 'normal',
    workspacePath = '',
    onModelClick,
  }: Props = $props();

  function getShortWorkspacePath(fullPath: string): string {
    const segments = fullPath.replace(/\\/g, '/').split('/');
    if (segments.length <= 3) return segments.join('/');
    return '…/' + segments.slice(-3).join('/');
  }

  const isCodeMode = $derived(chatMode === 'code');
  const shortWorkspace = $derived(workspacePath ? getShortWorkspacePath(workspacePath) : '');
</script>

<header class="chat-header">
  {#if projectName}
    <div class="project-name-block">
      <span class="project-name-label">Project</span>
      <span class="project-name-value">{projectName}</span>
    </div>
  {/if}

  {#if isCodeMode}
    <div class="code-mode-badge">
      <span class="code-mode-icon">&gt;_</span>
      <span class="code-mode-label">Code Mode</span>
    </div>
    {#if shortWorkspace}
      <div class="workspace-indicator" title={workspacePath}>
        <span class="workspace-icon">▷</span>
        <code class="workspace-path">{shortWorkspace}</code>
      </div>
    {/if}
  {/if}

  <span class="header-spacer"></span>

  {#if modelName !== undefined && onModelClick}
    <div class="model-block" title="Current model. Click to change.">
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
    transition: all 50ms ease-out;
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

  .code-mode-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.6rem;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 1rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: #22c55e;
  }

  .code-mode-icon {
    font-size: 0.75rem;
  }

  .code-mode-label {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .workspace-indicator {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    background: rgba(88, 166, 255, 0.06);
    border: 1px solid rgba(88, 166, 255, 0.12);
    border-radius: 0.5rem;
    font-size: 0.65rem;
    max-width: 20rem;
  }

  .workspace-icon {
    font-size: 0.7rem;
    flex-shrink: 0;
  }

  .workspace-path {
    color: #58a6ff;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.65rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: none;
    padding: 0;
  }
</style>
