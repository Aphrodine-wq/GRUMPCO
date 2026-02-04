<script lang="ts">
  import TechStackTiles from '../TechStackTiles.svelte';
  import SlideLayout from '../shared/SlideLayout.svelte';
  import type { TechOption } from '../../../stores/newOnboardingStore';
  import type { ComponentType, SvelteComponent } from 'svelte';

  interface Props {
    icon: ComponentType<SvelteComponent>;
    title: string;
    subtitle: string;
    options: TechOption[];
    selected: string[];
    onToggle: (id: string) => void;
    onNext: () => void;
    multiSelect?: boolean;
    columns?: 2 | 3 | 4;
    tip?: string;
    category?: string;
  }

  let {
    icon,
    title,
    subtitle,
    options,
    selected,
    onToggle,
    onNext,
    multiSelect = true,
    columns = 3,
    tip,
    category = 'frontend',
  }: Props = $props();

  const selectedCount = $derived(selected.length);
</script>

<SlideLayout>
  <!-- Header -->
  <div class="slide-header">
    <div class="slide-header-icon">
      {#if icon}
        {@const TechIcon = icon}
        <TechIcon size={28} />
      {/if}
    </div>
    <h2 class="slide-title">{title}</h2>
    <p class="slide-subtitle">{subtitle}</p>
  </div>

  <!-- Tiles -->
  <div class="tiles-container">
    <TechStackTiles {options} {selected} {onToggle} {multiSelect} {columns} {category} />
  </div>

  <!-- Selection count -->
  {#if multiSelect}
    <p class="selection-count">
      {#if selectedCount === 0}
        Select all that apply
      {:else}
        {selectedCount} selected
      {/if}
    </p>
  {/if}

  <!-- Tip -->
  {#if tip}
    <p class="tip">{tip}</p>
  {/if}

  <!-- CTA -->
  <button class="slide-cta-button" onclick={onNext}>
    <span>Continue</span>
    <svg class="slide-arrow" viewBox="0 0 20 20" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
        clip-rule="evenodd"
      />
    </svg>
  </button>
</SlideLayout>

<style>
  /* Tiles container */
  .tiles-container {
    width: 100%;
    margin-bottom: 1rem;
  }

  /* Selection count */
  .selection-count {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
  }

  /* Tip */
  .tip {
    font-size: 0.8125rem;
    color: #9ca3af;
    margin-bottom: 1.5rem;
    font-style: italic;
  }
</style>
