<script lang="ts">
  /**
   * GRumpBlob - Enhanced fluid blob avatar
   */
  import { onMount } from 'svelte';
  import { colors } from '../lib/design-system/tokens/colors';

  type BlobState = 'idle' | 'thinking' | 'speaking' | 'success' | 'error';
  type BlobSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  interface Props {
    state?: BlobState;
    size?: BlobSize;
    animated?: boolean;
  }

  let {
    state: blobState = $bindable('idle'),
    size = $bindable('md'),
    animated = $bindable(true)
  }: Props = $props();

  const sizeMap: Record<BlobSize, number> = {
    xs: 24,
    sm: 32,
    md: 48,
    lg: 80,
    xl: 120
  };

  const ariaLabel =
    blobState === 'thinking'
      ? 'G-Rump is thinking'
      : blobState === 'speaking'
        ? 'G-Rump is speaking'
        : blobState === 'success'
          ? 'G-Rump succeeded'
          : blobState === 'error'
            ? 'G-Rump encountered an error'
            : 'G-Rump';
</script>

<div 
  class="grump-blob-container grump-blob--{size} grump-blob--{blobState}"
  class:is-animated={animated}
  style="--blob-size: {sizeMap[size]}px"
  style:--primary-color="#000000"
  style:--glow-color="rgba(0, 102, 255, 0.4)"
  role="img"
  aria-label={ariaLabel}
>
  <div class="blob-outer">
    <div class="blob-inner">
      {#if blobState === 'thinking'}
        <div class="thinking-dots">
          <span></span><span></span><span></span>
        </div>
      {:else if blobState === 'idle'}
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      {/if}
    </div>
  </div>
</div>

<style>
  .grump-blob-container {
    width: var(--blob-size);
    height: var(--blob-size);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .blob-outer {
    width: 100%;
    height: 100%;
    position: relative;
    filter: drop-shadow(0 0 10px var(--glow-color)) drop-shadow(0 0 20px rgba(0, 102, 255, 0.2));
  }

  .blob-inner {
    width: 100%;
    height: 100%;
    background-color: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    position: relative;
    z-index: 1;
    animation: blob-idle 8s ease-in-out infinite;
    box-shadow: inset 0 0 12px rgba(255, 255, 255, 0.1);
  }

  .grump-blob--lg .blob-inner {
    animation-duration: 10s;
  }

  .blob-inner svg {
    width: 45%;
    height: 45%;
    opacity: 0.9;
  }

  .thinking-dots {
    display: flex;
    gap: 4px;
  }

  .thinking-dots span {
    width: 5px;
    height: 5px;
    background-color: white;
    border-radius: 50%;
    animation: dot-pulse 1.2s infinite ease-in-out;
  }

  .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
  .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes blob-idle {
    0%, 100% {
      border-radius: 54% 46% 45% 55% / 55% 45% 55% 45%;
      transform: translate(0, 0) rotate(0deg) scale(1);
    }
    20% {
      border-radius: 45% 55% 58% 42% / 48% 58% 42% 52%;
      transform: translate(-2px, 1px) rotate(1deg) scale(1.02);
    }
    40% {
      border-radius: 58% 42% 40% 60% / 52% 42% 58% 48%;
      transform: translate(1px, -2px) rotate(-1deg) scale(0.98);
    }
    60% {
      border-radius: 42% 58% 55% 45% / 58% 52% 48% 42%;
      transform: translate(-1px, 2px) rotate(2deg) scale(1.01);
    }
    80% {
      border-radius: 50% 50% 45% 55% / 45% 55% 50% 50%;
      transform: translate(2px, -1px) rotate(-2deg) scale(0.99);
    }
  }

  @keyframes dot-pulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.3); opacity: 1; }
  }

  .grump-blob--thinking .blob-inner {
    animation-duration: 4s;
    background-color: #000;
  }

  .grump-blob--success .blob-inner {
    background-color: #10b981;
    --glow-color: rgba(16, 185, 129, 0.4);
  }

  .grump-blob--error .blob-inner {
    background-color: #ef4444;
    --glow-color: rgba(239, 68, 68, 0.4);
    animation: shake 0.4s ease-in-out 0s 2;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    75% { transform: translateX(6px); }
  }
</style>
