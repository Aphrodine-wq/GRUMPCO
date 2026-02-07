<script lang="ts">
  /**
   * StreamingIndicator Component
   *
   * Shows a visual indicator when the AI is generating a response.
   * G-Rump branded status messages that rotate for personality.
   */
  import FrownyFace from '../FrownyFace.svelte';

  interface Props {
    streaming?: boolean;
    status?: string;
    showAvatar?: boolean;
    variant?: 'inline' | 'bubble';
  }

  let {
    streaming = true,
    status = 'Thinking...',
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

  // Rotate phrases when status is generic "Thinking..."
  const isGenericStatus = $derived(status === 'Thinking...' || status === 'Speaking...');

  const displayStatus = $derived.by(() => {
    if (isGenericStatus) {
      return grumpPhrases[phraseIndex % grumpPhrases.length];
    }
    // Make tool-running status more casual
    if (status.startsWith('Running ')) {
      const tool = status.replace('Running ', '').replace('...', '');
      const casualPrefixes = ['Firing up', 'Messing with', 'Poking at', 'Working'];
      const prefix = casualPrefixes[Math.floor(Math.random() * casualPrefixes.length)];
      return `${prefix} ${tool}...`;
    }
    if (status === 'Analyzing results...') {
      return 'Checking what happened...';
    }
    return status;
  });

  $effect(() => {
    if (streaming && isGenericStatus) {
      phraseIndex = Math.floor(Math.random() * grumpPhrases.length);
      phraseTimer = setInterval(() => {
        phraseIndex = (phraseIndex + 1) % grumpPhrases.length;
      }, 2800);
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
      <span class="dots">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </span>
    </div>
  </div>
{/if}

<style>
  .streaming-indicator {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family:
      'Inter',
      -apple-system,
      system-ui,
      sans-serif;
  }

  .streaming-indicator.bubble {
    padding: 0.75rem 1rem;
    border-radius: 12px;
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.06));
    border: 1px solid var(--color-border-light, rgba(124, 58, 237, 0.12));
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
    font-weight: 500;
    color: var(--color-text-secondary, #64748b);
    letter-spacing: -0.01em;
    animation: fade-in 80ms ease-out;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Bouncing dots instead of block cursor */
  .dots {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--color-primary, #7c3aed);
    animation: bounce-dot 1.4s ease-in-out infinite;
    opacity: 0.6;
  }

  .dot:nth-child(2) {
    animation-delay: 0.16s;
  }
  .dot:nth-child(3) {
    animation-delay: 0.32s;
  }

  @keyframes bounce-dot {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    40% {
      transform: translateY(-5px);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
      opacity: 0.7;
    }
    .status-text {
      animation: none;
    }
  }
</style>
