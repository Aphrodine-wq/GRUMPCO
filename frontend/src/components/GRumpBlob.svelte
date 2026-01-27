<script lang="ts">
  interface Props {
    state?: 'idle' | 'thinking';
    size?: 'sm' | 'md' | 'lg';
    animated?: boolean;
  }

  let {
    state = $bindable('idle'),
    size = $bindable('md'),
    animated = $bindable(true)
  }: Props = $props();

  const sizeMap = {
    sm: 24,
    md: 40,
    lg: 48
  };

  const blobStyles = {
    '--blob-size': `${sizeMap[size]}px`
  };

  const ariaLabel = state === 'thinking' ? 'G-Rump is thinking' : 'G-Rump';
</script>

<div 
  class="grump-blob grump-blob--{size} grump-blob--{state}"
  class:blob-animated={animated}
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
    animation: blob-breathe 3s ease-in-out infinite, blob-morph 8s ease-in-out infinite;
  }

  .grump-blob--thinking.blob-animated .blob-inner {
    animation: blob-thinking 1.5s ease-in-out infinite, glow-pulse 1s ease-in-out infinite;
  }

  .grump-blob:not(.blob-animated) .blob-inner {
    animation: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .blob-inner {
      animation: none !important;
      border-radius: 50%;
    }
  }
</style>
