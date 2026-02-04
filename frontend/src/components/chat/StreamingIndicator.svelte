<script lang="ts">
  /**
   * StreamingIndicator Component
   *
   * Shows a visual indicator when the AI is generating a response.
   * More polished than a simple "..." with animated dots.
   */
  import FrownyFace from '../FrownyFace.svelte';

  interface Props {
    /** Whether streaming is active */
    streaming?: boolean;
    /** Text label to show */
    label?: string;
    /** Show the avatar alongside */
    showAvatar?: boolean;
    /** Variant style */
    variant?: 'inline' | 'bubble';
  }

  let {
    streaming = true,
    label = 'G-Rump is thinking',
    showAvatar = true,
    variant = 'bubble',
  }: Props = $props();
</script>

{#if streaming}
  <div class="streaming-indicator {variant}">
    {#if showAvatar}
      <div class="avatar">
        <FrownyFace size="sm" state="thinking" animated={true} />
      </div>
    {/if}

    <div class="content">
      <span class="label">{label}</span>
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
  }

  .streaming-indicator.bubble {
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
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

  .label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6366f1;
  }

  .dots {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .dot {
    width: 4px;
    height: 4px;
    background: #6366f1;
    border-radius: 50%;
    animation: bounce 1.4s ease-in-out infinite;
  }

  .dot:nth-child(1) {
    animation-delay: 0s;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes bounce {
    0%,
    60%,
    100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
      opacity: 1;
    }

    .dots .dot:nth-child(2),
    .dots .dot:nth-child(3) {
      display: none;
    }

    .label::after {
      content: '...';
    }
  }
</style>
