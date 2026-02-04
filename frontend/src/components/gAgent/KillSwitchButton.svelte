<!--
  KillSwitchButton.svelte
  
  Emergency stop button for G-Agent operations.
  THE most important safety control in the entire system.
  
  Features:
  - Big red button that ALWAYS works
  - Double-confirmation for safety
  - Shows stopped state with resume option
  - Keyboard shortcut (Ctrl+Shift+K)
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gAgentStore, isGlobalStopActive } from '../../stores/gAgentStore';

  // Props
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let showLabel: boolean = true;
  export let confirmBeforeStop: boolean = true;

  // State
  let isConfirming = false;
  let confirmTimeout: ReturnType<typeof setTimeout> | null = null;
  let isProcessing = false;

  // Size classes
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  // Handle click
  async function handleClick() {
    if ($isGlobalStopActive) {
      // Resume operations
      isProcessing = true;
      try {
        await gAgentStore.resumeOperations();
      } finally {
        isProcessing = false;
      }
      return;
    }

    if (confirmBeforeStop && !isConfirming) {
      // First click - start confirmation
      isConfirming = true;
      confirmTimeout = setTimeout(() => {
        isConfirming = false;
      }, 3000);
      return;
    }

    // Second click or no confirmation needed - STOP EVERYTHING
    if (confirmTimeout) {
      clearTimeout(confirmTimeout);
      confirmTimeout = null;
    }
    isConfirming = false;
    isProcessing = true;

    try {
      await gAgentStore.emergencyStop('user_requested');
    } finally {
      isProcessing = false;
    }
  }

  // Cancel confirmation on click outside
  function handleClickOutside() {
    if (isConfirming) {
      isConfirming = false;
      if (confirmTimeout) {
        clearTimeout(confirmTimeout);
        confirmTimeout = null;
      }
    }
  }

  // Keyboard shortcut: Ctrl+Shift+K
  function handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.shiftKey && event.key === 'K') {
      event.preventDefault();
      if ($isGlobalStopActive) {
        gAgentStore.resumeOperations();
      } else {
        // Immediate stop on keyboard shortcut
        gAgentStore.emergencyStop('keyboard_shortcut');
      }
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('click', handleClickOutside);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('click', handleClickOutside);
    if (confirmTimeout) {
      clearTimeout(confirmTimeout);
    }
  });
</script>

<div class="kill-switch-container relative inline-flex flex-col items-center gap-2">
  <button
    on:click|stopPropagation={handleClick}
    disabled={isProcessing}
    class="
      kill-switch-button
      {sizeClasses[size]}
      rounded-full
      flex items-center justify-center
      transition-all duration-200
      focus:outline-none focus:ring-4
      disabled:opacity-50 disabled:cursor-wait
      {$isGlobalStopActive
      ? 'bg-green-600 hover:bg-green-500 focus:ring-green-300 text-white'
      : isConfirming
        ? 'bg-yellow-500 hover:bg-yellow-400 focus:ring-yellow-300 text-black animate-pulse'
        : 'bg-red-600 hover:bg-red-500 focus:ring-red-300 text-white'}
      shadow-lg hover:shadow-xl
      transform hover:scale-105 active:scale-95
    "
    title={$isGlobalStopActive
      ? 'Resume Operations (Ctrl+Shift+K)'
      : 'Emergency Stop (Ctrl+Shift+K)'}
    aria-label={$isGlobalStopActive ? 'Resume Operations' : 'Emergency Stop'}
  >
    {#if isProcessing}
      <!-- Spinner -->
      <svg class="{iconSizes[size]} animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    {:else if $isGlobalStopActive}
      <!-- Play/Resume icon -->
      <svg class={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    {:else}
      <!-- Stop icon (square) -->
      <svg class={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
        <rect x="6" y="6" width="12" height="12" rx="1" />
      </svg>
    {/if}
  </button>

  {#if showLabel}
    <span
      class="text-xs font-medium {$isGlobalStopActive
        ? 'text-green-500'
        : isConfirming
          ? 'text-yellow-500'
          : 'text-red-500'}"
    >
      {#if isProcessing}
        Processing...
      {:else if $isGlobalStopActive}
        STOPPED - Click to Resume
      {:else if isConfirming}
        Click again to confirm STOP
      {:else}
        Emergency Stop
      {/if}
    </span>
  {/if}

  <!-- Keyboard shortcut hint -->
  <span class="text-xs text-gray-400 opacity-50"> Ctrl+Shift+K </span>
</div>

<style>
  .kill-switch-button {
    /* Ensure the button is always visible and clickable */
    z-index: 9999;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  /* Pulsing animation for confirmation state */
  @keyframes pulse-warning {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.7);
    }
    50% {
      box-shadow: 0 0 0 10px rgba(234, 179, 8, 0);
    }
  }

  .kill-switch-button.animate-pulse {
    animation: pulse-warning 1s ease-in-out infinite;
  }
</style>
