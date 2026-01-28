<script lang="ts">
  import { onMount } from 'svelte';
  // import ChatInterface from './components/ChatInterface.svelte';
  import SessionsSidebar from './components/SessionsSidebar.svelte';
  import Toast from './components/Toast.svelte';
  import QuestionModal from './components/QuestionModal.svelte';
  import PricingModal from './components/PricingModal.svelte';
  import { sessionsStore, currentSession } from './stores/sessionsStore';
  import { settingsStore } from './stores/settingsStore';
  import type { Message } from './types';

  let showPricing = $state(false);

  onMount(() => {
    localStorage.removeItem('mermaid-app-state');
    settingsStore.load().catch(() => {});

    // If no active session, create one
    if (!$currentSession) {
      sessionsStore.createSession([]);
    }

    const isTauri =
      typeof window !== 'undefined' &&
      (!!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__);

    if (isTauri) {
      setTimeout(() => {
        import('@tauri-apps/api/core')
          .then(({ invoke }) => {
            invoke('close_splash_show_main').catch((err) => console.error(err));
          })
          .catch(() => {
            import('@tauri-apps/api').then((module: any) => {
              const invoke = module.invoke || module.tauri?.invoke;
              if (invoke) invoke('close_splash_show_main').catch((err: any) => console.error(err));
            });
          });
      }, 400);
    }
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
    <div style="padding: 20px;">
      <h1>App Skeleton Loaded</h1>
      <p>Session ID: {$currentSession?.id ?? 'None'}</p>
      <p>ChatInterface is currently DISABLED for debugging.</p>
    </div>
    <!--
    {#key $currentSession?.id ?? 'none'}
      <ChatInterface
        initialMessages={getInitialMessages()}
        on:messages-updated={(e: CustomEvent) => handleMessagesUpdate(e.detail)}
      />
    {/key}
    -->
  </div>

  <Toast />
  <QuestionModal />
  {#if showPricing}
    <PricingModal onClose={() => (showPricing = false)} />
  {/if}
</div>

<style>
  .app {
    display: flex;
    height: 100vh;
    width: 100%;
    background: linear-gradient(135deg, #fafafa 0%, #f5f7fa 100%);
    overflow: hidden;
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
  }

  @media (max-width: 480px) {
    .app {
      height: 100dvh;
    }
  }
</style>
