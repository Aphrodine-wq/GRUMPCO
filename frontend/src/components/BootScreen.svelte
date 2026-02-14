<script lang="ts">
  /**
   * BootScreen – Premium splash/boot screen shown on app startup.
   * Features: animated grid background, morphing gradient orbs,
   * spinning orbital rings, typewriter status text, and smooth exit.
   */
  import { onMount } from 'svelte';

  interface Props {
    onComplete: () => void;
    /** Duration in ms before auto-completing (default 2400) */
    duration?: number;
  }

  let { onComplete, duration = 2400 }: Props = $props();

  let progress = $state(0);
  let phase = $state<'loading' | 'ready' | 'exit'>('loading');
  let statusText = $state('Initializing...');
  let showContent = $state(false);

  const STATUS_STEPS = [
    { at: 0, text: 'Booting core systems...' },
    { at: 15, text: 'Loading AI model registry...' },
    { at: 30, text: 'Connecting to NVIDIA NIM...' },
    { at: 50, text: 'Initializing G-Agent orchestrator...' },
    { at: 70, text: 'Preparing workspace tools...' },
    { at: 85, text: 'Calibrating router...' },
    { at: 95, text: 'Almost ready...' },
    { at: 100, text: 'Ready ✓' },
  ];

  onMount(() => {
    // Stagger the content entrance
    requestAnimationFrame(() => {
      showContent = true;
    });

    const start = performance.now();
    let frame: number;

    function tick() {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic for smooth deceleration
      progress = Math.round(t * t * (3 - 2 * t) * 100);

      // Update status text based on progress
      for (let i = STATUS_STEPS.length - 1; i >= 0; i--) {
        if (progress >= STATUS_STEPS[i].at) {
          statusText = STATUS_STEPS[i].text;
          break;
        }
      }

      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        phase = 'ready';
        setTimeout(() => {
          phase = 'exit';
          setTimeout(onComplete, 600);
        }, 500);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });
</script>

<div class="boot-screen" class:exit={phase === 'exit'}>
  <!-- Animated grid background -->
  <div class="bg-grid"></div>

  <!-- Gradient orbs -->
  <div class="bg-effects">
    <div class="glow-orb orb1"></div>
    <div class="glow-orb orb2"></div>
    <div class="glow-orb orb3"></div>
  </div>

  <!-- Floating particles -->
  <div class="particles">
    {#each Array(8) as _, i}
      <div
        class="particle"
        style="
          top: {10 + Math.random() * 80}%;
          left: {5 + Math.random() * 90}%;
          animation-delay: {i * 0.8}s;
          animation-duration: {5 + Math.random() * 4}s;
          width: {2 + Math.random() * 2}px;
          height: {2 + Math.random() * 2}px;
        "
      ></div>
    {/each}
  </div>

  <div class="boot-content" class:visible={showContent}>
    <!-- Logo with orbital rings -->
    <div class="logo-container" class:ready={phase === 'ready'}>
      <div class="logo-orbit orbit1"></div>
      <div class="logo-orbit orbit2"></div>
      <div class="logo-orbit orbit3"></div>
      <div class="logo-core">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#c4b5fd" />
              <stop offset="50%" stop-color="#7c3aed" />
              <stop offset="100%" stop-color="#4c1d95" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <!-- Head circle -->
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="url(#logo-grad)"
            stroke-width="3"
            opacity="0.9"
            filter="url(#glow)"
          />
          <!-- Eyes -->
          <circle cx="35" cy="40" r="5" fill="#c4b5fd">
            <animate attributeName="r" values="5;4;5" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="65" cy="40" r="5" fill="#c4b5fd">
            <animate
              attributeName="r"
              values="5;4;5"
              dur="3s"
              repeatCount="indefinite"
              begin="0.15s"
            />
          </circle>
          <!-- Frowny mouth -->
          <path
            d="M 30 65 Q 50 54 70 65"
            stroke="url(#logo-grad)"
            stroke-width="3.5"
            stroke-linecap="round"
            fill="none"
            filter="url(#glow)"
          />
        </svg>
      </div>
    </div>

    <!-- Brand -->
    <div class="brand-block">
      <h1 class="brand-name">
        <span class="brand-g">G</span><span class="brand-rest">-RUMP</span>
      </h1>
      <p class="brand-tagline">The AI Product Operating System</p>
    </div>

    <!-- Progress bar -->
    <div class="progress-section">
      <div class="progress-track">
        <div class="progress-fill" style:width="{progress}%"></div>
        <div class="progress-glow" style:left="{progress}%"></div>
      </div>
      <div class="progress-info">
        <span class="status-text">{statusText}</span>
        <span class="progress-pct">{progress}%</span>
      </div>
    </div>

    <!-- Version badge -->
    <div class="version-badge">
      <span class="version-dot"></span>
      <span>v2.1.0</span>
    </div>
  </div>
</div>

<style>
  .boot-screen {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #07070d;
    overflow: hidden;
    transition:
      opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .boot-screen.exit {
    opacity: 0;
    transform: scale(1.08);
    pointer-events: none;
  }

  /* ── Grid background ──────────────────────────────────────────────── */
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(124, 58, 237, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124, 58, 237, 0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    animation: grid-pulse 4s ease-in-out infinite;
  }

  @keyframes grid-pulse {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 0.6;
    }
  }

  /* ── Gradient orbs ────────────────────────────────────────────────── */
  .bg-effects {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .glow-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    animation: morph-orb 8s infinite ease-in-out;
  }

  .orb1 {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(124, 58, 237, 0.25), transparent 70%);
    top: -15%;
    right: -10%;
  }

  .orb2 {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(167, 139, 250, 0.2), transparent 70%);
    bottom: -10%;
    left: -8%;
    animation-delay: 2.5s;
  }

  .orb3 {
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(196, 181, 253, 0.12), transparent 70%);
    top: 40%;
    left: 60%;
    animation-delay: 5s;
  }

  @keyframes morph-orb {
    0%,
    100% {
      opacity: 0.6;
      transform: scale(1) translate(0, 0);
    }
    33% {
      opacity: 0.9;
      transform: scale(1.15) translate(15px, -10px);
    }
    66% {
      opacity: 0.5;
      transform: scale(0.95) translate(-10px, 15px);
    }
  }

  /* ── Particles ─────────────────────────────────────────────────────── */
  .particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .particle {
    position: absolute;
    background: rgba(196, 181, 253, 0.7);
    border-radius: 50%;
    animation: drift linear infinite;
  }

  @keyframes drift {
    0% {
      transform: translateY(0) translateX(0);
      opacity: 0;
    }
    10% {
      opacity: 0.8;
    }
    90% {
      opacity: 0.8;
    }
    100% {
      transform: translateY(-60px) translateX(20px);
      opacity: 0;
    }
  }

  /* ── Content ───────────────────────────────────────────────────────── */
  .boot-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    z-index: 1;
    opacity: 0;
    transform: translateY(24px);
    transition:
      opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.1s,
      transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.1s;
  }

  .boot-content.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Logo ───────────────────────────────────────────────────────────── */
  .logo-container {
    position: relative;
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-orbit {
    position: absolute;
    border: 1.5px solid rgba(124, 58, 237, 0.15);
    border-radius: 50%;
    animation: orbit-spin linear infinite;
  }

  .logo-orbit::after {
    content: '';
    position: absolute;
    top: -3px;
    left: 50%;
    width: 6px;
    height: 6px;
    background: #7c3aed;
    border-radius: 50%;
    box-shadow:
      0 0 10px rgba(124, 58, 237, 0.9),
      0 0 20px rgba(124, 58, 237, 0.4);
  }

  .orbit1 {
    inset: 0;
    animation-duration: 4s;
  }

  .orbit2 {
    inset: 10px;
    border-color: rgba(167, 139, 250, 0.1);
    animation-duration: 3s;
    animation-direction: reverse;
  }

  .orbit2::after {
    background: #a78bfa;
    width: 5px;
    height: 5px;
    box-shadow: 0 0 8px rgba(167, 139, 250, 0.8);
  }

  .orbit3 {
    inset: 22px;
    border-color: rgba(196, 181, 253, 0.08);
    animation-duration: 5s;
  }

  .orbit3::after {
    background: #c4b5fd;
    width: 4px;
    height: 4px;
    box-shadow: 0 0 6px rgba(196, 181, 253, 0.7);
  }

  @keyframes orbit-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .logo-container.ready .logo-orbit {
    animation-play-state: paused;
    border-color: rgba(124, 58, 237, 0.4);
    transition: border-color 0.3s;
  }

  .logo-core {
    width: 54px;
    height: 54px;
    z-index: 1;
    animation: breathe 2.5s infinite ease-in-out;
  }

  .logo-core svg {
    width: 100%;
    height: 100%;
  }

  @keyframes breathe {
    0%,
    100% {
      transform: scale(1);
      filter: drop-shadow(0 0 10px rgba(124, 58, 237, 0.3));
    }
    50% {
      transform: scale(1.06);
      filter: drop-shadow(0 0 20px rgba(124, 58, 237, 0.6));
    }
  }

  /* ── Brand ──────────────────────────────────────────────────────────── */
  .brand-block {
    text-align: center;
  }

  .brand-name {
    margin: 0;
    font-size: 2.25rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    color: #e2e8f0;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  }

  .brand-g {
    background: linear-gradient(135deg, #c4b5fd 0%, #7c3aed 50%, #6d28d9 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .brand-rest {
    letter-spacing: 0.12em;
  }

  .brand-tagline {
    margin: 0.25rem 0 0;
    font-size: 0.8125rem;
    color: rgba(148, 163, 184, 0.6);
    letter-spacing: 0.1em;
    font-weight: 400;
    text-transform: uppercase;
    font-size: 0.6875rem;
  }

  /* ── Progress ───────────────────────────────────────────────────────── */
  .progress-section {
    width: 300px;
    margin-top: 0.5rem;
  }

  .progress-track {
    position: relative;
    height: 3px;
    background: rgba(124, 58, 237, 0.08);
    border-radius: 4px;
    overflow: visible;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6d28d9, #7c3aed, #a78bfa);
    border-radius: 4px;
    transition: width 0.15s ease;
    box-shadow: 0 0 8px rgba(124, 58, 237, 0.4);
  }

  .progress-glow {
    position: absolute;
    top: 50%;
    width: 28px;
    height: 28px;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(124, 58, 237, 0.4), transparent);
    border-radius: 50%;
    pointer-events: none;
    transition: left 0.15s ease;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    margin-top: 0.75rem;
    font-size: 0.6875rem;
    color: rgba(148, 163, 184, 0.5);
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  }

  .status-text {
    letter-spacing: 0.02em;
  }

  .progress-pct {
    font-variant-numeric: tabular-nums;
    color: rgba(167, 139, 250, 0.7);
  }

  /* ── Version badge ──────────────────────────────────────────────────── */
  .version-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 0.75rem;
    padding: 0.25rem 0.75rem;
    border-radius: 2rem;
    border: 1px solid rgba(124, 58, 237, 0.15);
    background: rgba(124, 58, 237, 0.05);
    font-size: 0.6875rem;
    color: rgba(167, 139, 250, 0.6);
    letter-spacing: 0.04em;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .version-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
    animation: blink-dot 2s infinite;
  }

  @keyframes blink-dot {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
</style>
