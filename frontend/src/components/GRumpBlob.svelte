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
      const ms = 60_000 + Math.random() * 120_000;
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
  <div class="blob-inner">
    <span class="blob-symbol">&gt;_</span>
  </div>
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
    border: 1px solid #00FF41;
    border-radius: 0;
    position: relative;
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.3), 0 0 20px rgba(0, 255, 65, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .blob-symbol {
    font-family: 'JetBrains Mono', monospace;
    font-size: calc(var(--blob-size) * 0.4);
    color: #00FF41;
    font-weight: bold;
    animation: cursor-blink 1s step-end infinite;
  }

  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .grump-blob--sm .blob-inner {
    box-shadow: 0 0 6px rgba(0, 255, 65, 0.3), 0 0 12px rgba(0, 255, 65, 0.2);
  }

  .grump-blob--lg .blob-inner {
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.35), 0 0 20px rgba(0, 255, 65, 0.2);
  }

  .grump-blob--idle.blob-animated .blob-inner {
    animation: none;
  }

  .grump-blob--thinking.blob-animated .blob-inner {
    animation: terminal-pulse 1.5s ease-in-out infinite;
  }

  .grump-blob--thinking .blob-symbol {
    animation: cursor-blink 0.5s step-end infinite;
  }

  .grump-blob--speaking.blob-animated .blob-inner {
    animation: terminal-pulse 1s ease-in-out infinite;
  }

  .grump-blob--success .blob-inner {
    border-color: #00FF41;
    box-shadow: 0 0 12px rgba(0, 255, 65, 0.5), 0 0 24px rgba(0, 255, 65, 0.25);
  }

  .grump-blob--success .blob-symbol {
    color: #00FF41;
  }

  .grump-blob--error .blob-inner {
    border-color: #FF3131;
    box-shadow: 0 0 12px rgba(255, 49, 49, 0.5), 0 0 24px rgba(255, 49, 49, 0.25);
  }

  .grump-blob--error .blob-symbol {
    color: #FF3131;
  }

  .grump-blob--error.blob-animated .blob-inner {
    animation: terminal-error 0.4s ease-out;
  }

  @keyframes terminal-pulse {
    0%, 100% { 
      box-shadow: 0 0 10px rgba(0, 255, 65, 0.3), 0 0 20px rgba(0, 255, 65, 0.2);
    }
    50% { 
      box-shadow: 0 0 15px rgba(0, 255, 65, 0.5), 0 0 30px rgba(0, 255, 65, 0.3);
    }
  }

  @keyframes terminal-error {
    0% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    50% { transform: translateX(2px); }
    75% { transform: translateX(-2px); }
    100% { transform: translateX(0); }
  }

  .grump-blob:not(.blob-animated) .blob-inner {
    animation: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .blob-inner {
      animation: none !important;
    }
    .blob-symbol {
      animation: none !important;
    }
  }
</style>
