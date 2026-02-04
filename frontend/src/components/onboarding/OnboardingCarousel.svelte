<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import OnboardingSlide from './OnboardingSlide.svelte';
  import OnboardingDots from './OnboardingDots.svelte';
  import OnboardingButton from './OnboardingButton.svelte';
  import { preferencesStore } from '../../stores/preferencesStore';
  import { trackSetupComplete, trackSetupSkipped } from '$lib/analytics';

  import { setCurrentView } from '../../stores/uiStore';
  import type { ViewType } from '../../stores/uiStore';

  interface Props {
    onComplete?: () => void;
    onSkip?: () => void;
    onCtaClick?: (action: ViewType) => void;
  }

  let { onComplete, onSkip, onCtaClick }: Props = $props();

  const dispatch = createEventDispatcher();

  // Slide state
  let currentSlide = $state(0);
  let isAnimating = $state(false);
  let direction = $state<'left' | 'right'>('right');

  // Touch/swipe handling
  let touchStartX = $state(0);
  let touchEndX = $state(0);
  let isDragging = $state(false);
  let dragOffset = $state(0);

  // Container ref
  let containerRef: HTMLDivElement;

  // User preferences (collected during onboarding)
  let selectedTechStack = $state<string[]>([]);
  let diagramStyle = $state<'minimal' | 'detailed' | 'comprehensive'>('detailed');

  // Slide definitions - White, Purple alternating
  const slides = [
    {
      id: 'welcome',
      title: 'Turn ideas into apps',
      subtitle: 'Your AI-powered development companion',
      description: 'Ship faster with intelligent architecture, PRDs, and code generation.',
      illustration: 'mascot' as const,
      background: 'white' as const,
    },
    {
      id: 'apiKey',
      title: 'Get Your API Key',
      subtitle: 'Connect in 2 minutes',
      description:
        'Add an API key from NVIDIA NIM, OpenRouter, or another provider. You can test the connection in Settings.',
      illustration: 'apiKey' as const,
      background: 'purple' as const,
      ctaLabel: 'Open Settings',
      ctaAction: 'settings' as const,
    },
    {
      id: 'architecture',
      title: 'Design Architecture',
      subtitle: 'From idea to diagram in seconds',
      description:
        'Describe your system and watch as G-Rump generates beautiful, accurate architecture diagrams.',
      illustration: 'architecture' as const,
      background: 'white' as const,
    },
    {
      id: 'prd',
      title: 'Generate PRDs',
      subtitle: 'Professional documentation, instantly',
      description:
        'Transform your ideas into comprehensive Product Requirements Documents with AI precision.',
      illustration: 'document' as const,
      background: 'purple' as const,
    },
    {
      id: 'code',
      title: 'Ship Code',
      subtitle: 'Design → Spec → Code, in one flow',
      description:
        'Generate production-ready code from your architecture and specs. Full-stack, any framework.',
      illustration: 'code' as const,
      background: 'white' as const,
    },
    {
      id: 'askDocs',
      title: 'Ask docs',
      subtitle: 'RAG-powered answers from your docs',
      description:
        'Query your documentation, codebase, and specs. Get answers grounded in the RAG index. Upload your own docs or use the indexer script. Enable RAG context in chat for tailored responses.',
      illustration: 'document' as const,
      background: 'purple' as const,
      ctaLabel: 'Open Ask docs',
      ctaAction: 'askDocs' as const,
    },
    {
      id: 'freeAgent',
      title: 'G-Agent',
      subtitle: 'Full capabilities when you need them',
      description:
        'G-Agent gives the AI access to more tools: files, git, Docker, external APIs. Use capability toggles to control what the AI can do. Docker is recommended for sandboxing. Access from the chat header or Ctrl+K.',
      illustration: 'code' as const,
      background: 'purple' as const,
      ctaLabel: 'Set up Docker',
      ctaAction: 'docker-setup' as const,
    },
    {
      id: 'integrations',
      title: 'Connect Your Tools',
      subtitle: 'Telegram, Discord, Slack, GitHub, Notion',
      description:
        'Use G-Rump from your favorite platforms. Chat from Telegram, Discord, or Slack. Sync specs with Notion. Trigger builds from GitHub. Configure integrations in Settings.',
      illustration: 'integrations' as const,
      background: 'white' as const,
      ctaLabel: 'Configure in Settings',
      ctaAction: 'settings' as const,
    },
    {
      id: 'models',
      title: 'Choose Your AI Model',
      subtitle: 'Smart routing or pick a provider',
      description:
        'Start with Auto (smart routing) or choose a provider: NVIDIA NIM, OpenRouter, Anthropic, Gemini, Groq, Together, or local Ollama. Change anytime in Settings.',
      illustration: 'setup' as const,
      background: 'purple' as const,
      ctaLabel: 'Open Settings',
      ctaAction: 'settings' as const,
    },
    {
      id: 'setup',
      title: "Let's Get Started",
      subtitle: 'Personalize your experience',
      description:
        'Select your preferred technologies to get tailored suggestions. You can change these later.',
      illustration: 'setup' as const,
      background: 'white' as const,
      isInteractive: true,
    },
  ];

  const totalSlides = slides.length;

  // Tech stack options
  const techCategories = {
    Frontend: ['React', 'Vue', 'Svelte', 'Next.js', 'Angular'],
    Backend: ['Node.js', 'Python', 'Go', 'Rust', 'Java'],
    Database: ['PostgreSQL', 'MongoDB', 'Redis', 'SQLite', 'MySQL'],
    Cloud: ['AWS', 'GCP', 'Azure', 'Vercel', 'Docker'],
  };

  // Navigation functions
  function goToSlide(index: number) {
    if (isAnimating || index === currentSlide) return;
    if (index < 0 || index >= totalSlides) return;

    direction = index > currentSlide ? 'right' : 'left';
    isAnimating = true;
    currentSlide = index;

    setTimeout(() => {
      isAnimating = false;
    }, 400);
  }

  function nextSlide() {
    if (currentSlide < totalSlides - 1) {
      goToSlide(currentSlide + 1);
    }
  }

  function prevSlide() {
    if (currentSlide > 0) {
      goToSlide(currentSlide - 1);
    }
  }

  // Touch handlers
  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    isDragging = true;
    dragOffset = 0;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    touchEndX = e.touches[0].clientX;
    dragOffset = touchEndX - touchStartX;
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;

    const threshold = 50;
    if (dragOffset > threshold && currentSlide > 0) {
      prevSlide();
    } else if (dragOffset < -threshold && currentSlide < totalSlides - 1) {
      nextSlide();
    }

    dragOffset = 0;
  }

  // Mouse drag handlers (for desktop)
  function handleMouseDown(e: MouseEvent) {
    touchStartX = e.clientX;
    isDragging = true;
    dragOffset = 0;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    touchEndX = e.clientX;
    dragOffset = touchEndX - touchStartX;
  }

  function handleMouseUp() {
    handleTouchEnd();
  }

  // Keyboard navigation
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'Escape') {
      handleSkip();
    }
  }

  // Tech stack toggle
  function toggleTech(tech: string) {
    if (selectedTechStack.includes(tech)) {
      selectedTechStack = selectedTechStack.filter((t) => t !== tech);
    } else {
      selectedTechStack = [...selectedTechStack, tech];
    }
  }

  // Completion handlers
  function handleComplete() {
    preferencesStore.update({
      setupComplete: true,
      primaryTechStack: selectedTechStack,
      diagramStyle: diagramStyle,
    });

    trackSetupComplete({
      diagramStyle,
      techStackCount: selectedTechStack.length,
    });

    dispatch('complete');
    onComplete?.();
  }

  function handleSkip() {
    preferencesStore.update({
      setupComplete: true,
    });

    trackSetupSkipped();
    dispatch('skip');
    onSkip?.();
  }

  // Lifecycle
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  // Computed styles for drag effect
  $effect(() => {
    if (containerRef && isDragging) {
      const dampedOffset = dragOffset * 0.3;
      containerRef.style.transform = `translateX(${dampedOffset}px)`;
    } else if (containerRef) {
      containerRef.style.transform = '';
    }
  });
