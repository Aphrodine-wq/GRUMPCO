<script lang="ts">
  /**
   * G-Rump Design System - Icon Component
   * Unified icon interface
   * Note: lucide-svelte dependency removed. Use inline SVGs or a different icon solution.
   */
  interface Props {
    name: string;
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
</script>

<span class="icon-error {className}">Icon "{name}" not found</span>

<style>
  :global(.icon-error) {
    color: #dc2626;
    font-size: 12px;
  }
</style>
