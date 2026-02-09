<script lang="ts">
  /**
   * BootScreen – Premium splash/boot screen shown on app startup.
   * Displays an animated logo, loading bar, and fade-out transition.
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

  const STATUS_STEPS = [
    { at: 0, text: 'Initializing core systems...' },
    { at: 20, text: 'Loading AI models...' },
    { at: 45, text: 'Connecting services...' },
    { at: 70, text: 'Preparing workspace...' },
    { at: 90, text: 'Almost ready...' },
    { at: 100, text: 'Ready' },
  ];

  onMount(() => {
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
          setTimeout(onComplete, 500);
        }, 400);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });
</script>

<div class="boot-screen" class:exit={phase === 'exit'}>
  <!-- Animated background particles -->
  <div class="bg-effects">
    <div class="particle p1"></div>
    <div class="particle p2"></div>
    <div class="particle p3"></div>
    <div class="particle p4"></div>
    <div class="particle p5"></div>
    <div class="glow-orb orb1"></div>
    <div class="glow-orb orb2"></div>
  </div>

  <div class="boot-content">
    <!-- Logo -->
    <div class="logo-container" class:ready={phase === 'ready'}>
      <div class="logo-ring"></div>
      <div class="logo-ring ring2"></div>
      <div class="logo-icon">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#a78bfa" />
              <stop offset="50%" stop-color="#7c3aed" />
              <stop offset="100%" stop-color="#6d28d9" />
            </linearGradient>
          </defs>
          <!-- Head circle -->
          <circle cx="50" cy="50" r="45" stroke="url(#logo-grad)" stroke-width="4" opacity="0.9" />
          <!-- Eyes -->
          <circle cx="35" cy="40" r="5.5" fill="#a78bfa" />
          <circle cx="65" cy="40" r="5.5" fill="#a78bfa" />
          <!-- Frowny mouth -->
          <path
            d="M 30 65 Q 50 54 70 65"
            stroke="url(#logo-grad)"
            stroke-width="4"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
      </div>
    </div>

    <!-- Brand name -->
    <h1 class="brand-name">
      <span class="brand-g">G</span>-RUMP
    </h1>
    <p class="brand-tagline">AI-Powered Development Environment</p>

    <!-- Progress section -->
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

    <!-- Version info -->
    <p class="version-text">v2.0.0</p>
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
    background: #0a0a0f;
    overflow: hidden;
    transition:
      opacity 0.5s ease,
      transform 0.5s ease;
  }

  .boot-screen.exit {
    opacity: 0;
    transform: scale(1.05);
    pointer-events: none;
  }

  /* ── Background effects ─────────────────────────────────────────── */
  .bg-effects {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .particle {
    position: absolute;
    width: 2px;
    height: 2px;
    background: rgba(167, 139, 250, 0.6);
    border-radius: 50%;
    animation: float-particle 8s infinite ease-in-out;
  }

  .p1 {
    top: 20%;
    left: 15%;
    animation-delay: 0s;
  }
  .p2 {
    top: 60%;
    left: 80%;
    animation-delay: 1.5s;
  }
  .p3 {
    top: 40%;
    left: 50%;
    animation-delay: 3s;
    width: 3px;
    height: 3px;
  }
  .p4 {
    top: 80%;
    left: 25%;
    animation-delay: 4.5s;
  }
  .p5 {
    top: 10%;
    left: 70%;
    animation-delay: 2s;
    width: 3px;
    height: 3px;
  }

  @keyframes float-particle {
    0%,
    100% {
      transform: translateY(0) translateX(0);
      opacity: 0.3;
    }
    25% {
      transform: translateY(-30px) translateX(10px);
      opacity: 0.8;
    }
    50% {
      transform: translateY(-15px) translateX(-15px);
      opacity: 0.5;
    }
    75% {
      transform: translateY(-40px) translateX(5px);
      opacity: 0.9;
    }
  }

  .glow-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.15;
    animation: pulse-orb 6s infinite ease-in-out;
  }

  .orb1 {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, #7c3aed, transparent);
    top: -100px;
    right: -100px;
  }

  .orb2 {
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, #a78bfa, transparent);
    bottom: -80px;
    left: -80px;
    animation-delay: 3s;
  }

  @keyframes pulse-orb {
    0%,
    100% {
      opacity: 0.1;
      transform: scale(1);
    }
    50% {
      opacity: 0.25;
      transform: scale(1.15);
    }
  }

  /* ── Content ────────────────────────────────────────────────────── */
  .boot-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    z-index: 1;
    animation: fade-in-up 0.8s ease-out;
  }

  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Logo ────────────────────────────────────────────────────────── */
  .logo-container {
    position: relative;
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-ring {
    position: absolute;
    inset: 0;
    border: 2px solid rgba(124, 58, 237, 0.2);
    border-radius: 50%;
    animation: spin-ring 4s linear infinite;
  }

  .logo-ring::after {
    content: '';
    position: absolute;
    top: -2px;
    left: 50%;
    width: 8px;
    height: 8px;
    background: #7c3aed;
    border-radius: 50%;
    box-shadow: 0 0 12px rgba(124, 58, 237, 0.8);
  }

  .ring2 {
    inset: 8px;
    border-color: rgba(167, 139, 250, 0.15);
    animation-direction: reverse;
    animation-duration: 3s;
  }

  .ring2::after {
    background: #a78bfa;
    width: 6px;
    height: 6px;
    box-shadow: 0 0 10px rgba(167, 139, 250, 0.8);
  }

  @keyframes spin-ring {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .logo-container.ready .logo-ring {
    animation-play-state: paused;
    border-color: rgba(124, 58, 237, 0.5);
  }

  .logo-icon {
    width: 56px;
    height: 56px;
    z-index: 1;
    animation: pulse-icon 2s infinite ease-in-out;
  }

  .logo-icon svg {
    width: 100%;
    height: 100%;
  }

  @keyframes pulse-icon {
    0%,
    100% {
      transform: scale(1);
      filter: drop-shadow(0 0 8px rgba(124, 58, 237, 0.3));
    }
    50% {
      transform: scale(1.05);
      filter: drop-shadow(0 0 16px rgba(124, 58, 237, 0.6));
    }
  }

  /* ── Brand ───────────────────────────────────────────────────────── */
  .brand-name {
    margin: 0;
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #e2e8f0;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  }

  .brand-g {
    background: linear-gradient(135deg, #a78bfa, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .brand-tagline {
    margin: -0.5rem 0 0;
    font-size: 0.8125rem;
    color: rgba(148, 163, 184, 0.7);
    letter-spacing: 0.08em;
    font-weight: 400;
  }

  /* ── Progress ────────────────────────────────────────────────────── */
  .progress-section {
    width: 280px;
    margin-top: 0.75rem;
  }

  .progress-track {
    position: relative;
    height: 3px;
    background: rgba(124, 58, 237, 0.1);
    border-radius: 4px;
    overflow: visible;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed, #a78bfa);
    border-radius: 4px;
    transition: width 0.15s ease;
  }

  .progress-glow {
    position: absolute;
    top: 50%;
    width: 24px;
    height: 24px;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(124, 58, 237, 0.5), transparent);
    border-radius: 50%;
    pointer-events: none;
    transition: left 0.15s ease;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    margin-top: 0.625rem;
    font-size: 0.6875rem;
    color: rgba(148, 163, 184, 0.6);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .status-text {
    letter-spacing: 0.02em;
  }

  .progress-pct {
    font-variant-numeric: tabular-nums;
    color: rgba(167, 139, 250, 0.8);
  }

  /* ── Version ─────────────────────────────────────────────────────── */
  .version-text {
    margin: 1rem 0 0;
    font-size: 0.6875rem;
    color: rgba(148, 163, 184, 0.3);
    letter-spacing: 0.05em;
  }
</style>
