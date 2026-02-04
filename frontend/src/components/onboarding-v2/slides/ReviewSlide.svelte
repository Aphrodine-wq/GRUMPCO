<script lang="ts">
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

  <p class="note">You can change any of these settings later in Settings</p>

  <button class="cta-button" onclick={onNext}>
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
</style>
