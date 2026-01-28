<script lang="ts">
  import { CollapsibleSidebar, Button } from '../lib/design-system';
  import { sessionsStore, sortedSessions, currentSession } from '../stores/sessionsStore';
  import { showSettings } from '../stores/uiStore';
  import type { Session } from '../types';

  let hoveredSessionId: string | null = $state(null);
  let collapsed = $state(false);

  function handleNewSession() {
    sessionsStore.createSession([]);
  }

  function handleSelectSession(id: string) {
    sessionsStore.switchSession(id);
    showSettings.set(false);
  }

  function handleDeleteSession(e: MouseEvent, id: string) {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      sessionsStore.deleteSession(id);
    }
  }

  function openSettings() {
    showSettings.set(true);
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function truncateText(text: string, maxLength: number = 50): string {
    if (collapsed) {
      return text.charAt(0).toUpperCase();
    }
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  }
</script>

  <CollapsibleSidebar bind:collapsed width={240} collapsedWidth={64}>
    {#snippet header()}
      <Button variant="primary" size="md" fullWidth onclick={handleNewSession} class="new-chat-btn">
        <div class="btn-inner" class:collapsed>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-plus"><path d="M5 12h14" /><path d="M12 5v14" /></svg
          >
          {#if !collapsed}
            <span>New Chat</span>
          {/if}
        </div>
      </Button>
    {/snippet}

    <div class="sessions-list" class:collapsed>
      {#each $sortedSessions as session (session.id)}
        <div
          class="session-item"
          class:active={session.id === $currentSession?.id}
          class:collapsed
          onmouseenter={() => (hoveredSessionId = session.id)}
          onmouseleave={() => (hoveredSessionId = null)}
          onclick={() => handleSelectSession(session.id)}
          onkeydown={(e) => e.key === 'Enter' && handleSelectSession(session.id)}
          role="button"
          tabindex="0"
          title={session.name}
        >
          <div class="session-content" class:collapsed>
            <div class="session-name" class:collapsed>
              {truncateText(session.name)}
            </div>
            {#if !collapsed}
              <div class="session-meta">
                {formatDate(session.updatedAt)} · {session.messages.length} msg
              </div>
            {/if}
          </div>

          {#if hoveredSessionId === session.id && !collapsed}
            <button
              class="delete-btn"
              onclick={(e) => handleDeleteSession(e, session.id)}
              title="Delete session"
              aria-label="Delete session"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-trash-2"
                ><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
                  d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
                /><line x1="10" x2="10" y1="11" y2="17" /><line
                  x1="14"
                  x2="14"
                  y1="11"
                  y2="17"
                /></svg
              >
            </button>
          {/if}
        </div>
      {/each}

      {#if $sortedSessions.length === 0}
        <div class="empty-state" class:collapsed>
          {#if !collapsed}
            <p>No sessions yet</p>
            <p class="hint">Start a new chat above</p>
          {:else}
            <div class="empty-dot"></div>
          {/if}
        </div>
      {/if}
    </div>

    {#snippet footer()}
      <div class="sidebar-footer-content" class:collapsed>
        <button class="settings-btn" title="Settings" aria-label="Settings" onclick={openSettings}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-settings"
            ><path
              d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
            /><circle cx="12" cy="12" r="3" /></svg
          >
          {#if !collapsed}
            <span>Settings</span>
          {/if}
        </button>
      </div>
    {/snippet}
  </CollapsibleSidebar>

<style>
  .btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
  }

  .btn-inner.collapsed {
    gap: 0;
  }

  .sessions-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    flex: 1;
    overflow-y: auto;
    transition: padding 200ms ease;
  }

  .sessions-list.collapsed {
    padding: 8px 4px;
    align-items: center;
  }

  .session-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    text-align: left;
    transition: all 150ms ease;
    min-height: 48px;
  }

  .session-item.collapsed {
    justify-content: center;
    padding: 8px;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    margin: 0 auto;
  }

  .session-item:hover {
    background-color: var(--color-bg-card-hover);
    border-color: var(--color-border-light);
  }

  .session-item.active {
    background-color: var(--color-bg-card);
    border-left: 3px solid var(--color-primary);
    border-color: var(--color-border-highlight);
    padding-left: 9px;
  }

  .session-item.active.collapsed {
    border-left: none;
    background-color: var(--color-primary);
    padding-left: 8px;
  }

  .session-item.active.collapsed .session-name {
    color: white;
  }

  .session-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .session-content.collapsed {
    align-items: center;
    justify-content: center;
  }

  .session-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-name.collapsed {
    font-size: 16px;
    font-weight: 600;
  }

  .session-meta {
    font-size: 11px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delete-btn {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .delete-btn:hover {
    background-color: var(--color-error-light, rgba(239, 68, 68, 0.2));
    color: var(--color-error);
  }

  .empty-state {
    padding: 24px 12px;
    text-align: center;
    color: var(--color-text-muted);
  }

  .empty-state.collapsed {
    padding: 24px 0;
  }

  .empty-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--color-border);
    margin: 0 auto;
  }

  .empty-state p {
    margin: 0;
    font-size: 13px;
  }

  .empty-state .hint {
    font-size: 12px;
    margin-top: 4px;
  }

  .sidebar-footer-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .sidebar-footer-content.collapsed {
    align-items: center;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--color-text);
    cursor: pointer;
    transition: all 150ms ease;
    font-size: 14px;
    font-weight: 500;
  }

  .settings-btn:hover {
    background-color: var(--color-bg-card-hover);
    color: var(--color-primary);
  }

  .sidebar-footer-content.collapsed .settings-btn {
    padding: 10px;
    justify-content: center;
    width: 40px;
    height: 40px;
  }

  /* Custom scrollbar */
  .sessions-list::-webkit-scrollbar {
    width: 4px;
  }

  .sessions-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .sessions-list::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 10px;
  }

  .sessions-list::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.1);
  }
</style>
