<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowRight, ClipboardCheck } from 'lucide-svelte';
  import { newOnboardingStore, AI_PROVIDER_OPTIONS } from '../../../stores/newOnboardingStore';
  import SlideLayout from '../shared/SlideLayout.svelte';
  import ReviewItem from '../shared/ReviewItem.svelte';

  interface Props {
    onNext: () => void;
    onEdit: (step: string) => void;
  }

  let { onNext, onEdit }: Props = $props();

  let data = $state(newOnboardingStore.get());
  let riskChecked = $state(newOnboardingStore.get().riskAcknowledged ?? false);

  onMount(() => {
    riskChecked = newOnboardingStore.get().riskAcknowledged ?? false;
  });

  const sections = $derived([
    {
      label: 'AI Provider',
      value: data.aiProvider
        ? AI_PROVIDER_OPTIONS.find((p) => p.id === data.aiProvider)?.name || 'Not configured'
        : 'Not configured',
      step: 'api-provider',
      configured: !!data.aiProvider,
    },
    {
      label: 'Theme',
      value: data.theme.charAt(0).toUpperCase() + data.theme.slice(1),
      step: 'app-preferences',
      configured: true,
    },
  ]);

  const configuredCount = $derived(sections.filter((s) => s.configured).length);
</script>

<SlideLayout
  title="Review Your Setup"
  subtitle={`${configuredCount} of ${sections.length} preferences configured`}
  icon={ClipboardCheck}
>
  <div class="review-list">
    {#each sections as section}
      <ReviewItem
        label={section.label}
        value={section.value}
        configured={section.configured}
        onEdit={() => onEdit(section.step)}
      />
    {/each}
  </div>

  <label class="risk-ack">
    <input
      type="checkbox"
      bind:checked={riskChecked}
      onchange={() => newOnboardingStore.setRiskAcknowledged(riskChecked)}
    />
    <span class="risk-ack-text"
      >I understand this software can execute code and access resources, and I accept the security
      and privacy risks.</span
    >
  </label>

  <p class="note">You can change any of these settings later in Settings</p>

  <button class="cta-button" disabled={!riskChecked} onclick={onNext}>
    <span>Looks good, let's go!</span>
    <ArrowRight size={18} />
  </button>
</SlideLayout>

<style>
  .review-list {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .risk-ack {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    width: 100%;
    margin-bottom: 1.25rem;
    cursor: pointer;
    text-align: left;
  }

  .risk-ack input[type='checkbox'] {
    margin-top: 0.25rem;
    flex-shrink: 0;
    width: 1.125rem;
    height: 1.125rem;
    accent-color: var(--color-primary);
  }

  .risk-ack-text {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .note {
    font-size: 0.8125rem;
    color: #9ca3af;
    margin-bottom: 1.5rem;
    text-align: center;
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

  .cta-button:hover:not(:disabled) {
    opacity: 0.95;
    box-shadow: var(--shadow-lg);
  }

  .cta-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cta-button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
</style>
