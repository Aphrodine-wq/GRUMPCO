<script lang="ts">
  import { onMount } from 'svelte';
  import ChatInterface from './components/ChatInterface.svelte';
  import Toast from './components/Toast.svelte';
  import QuestionModal from './components/QuestionModal.svelte';
  import { sessionsStore, currentSession } from './stores/sessionsStore';
  import type { Message } from './types';

  let chatKey = $state(0);

  // Auto-create session on load if none exists
  onMount(() => {
    // Clean up old onboarding state from localStorage
    localStorage.removeItem('mermaid-app-state');

    // Auto-create session if none exists
    if (!$currentSession) {
      sessionsStore.createSession([]);
    }

    // Close splash and show main when running in Tauri desktop (splash-screen boot)
    if (typeof window !== 'undefined' && (window as { __TAURI__?: unknown }).__TAURI__) {
      setTimeout(() => {
        import('@tauri-apps/api').then(({ invoke }) => {
          invoke('close_splash_show_main').catch(() => {});
        }).catch(() => {});
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
  <!-- Global Overlays -->
  <Toast />
  <QuestionModal />

  <!-- Single Chat Interface - Full Screen -->
  <ChatInterface
    key={chatKey}
    initialMessages={getInitialMessages()}
    on:messages-updated={(e) => handleMessagesUpdate(e.detail)}
  />
</div>

<style>
  .app {
    min-height: 100vh;
    background: #F5F5F5;
    display: flex;
    flex-direction: column;
  }
</style>
