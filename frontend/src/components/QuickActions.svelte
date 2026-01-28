<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface QuickAction {
    id: string;
    label: string;
    icon: string;
    action: () => void | Promise<void>;
    primary?: boolean;
  }

  interface Props {
    actions: QuickAction[];
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  }

  let { actions, position = 'bottom-right' }: Props = $props();

  let isExpanded = $state(false);
  let mainButton: HTMLButtonElement | null = $state(null);

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }

  function handleAction(action: QuickAction) {
    action.action();
    isExpanded = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (mainButton && !mainButton.contains(event.target as Node)) {
      const actionList = document.querySelector('.quick-actions-list');
      if (actionList && !actionList.contains(event.target as Node)) {
        isExpanded = false;
      }
    }
  }

  function handleEscape(event: KeyboardEvent) {
    if (event.key === 'Escape' && isExpanded) {
      isExpanded = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  });
</script>

<div class="quick-actions" class:position-bottom-right={position === 'bottom-right'} class:position-bottom-left={position === 'bottom-left'} class:position-top-right={position === 'top-right'} class:position-top-left={position === 'top-left'}>
  {#if isExpanded}
    <div class="quick-actions-list" role="menu">
      {#each actions as action (action.id)}
        <button
          class="quick-action-item"
          class:primary={action.primary}
          on:click={() => handleAction(action)}
          role="menuitem"
          aria-label={action.label}
        >
          <span class="quick-action-icon">{action.icon}</span>
          <span class="quick-action-label">{action.label}</span>
        </button>
      {/each}
    </div>
  {/if}
  <button
    bind:this={mainButton}
    class="quick-actions-main"
    class:expanded={isExpanded}
    on:click={toggleExpanded}
    aria-label={isExpanded ? 'Close actions' : 'Open actions'}
    aria-expanded={isExpanded}
  >
    <span class="quick-actions-icon">{isExpanded ? '✕' : '⚡'}</span>
  </button>
</div>

<style>
  .quick-actions {
    position: fixed;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.75rem;
  }

  .quick-actions.position-bottom-right {
    bottom: 2rem;
    right: 2rem;
  }

  .quick-actions.position-bottom-left {
    bottom: 2rem;
    left: 2rem;
    align-items: flex-start;
  }

  .quick-actions.position-top-right {
    top: 2rem;
    right: 2rem;
    flex-direction: column-reverse;
  }

  .quick-actions.position-top-left {
    top: 2rem;
    left: 2rem;
    flex-direction: column-reverse;
    align-items: flex-start;
  }

  .quick-actions-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 8px;
    padding: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.2s ease-out;
    min-width: 180px;
  }

  .quick-actions.position-bottom-left .quick-actions-list,
  .quick-actions.position-top-left .quick-actions-list {
    align-items: flex-start;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .quick-action-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: #E5E5E5;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    width: 100%;
  }

  .quick-action-item:hover {
    background: #262626;
    border-color: #404040;
  }

  .quick-action-item.primary {
    background: rgba(0, 102, 255, 0.1);
    border-color: #0EA5E9;
  }

  .quick-action-item.primary:hover {
    background: rgba(0, 102, 255, 0.2);
  }

  .quick-action-icon {
    font-size: 1.125rem;
    flex-shrink: 0;
  }

  .quick-action-label {
    flex: 1;
  }

  .quick-actions-main {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #0EA5E9;
    border: none;
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 102, 255, 0.4);
    transition: all 0.2s;
    z-index: 1001;
  }

  .quick-actions-main:hover {
    background: #0052CC;
    box-shadow: 0 6px 16px rgba(0, 102, 255, 0.5);
    transform: scale(1.05);
  }

  .quick-actions-main:active {
    transform: scale(0.95);
  }

  .quick-actions-main.expanded {
    background: #DC2626;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
  }

  .quick-actions-main.expanded:hover {
    background: #B91C1C;
    box-shadow: 0 6px 16px rgba(220, 38, 38, 0.5);
  }

  .quick-actions-icon {
    transition: transform 0.2s;
  }

  .quick-actions-main.expanded .quick-actions-icon {
    transform: rotate(90deg);
  }

  @media (max-width: 768px) {
    .quick-actions.position-bottom-right {
      bottom: 1rem;
      right: 1rem;
    }

    .quick-actions.position-bottom-left {
      bottom: 1rem;
      left: 1rem;
    }

    .quick-actions-main {
      width: 48px;
      height: 48px;
      font-size: 1.25rem;
    }
  }
</style>
