<script lang="ts">
  interface Props {
    onclick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: 'primary' | 'secondary';
    children?: import('svelte').Snippet;
  }

  let { onclick, disabled = false, loading = false, variant = 'primary', children }: Props = $props();

  let isPressed = $state(false);
  let ripples = $state<{ id: number; x: number; y: number }[]>([]);
  let buttonRef: HTMLButtonElement;
  let rippleId = 0;

  function handleClick(e: MouseEvent) {
    if (disabled || loading) return;
    
    // Create ripple effect
    const rect = buttonRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newRipple = { id: rippleId++, x, y };
    ripples = [...ripples, newRipple];
    
    // Remove ripple after animation
    setTimeout(() => {
      ripples = ripples.filter(r => r.id !== newRipple.id);
    }, 600);
    
    onclick?.();
  }

  function handleMouseDown() {
    if (!disabled && !loading) {
      isPressed = true;
    }
  }

  function handleMouseUp() {
    isPressed = false;
  }
</script>

<button
  bind:this={buttonRef}
  class="relative overflow-hidden px-10 py-4 rounded-full font-semibold text-lg
         transition-all duration-200 ease-out
         focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50
         disabled:opacity-50 disabled:cursor-not-allowed
         {variant === 'primary'
           ? 'bg-white text-purple-700 hover:bg-white/95 shadow-xl hover:shadow-2xl'
           : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'}
         {isPressed ? 'scale-[0.97] shadow-lg' : 'scale-100'}"
  {disabled}
  onclick={handleClick}
  onmousedown={handleMouseDown}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
  ontouchstart={handleMouseDown}
  ontouchend={handleMouseUp}
  aria-busy={loading}
>
  <!-- Ripple effects -->
  {#each ripples as ripple (ripple.id)}
    <span
      class="absolute rounded-full bg-purple-400/30 pointer-events-none animate-ripple"
      style="left: {ripple.x}px; top: {ripple.y}px;"
    ></span>
  {/each}

  <!-- Button content -->
  <span class="relative flex items-center justify-center gap-2">
    {#if loading}
      <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    {/if}
    
    {#if children}
      {@render children()}
    {/if}
    
    <!-- Arrow icon -->
    {#if !loading}
      <svg
        class="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
    {/if}
  </span>

  <!-- Gradient shine overlay -->
  <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
</button>

<style>
  /* Ripple animation */
  @keyframes ripple {
    0% {
      width: 0;
      height: 0;
      opacity: 0.5;
      transform: translate(-50%, -50%);
    }
    100% {
      width: 500px;
      height: 500px;
      opacity: 0;
      transform: translate(-50%, -50%);
    }
  }

  .animate-ripple {
    animation: ripple 600ms ease-out forwards;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .animate-ripple {
      animation: none;
      opacity: 0;
    }

    button {
      transition-duration: 0ms;
    }
  }
</style>
