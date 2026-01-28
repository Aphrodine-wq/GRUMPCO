<script lang="ts">
  import { onMount } from 'svelte';
  import ChatInterface from './components/ChatInterface.svelte';
  import ProjectsDashboard from './components/ProjectsDashboard.svelte';
  import Toast from './components/Toast.svelte';
  import QuestionModal from './components/QuestionModal.svelte';
  import { sessionsStore, currentSession } from './stores/sessionsStore';
  import { settingsStore } from './stores/settingsStore';
  import { Button } from './lib/design-system';
  import type { Message } from './types';

  let view = $state<'dashboard' | 'chat'>('dashboard');

  onMount(() => {
    localStorage.removeItem('mermaid-app-state');
    settingsStore.load().catch(() => {});

    // If there's an active session, go to chat; otherwise dashboard
    if ($currentSession) {
      view = 'chat';
    }

    const isTauri = typeof window !== 'undefined' && (
      !!(window as any).__TAURI__ || 
      !!(window as any).__TAURI_INTERNALS__
    );

    if (isTauri) {
      setTimeout(() => {
        import('@tauri-apps/api/core')
          .then(({ invoke }) => {
            invoke('close_splash_show_main').catch((err) => console.error(err));
          })
          .catch(() => {
            import('@tauri-apps/api')
              .then((module: any) => {
                const invoke = module.invoke || module.tauri?.invoke;
                if (invoke) invoke('close_splash_show_main').catch((err: any) => console.error(err));
              });
          });
      }, 400);
    }
  });

  function handleSelectProject(id: string) {
    sessionsStore.switchSession(id);
    view = 'chat';
  }

  function handleNewProject() {
    sessionsStore.createSession([]);
    view = 'chat';
  }

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
  <Toast />
  <QuestionModal />

  {#if view === 'dashboard'}
    <ProjectsDashboard 
      onSelectProject={handleSelectProject} 
      onNewProject={handleNewProject} 
    />
  {:else}
    <div class="chat-container">
      <nav class="top-nav">
        <Button variant="ghost" size="sm" onclick={() => (view = 'dashboard')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          All Projects
        </Button>
        <div class="nav-session-name">{$currentSession?.name || 'New Session'}</div>
      </nav>
      
      {#key $currentSession?.id ?? 'none'}
        <ChatInterface
          initialMessages={getInitialMessages()}
          on:messages-updated={(e: CustomEvent<Message[]>) => handleMessagesUpdate(e.detail)}
        />
      {/key}
    </div>
  {/if}
</div>

<style>
  .app {
    min-height: 100vh;
    width: 100%;
    background: #FAFAFA;
    display: flex;
    flex-direction: column;
  }

  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
  }

  .top-nav {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    background: white;
    border-bottom: 1px solid #E4E4E7;
    z-index: 30;
  }

  .nav-session-name {
    font-size: 14px;
    font-weight: 600;
    color: #18181B;
  }
</style>
