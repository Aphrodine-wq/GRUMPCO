<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet, ComponentType } from 'svelte';

  interface Props {
    children: Snippet;
    className?: string;
    title?: string;
    subtitle?: string;
    icon?: ComponentType;
    actions?: Snippet;
  }

  let {
    children,
    className = '',
    title = '',
    subtitle = '',
    icon: Icon,
    actions,
  }: Props = $props();

  let mounted = $state(false);

  onMount(() => {
    // Stagger the entrance animations
    setTimeout(() => {
      mounted = true;
    }, 100);
  });
</script>

<div class="slide-container {className}">
  <div class="content" class:mounted>
    {#if title || subtitle || Icon}
      <div class="slide-header">
        {#if Icon}
          <div class="slide-header-icon">
            <Icon size={24} />
          </div>
        {/if}
        {#if title}
          <h2 class="slide-title">{title}</h2>
        {/if}
        {#if subtitle}
          <p class="slide-subtitle">{subtitle}</p>
        {/if}
      </div>
    {/if}
    {@render children()}
    {#if actions}
      <div class="slide-actions">
        {@render actions()}
      </div>
    {/if}
  </div>
</div>

<style>
  .slide-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start; /* Changed from center to allow scrolling */
    min-height: 100%;
    padding: 2rem;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .content {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 600px;
    width: 100%;
    /* Start slightly lower and invisible */
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    /* Auto margin for vertical centering if content is short */
    margin: auto 0;
  }

  .content.mounted {
    opacity: 1;
    transform: translateY(0);
  }

  /* Shared Global Styles for Slides */
  :global(.slide-header) {
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  :global(.slide-header-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border-radius: 16px;
    color: white;
    margin-bottom: 1rem;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
  }

  :global(.slide-title) {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.5rem;
    line-height: 1.2;
  }

  :global(.slide-subtitle) {
    font-size: 1rem;
    color: #6b7280;
  }

  :global(.slide-cta-button) {
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
    margin-top: 1.5rem;
  }

  :global(.slide-cta-button:hover) {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(124, 58, 237, 0.5);
  }

  :global(.slide-cta-button:active) {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);
  }

  :global(.slide-cta-button:focus-visible) {
    outline: none;
    box-shadow:
      0 0 0 4px rgba(124, 58, 237, 0.3),
      0 4px 16px rgba(124, 58, 237, 0.4);
  }

  :global(.slide-arrow) {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s;
  }

  :global(.slide-cta-button:hover .slide-arrow) {
    transform: translateX(4px);
  }

  @media (prefers-reduced-motion: reduce) {
    .content {
      animation: none;
      transition: none;
    }

    .content.mounted {
      opacity: 1;
      transform: none;
    }

    :global(.slide-cta-button:hover),
    :global(.slide-cta-button:hover .slide-arrow) {
      transform: none;
    }
  }
</style>
