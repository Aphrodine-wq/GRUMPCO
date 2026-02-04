<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Code, Server, Database, Wrench, Layout } from 'lucide-svelte';

  import {
    newOnboardingStore,
    currentStep,
    currentStepIndex,
    STEP_ORDER,
    FRONTEND_OPTIONS,
    BACKEND_LANGUAGE_OPTIONS,
    BACKEND_FRAMEWORK_OPTIONS,
    DATABASE_OPTIONS,
    CLOUD_OPTIONS,
    INFRASTRUCTURE_OPTIONS,
    GIT_PROVIDER_OPTIONS,
    IDE_OPTIONS,
    STYLING_OPTIONS,
    type OnboardingStep,
  } from '../../stores/newOnboardingStore';

  // Slide components
  import WelcomeSlide from './slides/WelcomeSlide.svelte';
  import ShipWorkflowSlide from './slides/ShipWorkflowSlide.svelte';
  import GAgentSlide from './slides/GAgentSlide.svelte';
  import AuthSlide from './slides/AuthSlide.svelte';
  import ApiProviderSlide from './slides/ApiProviderSlide.svelte';
  import TechStackSlide from './slides/TechStackSlide.svelte';
  import AppPreferencesSlide from './slides/AppPreferencesSlide.svelte';
  import ReviewSlide from './slides/ReviewSlide.svelte';
  import NextStepsSlide from './slides/NextStepsSlide.svelte';

  // Dots indicator
  import OnboardingDots from '../onboarding/OnboardingDots.svelte';

  interface Props {
    onComplete: () => void;
    onSkip?: () => void;
  }

  let { onComplete, onSkip }: Props = $props();

  let direction = $state<'left' | 'right'>('right');
  let isTransitioning = $state(false);

  // Get reactive data from store
  let data = $state(newOnboardingStore.get());

  // Subscribe to store changes
  const unsubscribe = newOnboardingStore.subscribe((value) => {
    data = value;
  });

  onDestroy(() => {
    unsubscribe();
  });

  function goToStep(step: OnboardingStep) {
    const currentIndex = STEP_ORDER.indexOf($currentStep);
    const targetIndex = STEP_ORDER.indexOf(step);
    direction = targetIndex > currentIndex ? 'right' : 'left';
    isTransitioning = true;

    setTimeout(() => {
      newOnboardingStore.goToStep(step);
      setTimeout(() => {
        isTransitioning = false;
      }, 50);
    }, 200);
  }

  function nextStep() {
    direction = 'right';
    isTransitioning = true;

    setTimeout(() => {
      newOnboardingStore.nextStep();
      setTimeout(() => {
        isTransitioning = false;
      }, 50);
    }, 200);
  }

  function handleSkip() {
    newOnboardingStore.skip();
    onSkip?.();
    onComplete();
  }

  function handleComplete() {
    newOnboardingStore.complete();
    onComplete();
  }

  function handleDotClick(index: number) {
    const targetStep = STEP_ORDER[index];
    if (targetStep) {
      goToStep(targetStep);
    }
  }

  function handleEditFromReview(step: string) {
    goToStep(step as OnboardingStep);
  }

  // Keyboard navigation
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleSkip();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  // Toggle handlers for tech stack
  function toggleFrontend(id: string) {
    newOnboardingStore.toggleSelection('frontend', id);
  }
  function toggleBackendLanguage(id: string) {
    newOnboardingStore.toggleSelection('backendLanguage', id);
  }
  function toggleBackendFramework(id: string) {
    newOnboardingStore.toggleSelection('backendFramework', id);
  }
  function toggleDatabase(id: string) {
    newOnboardingStore.toggleSelection('database', id);
  }
  function toggleCloud(id: string) {
    newOnboardingStore.toggleSelection('cloud', id);
  }
  function toggleInfrastructure(id: string) {
    newOnboardingStore.toggleSelection('infrastructure', id);
  }
  function toggleGitProvider(id: string) {
    newOnboardingStore.toggleSelection('gitProvider', id);
  }
  function toggleIde(id: string) {
    newOnboardingStore.toggleSelection('ide', id);
  }
  function toggleStyling(id: string) {
    newOnboardingStore.toggleSelection('styling', id);
  }
