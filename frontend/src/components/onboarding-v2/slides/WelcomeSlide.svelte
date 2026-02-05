<script lang="ts">
  import { Sparkles } from 'lucide-svelte';
  import SlideLayout from '../shared/SlideLayout.svelte';
  import FrownyFace from '../../FrownyFace.svelte';

  interface Props {
    onNext: () => void;
  }

  let { onNext }: Props = $props();

  const features = [
    { text: 'Design-first architecture', icon: Sparkles },
    { text: 'Intelligent code generation', icon: Sparkles },
    { text: 'Multi-provider AI support', icon: Sparkles },
  ];
</script>

{#snippet background()}
  <!-- Full-bleed animated gradient + soft blur shapes (CSS-only for 144fps) -->
  <div class="welcome-bg">
    <div class="welcome-gradient"></div>
    <div class="welcome-blob welcome-blob-1"></div>
    <div class="welcome-blob welcome-blob-2"></div>
    <div class="welcome-blob welcome-blob-3"></div>
    <div class="frowny-cutoff" aria-hidden="true">
      <FrownyFace size="xl" state="idle" animated={false} />
    </div>
  </div>
{/snippet}

<SlideLayout {background}>
  <div class="logo-area">
    <div class="logo-glow"></div>
    <div class="logo-icon">
      <FrownyFace size="xl" state="idle" animated={true} />
    </div>
  </div>

  <div class="text-content">
    <h1 class="title">
      <span class="title-line">Welcome to</span>
      <span class="title-brand">G-Rump</span>
    </h1>
    <p class="tagline">
      The grumpiest AI development platform <span class="tagline-accent">(now in purple!)</span>
    </p>
    <p class="description">
      AI-powered architecture, specs, and code. Diagram to deploy—ship faster, stay in control.
    </p>
  </div>

  <div class="features">
    {#each features as feature}
      <div class="feature">
        <feature.icon class="feature-icon" size={20} />
        <span>{feature.text}</span>
      </div>
    {/each}
  </div>

  <button class="slide-cta-button" onclick={onNext}>
    <span>Let's get started</span>
    <svg class="slide-arrow" viewBox="0 0 20 20" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
        clip-rule="evenodd"
      />
    </svg>
  </button>
</SlideLayout>

<style>
  .welcome-bg {
    position: absolute;
    inset: 0;
    background: var(--color-bg-app, #fafafa);
    overflow: hidden;
  }

  .welcome-gradient {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 20% 40%, rgba(124, 58, 237, 0.25) 0%, transparent 50%),
      radial-gradient(ellipse 60% 80% at 80% 20%, rgba(139, 92, 246, 0.2) 0%, transparent 45%),
      radial-gradient(ellipse 50% 50% at 50% 80%, rgba(196, 181, 253, 0.15) 0%, transparent 50%),
      linear-gradient(
        135deg,
        rgba(249, 250, 251, 1) 0%,
        rgba(243, 232, 255, 0.5) 35%,
        rgba(237, 233, 254, 0.6) 65%,
        rgba(221, 214, 254, 0.4) 100%
      );
    animation: gradient-shift 10s ease-in-out infinite;
  }

  .welcome-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    opacity: 0.35;
    pointer-events: none;
    animation: blob-float 8s ease-in-out infinite;
  }

  .welcome-blob-1 {
    width: 320px;
    height: 320px;
    background: rgba(124, 58, 237, 0.25);
    top: -80px;
    right: -80px;
    animation-delay: 0s;
  }

  .welcome-blob-2 {
    width: 240px;
    height: 240px;
    background: rgba(139, 92, 246, 0.2);
    bottom: 20%;
    left: -60px;
    animation-delay: -3s;
  }

  .welcome-blob-3 {
    width: 180px;
    height: 180px;
    background: rgba(196, 181, 253, 0.25);
    top: 50%;
    right: 15%;
    animation-delay: -5s;
  }

  @keyframes gradient-shift {
    0%,
    100% {
      opacity: 1;
      filter: hue-rotate(0deg);
    }
    50% {
      opacity: 0.98;
      filter: hue-rotate(2deg);
    }
  }

  @keyframes blob-float {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    33% {
      transform: translate(10px, -15px) scale(1.05);
    }
    66% {
      transform: translate(-5px, 10px) scale(0.98);
    }
  }

  .frowny-cutoff {
    position: absolute;
    right: -20%;
    top: 50%;
    transform: translateY(-50%) scale(3.5);
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.18;
    pointer-events: none;
  }

  /* Logo styles – slightly larger, prominent */
  .logo-area {
    position: relative;
    width: 144px;
    height: 144px;
    margin-bottom: 2rem;
  }

  .logo-glow {
    position: absolute;
    inset: -28px;
    background: radial-gradient(circle, rgba(124, 58, 237, 0.45) 0%, transparent 68%);
    filter: blur(24px);
    animation: pulse 4s ease-in-out infinite;
  }

  .logo-icon {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  /* Text Content – staggered title */
  .text-content {
    margin-bottom: 2.5rem;
  }

  .title {
    font-size: 2.75rem;
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 1rem;
    line-height: 1.2;
    letter-spacing: -0.03em;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .title-line {
    display: block;
    font-size: 0.5em;
    font-weight: 600;
    color: #6b7280;
    letter-spacing: 0.02em;
    animation: fade-in-up 0.6s ease-out;
  }

  .title-brand {
    display: block;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: fade-in-up 0.6s ease-out 0.1s both;
  }

  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .brand {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .tagline {
    font-size: 1.25rem;
    font-weight: 600;
    color: #4b5563;
    margin-bottom: 1rem;
  }

  .tagline-accent {
    color: #7c3aed;
    font-size: 0.875em;
  }

  .description {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text-secondary, #4b5563);
    line-height: 1.5;
    max-width: 420px;
    margin: 0 auto;
    letter-spacing: 0.01em;
  }

  /* Features */
  .features {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 2.5rem;
    align-items: flex-start;
    background: rgba(255, 255, 255, 0.5);
    padding: 1.5rem;
    border-radius: 16px;
    border: 1px solid rgba(124, 58, 237, 0.1);
    backdrop-filter: blur(8px);
  }

  .feature {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1rem;
    color: #4b5563;
    font-weight: 500;
  }

  :global(.feature-icon) {
    color: #7c3aed;
  }

  /* Animations */
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .logo-glow,
    .welcome-gradient,
    .welcome-blob,
    .title-line,
    .title-brand {
      animation: none;
    }
  }
</style>
