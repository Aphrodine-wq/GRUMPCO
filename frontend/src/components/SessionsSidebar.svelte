<script lang="ts">
  import { CollapsibleSidebar, Button } from '../lib/design-system';
  import { sessionsStore, sortedSessions, currentSession } from '../stores/sessionsStore';
  import type { Session } from '../types';

  let hoveredSessionId: string | null = $state(null);

  function handleNewSession() {
    sessionsStore.createSession([]);
  }

  function handleSelectSession(id: string) {
    sessionsStore.switchSession(id);
  }

  function handleDeleteSession(e: MouseEvent, id: string) {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      sessionsStore.deleteSession(id);
    }
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
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  }
</script>

<CollapsibleSidebar width={280} collapsedWidth={64}>
  {#snippet header()}
    <Button variant="primary" size="md" fullWidth onclick={handleNewSession} class="new-chat-btn">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide lucide-plus"><path d="M5 12h14" /><path d="M12 5v14" /></svg
      >
      New Chat
    </Button>
  {/snippet}

  <div class="sessions-list">
    {#each $sortedSessions as session (session.id)}
      <div
        class="session-item"
        class:active={session.id === $currentSession?.id}
        onmouseenter={() => (hoveredSessionId = session.id)}
        onmouseleave={() => (hoveredSessionId = null)}
        onclick={() => handleSelectSession(session.id)}
        onkeydown={(e) => e.key === 'Enter' && handleSelectSession(session.id)}
        role="button"
        tabindex="0"
        title={session.name}
      >
        <div class="session-content">
          <div class="session-name">
            {truncateText(session.name)}
          </div>
          <div class="session-meta">
            {formatDate(session.updatedAt)} · {session.messages.length} msg
          </div>
        </div>

        {#if hoveredSessionId === session.id}
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
      <div class="empty-state">
        <p>No sessions yet</p>
        <p class="hint">Start a new chat above</p>
      </div>
    {/if}
  </div>
</CollapsibleSidebar>

<style>
  .sessions-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    flex: 1;
    overflow-y: auto;
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

  .session-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .session-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .empty-state p {
    margin: 0;
    font-size: 13px;
  }

  .empty-state .hint {
    font-size: 12px;
    margin-top: 4px;
  }

  /* Custom scrollbar */
  .sessions-list::-webkit-scrollbar {
    width: 6px;
  }

  .sessions-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .sessions-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .sessions-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
