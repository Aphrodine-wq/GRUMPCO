<script lang="ts">
  import { onMount } from 'svelte';
  import ChatInterface from './components/ChatInterface.svelte';
  import SessionsSidebar from './components/SessionsSidebar.svelte';
  import MobileNav from './components/MobileNav.svelte';
  import Toast from './components/Toast.svelte';
  import QuestionModal from './components/QuestionModal.svelte';
  import PricingModal from './components/PricingModal.svelte';
  import SettingsScreen from './components/SettingsScreen.svelte';
  import SetupScreen from './components/SetupScreen.svelte';
  import AskDocsScreen from './components/AskDocsScreen.svelte';
  import VoiceCodeScreen from './components/VoiceCodeScreen.svelte';
  import AgentSwarmVisualizer from './components/AgentSwarmVisualizer.svelte';
  import DesignToCodeScreen from './components/DesignToCodeScreen.svelte';
import LazyCostDashboard from './components/LazyCostDashboard.svelte';
  import { sessionsStore, currentSession } from './stores/sessionsStore';
  import { settingsStore } from './stores/settingsStore';
  import { preferencesStore, setupComplete } from './stores/preferencesStore';
  import { showSettings, showAskDocs, showVoiceCode, showSwarm, showDesignToCode, showCostDashboard, sidebarCollapsed, focusChatTrigger } from './stores/uiStore';
  import { demoStore } from './stores/demoStore';
  import TutorialOverlay from './components/TutorialOverlay.svelte';
  import { isMobileDevice } from './utils/touchGestures';
  import type { Message } from './types';

  let isMobile = $state(false);

  let showPricing = $state(false);

  onMount(() => {
    localStorage.removeItem('mermaid-app-state');
    settingsStore.load().catch(() => {});

    if (!$currentSession) {
      sessionsStore.createSession([]);
    }

    // Detect mobile device
    isMobile = isMobileDevice();
    
    // Auto-collapse sidebar on mobile
    if (isMobile) {
      sidebarCollapsed.set(true);
    }

    function onKeydown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'b') {
        e.preventDefault();
        sidebarCollapsed.update((v) => !v);
      }
      if ((mod && e.shiftKey && e.key === 'L') || (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        const target = e.target as HTMLElement;
        if (target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          focusChatTrigger.update((n) => n + 1);
        }
      }
    }
    window.addEventListener('keydown', onKeydown);

    const isTauri =
      typeof window !== 'undefined' &&
      (!!(window as { __TAURI__?: unknown }).__TAURI__ || !!(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
    if (isTauri) {
      setTimeout(() => {
        import('@tauri-apps/api/core')
          .then(({ invoke }) => {
            invoke('close_splash_show_main').catch((err: unknown) => console.error(err));
          })
          .catch(() => {
            import('@tauri-apps/api').then((mod: unknown) => {
              const m = mod as { invoke?: (cmd: string) => Promise<unknown>; tauri?: { invoke: (cmd: string) => Promise<unknown> } };
              const invoke = m.invoke ?? m.tauri?.invoke;
              if (invoke) invoke('close_splash_show_main').catch((err: unknown) => console.error(err));
            });
          });
      }, 400);
    }

    return () => window.removeEventListener('keydown', onKeydown);
  });

  function getInitialMessages(): Message[] | undefined {
    return $currentSession?.messages || undefined;
  }

  function handleMessagesUpdate(messages: Message[]): void {
    if ($currentSession) {
      sessionsStore.updateSession($currentSession.id, messages);
    } else {
      sessionsStore.createSession(messages);
    }
  }
</script>

<div class="app">
  <SessionsSidebar />

  <div class="main-content">
    {#if $showSettings}
      <SettingsScreen onBack={() => showSettings.set(false)} />
    {:else if $showAskDocs}
      <AskDocsScreen onBack={() => showAskDocs.set(false)} />
    {:else if $showVoiceCode}
      <VoiceCodeScreen onBack={() => showVoiceCode.set(false)} />
    {:else if $showSwarm}
      <AgentSwarmVisualizer onBack={() => showSwarm.set(false)} />
    {:else if $showDesignToCode}
      <DesignToCodeScreen onBack={() => showDesignToCode.set(false)} />
    {:else if $showCostDashboard}
      <LazyCostDashboard onBack={() => showCostDashboard.set(false)} />
    {:else if !$setupComplete}
      <SetupScreen
        onComplete={() => preferencesStore.completeSetup()}
        onSkip={() => preferencesStore.completeSetup()}
      />
    {:else}
      {#key $currentSession?.id ?? 'none'}
        <ChatInterface
          initialMessages={getInitialMessages()}
          onmessagesUpdated={handleMessagesUpdate}
        />
      {/key}
    {/if}
  </div>

  <Toast />
  <QuestionModal />
  {#if showPricing}
    <PricingModal onClose={() => (showPricing = false)} />
  {/if}

  {#if $demoStore.active && $demoStore.steps.length > 0}
    <TutorialOverlay
      steps={$demoStore.steps}
      onComplete={() => demoStore.reset()}
      onSkip={() => demoStore.reset()}
    />
  {/if}
  
  <!-- Mobile Navigation -->
  {#if isMobile}
    <MobileNav activeView={$showSettings ? 'settings' : 'chat'} />
  {/if}
</div>

<style>
  .app {
    display: flex;
    height: 100vh;
    width: 100%;
    /* Reverting centered container to full width to reduce "white space" on sides */
    /* max-width: 1400px; */
    /* margin: 0 auto; */

    background: linear-gradient(135deg, #fafafa 0%, #f5f7fa 100%);
    overflow: hidden;
    position: relative;
  }

  /* Ensure background fills the "void" outside the app on large screens */
  :global(body) {
    background-color: #f0f2f5;
  }

  /* Respect user preference for reduced motion */
  @media (prefers-reduced-motion: reduce) {
    :global(*),
    :global(*::before),
    :global(*::after) {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Responsive adjustments */
  @media (max-width: 1024px) {
    .app {
      /* Sidebar will automatically collapse to 64px on smaller screens */
    }
  }

  @media (max-width: 768px) {
    .app {
      flex-direction: column;
      height: 100dvh;
    }
    
    .main-content {
      padding-bottom: 70px; /* Space for mobile nav */
    }
  }

  @media (max-width: 480px) {
    .app {
      height: 100dvh;
    }
  }

  /* Touch-friendly adjustments */
  @media (hover: none) and (pointer: coarse) {
    /* Increase touch target sizes */
    :global(button) {
      min-height: 44px;
      min-width: 44px;
    }
    
    :global(input), :global(textarea) {
      font-size: 16px; /* Prevent zoom on iOS */
    }
  }

  /* Landscape mobile */
  @media (max-width: 768px) and (orientation: landscape) {
    .main-content {
      padding-bottom: 60px;
    }
  }
</style>
