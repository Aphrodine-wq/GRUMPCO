<script lang="ts">
  /**
   * StreamingIndicator Component
   *
   * Shows a visual indicator when the AI is generating a response.
   * "Claude Code" style: dynamic status updates, terminal feel.
   */
  import FrownyFace from '../FrownyFace.svelte';

  interface Props {
    /** Whether streaming is active */
    streaming?: boolean;
    /** Current status text (e.g. "Reading file...", "Thinking...") */
    status?: string;
    /** Show the avatar alongside */
    showAvatar?: boolean;
    /** Variant style */
    variant?: 'inline' | 'bubble';
  }

  let {
    streaming = true,
    status = 'Thinking...',
    showAvatar = true,
    variant = 'bubble',
  }: Props = $props();
</script>

{#if streaming}
  <div class="streaming-indicator {variant}">
    {#if showAvatar}
      <div class="avatar">
        <!-- Use 'thinking' state normally, but if status includes specialized words we could switch -->
        <FrownyFace size="sm" state="thinking" animated={true} />
      </div>
    {/if}

    <div class="content">
      <span class="status-text">{status}</span>
      <span class="cursor-block"></span>
    </div>
  </div>
{/if}

<style>
  .streaming-indicator {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: 'JetBrains Mono', 'Fira Code', monospace; /* Terminal font preference */
  }

  .streaming-indicator.bubble {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    background: rgba(124, 58, 237, 0.05); /* Very subtle purple tint */
    border: 1px solid rgba(124, 58, 237, 0.1);
  }

  .streaming-indicator.inline {
    padding: 0.5rem 0;
  }

  .avatar {
    flex-shrink: 0;
  }

  .content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-text {
    font-size: 0.85rem;
    color: var(--color-text-secondary, #64748b);
    letter-spacing: -0.01em;
  }

  /* Flashing block cursor */
  .cursor-block {
    display: inline-block;
    width: 0.5em;
    height: 1em;
    background-color: var(--color-primary, #7c3aed);
    animation: blink 1s step-end infinite;
    opacity: 0.7;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 0.7;
    }
    50% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cursor-block {
      animation: none;
      opacity: 1;
    }
  }
</style>
