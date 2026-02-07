<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Lightbulb,
    FileText,
    Code,
    ArrowRight,
    Rocket,
    Zap,
    Target,
    RefreshCw,
  } from 'lucide-svelte';

  interface Props {
    onNext: () => void;
  }

  let { onNext }: Props = $props();

  let mounted = $state(false);
  let activeStep = $state(0);

  onMount(() => {
    setTimeout(() => (mounted = true), 100);

    // Auto-advance through steps for demo
    const interval = setInterval(() => {
      activeStep = (activeStep + 1) % 4;
    }, 2500);

    return () => clearInterval(interval);
  });

  const steps = [
    {
      icon: Lightbulb,
      label: 'Describe',
      description: 'Tell G-Rump what you want to build',
      color: '#F59E0B',
    },
    {
      icon: FileText,
      label: 'Architecture',
      description: 'AI generates Mermaid diagrams',
      color: '#7C3AED',
    },
    {
      icon: FileText,
      label: 'PRD',
      description: 'Detailed specs & requirements',
      color: '#10B981',
    },
    {
      icon: Code,
      label: 'Code',
      description: 'Production-ready code output',
      color: '#3B82F6',
    },
  ];

  const features = [
    { icon: Zap, text: '18x faster than traditional development' },
    { icon: Target, text: 'Architecture-as-Code approach' },
    { icon: RefreshCw, text: 'Iterate at any stage of the flow' },
  ];
</script>

<div class="slide-container">
  <div class="content" class:mounted>
    <!-- Header -->
    <div class="header">
      <div class="header-icon">
        <Rocket size={28} />
      </div>
      <h2 class="title">The SHIP Workflow</h2>
      <p class="subtitle">From idea to production in one flow</p>
    </div>

    <!-- Workflow visualization -->
    <div class="workflow">
      {#each steps as step, i}
        <div class="step" class:active={activeStep === i} class:completed={activeStep > i}>
          <div class="step-connector" class:hidden={i === 0}>
            <div class="connector-line" class:filled={activeStep >= i}></div>
            <ArrowRight class="connector-arrow" size={16} />
          </div>

          <div class="step-content">
            <div class="step-icon" style="--step-color: {step.color}">
              {#if step.icon}
                {@const StepIcon = step.icon}
                <StepIcon size={24} />
              {/if}
            </div>
            <span class="step-label">{step.label}</span>
          </div>
        </div>
      {/each}
    </div>

    <!-- Active step description -->
    <div class="step-description">
      <div class="description-card" style="--step-color: {steps[activeStep].color}">
        {#if steps[activeStep].icon}
          {@const ActiveIcon = steps[activeStep].icon}
          <ActiveIcon size={20} />
        {/if}
        <span>{steps[activeStep].description}</span>
      </div>
    </div>

    <!-- Features list -->
    <div class="features">
      {#each features as feature}
        <div class="feature">
          <span class="feature-icon">
            {#if feature.icon}
              {@const FeatureIcon = feature.icon}
              <FeatureIcon size={18} />
            {/if}
          </span>
          <span>{feature.text}</span>
        </div>
      {/each}
    </div>

    <!-- CTA -->
    <button class="cta-button" onclick={onNext}>
      <span>Continue</span>
      <svg class="arrow" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  </div>
</div>

<style>
  .slide-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 2rem;
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 600px;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .content.mounted {
    opacity: 1;
    transform: translateY(0);
  }

  /* Header */
  .header {
    margin-bottom: 2.5rem;
  }

  .header-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background: var(--onboarding-cta-gradient);
    border-radius: 16px;
    color: white;
    margin-bottom: 1rem;
    box-shadow: var(--shadow-glow);
  }

  .title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 0.5rem;
  }

  .subtitle {
    font-size: 1.125rem;
    color: var(--color-text-muted);
  }

  /* Workflow */
  .workflow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-bottom: 2rem;
    width: 100%;
    max-width: 500px;
  }

  .step {
    display: flex;
    align-items: center;
    flex: 1;
  }

  .step-connector {
    display: flex;
    align-items: center;
    width: 40px;
    position: relative;
  }

  .step-connector.hidden {
    display: none;
  }

  .connector-line {
    flex: 1;
    height: 2px;
    background: #e5e7eb;
    transition: background 0.3s;
  }

  .connector-line.filled {
    background: #7c3aed;
  }

  .connector-arrow {
    color: #d1d5db;
    flex-shrink: 0;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .step-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f3f4f6;
    border-radius: 16px;
    color: #9ca3af;
    transition: all 0.3s ease-out;
    border: 2px solid transparent;
  }

  .step.active .step-icon {
    background: var(--step-color);
    color: white;
    transform: scale(1.1);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--step-color) 40%, transparent);
    border-color: transparent;
  }

  .step.completed .step-icon {
    background: color-mix(in srgb, var(--step-color) 15%, white);
    color: var(--step-color);
    border-color: var(--step-color);
  }

  .step-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: color 0.3s;
  }

  .step.active .step-label,
  .step.completed .step-label {
    color: #374151;
  }

  /* Step description */
  .description-card {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    background: color-mix(in srgb, var(--step-color) 10%, white);
    border: 1px solid color-mix(in srgb, var(--step-color) 20%, transparent);
    border-radius: 12px;
    color: var(--step-color);
    font-weight: 500;
    animation: fadeInUp 0.3s ease-out;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Features */
  .features {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 2rem;
  }

  .feature {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9375rem;
    color: #4b5563;
  }

  /* CTA Button */
  .cta-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: var(--onboarding-cta-gradient);
    color: white;
    font-size: 1.125rem;
    font-weight: 600;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    box-shadow: var(--shadow-glow);
    transition: all 0.2s ease-out;
  }

  .cta-button:hover {
    opacity: 0.95;
    box-shadow: var(--shadow-lg);
  }

  .cta-button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .arrow {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s;
  }

  .cta-button:hover .arrow {
    transform: translateX(2px);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .content,
    .step-icon,
    .description-card {
      animation: none;
      transition: none;
    }

    .content.mounted {
      opacity: 1;
      transform: none;
    }
  }
</style>
