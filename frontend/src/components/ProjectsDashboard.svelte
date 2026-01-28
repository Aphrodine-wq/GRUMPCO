<script lang="ts">
  import { sortedSessions, sessionsStore } from '../stores/sessionsStore';
  import { Button } from '../lib/design-system';
  import GRumpBlob from './GRumpBlob.svelte';

  let { onSelectProject, onNewProject, onUpgrade } = $props<{
    onSelectProject: (id: string) => void;
    onNewProject: () => void;
    onUpgrade: () => void;
  }>();

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function deleteProject(e: Event, id: string) {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      sessionsStore.deleteSession(id);
    }
  }
</script>

<div class="dashboard">
  <header class="header">
    <div class="header-content">
      <div class="logo-area">
        <GRumpBlob size={48} speed={1.2} />
        <h1>G-Rump</h1>
      </div>
      <div style="display: flex; gap: 12px;">
        <Button onclick={onUpgrade} variant="secondary">Upgrade</Button>
        <Button onclick={onNewProject} variant="primary">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>

          New Project
        </Button>
      </div>
    </div>
  </header>

  <main class="content">
    <div class="section-header">
      <h2>Recent Projects</h2>
      <span class="count">{$sortedSessions.length} total</span>
    </div>

    {#if $sortedSessions.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#A1A1AA"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <h3>No projects yet</h3>
        <p>Start your first AI-powered architecture journey today.</p>
        <Button onclick={onNewProject} variant="secondary">Create your first project</Button>
      </div>
    {:else}
      <div class="project-grid">
        {#each $sortedSessions as session (session.id)}
          <div
            class="project-card"
            onclick={() => onSelectProject(session.id)}
            role="button"
            tabindex="0"
          >
            <div class="card-header">
              <span class="date">{formatDate(session.updatedAt)}</span>
              <button
                class="delete-btn"
                onclick={(e) => deleteProject(e, session.id)}
                aria-label="Delete project"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            <h3 class="title">{session.name}</h3>
            <div class="card-footer">
              <span class="message-count">{session.messages.length} messages</span>
              <div class="arrow">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  .dashboard {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding-bottom: 40px;
  }

  .header {
    background: white;
    border-bottom: 1px solid #e4e4e7;
    position: sticky;
    top: 0;
    z-index: 20;
    padding: 16px 24px;
  }

  .header-content {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .logo-area {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-area h1 {
    font-size: 20px;
    font-weight: 800;
    color: #18181b;
    letter-spacing: -0.02em;
  }

  .content {
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
    padding: 32px 24px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .section-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .count {
    font-size: 13px;
    color: #a1a1aa;
    font-weight: 500;
  }

  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }

  .project-card {
    background: white;
    border: 1px solid #e4e4e7;
    border-radius: 16px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }

  .project-card:hover {
    border-color: #18181b;
    transform: translateY(-2px);
    box-shadow: 0 10px 20px -10px rgba(0, 0, 0, 0.1);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .date {
    font-size: 12px;
    font-weight: 500;
    color: #71717a;
  }

  .delete-btn {
    opacity: 0;
    color: #a1a1aa;
    padding: 4px;
    border-radius: 6px;
    transition: all 0.2s;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .project-card:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    color: #ef4444;
    background: #fef2f2;
  }

  .title {
    font-size: 18px;
    font-weight: 700;
    color: #18181b;
    line-height: 1.3;
    margin: 4px 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-footer {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
  }

  .message-count {
    font-size: 13px;
    font-weight: 500;
    color: #71717a;
  }

  .arrow {
    color: #18181b;
    opacity: 0;
    transform: translateX(-10px);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .project-card:hover .arrow {
    opacity: 1;
    transform: translateX(0);
  }

  .empty-state {
    padding: 80px 40px;
    text-align: center;
    background: white;
    border: 2px dashed #e4e4e7;
    border-radius: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    background: #f4f4f5;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }

  .empty-state h3 {
    font-size: 20px;
    font-weight: 700;
    color: #18181b;
  }

  .empty-state p {
    color: #71717a;
    max-width: 320px;
    line-height: 1.5;
    margin-bottom: 8px;
  }
</style>
