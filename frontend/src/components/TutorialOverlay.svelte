<script lang="ts">
  import Button from '$lib/design-system/components/Button/Button.svelte';
  import Card from '$lib/design-system/components/Card/Card.svelte';

  interface TutorialStep {
    target: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    action?: () => void;
  }

  interface Props {
    steps: TutorialStep[];
    onComplete?: () => void;
    onSkip?: () => void;
  }

  let { steps, onComplete, onSkip }: Props = $props();

  let currentStep = $state(0);
  let highlightElement: HTMLElement | null = $state(null);
  let tooltipPosition = $state({ top: 0, left: 0 });

  $effect(() => {
    if (currentStep < steps.length) {
      const step = steps[currentStep];
      const element = document.querySelector(step.target) as HTMLElement;

      if (element) {
        highlightElement = element;
        updateTooltipPosition(element, step.position || 'bottom');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  function updateTooltipPosition(element: HTMLElement, position: string) {
    const rect = element.getBoundingClientRect();
    const tooltipWidth = 400;
    const tooltipHeight = 200;
    const padding = 20;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - tooltipHeight - padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - padding;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + padding;
        break;
    }

    // Keep tooltip within viewport
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

    tooltipPosition = { top, left };
  }

  function nextStep() {
    const step = steps[currentStep];
    if (step.action) {
      step.action();
    }

    if (currentStep < steps.length - 1) {
      currentStep++;
    } else {
      complete();
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
    }
  }

  function complete() {
    highlightElement = null;
    onComplete?.();
  }

  function skip() {
    highlightElement = null;
    onSkip?.();
  }
</script>

{#if currentStep < steps.length}
  <!-- Overlay -->
  <div
    class="tutorial-overlay"
    role="button"
    tabindex="0"
    onclick={skip}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && skip()}
    aria-label="Skip tutorial"
  >
    <!-- Highlight cutout -->
    {#if highlightElement}
      <div
        class="highlight-box"
        style="
          top: {highlightElement.getBoundingClientRect().top - 4}px;
          left: {highlightElement.getBoundingClientRect().left - 4}px;
          width: {highlightElement.getBoundingClientRect().width + 8}px;
          height: {highlightElement.getBoundingClientRect().height + 8}px;
        "
      ></div>
    {/if}

    <!-- Tooltip -->
    <div
      class="tutorial-tooltip"
      role="presentation"
      style="top: {tooltipPosition.top}px; left: {tooltipPosition.left}px;"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <Card>
        <div class="p-6">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-lg font-bold mb-1">{steps[currentStep].title}</h3>
              <p class="text-sm text-gray-500">
                Step {currentStep + 1} of {steps.length}
              </p>
            </div>
            <button
              onclick={skip}
              class="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Skip tutorial"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <p class="text-gray-700 mb-6">{steps[currentStep].content}</p>

          <div class="flex justify-between items-center">
            <Button variant="ghost" size="sm" onclick={prevStep} disabled={currentStep === 0}>
              Previous
            </Button>

            <div class="flex gap-1">
              {#each steps as _, i}
                <div
                  class="w-2 h-2 rounded-full transition-colors"
                  class:bg-blue-500={i === currentStep}
                  class:bg-gray-300={i !== currentStep}
                ></div>
              {/each}
            </div>

            <Button size="sm" onclick={nextStep}>
              {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
{/if}

<style>
  .tutorial-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9999;
    backdrop-filter: blur(2px);
  }

  .highlight-box {
    position: fixed;
    border: 3px solid #3b82f6;
    border-radius: 8px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
    pointer-events: none;
    z-index: 10000;
    transition: all 0.3s ease;
  }

  .tutorial-tooltip {
    position: fixed;
    width: 400px;
    z-index: 10001;
    animation: fadeIn 0.3s ease;
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

  @media (max-width: 640px) {
    .tutorial-tooltip {
      width: calc(100vw - 32px);
      left: 16px !important;
    }
  }
</style>
