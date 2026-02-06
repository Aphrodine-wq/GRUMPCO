<script lang="ts">
  import FrownyFace from './FrownyFace.svelte';
  import QuickStartModal from './QuickStartModal.svelte';
  import { tutorialStore, type QuickStartTemplate } from '../stores/tutorialStore';
  import { chatModeStore } from '../stores/chatModeStore';
  import { setCurrentView } from '../stores/uiStore';
  import { showToast } from '../stores/toastStore';
  import {
    Rocket,
    Zap,
    GraduationCap,
    Lightbulb,
    Building2,
    Code2,
    Plug,
    Palette,
    MessageCircle,
    ListChecks,
    FileText,
    Bot,
    BookOpen,
  } from 'lucide-svelte';

  interface Props {
    onTemplateSelect?: (template: QuickStartTemplate) => void;
    onStartTutorial?: () => void;
    onShipMode?: () => void;
  }

  let { onTemplateSelect, onStartTutorial, onShipMode }: Props = $props();

  let showQuickStart = $state(false);
  let showExamples = $state(false);

  const examplePrompts = [
    {
      icon: 'building',
      title: 'Architecture Design',
      prompt:
        'Design a microservices architecture for an e-commerce platform with user service, product catalog, and order management',
    },
    {
      icon: 'code',
      title: 'Full-Stack App',
      prompt:
        'Build a task management app with React, Node.js, and PostgreSQL. Include authentication and real-time updates',
    },
    {
      icon: 'plug',
      title: 'REST API',
      prompt:
        'Create a RESTful API for a blog platform with posts, comments, and user authentication using JWT',
    },
    {
      icon: 'palette',
      title: 'Component Library',
      prompt:
        'Build a design system with reusable React components, TypeScript, and Storybook documentation',
    },
  ];

  function handleStartTutorial() {
    tutorialStore.startTutorial('first-time');
    onStartTutorial?.();
  }

  function handleTemplateSelect(template: QuickStartTemplate) {
    showQuickStart = false;
    onTemplateSelect?.(template);
  }

  function handleExampleClick(prompt: string) {
    onTemplateSelect?.({
      id: 'custom',
      name: 'Custom',
      description: '',
      icon: 'lightbulb',
      prompt,
      mode: 'design',
      tags: [],
    });
  }

  function handleArgument() {
    chatModeStore.setMode('argument');
  }

  function handlePlan() {
    chatModeStore.setMode('code');
    window.dispatchEvent(new CustomEvent('switch-plan-mode'));
  }

  function handleSpec() {
    chatModeStore.setMode('code');
    window.dispatchEvent(new CustomEvent('switch-spec-mode'));
  }

  function handleShip() {
    window.dispatchEvent(new CustomEvent('open-ship-mode'));
    onShipMode?.();
  }

  function handleGAgent() {
    setCurrentView('gAgent');
  }

  function handleAskDocs() {
    setCurrentView('askDocs');
  }
</script>

