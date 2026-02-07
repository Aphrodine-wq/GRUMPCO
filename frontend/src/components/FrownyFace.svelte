<script lang="ts">
  /**
   * FrownyFace - The G-Rump Brand Character
   *
   * A grumpy but lovable mascot with personality.
   * Features expressive eyes, furrowed brows, and a signature frown.
   * States: idle (breathing + occasional blink), thinking (focused squint),
   * speaking (animated mouth), success (brief smirk), error (angry shake).
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

  const IDLE_BORED_MS = 3 * 60 * 1000;

  let { state: faceState = 'idle', size = 'md', animated = true }: Props = $props();

  let idleVariant = $state<'normal' | 'bored'>('normal');
  let blinkPhase = $state(false);
  let isHovered = $state(false);
  let hoverWiggle = $state(false);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let blinkInterval: ReturnType<typeof setInterval> | null = null;

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (blinkInterval) {
      clearInterval(blinkInterval);
      blinkInterval = null;
    }
  }

  function startIdleTimer() {
    clearIdleTimer();
    idleVariant = 'normal';
    // Random blink every 3-6 seconds
    if (animated && faceState === 'idle') {
      blinkInterval = setInterval(
        () => {
          blinkPhase = true;
          setTimeout(() => {
            blinkPhase = false;
          }, 180);
        },
        3000 + Math.random() * 3000
      );
    }
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
    xs: 20,
    sm: 28,
    md: 44,
    lg: 72,
    xl: 110,
  };

  // Mouth path changes per state
  const mouthPath = $derived.by(() => {
    if (faceState === 'success') return 'M 30 68 Q 50 62 70 68'; // slight smirk
    if (faceState === 'error') return 'M 28 72 Q 50 56 72 72'; // angry frown
    if (faceState === 'speaking') return 'M 32 66 Q 50 74 68 66'; // open mouth
    if (faceState === 'thinking') return 'M 34 70 Q 50 60 66 70'; // tight frown
    if (idleVariant === 'bored') return 'M 30 66 Q 50 78 70 66'; // deep frown
    return 'M 30 68 Q 50 58 70 68'; // default grumpy frown
  });

  // Eye squish for blink / thinking
  const eyeScaleY = $derived.by(() => {
    if (blinkPhase) return 0.15;
    if (faceState === 'thinking') return 0.6;
    return 1;
  });

  // Brow angle per state
  const browAngleLeft = $derived.by(() => {
    if (faceState === 'error') return -18;
    if (faceState === 'thinking') return -12;
    if (faceState === 'success') return -4;
    return -10;
  });
  const browAngleRight = $derived.by(() => {
    if (faceState === 'error') return 18;
    if (faceState === 'thinking') return 12;
    if (faceState === 'success') return 4;
    return 10;
  });

  const ariaLabel = $derived.by(() => {
    if (faceState === 'thinking') return 'G-Rump is thinking';
    if (faceState === 'speaking') return 'G-Rump is speaking';
    if (faceState === 'success') return 'G-Rump succeeded';
    if (faceState === 'error') return 'G-Rump is upset';
    return 'G-Rump';
  });

  function handleMouseEnter() {
    isHovered = true;
    hoverWiggle = true;
    setTimeout(() => {
      hoverWiggle = false;
    }, 400);
  }

  function handleMouseLeave() {
    isHovered = false;
  }
</script>

<div
  class="grump-face grump-face--{size} grump-face--{faceState}"
  class:is-animated={animated}
  class:idle-bored={faceState === 'idle' && idleVariant === 'bored'}
  class:is-hovered={isHovered}
  class:hover-wiggle={hoverWiggle}
  style="--face-size: {sizeMap[size]}px"
  role="img"
  aria-label={ariaLabel}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
>
  <!-- Ambient glow -->
  <div class="grump-glow grump-glow--{faceState}"></div>

  <!-- Thought bubbles during thinking -->
  {#if faceState === 'thinking' && animated}
    <div class="thought-bubbles">
      <span class="thought-dot thought-dot--1"></span>
      <span class="thought-dot thought-dot--2"></span>
      <span class="thought-dot thought-dot--3"></span>
    </div>
  {/if}

  <!-- Success particles -->
  {#if faceState === 'success' && animated}
    <div class="success-particles">
      <span class="particle particle--1">✦</span>
      <span class="particle particle--2">✧</span>
      <span class="particle particle--3">✦</span>
      <span class="particle particle--4">✧</span>
    </div>
  {/if}

  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="grump-svg">
    <!-- Head shape - no background, just facial features -->
    <rect x="8" y="8" width="84" height="84" rx="26" ry="26" class="grump-head" fill="none" />

    <!-- Left brow -->
    <line
      x1="22"
      y1="34"
      x2="42"
      y2="30"
      class="grump-brow"
      transform="rotate({browAngleLeft}, 32, 32)"
    />
    <!-- Right brow -->
    <line
      x1="58"
      y1="30"
      x2="78"
      y2="34"
      class="grump-brow"
      transform="rotate({browAngleRight}, 68, 32)"
    />

    <!-- Eyes - with blink/squish -->
    <g transform="translate(35, 44)">
      <ellipse cx="0" cy="0" rx="6" ry={6 * eyeScaleY} class="grump-eye" />
      {#if !blinkPhase && faceState !== 'thinking'}
        <ellipse cx="1.5" cy="-1" rx="2" ry="2" class="grump-eye-highlight" />
      {/if}
    </g>
    <g transform="translate(65, 44)">
      <ellipse cx="0" cy="0" rx="6" ry={6 * eyeScaleY} class="grump-eye" />
      {#if !blinkPhase && faceState !== 'thinking'}
        <ellipse cx="1.5" cy="-1" rx="2" ry="2" class="grump-eye-highlight" />
      {/if}
    </g>

    <!-- Mouth -->
    <path d={mouthPath} class="grump-mouth" stroke-width="4" stroke-linecap="round" fill="none" />

    {#if faceState === 'speaking'}
      <!-- Speaking: open mouth area -->
      <ellipse cx="50" cy="70" rx="10" ry="5" class="grump-mouth-open" />
    {/if}

    {#if faceState === 'error'}
      <!-- Anger mark -->
      <g class="anger-mark" transform="translate(74, 16)">
        <line x1="0" y1="0" x2="6" y2="6" stroke-width="2.5" stroke-linecap="round" />
        <line x1="6" y1="0" x2="0" y2="6" stroke-width="2.5" stroke-linecap="round" />
      </g>
    {/if}

    {#if faceState === 'success'}
      <!-- Sparkle -->
      <circle cx="78" cy="22" r="3" class="grump-sparkle" />
      <circle cx="82" cy="18" r="1.5" class="grump-sparkle grump-sparkle--sm" />
    {/if}
  </svg>
</div>

<style>
  .grump-face {
    width: var(--face-size);
    height: var(--face-size);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    z-index: 10;
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .grump-face.is-hovered {
    transform: scale(1.12) translateY(-2px);
  }

  .grump-face.hover-wiggle .grump-svg {
    animation: hover-wiggle 0.4s ease-in-out !important;
  }

  /* Ambient glow */
  .grump-glow {
    position: absolute;
    inset: -30%;
    border-radius: 50%;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .grump-face.is-animated .grump-glow {
    opacity: 0.4;
  }

  .grump-glow--idle {
    background: radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%);
    animation: glow-pulse 4s ease-in-out infinite;
  }

  .grump-glow--thinking {
    background: radial-gradient(circle, rgba(124, 58, 237, 0.25) 0%, transparent 70%);
    animation: glow-pulse 2s ease-in-out infinite;
  }

  .grump-glow--speaking {
    background: radial-gradient(circle, rgba(124, 58, 237, 0.2) 0%, transparent 70%);
    animation: glow-pulse 0.8s ease-in-out infinite;
  }

  .grump-glow--success {
    background: radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%);
    animation: glow-pop 0.6s ease-out;
  }

  .grump-glow--error {
    background: radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, transparent 70%);
    animation: glow-pulse 0.5s ease-in-out infinite;
  }

  /* Thought bubbles */
  .thought-bubbles {
    position: absolute;
    top: -8px;
    right: -6px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
    pointer-events: none;
  }

  .thought-dot {
    display: block;
    border-radius: 50%;
    background: var(--color-primary, #7c3aed);
    opacity: 0;
    animation: thought-float 1.8s ease-in-out infinite;
  }

  .thought-dot--1 {
    width: 4px;
    height: 4px;
    animation-delay: 0s;
  }

  .thought-dot--2 {
    width: 6px;
    height: 6px;
    animation-delay: 0.3s;
  }

  .thought-dot--3 {
    width: 8px;
    height: 8px;
    animation-delay: 0.6s;
  }

  /* Success particles */
  .success-particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .particle {
    position: absolute;
    font-size: 10px;
    color: #fbbf24;
    opacity: 0;
    animation: particle-burst 0.8s ease-out forwards;
  }

  .particle--1 {
    top: 0;
    left: 20%;
    animation-delay: 0s;
  }

  .particle--2 {
    top: 10%;
    right: 5%;
    animation-delay: 0.1s;
  }

  .particle--3 {
    bottom: 10%;
    left: 5%;
    animation-delay: 0.2s;
  }

  .particle--4 {
    bottom: 0;
    right: 20%;
    animation-delay: 0.15s;
  }

  .grump-svg {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    transition: filter 0.2s;
  }

  .grump-face.is-hovered .grump-svg {
    filter: drop-shadow(0 4px 12px rgba(124, 58, 237, 0.3));
  }

  /* Head */
  .grump-head {
    fill: none;
  }

  /* Brows */
  .grump-brow {
    stroke: var(--color-primary, #7c3aed);
    stroke-width: 3.5;
    stroke-linecap: round;
    transition: all 0.2s ease;
  }

  .grump-face--success .grump-brow {
    stroke: #10b981;
  }

  .grump-face--error .grump-brow {
    stroke: #ef4444;
  }

  /* Eyes */
  .grump-eye {
    fill: var(--color-primary, #7c3aed);
    transition: ry 0.1s ease;
  }

  .grump-face--success .grump-eye {
    fill: #10b981;
  }

  .grump-face--error .grump-eye {
    fill: #ef4444;
  }

  .grump-eye-highlight {
    fill: rgba(124, 58, 237, 0.3);
    transition: opacity 0.15s;
  }

  .grump-face.is-hovered .grump-eye-highlight {
    fill: rgba(255, 255, 255, 0.5);
  }

  /* Mouth */
  .grump-mouth {
    stroke: var(--color-primary, #7c3aed);
    transition: d 0.2s ease;
  }

  .grump-face--success .grump-mouth {
    stroke: #10b981;
  }

  .grump-face--error .grump-mouth {
    stroke: #ef4444;
  }

  .grump-mouth-open {
    fill: rgba(124, 58, 237, 0.2);
    animation: speak-pulse 0.4s ease-in-out infinite alternate;
  }

  /* Anger mark */
  .anger-mark line {
    stroke: #fbbf24;
  }

  /* Sparkle */
  .grump-sparkle {
    fill: #fbbf24;
    animation: sparkle-pop 0.8s ease-out;
  }
  .grump-sparkle--sm {
    animation-delay: 0.15s;
  }

  /* Idle: gentle breathing */
  .grump-face--idle.is-animated:not(.idle-bored) .grump-svg {
    animation: grump-breathe 4s ease-in-out infinite;
  }

  /* Bored: slow side-to-side look */
  .grump-face--idle.idle-bored.is-animated .grump-svg {
    animation: grump-look-around 5s ease-in-out infinite;
  }

  /* Thinking: focused pulse */
  .grump-face--thinking.is-animated .grump-svg {
    animation: grump-think 2s ease-in-out infinite;
  }

  /* Speaking: subtle bob */
  .grump-face--speaking.is-animated .grump-svg {
    animation: grump-speak 0.6s ease-in-out infinite;
  }

  /* Error: angry shake */
  .grump-face--error.is-animated .grump-svg {
    animation: grump-angry 0.4s ease-in-out 0s 2;
  }

  /* Success: happy bounce */
  .grump-face--success.is-animated .grump-svg {
    animation: grump-happy 0.5s ease-out;
  }

  @keyframes grump-breathe {
    0%,
    100% {
      transform: scale(1) translateY(0);
    }
    50% {
      transform: scale(1.03) translateY(-1px);
    }
  }

  @keyframes grump-look-around {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(3px) rotate(2deg);
    }
    75% {
      transform: translateX(-3px) rotate(-2deg);
    }
  }

  @keyframes grump-think {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(0.97);
      opacity: 0.85;
    }
  }

  @keyframes grump-speak {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-2px);
    }
  }

  @keyframes grump-angry {
    0%,
    100% {
      transform: translateX(0) rotate(0);
    }
    20% {
      transform: translateX(-4px) rotate(-3deg);
    }
    40% {
      transform: translateX(4px) rotate(3deg);
    }
    60% {
      transform: translateX(-3px) rotate(-2deg);
    }
    80% {
      transform: translateX(3px) rotate(2deg);
    }
  }

  @keyframes grump-happy {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.1) translateY(-4px);
    }
    70% {
      transform: scale(1.05) translateY(-2px);
    }
    100% {
      transform: scale(1) translateY(0);
    }
  }

  @keyframes speak-pulse {
    0% {
      ry: 3;
    }
    100% {
      ry: 6;
    }
  }

  @keyframes sparkle-pop {
    0% {
      opacity: 0;
      transform: scale(0);
    }
    50% {
      opacity: 1;
      transform: scale(1.3);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes hover-wiggle {
    0%,
    100% {
      transform: rotate(0deg);
    }
    20% {
      transform: rotate(-6deg);
    }
    40% {
      transform: rotate(6deg);
    }
    60% {
      transform: rotate(-4deg);
    }
    80% {
      transform: rotate(4deg);
    }
  }

  @keyframes glow-pulse {
    0%,
    100% {
      opacity: 0.2;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.1);
    }
  }

  @keyframes glow-pop {
    0% {
      opacity: 0;
      transform: scale(0.5);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.3);
    }
    100% {
      opacity: 0.4;
      transform: scale(1);
    }
  }

  @keyframes thought-float {
    0% {
      opacity: 0;
      transform: translateY(4px) scale(0.5);
    }
    30% {
      opacity: 0.7;
      transform: translateY(0) scale(1);
    }
    70% {
      opacity: 0.7;
      transform: translateY(-4px) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-8px) scale(0.5);
    }
  }

  @keyframes particle-burst {
    0% {
      opacity: 0;
      transform: scale(0) translate(0, 0);
    }
    40% {
      opacity: 1;
      transform: scale(1.2) translate(var(--dx, -8px), var(--dy, -12px));
    }
    100% {
      opacity: 0;
      transform: scale(0.6) translate(var(--dx2, -16px), var(--dy2, -24px));
    }
  }

  .particle--1 {
    --dx: -10px;
    --dy: -14px;
    --dx2: -18px;
    --dy2: -28px;
  }
  .particle--2 {
    --dx: 12px;
    --dy: -12px;
    --dx2: 20px;
    --dy2: -26px;
  }
  .particle--3 {
    --dx: -8px;
    --dy: 6px;
    --dx2: -14px;
    --dy2: 16px;
  }
  .particle--4 {
    --dx: 10px;
    --dy: 8px;
    --dx2: 18px;
    --dy2: 18px;
  }

  /* Mobile */
  @media (max-width: 768px) {
    .grump-face--lg {
      --face-size: 56px;
    }
    .grump-face--xl {
      --face-size: 88px;
    }
  }

  @media (max-width: 480px) {
    .grump-face--lg {
      --face-size: 48px;
    }
    .grump-face--xl {
      --face-size: 72px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .grump-face .grump-svg {
      animation: none !important;
    }
    .grump-mouth-open {
      animation: none;
    }
    .grump-glow,
    .thought-bubbles,
    .success-particles {
      display: none;
    }
    .grump-face.is-hovered {
      transform: none;
    }
  }
</style>
