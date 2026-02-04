<script lang="ts">
  /**
   * G-Rump Design System - Spinner Component
   * Animated loading spinner
   */

  interface Props {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    color?: 'primary' | 'white' | 'muted';
  }

  let { size = 'md', color = 'primary' }: Props = $props();

  const sizes: Record<typeof size, number> = {
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
  };
</script>

<svg
  class="spinner spinner-{color}"
  width={sizes[size]}
  height={sizes[size]}
  viewBox="0 0 24 24"
  fill="none"
  aria-label="Loading"
  role="status"
>
  <circle
    class="spinner-track"
    cx="12"
    cy="12"
    r="10"
    stroke="currentColor"
    stroke-width="3"
    fill="none"
  />
  <circle
    class="spinner-head"
    cx="12"
    cy="12"
    r="10"
    stroke="currentColor"
    stroke-width="3"
    stroke-linecap="round"
    fill="none"
    stroke-dasharray="60"
    stroke-dashoffset="45"
  />
</svg>

<style>
  .spinner {
    animation: spin 1s linear infinite;
  }

  .spinner-track {
    opacity: 0.2;
  }

  .spinner-head {
    opacity: 1;
  }

  .spinner-primary {
    color: var(--color-primary, #7c3aed);
  }

  .spinner-white {
    color: white;
  }

  .spinner-muted {
    color: var(--color-text-muted, #6d28d9);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 1.5s;
    }
  }
</style>
