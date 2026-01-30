<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import OnboardingSlide from './OnboardingSlide.svelte';
  import OnboardingDots from './OnboardingDots.svelte';
  import OnboardingButton from './OnboardingButton.svelte';
  import { preferencesStore } from '../../stores/preferencesStore';
  import { trackSetupComplete, trackSetupSkipped } from '$lib/analytics';

  interface Props {
    onComplete?: () => void;
    onSkip?: () => void;
  }

  let { onComplete, onSkip }: Props = $props();

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

  // Slide definitions
  const slides = [
    {
      id: 'welcome',
      title: 'Welcome to G-Rump',
      subtitle: 'Your AI-powered development companion',
      description: 'Ship faster with intelligent architecture, PRDs, and code generation.',
      illustration: 'mascot',
      gradient: 'from-purple-600 via-violet-600 to-indigo-700',
    },
    {
      id: 'architecture',
      title: 'Design Architecture',
      subtitle: 'From idea to diagram in seconds',
      description: 'Describe your system and watch as G-Rump generates beautiful, accurate architecture diagrams.',
      illustration: 'architecture',
      gradient: 'from-blue-600 via-cyan-600 to-teal-600',
    },
    {
      id: 'prd',
      title: 'Generate PRDs',
      subtitle: 'Professional documentation, instantly',
      description: 'Transform your ideas into comprehensive Product Requirements Documents with AI precision.',
      illustration: 'document',
      gradient: 'from-emerald-600 via-green-600 to-teal-600',
    },
    {
      id: 'code',
      title: 'Ship Code',
      subtitle: 'From design to deployment',
      description: 'Generate production-ready code from your architecture and specs. Full-stack, any framework.',
      illustration: 'code',
      gradient: 'from-orange-500 via-amber-500 to-yellow-500',
    },
    {
      id: 'setup',
      title: "Let's Get Started",
      subtitle: 'Personalize your experience',
      description: 'Select your preferred technologies to get tailored suggestions.',
      illustration: 'setup',
      gradient: 'from-purple-600 via-pink-600 to-rose-600',
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
      selectedTechStack = selectedTechStack.filter(t => t !== tech);
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
  class="fixed inset-0 z-50 bg-gradient-to-br {slides[currentSlide].gradient} overflow-hidden"
  role="region"
  aria-label="Onboarding carousel"
  aria-live="polite"
>
  <!-- Skip button -->
  <button
    class="absolute top-6 right-6 z-50 px-4 py-2 text-white/80 hover:text-white text-sm font-medium
           transition-all duration-200 hover:bg-white/10 rounded-full backdrop-blur-sm"
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
          <OnboardingSlide
            slide={slides[currentSlide]}
            isActive={true}
          >
            {#if slides[currentSlide].isInteractive}
              <!-- Tech stack selection -->
              <div class="mt-8 space-y-6">
                {#each Object.entries(techCategories) as [category, techs]}
                  <div>
                    <h4 class="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">
                      {category}
                    </h4>
                    <div class="flex flex-wrap gap-2">
                      {#each techs as tech}
                        <button
                          class="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                                 {selectedTechStack.includes(tech)
                                   ? 'bg-white text-purple-700 shadow-lg scale-105'
                                   : 'bg-white/20 text-white hover:bg-white/30'}"
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
      />

      <!-- Action button -->
      {#if currentSlide === totalSlides - 1}
        <OnboardingButton onclick={handleComplete}>
          Get Started
        </OnboardingButton>
      {:else}
        <OnboardingButton onclick={nextSlide}>
          Continue
        </OnboardingButton>
      {/if}

      <!-- Swipe hint (first slide only) -->
      {#if currentSlide === 0}
        <p class="text-white/50 text-sm animate-pulse">
          Swipe or use arrow keys to navigate
        </p>
      {/if}
    </div>
  </div>

  <!-- Background decoration -->
  <div class="absolute inset-0 pointer-events-none overflow-hidden">
    <!-- Floating orbs -->
    <div class="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float-slow"></div>
    <div class="absolute -bottom-48 -right-48 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl animate-float-slower"></div>
    <div class="absolute top-1/3 right-10 w-24 h-24 bg-white/10 rounded-full blur-2xl animate-float"></div>
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

  /* Floating animation for background elements */
  @keyframes float {
    0%, 100% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-20px) rotate(3deg);
    }
  }

  @keyframes floatSlow {
    0%, 100% {
      transform: translate(0, 0) scale(1);
    }
    50% {
      transform: translate(30px, -30px) scale(1.05);
    }
  }

  @keyframes floatSlower {
    0%, 100% {
      transform: translate(0, 0) scale(1);
    }
    50% {
      transform: translate(-20px, 20px) scale(1.02);
    }
  }

  .animate-float {
    animation: float 4s ease-in-out infinite;
  }

  .animate-float-slow {
    animation: floatSlow 8s ease-in-out infinite;
  }

  .animate-float-slower {
    animation: floatSlower 12s ease-in-out infinite;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .slide-enter {
      animation: fadeIn 300ms ease-out forwards;
    }

    .animate-float,
    .animate-float-slow,
    .animate-float-slower {
      animation: none;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  }

  /* Duration utility */
  .duration-400 {
    transition-duration: 400ms;
  }
</style>
