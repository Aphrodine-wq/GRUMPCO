<script lang="ts">
  interface Props {
    total: number;
    current: number;
    onDotClick?: (index: number) => void;
  }

  let { total, current, onDotClick }: Props = $props();

  function handleClick(index: number) {
    onDotClick?.(index);
  }

  function handleKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(index);
    }
  }
</script>

<div
  class="flex items-center justify-center gap-2"
  role="tablist"
  aria-label="Onboarding progress"
>
  {#each Array(total) as _, index}
    <button
      class="relative transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-full"
      role="tab"
      aria-selected={index === current}
      aria-label="Go to slide {index + 1} of {total}"
      tabindex={index === current ? 0 : -1}
      onclick={() => handleClick(index)}
      onkeydown={(e) => handleKeydown(e, index)}
    >
      <!-- Outer ring for current -->
      {#if index === current}
        <div class="absolute -inset-1 rounded-full border-2 border-white/40 animate-ping-slow"></div>
      {/if}
      
      <!-- Dot -->
      <div
        class="relative rounded-full transition-all duration-300 ease-out
               {index === current
                 ? 'w-8 h-3 bg-white shadow-lg'
                 : index < current
                   ? 'w-3 h-3 bg-white/70 hover:bg-white/90'
                   : 'w-3 h-3 bg-white/30 hover:bg-white/50'}"
      >
        <!-- Shine effect on active -->
        {#if index === current}
          <div class="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine"></div>
        {/if}
      </div>
    </button>
  {/each}
</div>

<style>
  /* Slow ping for current dot */
  @keyframes pingSlow {
    0% {
      transform: scale(1);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.3);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }

  .animate-ping-slow {
    animation: pingSlow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  /* Shine sweep effect */
  @keyframes shine {
    0% {
      transform: translateX(-100%);
    }
    50%, 100% {
      transform: translateX(100%);
    }
  }

  .animate-shine {
    animation: shine 2s ease-in-out infinite;
    animation-delay: 500ms;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .animate-ping-slow,
    .animate-shine {
      animation: none;
    }
  }
</style>
