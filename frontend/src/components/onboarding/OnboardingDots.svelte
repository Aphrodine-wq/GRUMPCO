<script lang="ts">
  interface Props {
    total: number;
    current: number;
    onDotClick?: (index: number) => void;
    background?: 'white' | 'purple';
  }

  let { total, current, onDotClick, background = 'purple' }: Props = $props();

  const dotActive = $derived(background === 'purple' ? 'bg-white' : 'bg-[#7C3AED]');
  const dotCompleted = $derived(background === 'purple' ? 'bg-white/70' : 'bg-[#7C3AED]/70');
  const dotInactive = $derived(background === 'purple' ? 'bg-white/30' : 'bg-[#7C3AED]/30');
  const ringColor = $derived(background === 'purple' ? 'border-white/40' : 'border-[#7C3AED]/40');
  const focusRing = $derived(
    background === 'purple' ? 'focus-visible:ring-white' : 'focus-visible:ring-[#7C3AED]'
  );

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

<div class="flex items-center justify-center gap-2" role="tablist" aria-label="Onboarding progress">
  {#each Array(total) as _, index}
    <button
      class="relative transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-full {focusRing}"
      role="tab"
      aria-selected={index === current}
      aria-label="Go to slide {index + 1} of {total}"
      tabindex={index === current ? 0 : -1}
      onclick={() => handleClick(index)}
      onkeydown={(e) => handleKeydown(e, index)}
    >
      <!-- Outer ring for current -->
      {#if index === current}
        <div class="absolute -inset-1 rounded-full border-2 {ringColor} animate-ping-slow"></div>
      {/if}

      <!-- Dot -->
      <div
        class="relative rounded-full transition-all duration-300 ease-out
               {index === current
          ? 'w-8 h-3 shadow-lg ' + dotActive
          : index < current
            ? 'w-3 h-3 ' +
              dotCompleted +
              (background === 'purple' ? ' hover:bg-white/90' : ' hover:bg-[#7C3AED]/90')
            : 'w-3 h-3 ' +
              dotInactive +
              (background === 'purple' ? ' hover:bg-white/50' : ' hover:bg-[#7C3AED]/50')}"
      >
        <!-- Shine effect on active (removed gradient) -->
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
    50%,
    100% {
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