</script>

<div
  class="fixed inset-0 z-50 overflow-hidden {slides[currentSlide].background === 'purple'
    ? 'bg-[#7C3AED]'
    : 'bg-white'}"
  role="region"
  aria-label="Onboarding carousel"
  aria-live="polite"
>
  <!-- Skip button -->
  <button
    class="absolute top-6 right-6 z-50 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-full
           {slides[currentSlide].background === 'purple'
      ? 'text-white/80 hover:text-white hover:bg-white/10'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
    onclick={handleSkip}
    aria-label="Skip onboarding"
  >
    Skip
  </button>

  <!-- Main carousel container -->
  <div
    bind:this={containerRef}
    class="h-full w-full flex flex-col items-center justify-center px-6 py-12
           transition-transform duration-400 ease-out"
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
    onmousedown={handleMouseDown}
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    onmouseleave={handleMouseUp}
    role="presentation"
  >
    <!-- Slide content -->
    <div class="flex-1 flex flex-col items-center justify-center max-w-lg w-full">
      {#key currentSlide}
        <div
          class="slide-enter w-full"
          class:slide-enter-from-right={direction === 'right'}
          class:slide-enter-from-left={direction === 'left'}
        >
          <OnboardingSlide slide={slides[currentSlide]} isActive={true}>
            {#if slides[currentSlide].ctaLabel && slides[currentSlide].ctaAction}
              <div class="mt-6">
                <button
                  type="button"
                  class="cta-button {slides[currentSlide].background === 'purple'
                    ? 'cta-button-purple'
                    : 'cta-button-white'}"
                  onclick={() => {
                    const action = slides[currentSlide].ctaAction as ViewType;
                    onCtaClick?.(action) ?? (handleComplete(), setCurrentView(action));
                  }}
                >
                  {slides[currentSlide].ctaLabel}
                </button>
              </div>
            {:else if slides[currentSlide].isInteractive}
              <!-- Tech stack selection (setup slide is white background) -->
              <div class="mt-8 space-y-6">
                {#each Object.entries(techCategories) as [category, techs]}
                  <div>
                    <h4 class="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">
                      {category}
                    </h4>
                    <div class="flex flex-wrap gap-2">
                      {#each techs as tech}
                        <button
                          class="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                                 {selectedTechStack.includes(tech)
                            ? 'bg-[#7C3AED] text-white shadow-lg scale-105'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                          onclick={() => toggleTech(tech)}
                          aria-pressed={selectedTechStack.includes(tech)}
                        >
                          {tech}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </OnboardingSlide>
        </div>
      {/key}
    </div>

    <!-- Bottom navigation -->
    <div class="w-full max-w-lg flex flex-col items-center gap-6 mt-8">
      <!-- Dots indicator -->
      <OnboardingDots
        total={totalSlides}
        current={currentSlide}
        onDotClick={goToSlide}
        background={slides[currentSlide].background}
      />

      <!-- Action button -->
      {#if currentSlide === totalSlides - 1}
        <div class="setup-actions">
          <OnboardingButton onclick={handleComplete} background={slides[currentSlide].background}>
            Get Started
          </OnboardingButton>
          <button type="button" class="choose-later" onclick={handleComplete}>
            I'll choose later
          </button>
        </div>
      {:else}
        <OnboardingButton onclick={nextSlide} background={slides[currentSlide].background}>
          Continue
        </OnboardingButton>
      {/if}

      <!-- Swipe hint (first slide only) -->
      {#if currentSlide === 0}
        <p class="text-gray-400 text-sm animate-pulse">Swipe or use arrow keys to navigate</p>
      {/if}
      <!-- Post-onboarding hint (last slide) -->
      {#if currentSlide === totalSlides - 1}
        <p class="onboarding-hint text-gray-400 text-xs">
          Try <kbd>Ctrl</kbd>+<kbd>K</kbd> to jump anywhere. Use G-Agent for full AI capabilities.
        </p>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Slide animations */
  .slide-enter {
    animation: slideEnter 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  .slide-enter-from-right {
    --slide-start: 60px;
  }

  .slide-enter-from-left {
    --slide-start: -60px;
  }

  @keyframes slideEnter {
    from {
      opacity: 0;
      transform: translateX(var(--slide-start, 60px));
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .slide-enter {
      animation: fadeIn 300ms ease-out forwards;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  }

  /* Duration utility */
  .duration-400 {
    transition-duration: 400ms;
  }

  .setup-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .choose-later {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    background: transparent;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .choose-later:hover {
    color: var(--color-text, #111);
  }

  .onboarding-hint {
    margin: 0;
  }

  .onboarding-hint kbd {
    padding: 0.125rem 0.375rem;
    font-size: 0.7rem;
    background: rgba(0, 0, 0, 0.08);
    border-radius: 4px;
  }

  .cta-button {
    padding: 0.625rem 1.25rem;
    font-size: 0.9375rem;
    font-weight: 600;
    border-radius: 0.5rem;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cta-button-purple {
    color: #7c3aed;
    background: white;
    border-color: white;
  }

  .cta-button-purple:hover {
    background: rgba(255, 255, 255, 0.9);
    transform: scale(1.02);
  }

  .cta-button-white {
    color: white;
    background: #7c3aed;
    border-color: #7c3aed;
  }

  .cta-button-white:hover {
    background: #6d28d9;
    border-color: #6d28d9;
    transform: scale(1.02);
  }
</style>
