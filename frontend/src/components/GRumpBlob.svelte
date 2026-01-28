<script lang="ts">
  import { onMount } from 'svelte';

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

  let blinking = $state(false);

  const sizeMap: Record<BlobSize, number> = {
    xs: 16,
    sm: 24,
    md: 40,
    lg: 48,
    xl: 64
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

  onMount(() => {
    let cancelled = false;
    let blinkTimerId: ReturnType<typeof setInterval> | undefined;

    function scheduleBlink() {
      const ms = 60_000 + Math.random() * 120_000; // 1–3 minutes
      const id = setTimeout(() => {
        if (cancelled) return;
        blinking = true;
        window.setTimeout(() => {
          if (cancelled) return;
          blinking = false;
          blinkTimerId = scheduleBlink();
        }, 300);
      }, ms);
      return id;
    }

    blinkTimerId = scheduleBlink();
    return () => {
      cancelled = true;
      if (blinkTimerId != null) clearTimeout(blinkTimerId);
    };
  });
</script>

<div 
  class="grump-blob grump-blob--{size} grump-blob--{blobState}"
  class:blob-animated={animated}
  class:blinking
  style="--blob-size: {sizeMap[size]}px"
  role="img"
  aria-label={ariaLabel}
>
  <div class="blob-inner"></div>
</div>

<style>
  .grump-blob {
    width: var(--blob-size);
    height: var(--blob-size);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .blob-inner {
    width: 100%;
    height: 100%;
    background-color: #000000;
    border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
    position: relative;
    box-shadow: 0 0 10px rgba(0, 102, 255, 0.3), 0 0 20px rgba(0, 102, 255, 0.2);
  }

  .grump-blob--sm .blob-inner {
    box-shadow: 0 0 6px rgba(0, 102, 255, 0.3), 0 0 12px rgba(0, 102, 255, 0.2);
  }

  .grump-blob--lg .blob-inner {
    box-shadow: 0 0 10px rgba(0, 102, 255, 0.35), 0 0 20px rgba(0, 102, 255, 0.2);
  }

  .grump-blob--idle.blob-animated .blob-inner {
    animation: blob-idle 8s ease-in-out infinite;
  }

  .grump-blob--thinking.blob-animated .blob-inner {
    animation: blob-thinking 2s ease-in-out infinite, glow-pulse 1.8s ease-in-out infinite;
  }

  .grump-blob--speaking.blob-animated .blob-inner {
    animation: blob-idle 4s ease-in-out infinite, glow-pulse 1.2s ease-in-out infinite;
  }

  .grump-blob--success .blob-inner {
    box-shadow: 0 0 12px rgba(34, 197, 94, 0.5), 0 0 24px rgba(34, 197, 94, 0.25);
  }

  .grump-blob--success.blob-animated .blob-inner {
    animation: blob-success 0.6s ease-out;
  }

  .grump-blob--error .blob-inner {
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.5), 0 0 24px rgba(239, 68, 68, 0.25);
  }

  .grump-blob--error.blob-animated .blob-inner {
    animation: blob-error 0.4s ease-out;
  }

  .grump-blob:not(.blob-animated) .blob-inner {
    animation: none;
  }

  .grump-blob.blinking .blob-inner {
    animation: blob-blink 0.3s ease-in-out !important;
  }

  @keyframes blob-success {
    0% { transform: scale(1); }
    50% { transform: scale(1.12); }
    100% { transform: scale(1); }
  }

  @keyframes blob-error {
    0% { transform: scale(1); }
    25% { transform: scale(1.05) translateX(-2px); }
    75% { transform: scale(1.05) translateX(2px); }
    100% { transform: scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .blob-inner {
      animation: none !important;
      border-radius: 50%;
    }
    .grump-blob.blinking .blob-inner {
      animation: none !important;
    }
  }
</style>