<div class="chat-empty-state">
  <div class="empty-inner">
    <!-- Hero Section -->
    <div class="hero">
      <div class="hero-icon">
        <FrownyFace size="lg" state="idle" animated={false} />
      </div>
      <h1 class="hero-title">Welcome to G-Rump</h1>
      <p class="hero-desc">
        AI-powered platform for architecture design, code generation, and development workflows
      </p>
    </div>

    <!-- Primary mode cards: Argument, Plan, Spec, SHIP, G-Agent -->
    <div class="modes-grid">
      <button type="button" class="mode-card" onclick={handleArgument}>
        <div class="mode-icon"><MessageCircle strokeWidth={1.5} /></div>
        <h3 class="mode-title">Argument</h3>
        <p class="mode-desc">Free-form chat with tools and reasoning</p>
      </button>
      <button type="button" class="mode-card" onclick={handlePlan}>
        <div class="mode-icon"><ListChecks strokeWidth={1.5} /></div>
        <h3 class="mode-title">Plan</h3>
        <p class="mode-desc">Generate a development plan from your request</p>
      </button>
      <button type="button" class="mode-card" onclick={handleSpec}>
        <div class="mode-icon"><FileText strokeWidth={1.5} /></div>
        <h3 class="mode-title">Spec</h3>
        <p class="mode-desc">Q&A session → specification</p>
      </button>
      <button type="button" class="mode-card" onclick={handleShip}>
        <div class="mode-icon"><Rocket strokeWidth={1.5} /></div>
        <h3 class="mode-title">SHIP</h3>
        <p class="mode-desc">Design → Spec → Plan → Code in one run</p>
      </button>
      <button type="button" class="mode-card mode-card-highlight" onclick={handleGAgent}>
        <div class="mode-icon"><Bot strokeWidth={1.5} /></div>
        <h3 class="mode-title">G-Agent</h3>
        <p class="mode-desc">Full capabilities (Docker recommended)</p>
      </button>
    </div>

    <!-- Secondary: Quick Actions -->
    <div class="actions-grid">
      <button type="button" class="action-card" onclick={() => (showQuickStart = true)}>
        <div class="action-icon"><Zap strokeWidth={1.5} /></div>
        <h3 class="action-title">Quick Start</h3>
        <p class="action-desc">Choose from pre-built templates</p>
      </button>

      <button type="button" class="action-card" onclick={handleStartTutorial}>
        <div class="action-icon"><GraduationCap strokeWidth={1.5} /></div>
        <h3 class="action-title">Take a Tour</h3>
        <p class="action-desc">Learn how to use G-Rump</p>
      </button>

      <button type="button" class="action-card" onclick={() => (showExamples = !showExamples)}>
        <div class="action-icon"><Lightbulb class="icon" strokeWidth={1.5} /></div>
        <h3 class="action-title">See Examples</h3>
        <p class="action-desc">Explore what you can build</p>
      </button>

      <button type="button" class="action-card" onclick={handleAskDocs}>
        <div class="action-icon"><BookOpen strokeWidth={1.5} /></div>
        <h3 class="action-title">Ask docs</h3>
        <p class="action-desc">Query docs and codebase with RAG</p>
      </button>
    </div>

    <!-- Example Prompts (Expandable) -->
    {#if showExamples}
      <div class="examples-wrap animate-fadeIn">
        <h3 class="examples-heading">Try these examples:</h3>
        <div class="examples-grid">
          {#each examplePrompts as example}
            <button
              type="button"
              class="example-card"
              onclick={() => handleExampleClick(example.prompt)}
            >
              <div class="example-icon">
                {#if example.icon === 'building'}
                  <Building2 strokeWidth={1.5} />
                {:else if example.icon === 'code'}
                  <Code2 strokeWidth={1.5} />
                {:else if example.icon === 'plug'}
                  <Plug strokeWidth={1.5} />
                {:else}
                  <Palette strokeWidth={1.5} />
                {/if}
              </div>
              <div class="example-body">
                <h4 class="example-title">{example.title}</h4>
                <p class="example-prompt">{example.prompt}</p>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Features Overview -->
    <div class="features-row">
      <div class="feature">
        <div class="feature-icon"><Building2 strokeWidth={1.5} /></div>
        <h4 class="feature-title">Architecture Design</h4>
        <p class="feature-desc">Generate system diagrams from descriptions</p>
      </div>
      <div class="feature">
        <div class="feature-icon"><Code2 strokeWidth={1.5} /></div>
        <h4 class="feature-title">Code Generation</h4>
        <p class="feature-desc">Complete applications from your designs</p>
      </div>
      <div class="feature">
        <div class="feature-icon"><Zap strokeWidth={1.5} /></div>
        <h4 class="feature-title">Ship Mode</h4>
        <p class="feature-desc">Architecture → PRD → Plan → Code</p>
      </div>
    </div>

    <!-- Keyboard Shortcuts Hint (aligned with post-onboarding tip) -->
    <div class="shortcuts-hint">
      <p>
        Press <kbd>/</kbd> to focus chat, <kbd>Ctrl</kbd>+<kbd>K</kbd> for commands •
        <kbd>Ctrl</kbd>+<kbd>B</kbd> toggle sidebar
      </p>
    </div>
  </div>
</div>

{#if showQuickStart}
  <QuickStartModal onSelect={handleTemplateSelect} onClose={() => (showQuickStart = false)} />
{/if}

<style>
  .chat-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 2rem;
  }

  .empty-inner {
    max-width: 48rem;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .hero {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .hero-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .hero-icon :global(svg) {
    width: 4rem;
    height: 4rem;
    color: var(--color-primary);
  }

  .hero-title {
    font-size: 2.25rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }

  .hero-desc {
    font-size: 1.25rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .modes-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .modes-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 900px) {
    .modes-grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  .mode-card {
    padding: 1.25rem;
    background: var(--color-bg-subtle);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    transition:
      box-shadow var(--duration-normal, 200ms) ease,
      border-color var(--duration-normal, 200ms) ease,
      transform var(--duration-normal, 200ms) ease;
    text-align: left;
    cursor: pointer;
  }

  .mode-card:hover {
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.1));
    border-color: var(--color-border-highlight);
  }

  .mode-card-highlight {
    background: var(--color-bg-input);
    border-color: var(--color-primary);
  }

  .mode-card-highlight:hover {
    border-color: var(--color-primary-hover);
    box-shadow: var(--shadow-glow, 0 6px 26px rgba(124, 58, 237, 0.35));
  }

  .mode-icon {
    display: flex;
    margin-bottom: 0.5rem;
  }

  .mode-icon :global(svg) {
    width: 1.75rem;
    height: 1.75rem;
    color: var(--color-primary);
  }

  .mode-title {
    font-weight: 700;
    color: var(--color-text);
    margin: 0 0 0.25rem 0;
    font-size: 0.9375rem;
  }

  .mode-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .actions-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .actions-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .action-card {
    padding: 1.5rem;
    background: var(--color-bg-subtle);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    transition:
      box-shadow var(--duration-normal, 200ms) ease,
      border-color var(--duration-normal, 200ms) ease,
      transform var(--duration-normal, 200ms) ease;
    text-align: left;
    cursor: pointer;
  }

  .action-card:hover,
  .mode-card:hover {
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.1));
    border-color: var(--color-border-highlight);
    transform: scale(1.02);
  }

  .action-card:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-card-demo {
    background: var(--color-bg-input);
    border-color: var(--color-border-highlight);
  }

  .action-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 0.75rem;
  }

  .action-icon :global(svg) {
    width: 2rem;
    height: 2rem;
    color: var(--color-primary);
  }

  .action-title {
    font-weight: 700;
    color: var(--color-text);
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
  }

  .action-card:hover .action-title {
    color: var(--color-primary-hover);
  }

  .action-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .examples-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .examples-heading {
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .examples-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  @media (min-width: 768px) {
    .examples-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .example-card {
    text-align: left;
    padding: 1rem;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    transition:
      border-color var(--duration-normal, 200ms) ease,
      box-shadow var(--duration-normal, 200ms) ease;
    cursor: pointer;
    display: flex;
    gap: 0.75rem;
  }

  .example-card:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.1));
  }

  .example-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .example-icon :global(svg) {
    width: 1.5rem;
    height: 1.5rem;
    color: var(--color-text-muted);
  }

  .example-body {
    flex: 1;
    min-width: 0;
  }

  .example-title {
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: var(--color-text);
    font-size: 0.875rem;
  }

  .example-card:hover .example-title {
    color: var(--color-primary-hover);
  }

  .example-prompt {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .features-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    padding-top: 2rem;
    border-top: 1px solid var(--color-border);
  }

  @media (min-width: 768px) {
    .features-row {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .feature {
    text-align: center;
  }

  .feature-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .feature-icon :global(svg) {
    width: 2rem;
    height: 2rem;
    color: var(--color-primary);
  }

  .feature-title {
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: var(--color-text);
    font-size: 0.875rem;
  }

  .feature-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .shortcuts-hint {
    text-align: center;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    padding-top: 1rem;
  }

  .shortcuts-hint kbd {
    padding: 0.25rem 0.5rem;
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 4px;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.3s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .action-card:hover,
    .mode-card:hover {
      transform: none;
    }
  }
</style>
