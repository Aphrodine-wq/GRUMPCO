<script lang="ts">
  /**
   * ProjectsDashboard - Professional light theme
   * A high-level view of all user sessions/projects
   */
  import { onMount } from 'svelte';
  import { sessionsStore, sortedSessions } from '../stores/sessionsStore';
  import { Button, Card, Badge } from '../lib/design-system';
  import { colors } from '../lib/design-system/tokens/colors';
  import GRumpBlob from './GRumpBlob.svelte';

  interface Props {
    onSelectProject: (id: string) => void;
    onNewProject: () => void;
  }

  let { onSelectProject, onNewProject }: Props = $props();

  function getProjectStats(session: any) {
    const messages = session.messages || [];
    const userMessages = messages.filter((m: any) => m.role === 'user').length;
    const aiMessages = messages.filter((m: any) => m.role === 'assistant').length;
    return { userMessages, aiMessages };
  }
</script>

<div class="dashboard" style:--bg-primary={colors.background.primary}>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <div class="header-left">
        <h1 class="dashboard-title">Projects</h1>
        <p class="dashboard-subtitle">Manage your AI-powered build sessions</p>
      </div>
      <div class="header-right">
        <Button variant="primary" onclick={onNewProject}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Project
        </Button>
      </div>
    </header>

    {#if $sortedSessions.length === 0}
      <div class="empty-dashboard">
        <GRumpBlob size="xl" state="idle" />
        <h2>No projects yet</h2>
        <p>Start your first build session to see it here.</p>
        <Button variant="primary" size="lg" onclick={onNewProject}>Get Started</Button>
      </div>
    {:else}
      <div class="projects-grid">
        {#each $sortedSessions as session (session.id)}
          {@const stats = getProjectStats(session)}
          <Card 
            interactive 
            onclick={() => onSelectProject(session.id)}
            padding="md"
          >
            {#snippet children()}
              <div class="project-card-content">
                <div class="project-info">
                  <h3 class="project-name">{session.name}</h3>
                  <p class="project-date">Last updated {new Date(session.updatedAt).toLocaleDateString()}</p>
                </div>
                <div class="project-stats">
                  <div class="stat-item">
                    <span class="stat-value">{stats.userMessages}</span>
                    <span class="stat-label">Prompts</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{stats.aiMessages}</span>
                    <span class="stat-label">Responses</span>
                  </div>
                </div>
                <div class="project-footer">
                  <Badge variant="primary" size="sm">Active</Badge>
                  <div class="project-actions">
                    <Button variant="ghost" size="sm" onclick={(e) => { e.stopPropagation(); sessionsStore.deleteSession(session.id); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            {/snippet}
          </Card>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .dashboard {
    width: 100%;
    min-height: 100%;
    background-color: var(--bg-primary);
    padding: 48px 24px;
    overflow-y: auto;
  }

  .dashboard-container {
    max-width: 1000px;
    margin: 0 auto;
  }

  .dashboard-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 40px;
  }

  .dashboard-title {
    font-size: 32px;
    font-weight: 800;
    color: #18181b;
    margin-bottom: 8px;
  }

  .dashboard-subtitle {
    font-size: 16px;
    color: #71717a;
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 24px;
  }

  .project-card-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 20px;
  }

  .project-name {
    font-size: 18px;
    font-weight: 700;
    color: #18181b;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-date {
    font-size: 13px;
    color: #a1a1aa;
  }

  .project-stats {
    display: flex;
    gap: 24px;
    padding: 12px 0;
    border-top: 1px solid #f4f4f5;
    border-bottom: 1px solid #f4f4f5;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: #18181b;
  }

  .stat-label {
    font-size: 11px;
    font-weight: 600;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .project-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .empty-dashboard {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 0;
    text-align: center;
    gap: 16px;
  }

  .empty-dashboard h2 {
    font-size: 24px;
    font-weight: 700;
    color: #18181b;
  }

  .empty-dashboard p {
    font-size: 16px;
    color: #71717a;
    max-width: 300px;
    margin-bottom: 8px;
  }
</style>
