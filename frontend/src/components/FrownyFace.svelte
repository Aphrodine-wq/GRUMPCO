<script lang="ts">
  /**
   * FrownyFace - Default G-Rump frowny face logo/avatar
   * After ~3 minutes in idle, switches to bored (frown + subtle explore drift).
   */
  import { onDestroy } from 'svelte';

  type FaceSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  type FaceState = 'idle' | 'thinking' | 'speaking' | 'success' | 'error';

  interface Props {
    state?: FaceState;
    size?: FaceSize;
    animated?: boolean;
    class?: string;
  }

  const IDLE_BORED_MS = 3 * 60 * 1000; // 3 minutes

  let { state: faceState = 'idle', size = 'md', animated = true }: Props = $props();

  let idleVariant = $state<'normal' | 'bored'>('normal');
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function startIdleTimer() {
    clearIdleTimer();
    idleVariant = 'normal';
    if (faceState === 'idle') {
      idleTimer = setTimeout(() => {
        idleVariant = 'bored';
        idleTimer = null;
      }, IDLE_BORED_MS);
    }
  }

  $effect(() => {
    if (faceState === 'idle') {
      startIdleTimer();
    } else {
      clearIdleTimer();
      idleVariant = 'normal';
    }
    return () => clearIdleTimer();
  });

  onDestroy(clearIdleTimer);

  const sizeMap: Record<FaceSize, number> = {
    xs: 16,
    sm: 24,
    md: 40,
    lg: 64,
    xl: 100,
  };

  const colorMap: Record<FaceState, string> = {
    idle: 'var(--color-primary, #7C3AED)',
    thinking: '#6d28d9',
    speaking: 'var(--color-primary, #7C3AED)',
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
  class:idle-bored={faceState === 'idle' && idleVariant === 'bored'}
  style="--face-size: {sizeMap[size]}px; --face-color: {colorMap[faceState]}"
  role="img"
  aria-label={ariaLabel}
>
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="frowny-svg">
    <!-- No outer circle – logo is transparent; only eyes and mouth for clear read on any background -->
    <circle cx="35" cy="40" r="6" fill="var(--face-color)" />
    <circle cx="65" cy="40" r="6" fill="var(--face-color)" />
    <path
      d={faceState === 'idle' && idleVariant === 'bored'
        ? 'M 28 62 Q 50 78 72 62'
        : 'M 28 68 Q 50 55 72 68'}
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

  /* Idle: gentle breathe + subtle blink (signature look) */
  .frowny-face--idle.is-animated:not(.idle-bored) .frowny-svg {
    animation: idle-signature 4s ease-in-out infinite;
    transform-origin: 50% 50%;
  }

  /* Idle bored (after ~3 min): frown + subtle explore drift */
  .frowny-face--idle.idle-bored.is-animated .frowny-svg {
    animation: idle-explore 4s ease-in-out infinite;
  }

  /* Animated pulse for thinking state */
  .frowny-face--thinking.is-animated .frowny-svg {
    animation: pulse 1.5s ease-in-out infinite;
  }

  /* Shake animation for error state */
  .frowny-face--error.is-animated .frowny-svg {
    animation: shake 0.4s ease-in-out 0s 2;
  }

  @keyframes idle-breathe {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.06);
      opacity: 0.94;
    }
  }

  /* Signature: breathe + blink for personality */
  @keyframes idle-signature {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    35% {
      transform: scale(1.05);
      opacity: 0.96;
    }
    48% {
      transform: scale(1.05) scaleY(0.72);
      opacity: 0.9;
    }
    52% {
      transform: scale(1.05) scaleY(0.72);
      opacity: 0.9;
    }
    65% {
      transform: scale(1.05);
      opacity: 0.96;
    }
  }

  @keyframes idle-explore {
    0%,
    100% {
      transform: translateX(0) scale(1);
    }
    25% {
      transform: translateX(3%) scale(1.02);
    }
    75% {
      transform: translateX(-3%) scale(1.02);
    }
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

  @media (prefers-reduced-motion: reduce) {
    .frowny-face--idle.is-animated .frowny-svg,
    .frowny-face--idle.idle-bored.is-animated .frowny-svg,
    .frowny-face--thinking.is-animated .frowny-svg {
      animation: none;
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

  /* Dark mode: white frowny face on black background */
  :global([data-theme='dark']) .frowny-face-container {
    --face-color: #ffffff !important;
  }
</style>
