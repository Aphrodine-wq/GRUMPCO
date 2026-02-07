<script lang="ts">
  import type { TechOption } from '../../stores/newOnboardingStore';
  import type { ComponentType } from 'svelte';
  import { getTechIcon } from '../../lib/icons/techIcons';
  import { Package } from 'lucide-svelte';

  interface Props {
    options: TechOption[];
    selected: string[];
    onToggle: (id: string) => void;
    multiSelect?: boolean;
    columns?: 2 | 3 | 4;
    category?: string;
  }

  let {
    options,
    selected,
    onToggle,
    multiSelect = true,
    columns = 3,
    category = 'frontend',
  }: Props = $props();

  // Get the icon component for an option
  function getIconComponent(option: TechOption): ComponentType {
    if (option.icon) {
      return getTechIcon(category, option.id);
    }
    return Package;
  }

  function handleClick(id: string) {
    onToggle(id);
  }

  function handleKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(id);
    }
  }

  const gridCols = $derived(
    {
      2: 'grid-cols-2',
      3: 'grid-cols-2 sm:grid-cols-3',
      4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
    }[columns]
  );
</script>

<div class="grid {gridCols} gap-3" role="group" aria-label="Technology options">
  {#each options as option (option.id)}
    {@const isSelected = selected.includes(option.id)}
    {@const IconComponent = getIconComponent(option)}
    <button
      type="button"
      class="tech-tile group {isSelected ? 'tech-tile-selected' : 'tech-tile-unselected'}"
      class:popular={option.popular}
      onclick={() => handleClick(option.id)}
      onkeydown={(e) => handleKeydown(e, option.id)}
      aria-pressed={isSelected}
      role={multiSelect ? 'checkbox' : 'radio'}
    >
      <!-- Popular badge -->
      {#if option.popular}
        <span class="popular-badge">Popular</span>
      {/if}

      <!-- Icon -->
      <span class="tech-icon" aria-hidden="true">
        {#if IconComponent}
          {@const Icon = IconComponent}
          <Icon size={24} />
        {/if}
      </span>

      <!-- Name -->
      <span class="tech-name">
        {option.name}
      </span>

      <!-- Selection indicator -->
      <span class="selection-indicator" class:visible={isSelected}>
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clip-rule="evenodd"
          />
        </svg>
      </span>
    </button>
  {/each}
</div>

<style>
  .tech-tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem 0.75rem;
    border-radius: 0.75rem;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease-out;
    min-height: 5rem;
    text-align: center;
  }

  .tech-tile:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.4);
  }

  .tech-tile-unselected {
    background: white;
    border-color: #e5e7eb;
  }

  .tech-tile-unselected:hover {
    border-color: var(--color-border-highlight);
    background: var(--color-bg-subtle);
    box-shadow: var(--shadow-sm);
  }

  .tech-tile-selected {
    background: var(--onboarding-cta-gradient);
    border-color: var(--color-primary);
    color: white;
    box-shadow: var(--shadow-glow);
  }

  .tech-tile-selected:hover {
    opacity: 0.95;
    box-shadow: var(--shadow-lg);
  }

  .popular-badge {
    position: absolute;
    top: -0.5rem;
    right: -0.25rem;
    padding: 0.125rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    background: linear-gradient(135deg, var(--color-warning) 0%, #d97706 100%);
    color: white;
    border-radius: 9999px;
    box-shadow: var(--shadow-xs);
  }

  .tech-tile-selected .popular-badge {
    background: var(--color-bg-card);
    color: var(--color-primary);
  }

  .tech-icon {
    font-size: 1.5rem;
    line-height: 1;
    transition: transform 0.2s ease-out;
  }

  .tech-tile:hover .tech-icon {
    opacity: 0.9;
  }

  .tech-tile-selected .tech-icon {
    filter: grayscale(0) brightness(1.1);
  }

  .tech-name {
    font-size: 0.875rem;
    font-weight: 500;
    transition: color 0.2s;
  }

  .tech-tile-unselected .tech-name {
    color: #374151;
  }

  .tech-tile-selected .tech-name {
    color: white;
  }

  .selection-indicator {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: white;
    color: #7c3aed;
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.2s ease-out;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .selection-indicator.visible {
    opacity: 1;
    transform: scale(1);
  }

  /* Animation for selection – subtle */
  @keyframes selectPop {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.02);
    }
    100% {
      transform: scale(1);
    }
  }

  .tech-tile-selected {
    animation: selectPop 0.3s ease-out;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .tech-tile,
    .tech-icon,
    .selection-indicator {
      transition: none;
    }

    .tech-tile-selected {
      animation: none;
    }

    .tech-tile:hover {
      transform: none;
    }

    .tech-tile-selected:hover {
      transform: scale(1.02);
    }
  }
</style>
