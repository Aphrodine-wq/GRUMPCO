<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet, ComponentType } from 'svelte';

  interface Props {
    children: Snippet;
    /** Optional full-bleed background (renders behind content, covers whole slide) */
    background?: Snippet;
    className?: string;
    title?: string;
    subtitle?: string;
    icon?: ComponentType;
    actions?: Snippet;
  }

  let {
    children,
    background,
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
  {#if background}
    <div class="slide-background">{@render background()}</div>
  {:else}
    <div class="slide-background slide-background-default" aria-hidden="true">
      <div class="slide-bg-gradient"></div>
      <div class="slide-bg-dots"></div>
    </div>
  {/if}
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
  .slide-background {
    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;
  }

  .slide-background-default .slide-bg-gradient {
    position: absolute;
    inset: 0;
    background: var(--onboarding-slide-default-bg);
  }

  .slide-background-default .slide-bg-dots {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(
      circle at 1px 1px,
      var(--onboarding-slide-dots) 1px,
      transparent 0
    );
    background-size: 20px 20px;
    opacity: 0.95;
  }

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
    transition:
      opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
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
    background: var(--onboarding-cta-gradient);
    border-radius: 16px;
    color: white;
    margin-bottom: 1rem;
    box-shadow: var(--shadow-glow);
  }

  :global(.slide-title) {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 0.5rem;
    line-height: 1.2;
  }

  :global(.slide-subtitle) {
    font-size: 1rem;
    color: var(--color-text-muted);
  }

  :global(.slide-cta-button) {
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
    margin-top: 1.5rem;
  }

  :global(.slide-cta-button:hover) {
    opacity: 0.95;
    box-shadow: var(--shadow-lg);
  }

  :global(.slide-cta-button:active) {
    opacity: 1;
  }

  :global(.slide-cta-button:focus-visible) {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  :global(.slide-arrow) {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s;
  }

  :global(.slide-cta-button:hover .slide-arrow) {
    transform: translateX(2px);
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
