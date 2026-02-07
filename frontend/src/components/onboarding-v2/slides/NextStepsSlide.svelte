<script lang="ts">
  import { onMount } from 'svelte';
  import {
    PartyPopper,
    BookOpen,
    MessageCircle,
    Github,
    ExternalLink,
    Lightbulb,
    Bot,
    Settings,
  } from 'lucide-svelte';

  interface Props {
    onComplete: () => void;
  }

  let { onComplete }: Props = $props();

  let mounted = $state(false);
  let confettiVisible = $state(false);

  onMount(() => {
    setTimeout(() => (mounted = true), 100);
    setTimeout(() => (confettiVisible = true), 300);
  });

  const resources = [
    {
      icon: BookOpen,
      label: 'Documentation',
      description: 'Learn how to use G-Rump effectively',
      url: 'https://docs.g-rump.dev',
    },
    {
      icon: MessageCircle,
      label: 'Discord Community',
      description: 'Join our community for help and discussion',
      url: 'https://discord.gg/grump',
    },
    {
      icon: Github,
      label: 'GitHub',
      description: 'View source, report issues, contribute',
      url: 'https://github.com/grump-ai/grump',
    },
  ];

  const tips = [
    { icon: Lightbulb, text: 'Type', kbd: '/ship', suffix: 'to start the SHIP workflow' },
    { icon: Bot, text: "Click 'Use G-Agent' in chat to turn on agent mode in this session" },
    { icon: Settings, text: 'Access settings and AI providers from the sidebar' },
  ];

  const newFeatures = [
    {
      label: 'G-Agent in chat',
      desc: 'Use G-Agent button in the chat header to enable agent mode without leaving the conversation.',
    },
    { label: 'Credits & billing', desc: 'Buy credits and manage billing from the Credits view.' },
    { label: 'Dark mode & themes', desc: 'Appearance and density in Settings → General.' },
  ];
</script>