</script>

<div class="onboarding-container" role="dialog" aria-label="Onboarding" aria-modal="true">
  <!-- Skip button -->
  <button class="skip-button" onclick={handleSkip} aria-label="Skip onboarding"> Skip </button>

  <!-- Main content area -->
  <div class="slide-wrapper">
    <!-- Full-bleed background for all slides -->
    <div class="onboarding-bg" aria-hidden="true">
      <div class="onboarding-bg-gradient"></div>
      <div class="onboarding-bg-dots"></div>
    </div>
    <div
      class="slide-content"
      class:transitioning={isTransitioning}
      class:slide-left={direction === 'left'}
      class:slide-right={direction === 'right'}
    >
      {#if $currentStep === 'welcome'}
        <WelcomeSlide onNext={nextStep} />
      {:else if $currentStep === 'ship-workflow'}
        <ShipWorkflowSlide onNext={nextStep} />
      {:else if $currentStep === 'g-agent'}
        <GAgentSlide onNext={nextStep} />
      {:else if $currentStep === 'auth'}
        <AuthSlide onNext={nextStep} />
      {:else if $currentStep === 'api-provider'}
        <ApiProviderSlide onNext={nextStep} />
      {:else if $currentStep === 'frontend-stack'}
        <TechStackSlide
          icon={Layout}
          title="Frontend Stack"
          subtitle="What frontend technologies do you use?"
          options={FRONTEND_OPTIONS}
          selected={data.frontend}
          onToggle={toggleFrontend}
          onNext={nextStep}
          tip="Select all that you commonly work with"
        />
      {:else if $currentStep === 'backend-stack'}
        <div class="stacked-slides">
          <TechStackSlide
            icon={Server}
            title="Backend Stack"
            subtitle="What backend languages do you use?"
            options={BACKEND_LANGUAGE_OPTIONS}
            selected={data.backendLanguage}
            onToggle={toggleBackendLanguage}
            onNext={() => {}}
            columns={4}
          />
          <div class="section-divider">
            <span>And which frameworks?</span>
          </div>
          <div class="framework-grid">
            <TechStackSlide
              icon={Server}
              title=""
              subtitle=""
              options={BACKEND_FRAMEWORK_OPTIONS}
              selected={data.backendFramework}
              onToggle={toggleBackendFramework}
              onNext={nextStep}
              columns={4}
            />
          </div>
        </div>
      {:else if $currentStep === 'infrastructure'}
        <div class="stacked-slides">
          <TechStackSlide
            icon={Database}
            title="Infrastructure"
            subtitle="Database & hosting preferences"
            options={DATABASE_OPTIONS}
            selected={data.database}
            onToggle={toggleDatabase}
            onNext={() => {}}
            columns={4}
          />
          <div class="section-divider">
            <span>Cloud & Hosting</span>
          </div>
          <div class="infra-section">
            <TechStackSlide
              icon={Database}
              title=""
              subtitle=""
              options={CLOUD_OPTIONS}
              selected={data.cloud}
              onToggle={toggleCloud}
              onNext={() => {}}
              columns={4}
            />
          </div>
          <div class="section-divider">
            <span>Infrastructure Tools</span>
          </div>
          <div class="infra-section">
            <TechStackSlide
              icon={Database}
              title=""
              subtitle=""
              options={INFRASTRUCTURE_OPTIONS}
              selected={data.infrastructure}
              onToggle={toggleInfrastructure}
              onNext={nextStep}
              columns={4}
            />
          </div>
        </div>
      {:else if $currentStep === 'tooling'}
        <div class="stacked-slides">
          <TechStackSlide
            icon={Wrench}
            title="Tooling"
            subtitle="Git, IDE, and styling preferences"
            options={GIT_PROVIDER_OPTIONS}
            selected={data.gitProvider}
            onToggle={toggleGitProvider}
            onNext={() => {}}
            columns={4}
          />
          <div class="section-divider">
            <span>IDE / Editor</span>
          </div>
          <div class="tool-section">
            <TechStackSlide
              icon={Code}
              title=""
              subtitle=""
              options={IDE_OPTIONS}
              selected={data.ide}
              onToggle={toggleIde}
              onNext={() => {}}
              columns={4}
            />
          </div>
          <div class="section-divider">
            <span>Styling</span>
          </div>
          <div class="tool-section">
            <TechStackSlide
              icon={Layout}
              title=""
              subtitle=""
              options={STYLING_OPTIONS}
              selected={data.styling}
              onToggle={toggleStyling}
              onNext={nextStep}
              columns={4}
            />
          </div>
        </div>
      {:else if $currentStep === 'app-preferences'}
        <AppPreferencesSlide onNext={nextStep} />
      {:else if $currentStep === 'review'}
        <ReviewSlide onNext={nextStep} onEdit={handleEditFromReview} />
      {:else if $currentStep === 'next-steps'}
        <NextStepsSlide onComplete={handleComplete} />
      {/if}
    </div>
  </div>

  <!-- Dots navigation -->
  <div class="dots-container">
    <OnboardingDots
      total={STEP_ORDER.length}
      current={$currentStepIndex}
      onDotClick={handleDotClick}
      background="white"
    />
  </div>
</div>

<style>
  .onboarding-container {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .onboarding-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .onboarding-bg-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      165deg,
      #fafafa 0%,
      #f5f3ff 25%,
      #ede9fe 50%,
      #e9e5ff 75%,
      #ddd6fe 100%
    );
  }

  .onboarding-bg-dots {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(
      circle at 1px 1px,
      rgba(124, 58, 237, 0.12) 1px,
      transparent 0
    );
    background-size: 22px 22px;
    opacity: 0.9;
  }

  /* Skip button */
  .skip-button {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    z-index: 50;
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    color: #6b7280;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .skip-button:hover {
    color: #374151;
    background: rgba(0, 0, 0, 0.05);
  }

  .skip-button:focus-visible {
    outline: 2px solid #7c3aed;
    outline-offset: 2px;
  }

  /* Slide wrapper – scrollable so tall slides are not cut off */
  .slide-wrapper {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2rem;
    padding-bottom: 4rem;
  }

  .slide-content {
    position: relative;
    z-index: 1;
    width: 100%;
    min-height: min-content;
    max-width: 900px;
    transition:
      opacity 0.4s ease-out,
      transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .slide-content.transitioning {
    opacity: 0;
  }

  .slide-content.transitioning.slide-right {
    transform: translateX(-20px);
  }

  .slide-content.transitioning.slide-left {
    transform: translateX(20px);
  }

  /* Stacked slides for multi-section pages */
  .stacked-slides {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 0;
    max-height: 100%;
    overflow-y: auto;
    padding-bottom: 2rem;
  }

  .section-divider {
    width: 100%;
    max-width: 700px;
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1rem 0;
    padding: 0 1rem;
  }

  .section-divider::before,
  .section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e5e7eb;
  }

  .section-divider span {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    white-space: nowrap;
  }

  .framework-grid,
  .infra-section,
  .tool-section {
    width: 100%;
  }

  /* Remove redundant headers from nested TechStackSlides */
  .framework-grid :global(.header),
  .infra-section :global(.header),
  .tool-section :global(.header) {
    display: none;
  }

  .framework-grid :global(.selection-count),
  .infra-section :global(.selection-count),
  .tool-section :global(.selection-count) {
    display: none;
  }

  .framework-grid :global(.tip),
  .infra-section :global(.tip),
  .tool-section :global(.tip) {
    display: none;
  }

  /* Only show CTA on the last nested section */
  .stacked-slides > :not(:last-child) :global(.cta-button) {
    display: none;
  }

  /* Dots container */
  .dots-container {
    position: absolute;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .slide-content {
      transition: none;
    }
  }

  /* Responsive */
  @media (max-width: 640px) {
    .slide-wrapper {
      padding: 1rem;
      padding-bottom: 5rem;
    }

    .skip-button {
      top: 1rem;
      right: 1rem;
    }
  }
</style>
