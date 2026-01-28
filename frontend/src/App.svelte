<script lang="ts">
  import { onMount } from 'svelte';
  import ChatInterface from './components/ChatInterface.svelte';
  import Toast from './components/Toast.svelte';
  import QuestionModal from './components/QuestionModal.svelte';
  import { sessionsStore, currentSession } from './stores/sessionsStore';
  import { settingsStore } from './stores/settingsStore';
  import type { Message } from './types';

  // Auto-create session on load if none exists
  onMount(() => {
    // Clean up old onboarding state from localStorage
    localStorage.removeItem('mermaid-app-state');

    // Load settings so default model is available for chat
    settingsStore.load().catch(() => {});

    // Auto-create session if none exists
    if (!$currentSession) {
      sessionsStore.createSession([]);
    }

    // Close splash and show main when running in Tauri desktop (splash-screen boot)
    // Check for Tauri environment (v1 or v2)
    const isTauri = typeof window !== 'undefined' && (
      !!(window as any).__TAURI__ || 
      !!(window as any).__TAURI_INTERNALS__
    );

    if (isTauri) {
      setTimeout(() => {
        // Try importing from core first (Tauri v2)
        import('@tauri-apps/api/core')
          .then(({ invoke }) => {
            invoke('close_splash_show_main').catch((err) => console.error('Failed to invoke close_splash_show_main:', err));
          })
          .catch(() => {
            // Fallback to v1 API just in case
            import('@tauri-apps/api')
              .then((module: any) => {
                const invoke = module.invoke || module.tauri?.invoke;
                if (invoke) {
                  invoke('close_splash_show_main').catch((err: any) => console.error('Failed to invoke close_splash_show_main (v1):', err));
                }
              })
              .catch((err) => console.error('Failed to load tauri api:', err));
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
  <!-- Global Overlays -->
  <Toast />
  <QuestionModal />

  <!-- Single Chat Interface - Full Screen; {#key} remounts when session changes so messages stay in sync -->
  {#key $currentSession?.id ?? 'none'}
    <ChatInterface
      initialMessages={getInitialMessages()}
      on:messages-updated={(e: CustomEvent<Message[]>) => handleMessagesUpdate(e.detail)}
    />
  {/key}
</div>

<style>
  .app {
    min-height: 100vh;
    background: #F5F5F5;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>
