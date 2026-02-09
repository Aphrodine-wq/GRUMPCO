<script lang="ts">
  /**
   * StreamingIndicator Component
   *
   * Shows a visual indicator when the AI is generating a response.
   * Claude Code-inspired: shows current file being worked on.
   * G-Rump branded status messages that rotate for personality.
   */
  import FrownyFace from '../FrownyFace.svelte';

  interface ActiveFileInfo {
    path: string;
    shortPath: string;
    action: 'writing' | 'reading' | 'editing' | 'searching' | 'executing' | 'tool';
  }

  interface Props {
    streaming?: boolean;
    status?: string;
    /** Comma-separated tool names when multiple tools are running (e.g. "file_write, read_file"). */
    toolSummary?: string;
    /** Currently active files from tool calls — displayed Claude Code-style. */
    activeFiles?: ActiveFileInfo[];
    showAvatar?: boolean;
    variant?: 'inline' | 'bubble';
  }

  let {
    streaming = true,
    status = 'Thinking...',
    toolSummary,
    activeFiles = [],
    showAvatar = true,
    variant = 'bubble',
  }: Props = $props();

  // Fun rotating status messages when just "Thinking..."
  const grumpPhrases = [
    'Grumping...',
    'Working on it...',
    'Stressing over this...',
    'grrrrrrrrr',
    'Frantically working...',
    'Task hunting...',
    'Complaining internally...',
    'Weeeee!',
    'Wiping the board...',
    'Crunching thoughts...',
    'Mumbling to myself...',
    'Making it happen...',
    'Hold on, hold on...',
    'Almost got it...',
    'Scribbling away...',
    'Deep in thought...',
    'On it, boss...',
    'Let me cook...',
    'Brewing something up...',
    'Doing the thing...',
  ];

  let phraseIndex = $state(0);
  let phraseTimer: ReturnType<typeof setInterval> | null = null;

  // Rotate phrases only when status is "Thinking..." or "Speaking..."
  const isGenericStatus = $derived(status === 'Thinking...' || status === 'Speaking...');

  // Contextual statuses that should display as-is (no casualizing)
  const contextualStatuses = new Set([
    'Asking Questions',
    'Generating Architecture Chart',
    'Generating Mermaid Chart',
    'Generating Code',
    'Writing Files',
    'Running Command',
    'Exploring Workspace',
    'Generating response...',
  ]);

  const displayStatus = $derived.by(() => {
    if (isGenericStatus) {
      return grumpPhrases[phraseIndex % grumpPhrases.length];
    }
    // Show contextual statuses directly — they're already human-friendly
    if (contextualStatuses.has(status)) {
      return status;
    }
    // When multiple tools: show "Running: A, B" (toolSummary takes precedence)
    if (toolSummary && status.startsWith('Running')) {
      return `Running: ${toolSummary}`;
    }
    // Fallback for any other status
    return status;
  });

  /** Action verb + icon for the file activity badge */
  function getActionInfo(action: ActiveFileInfo['action']): {
    icon: string;
    label: string;
    color: string;
  } {
    switch (action) {
      case 'writing':
        return { icon: '+', label: 'Writing', color: '#22c55e' };
      case 'editing':
        return { icon: '✎', label: 'Editing', color: '#22c55e' };
      case 'reading':
        return { icon: '◎', label: 'Reading', color: '#3b82f6' };
      case 'searching':
        return { icon: '?', label: 'Searching', color: '#f59e0b' };
      case 'executing':
        return { icon: '$', label: 'Running', color: '#a855f7' };
      default:
        return { icon: '~', label: 'Using', color: '#6366f1' };
    }
  }

  $effect(() => {
    if (streaming && isGenericStatus) {
      phraseIndex = Math.floor(Math.random() * grumpPhrases.length);
      phraseTimer = setInterval(() => {
        phraseIndex = (phraseIndex + 1) % grumpPhrases.length;
      }, 1600);
    } else if (phraseTimer) {
      clearInterval(phraseTimer);
      phraseTimer = null;
    }
    return () => {
      if (phraseTimer) {
        clearInterval(phraseTimer);
        phraseTimer = null;
      }
    };
  });
</script>

{#if streaming}
  <div class="streaming-indicator {variant}">
    {#if showAvatar}
      <div class="avatar">
        <FrownyFace size="sm" state="thinking" animated={true} />
      </div>
    {/if}

    <div class="content">
      {#key displayStatus}
        <span class="status-text">
          {displayStatus}
        </span>
      {/key}
      <span class="cursor">▋</span>
    </div>
  </div>

  <!-- Claude Code-style file activity log -->
  {#if activeFiles.length > 0}
    <div class="file-activity-log">
      {#each activeFiles as file (file.path)}
        {@const info = getActionInfo(file.action)}
        <div class="file-activity-row" style="--accent-color: {info.color}">
          <span class="file-action-icon">{info.icon}</span>
          <span class="file-action-label">{info.label}</span>
          <code class="file-activity-path" title={file.path}>{file.shortPath}</code>
          <span class="file-activity-spinner"></span>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .streaming-indicator {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace;
    border-left: 2px solid var(--color-primary, #7c3aed);
    animation: pulse-border 1.5s ease-in-out infinite;
  }

  @keyframes pulse-border {
    0%,
    100% {
      border-left-color: var(--color-primary, #7c3aed);
    }
    50% {
      border-left-color: rgba(124, 58, 237, 0.3);
    }
  }

  .streaming-indicator.bubble {
    padding: 6px var(--spacing-md);
    border-radius: var(--radius-md);
    background: rgba(124, 58, 237, 0.04);
    border: 1px solid rgba(124, 58, 237, 0.1);
    border-left: 2px solid var(--color-primary, #7c3aed);
  }

  .streaming-indicator.inline {
    padding: 4px 0 4px 8px;
  }

  .avatar {
    flex-shrink: 0;
  }

  .content {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-text {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-primary, #7c3aed);
    letter-spacing: -0.01em;
    animation: fade-in 60ms ease-out;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Terminal-style blinking cursor */
  .cursor {
    color: var(--color-primary, #7c3aed);
    font-size: 0.9rem;
    animation: blink 800ms step-end infinite;
    line-height: 1;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  /* ── Claude Code-style file activity log ─────────────────────────── */
  .file-activity-log {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 4px;
    padding: 0;
  }

  .file-activity-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(124, 58, 237, 0.03);
    border-left: 2px solid var(--accent-color, #7c3aed);
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace;
    font-size: 0.7rem;
    animation: file-row-in 60ms ease-out;
  }

  @keyframes file-row-in {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .file-action-icon {
    font-size: 0.7rem;
    flex-shrink: 0;
    color: var(--accent-color, #7c3aed);
  }

  .file-action-label {
    font-weight: 600;
    color: var(--accent-color, #7c3aed);
    text-transform: uppercase;
    font-size: 0.58rem;
    letter-spacing: 0.05em;
    flex-shrink: 0;
    min-width: 48px;
  }

  .file-activity-path {
    color: var(--color-text-secondary, #94a3b8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: none;
    padding: 0;
    flex: 1;
    min-width: 0;
  }

  .file-activity-spinner {
    width: 6px;
    height: 6px;
    border: 1.5px solid rgba(124, 58, 237, 0.2);
    border-top-color: var(--accent-color, #7c3aed);
    border-radius: 50%;
    animation: spin 0.4s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cursor {
      animation: none;
      opacity: 0.7;
    }
    .status-text {
      animation: none;
    }
    .streaming-indicator {
      animation: none;
    }
    .file-activity-spinner {
      animation: none;
    }
    .file-activity-row {
      animation: none;
    }
  }
</style>
