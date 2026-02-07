<script lang="ts">
  import {
    showSettings,
    showAskDocs,
    showVoiceCode,
    showSwarm,
    showDesignToCode,
  } from '../stores/uiStore';
  import { currentSession } from '../stores/sessionsStore';

  interface Props {
    activeView?: string;
  }

  let { activeView = 'chat' }: Props = $props();

  const navItems = [
    {
      id: 'chat',
      icon: '💬',
      label: 'Chat',
      action: () => {
        showSettings.set(false);
        showAskDocs.set(false);
        showVoiceCode.set(false);
        showSwarm.set(false);
        showDesignToCode.set(false);
      },
    },
    {
      id: 'ship',
      icon: '🚀',
      label: 'Ship',
      action: () => {
        // Navigate to ship mode
        window.dispatchEvent(new CustomEvent('navigate-ship'));
      },
    },
    {
      id: 'voice',
      icon: '🎤',
      label: 'Voice',
      action: () => {
        showVoiceCode.set(true);
      },
    },
    {
      id: 'swarm',
      icon: '🐝',
      label: 'Swarm',
      action: () => {
        showSwarm.set(true);
      },
    },
    {
      id: 'settings',
      icon: '⚙️',
      label: 'Settings',
      action: () => {
        showSettings.set(true);
      },
    },
  ];

  function handleNavClick(item: (typeof navItems)[0]) {
    item.action();
  }
</script>

<nav class="mobile-nav">
  <div class="mobile-nav-inner">
    {#each navItems as item}
      <button
        onclick={() => handleNavClick(item)}
        class="mobile-nav-item"
        class:active={activeView === item.id}
        aria-label={item.label}
      >
        <span class="mobile-nav-icon">{item.icon}</span>
        <span class="mobile-nav-label">{item.label}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .mobile-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--color-bg-elevated, #ffffff);
    border-top: 1px solid var(--color-border, #e5e7eb);
    z-index: 100;
    display: none;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 768px) {
    .mobile-nav {
      display: block;
    }
  }

  .mobile-nav-inner {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 8px 0;
    max-width: 100%;
  }

  .mobile-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: none;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 60px;
    border-radius: 8px;
  }

  .mobile-nav-item:active {
    transform: scale(0.95);
  }

  .mobile-nav-item.active {
    background: var(--color-primary-subtle, #eff6ff);
  }

  .mobile-nav-icon {
    font-size: 24px;
    transition: transform 0.2s ease;
  }

  .mobile-nav-item.active .mobile-nav-icon {
    transform: scale(1.1);
  }

  .mobile-nav-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
    transition: color 0.2s ease;
  }

  .mobile-nav-item.active .mobile-nav-label {
    color: var(--color-primary, #3b82f6);
    font-weight: 600;
  }

  /* Safe area padding for iOS */
  @supports (padding-bottom: env(safe-area-inset-bottom)) {
    .mobile-nav-inner {
      padding-bottom: max(8px, env(safe-area-inset-bottom));
    }
  }
</style>