<div class="slide-container">
  <!-- Confetti -->
  {#if confettiVisible}
    <div class="confetti-container" aria-hidden="true">
      {#each Array(20) as _, i}
        <div
          class="confetti-piece"
          style="--delay: {i * 0.1}s; --x: {Math.random() * 100}%; --rotation: {Math.random() *
            360}deg; --color: {['#7C3AED', '#A855F7', '#F59E0B', '#10B981', '#3B82F6'][i % 5]}"
        ></div>
      {/each}
    </div>
  {/if}

  <div class="content" class:mounted>
    <!-- Header with celebration -->
    <div class="header">
      <div class="header-icon celebration">
        <PartyPopper size={32} />
      </div>
      <h2 class="title">You're All Set!</h2>
      <p class="subtitle">Welcome to the grumpiest AI development platform</p>
    </div>

    <!-- What's new -->
    <div class="new-features-card">
      <h3 class="new-features-title">What's new</h3>
      <div class="new-features-grid">
        {#each newFeatures as f}
          <div class="new-feature-item">
            <span class="new-feature-label">{f.label}</span>
            <span class="new-feature-desc">{f.desc}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Quick tips -->
    <div class="tips-card">
      <h3 class="tips-title">Quick Tips</h3>
      <ul class="tips-list">
        {#each tips as tip}
          <li>
            <span class="tip-icon">
              {#if tip.icon}
                {@const TipIcon = tip.icon}
                <TipIcon size={16} />
              {/if}
            </span>
            <span>
              {tip.text}
              {#if tip.kbd}
                <kbd>{tip.kbd}</kbd>
              {/if}
              {#if tip.suffix}
                {tip.suffix}
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    </div>

    <!-- Resources -->
    <div class="resources">
      <h3 class="resources-title">Resources</h3>
      <div class="resources-grid">
        {#each resources as resource}
          <a href={resource.url} target="_blank" rel="noopener" class="resource-card">
            <div class="resource-icon">
              {#if resource.icon}
                {@const ResIcon = resource.icon}
                <ResIcon size={20} />
              {/if}
            </div>
            <div class="resource-text">
              <span class="resource-label">{resource.label}</span>
              <span class="resource-desc">{resource.description}</span>
            </div>
            <ExternalLink size={14} class="external-icon" />
          </a>
        {/each}
      </div>
    </div>

    <!-- CTA -->
    <button class="cta-button" onclick={onComplete}>
      <span>Start Building</span>
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
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 2rem;
    overflow: hidden;
  }

  /* Confetti */
  .confetti-container {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .confetti-piece {
    position: absolute;
    width: 10px;
    height: 10px;
    background: var(--color);
    top: -20px;
    left: var(--x);
    transform: rotate(var(--rotation));
    animation: confettiFall 3s ease-out var(--delay) forwards;
  }

  @keyframes confettiFall {
    0% {
      transform: translateY(0) rotate(var(--rotation)) scale(1);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(calc(var(--rotation) + 720deg)) scale(0.5);
      opacity: 0;
    }
  }

  .content {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 500px;
    width: 100%;
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background: var(--onboarding-cta-gradient);
    border-radius: 20px;
    color: white;
    margin-bottom: 1rem;
    box-shadow: var(--shadow-glow);
  }

  .header-icon.celebration {
    animation: celebrationPop 0.5s ease-out 0.3s;
  }

  @keyframes celebrationPop {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.08);
    }
    100% {
      transform: scale(1);
    }
  }

  .title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 0.5rem;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--color-text-muted);
  }

  /* What's new */
  .new-features-card {
    width: 100%;
    padding: 1.25rem;
    background: var(--color-bg-card, rgba(255, 255, 255, 0.6));
    border: 1px solid var(--color-border, rgba(124, 58, 237, 0.15));
    border-radius: 12px;
    margin-bottom: 1.5rem;
  }

  .new-features-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
    margin-bottom: 0.75rem;
    text-align: left;
  }

  .new-features-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem 1rem;
  }

  .new-feature-item {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .new-feature-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #1f2937);
  }

  .new-feature-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.3;
  }

  /* Tips card */
  .tips-card {
    width: 100%;
    padding: 1.25rem;
    background: var(--onboarding-card-bg);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    margin-bottom: 1.5rem;
  }

  .tips-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-primary);
    margin-bottom: 0.75rem;
    text-align: left;
  }

  .tips-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tips-list li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    text-align: left;
  }

  .tip-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    color: #7c3aed;
    flex-shrink: 0;
  }

  .tips-list kbd {
    padding: 0.125rem 0.375rem;
    background: rgba(124, 58, 237, 0.1);
    border-radius: 4px;
    font-size: 0.8125rem;
    font-family: monospace;
    color: #7c3aed;
  }

  /* Resources */
  .resources {
    width: 100%;
    margin-bottom: 2rem;
  }

  .resources-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: 0.75rem;
    text-align: left;
  }

  .resources-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .resource-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .resource-card:hover {
    border-color: #7c3aed;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.1);
  }

  .resource-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f3f4f6;
    border-radius: 8px;
    color: #7c3aed;
    flex-shrink: 0;
  }

  .resource-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }

  .resource-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .resource-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .resource-card :global(.external-icon) {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  /* CTA Button */
  .cta-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2.5rem;
    background: var(--onboarding-cta-gradient);
    color: white;
    font-size: 1.25rem;
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
    box-shadow:
      0 0 0 4px rgba(124, 58, 237, 0.3),
      0 4px 20px rgba(124, 58, 237, 0.5);
  }

  .arrow {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s;
  }

  .cta-button:hover .arrow {
    transform: translateX(4px);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .content,
    .confetti-piece,
    .header-icon.celebration {
      animation: none;
    }

    .content.mounted {
      opacity: 1;
      transform: none;
    }

    .confetti-container {
      display: none;
    }
  }
</style>
