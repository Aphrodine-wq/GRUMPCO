<script lang="ts">
  import { Sparkles } from 'lucide-svelte';
  import SlideLayout from '../shared/SlideLayout.svelte';
  import BackgroundBlobs from '../shared/BackgroundBlobs.svelte';

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

<SlideLayout>
  <BackgroundBlobs />

  <div class="logo-area">
    <div class="logo-glow"></div>
    <div class="logo-icon">
      <span class="grumpy-face">😤</span>
    </div>
  </div>

  <div class="text-content">
    <h1 class="title">Welcome to <span class="brand">G-Rump</span></h1>
    <p class="tagline">
      The grumpiest AI development platform <span class="tagline-accent">(now in purple!)</span>
    </p>
    <p class="description">
      Turn ideas into production-ready apps with AI-powered architecture, specs, and code
      generation. Ship 18x faster.
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
  /* Logo styles */
  .logo-area {
    position: relative;
    width: 96px;
    height: 96px;
    margin-bottom: 2rem;
  }

  .logo-glow {
    position: absolute;
    inset: -20px;
    background: radial-gradient(circle, rgba(124, 58, 237, 0.4) 0%, transparent 70%);
    filter: blur(20px);
    animation: pulse 4s ease-in-out infinite;
  }

  .logo-icon {
    position: relative;
    width: 100%;
    height: 100%;
    background: white;
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    box-shadow: 0 10px 25px rgba(124, 58, 237, 0.15);
    border: 1px solid rgba(124, 58, 237, 0.1);
    z-index: 10;
  }

  .grumpy-face {
    display: inline-block;
    animation: bounce 2s infinite;
  }

  /* Text Content */
  .text-content {
    margin-bottom: 2.5rem;
  }

  .title {
    font-size: 2.5rem;
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 1rem;
    line-height: 1.2;
    letter-spacing: -0.02em;
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
    font-size: 1.125rem;
    color: #6b7280;
    line-height: 1.6;
    max-width: 480px;
    margin: 0 auto;
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

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-5px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .logo-glow,
    .grumpy-face {
      animation: none;
    }
  }
</style>
