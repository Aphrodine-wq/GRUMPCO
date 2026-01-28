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
    xs: 16,
    sm: 24,
    md: 40,
    lg: 64,
    xl: 100
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
    z-index: 10;
  }

  .blob-outer {
    width: 100%;
    height: 100%;
    position: relative;
    filter: drop-shadow(0 0 12px var(--glow-color)) drop-shadow(0 0 24px rgba(0, 102, 255, 0.25)) drop-shadow(0 0 40px rgba(0, 102, 255, 0.15));
  }

  .blob-inner {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--primary-color) 0%, rgba(0, 0, 0, 0.85) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    position: relative;
    z-index: 1;
    animation: blob-idle 8s ease-in-out infinite;
    box-shadow: inset 0 0 16px rgba(255, 255, 255, 0.15), inset 0 -2px 8px rgba(0, 0, 0, 0.2);
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
        border-radius: 42% 58% 52% 48% / 48% 52% 48% 52%;
        transform: translate(-3px, 2px) rotate(1.5deg) scale(1.03);
      }
      40% {
        border-radius: 58% 42% 40% 60% / 52% 48% 52% 48%;
        transform: translate(2px, -3px) rotate(-2deg) scale(0.97);
      }
      60% {
        border-radius: 45% 55% 58% 42% / 55% 42% 58% 45%;
        transform: translate(-2px, 3px) rotate(2.5deg) scale(1.02);
      }
      80% {
        border-radius: 52% 48% 48% 52% / 45% 58% 42% 55%;
        transform: translate(3px, -2px) rotate(-1.5deg) scale(0.98);
      }
    }


  @keyframes dot-pulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.3); opacity: 1; }
  }

  .grump-blob--thinking .blob-inner {
    animation-duration: 3s;
    background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
  }

  .grump-blob--success .blob-inner {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    --glow-color: rgba(16, 185, 129, 0.5);
  }

  .grump-blob--error .blob-inner {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    --glow-color: rgba(239, 68, 68, 0.5);
    animation: shake 0.4s ease-in-out 0s 2;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    75% { transform: translateX(6px); }
  }

  /* Mobile responsiveness - ensure blob is visible and properly sized */
  @media (max-width: 768px) {
    .grump-blob-container {
      /* Ensure blob doesn't shrink too much on mobile */
      min-width: var(--blob-size);
      min-height: var(--blob-size);
    }

    .grump-blob--lg {
      /* Slightly reduce size on mobile for better fit */
      --blob-size: 72px;
    }

    .grump-blob--xl {
      --blob-size: 104px;
    }

    .blob-outer {
      /* Reduce glow effect on mobile for better visibility */
      filter: drop-shadow(0 0 10px var(--glow-color)) drop-shadow(0 0 18px rgba(0, 102, 255, 0.2));
    }
  }

  @media (max-width: 480px) {
    .grump-blob--lg {
      --blob-size: 64px;
    }

    .grump-blob--xl {
      --blob-size: 88px;
    }

    .blob-outer {
      filter: drop-shadow(0 0 8px var(--glow-color)) drop-shadow(0 0 14px rgba(0, 102, 255, 0.15));
    }
  }
</style>
