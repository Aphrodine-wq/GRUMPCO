<script lang="ts">
  /**
   * G-Rump Design System - Icon Component
   * Unified icon interface using Lucide SVG icons
   */
  import * as Icons from 'lucide-svelte';
  import type { ComponentProps } from 'svelte';

  interface Props {
    name: keyof typeof Icons;
    size?: number;
    strokeWidth?: number;
    color?: string;
    class?: string;
  }

  let {
    name,
    size = 20,
    strokeWidth = 2,
    color = 'currentColor',
    class: className = '',
  }: Props = $props();

  // Get the icon component dynamically
  const IconComponent = Icons[name] as any;
</script>

{#if IconComponent}
  <svelte:component
    this={IconComponent}
    {size}
    stroke-width={strokeWidth}
    {color}
    class={className}
  />
{:else}
  <span class="icon-error">Icon "{name}" not found</span>
{/if}

<style>
  :global(.icon-error) {
    color: #dc2626;
    font-size: 12px;
  }
</style>
