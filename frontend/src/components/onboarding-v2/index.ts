// Onboarding v2 - Complete redesign
export { default as OnboardingFlow } from './OnboardingFlow.svelte';
export { default as TechStackTiles } from './TechStackTiles.svelte';

// Individual slides
export { default as WelcomeSlide } from './slides/WelcomeSlide.svelte';
export { default as ShipWorkflowSlide } from './slides/ShipWorkflowSlide.svelte';
export { default as GAgentSlide } from './slides/GAgentSlide.svelte';
export { default as AuthSlide } from './slides/AuthSlide.svelte';
export { default as ApiProviderSlide } from './slides/ApiProviderSlide.svelte';
export { default as TechStackSlide } from './slides/TechStackSlide.svelte';
export { default as AppPreferencesSlide } from './slides/AppPreferencesSlide.svelte';
export { default as ReviewSlide } from './slides/ReviewSlide.svelte';
export { default as NextStepsSlide } from './slides/NextStepsSlide.svelte';

// Re-export store
export {
  newOnboardingStore,
  currentStep,
  currentStepIndex,
  isOnboardingComplete,
  progress,
  STEP_ORDER,
  type OnboardingStep,
  type OnboardingData,
} from '../../stores/newOnboardingStore';
