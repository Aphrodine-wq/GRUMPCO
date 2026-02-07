<script lang="ts">
  import { onMount } from 'svelte';
  import { Bot, FileEdit, GitBranch, Terminal, Cloud, Zap, Shield, Brain } from 'lucide-svelte';

  interface Props {
    onNext: () => void;
  }

  let { onNext }: Props = $props();

  let mounted = $state(false);

  onMount(() => {
    setTimeout(() => (mounted = true), 100);
  });

  const capabilities = [
    {
      icon: FileEdit,
      label: 'File Operations',
      description: 'Read, write, and edit files in your workspace',
      color: '#3B82F6',
    },
    {
      icon: GitBranch,
      label: 'Git Control',
      description: 'Commit, branch, push, and manage your repo',
      color: '#10B981',
    },
    {
      icon: Terminal,
      label: 'Shell Commands',
      description: 'Execute bash, npm, and system commands',
      color: '#F59E0B',
    },
    {
      icon: Cloud,
      label: 'API & Cloud',
      description: 'Call external APIs and manage deployments',
      color: '#8B5CF6',
    },
  ];

  const features = [
    {
      icon: Zap,
      label: 'Autonomous Execution',
      description: 'Completes multi-step tasks independently',
    },
    {
      icon: Shield,
      label: 'Sandboxed Safety',
      description: 'Docker isolation for risky operations',
    },
    { icon: Brain, label: 'Persistent Memory', description: 'Remembers context across sessions' },
  ];
</script>

<div class="slide-container">
  <div class="content" class:mounted>
    <!-- Header -->
    <div class="header">
      <div class="header-icon">
        <Bot size={28} />
        <div class="icon-pulse"></div>
      </div>
      <h2 class="title">G-Agent is the star</h2>
      <p class="subtitle">
        Your autonomous AI partner that executes, ships, and builds – powered by chat
      </p>
    </div>

    <!-- Capabilities section -->
    <div class="section-label">Capabilities</div>
    <div class="capabilities-list">
      {#each capabilities as cap}
        <div class="capability-row">
          <div class="capability-row-icon" style="--cap-color: {cap.color}">
            {#if cap.icon}
              {@const CapIcon = cap.icon}
              <CapIcon size={22} />
            {/if}
          </div>
          <div class="capability-row-text">
            <span class="capability-row-label">{cap.label}</span>
            <span class="capability-row-desc">{cap.description}</span>
          </div>
        </div>
      {/each}
    </div>

    <!-- Features section -->
    <div class="section-label">Features</div>
    <div class="features-grid">
      {#each features as feature}
        <div class="feature-card">
          <div class="feature-icon">
            {#if feature.icon}
              {@const FeatIcon = feature.icon}
              <FeatIcon size={20} />
            {/if}
          </div>
          <div class="feature-text">
            <span class="feature-label">{feature.label}</span>
            <span class="feature-desc">{feature.description}</span>
          </div>
        </div>
      {/each}
    </div>

    <!-- CTA (matches SlideLayout slide-cta-button) – pulled down for spacing -->
    <div class="cta-spacer"></div>
    <button class="slide-cta-button" onclick={onNext}>
      <span>Continue</span>
      <svg class="slide-arrow" viewBox="0 0 20 20" fill="currentColor">
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
    max-width: 720px;
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .section-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6d28d9;
    margin-bottom: 0.75rem;
    width: 100%;
    max-width: 420px;
    text-align: left;
  }

  .content.mounted {
    opacity: 1;
    transform: translateY(0);
  }

  /* Header */
  .header {
    margin-bottom: 2rem;
  }

  .header-icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: var(--onboarding-cta-gradient);
    border-radius: 20px;
    color: white;
    margin-bottom: 1rem;
    box-shadow: var(--shadow-glow);
  }

  .icon-pulse {
    position: absolute;
    inset: -4px;
    border-radius: 24px;
    border: 2px solid var(--color-primary);
    animation: pulse 2s ease-out infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 0.5;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(1.12);
    }
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

  /* Capabilities vertical list */
  .capabilities-list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin-bottom: 1.5rem;
    width: 100%;
    max-width: 420px;
  }

  .capability-row {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 0.875rem 1.125rem;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    text-align: left;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .capability-row-icon {
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--cap-color) 14%, transparent);
    color: var(--cap-color);
    border-radius: 12px;
  }

  .capability-row-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .capability-row-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #111827;
  }

  .capability-row-desc {
    font-size: 0.8125rem;
    color: #6b7280;
    line-height: 1.4;
  }

  /* Features grid - 3-column on desktop, 1-col on mobile; wider cards */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.875rem;
    margin-bottom: 1.75rem;
    width: 100%;
    max-width: 820px;
  }

  .feature-card {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem 1.125rem;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    text-align: left;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .feature-icon {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-subtle);
    border-radius: 10px;
    color: var(--color-primary);
  }

  .feature-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 0.25rem;
    min-width: 0;
  }

  .feature-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .feature-desc {
    font-size: 0.75rem;
    color: #6b7280;
    line-height: 1.4;
  }

  /* CTA uses global slide-cta-button / slide-arrow from SlideLayout; add margin if not already present */
  .cta-spacer {
    height: 2.5rem;
    flex-shrink: 0;
  }

  :global(.slide-cta-button) {
    margin-top: 0.5rem;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .features-grid {
      grid-template-columns: 1fr;
      max-width: 100%;
    }
  }

  @media (max-width: 480px) {
    .capabilities-list {
      max-width: 100%;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .content,
    .icon-pulse {
      animation: none;
      transition: none;
    }

    .content.mounted {
      opacity: 1;
      transform: none;
    }
  }
</style>
