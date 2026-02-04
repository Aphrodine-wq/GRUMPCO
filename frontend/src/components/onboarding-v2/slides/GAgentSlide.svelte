<script lang="ts">
  import { onMount } from 'svelte';
  import { Bot, FileEdit, GitBranch, Terminal, Cloud, Zap, Shield, Brain } from 'lucide-svelte';

  interface Props {
    onNext: () => void;
  }

  let { onNext }: Props = $props();

  let mounted = $state(false);
  let activeCapability = $state(0);

  onMount(() => {
    setTimeout(() => (mounted = true), 100);

    // Cycle through capabilities
    const interval = setInterval(() => {
      activeCapability = (activeCapability + 1) % capabilities.length;
    }, 3000);

    return () => clearInterval(interval);
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
      <h2 class="title">Meet G-Agent</h2>
      <p class="subtitle">Your autonomous AI development partner</p>
    </div>

    <!-- Capability carousel -->
    <div class="capabilities-showcase">
      <div class="capability-ring">
        {#each capabilities as cap, i}
          <div
            class="capability-node"
            class:active={activeCapability === i}
            style="--angle: {(i * 360) / capabilities.length}deg"
          >
            {#if cap.icon}
              {@const CapIcon = cap.icon}
              <CapIcon size={20} />
            {/if}
          </div>
        {/each}

        <!-- Center display -->
        <div class="capability-center" style="--cap-color: {capabilities[activeCapability].color}">
          {#if capabilities[activeCapability].icon}
            {@const ActiveCapIcon = capabilities[activeCapability].icon}
            <ActiveCapIcon size={32} />
          {/if}
          <span class="cap-label">{capabilities[activeCapability].label}</span>
          <span class="cap-desc">{capabilities[activeCapability].description}</span>
        </div>
      </div>
    </div>

    <!-- Features grid -->
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
    max-width: 550px;
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
    margin-bottom: 2rem;
  }

  .header-icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border-radius: 20px;
    color: white;
    margin-bottom: 1rem;
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
  }

  .icon-pulse {
    position: absolute;
    inset: -4px;
    border-radius: 24px;
    border: 2px solid #7c3aed;
    animation: pulse 2s ease-out infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 0.6;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(1.3);
    }
  }

  .title {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    font-size: 1.125rem;
    color: #6b7280;
  }

  /* Capabilities showcase */
  .capabilities-showcase {
    margin-bottom: 2rem;
  }

  .capability-ring {
    position: relative;
    width: 240px;
    height: 240px;
  }

  .capability-node {
    position: absolute;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    color: #9ca3af;
    top: 50%;
    left: 50%;
    transform: rotate(var(--angle)) translateY(-90px) rotate(calc(-1 * var(--angle)));
    transition: all 0.3s ease-out;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .capability-node.active {
    background: #7c3aed;
    border-color: #7c3aed;
    color: white;
    transform: rotate(var(--angle)) translateY(-90px) rotate(calc(-1 * var(--angle))) scale(1.15);
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
  }

  .capability-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 140px;
    height: 140px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    background: white;
    border-radius: 24px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    color: var(--cap-color);
    padding: 1rem;
  }

  .cap-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .cap-desc {
    font-size: 0.75rem;
    color: #6b7280;
    text-align: center;
    line-height: 1.4;
  }

  /* Features grid */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
    width: 100%;
  }

  .feature-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
  }

  .feature-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border-radius: 10px;
    color: #7c3aed;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .feature-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .feature-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #374151;
  }

  .feature-desc {
    font-size: 0.6875rem;
    color: #9ca3af;
    line-height: 1.3;
  }

  /* CTA Button */
  .cta-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
    font-size: 1.125rem;
    font-weight: 600;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
    transition: all 0.2s ease-out;
  }

  .cta-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(124, 58, 237, 0.5);
  }

  .cta-button:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 4px rgba(124, 58, 237, 0.3),
      0 4px 16px rgba(124, 58, 237, 0.4);
  }

  .arrow {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s;
  }

  .cta-button:hover .arrow {
    transform: translateX(4px);
  }

  /* Responsive */
  @media (max-width: 480px) {
    .features-grid {
      grid-template-columns: 1fr;
    }

    .feature-card {
      flex-direction: row;
      text-align: left;
    }

    .feature-text {
      align-items: flex-start;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .content,
    .capability-node,
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
