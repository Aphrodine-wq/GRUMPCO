<script lang="ts">
  /**
   * FrownyFace - Default G-Rump frowny face logo/avatar
   */

  type FaceSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  type FaceState = 'idle' | 'thinking' | 'speaking' | 'success' | 'error';

  interface Props {
    state?: FaceState;
    size?: FaceSize;
    animated?: boolean;
  }

  let {
    state: faceState = $bindable('idle'),
    size = $bindable('md'),
    animated = $bindable(true),
  }: Props = $props();

  const sizeMap: Record<FaceSize, number> = {
    xs: 16,
    sm: 24,
    md: 40,
    lg: 64,
    xl: 100,
  };

  const colorMap: Record<FaceState, string> = {
    idle: '#7C3AED',
    thinking: '#6d28d9',
    speaking: '#7C3AED',
    success: '#10b981',
    error: '#ef4444',
  };

  const ariaLabel =
    faceState === 'thinking'
      ? 'G-Rump is thinking'
      : faceState === 'speaking'
        ? 'G-Rump is speaking'
        : faceState === 'success'
          ? 'G-Rump succeeded'
          : faceState === 'error'
            ? 'G-Rump encountered an error'
            : 'G-Rump';
</script>

<div
  class="frowny-face-container frowny-face--{size} frowny-face--{faceState}"
  class:is-animated={animated}
  style="--face-size: {sizeMap[size]}px; --face-color: {colorMap[faceState]}"
  role="img"
  aria-label={ariaLabel}
>
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="frowny-svg">
    <!-- No outer circle – logo is transparent; only eyes and mouth for clear read on any background -->
    <circle cx="35" cy="40" r="6" fill="var(--face-color)" />
    <circle cx="65" cy="40" r="6" fill="var(--face-color)" />
    <path
      d="M 28 68 Q 50 55 72 68"
      stroke="var(--face-color)"
      stroke-width="5"
      stroke-linecap="round"
      fill="none"
    />
  </svg>
</div>

<style>
  .frowny-face-container {
    width: var(--face-size);
    height: var(--face-size);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    z-index: 10;
  }

  .frowny-svg {
    width: 100%;
    height: 100%;
  }

  /* Animated pulse for thinking state */
  .frowny-face--thinking.is-animated .frowny-svg {
    animation: pulse 1.5s ease-in-out infinite;
  }

  /* Shake animation for error state */
  .frowny-face--error.is-animated .frowny-svg {
    animation: shake 0.4s ease-in-out 0s 2;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(0.95);
    }
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .frowny-face-container {
      min-width: var(--face-size);
      min-height: var(--face-size);
    }

    .frowny-face--lg {
      --face-size: 56px;
    }

    .frowny-face--xl {
      --face-size: 88px;
    }
  }

  @media (max-width: 480px) {
    .frowny-face--lg {
      --face-size: 48px;
    }

    .frowny-face--xl {
      --face-size: 72px;
    }
  }
</style>
