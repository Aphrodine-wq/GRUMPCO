<script lang="ts">
  /**
   * DockerPanel - Opens Docker Desktop. All container/image management happens in Docker Desktop.
   */
  import { fade } from 'svelte/transition';
  import { setCurrentView } from '../stores/uiStore';
  import { Button, Card } from '../lib/design-system';
  import { Container, ExternalLink, Cog } from 'lucide-svelte';

  const DOCKER_OPEN_URL = 'https://app.docker.com/open-desktop';

  interface Props {
    onBack?: () => void;
  }
  let { onBack }: Props = $props();

  function openDockerDesktop() {
    if (typeof window !== 'undefined') {
      window.open(DOCKER_OPEN_URL, '_blank', 'noopener,noreferrer');
    }
  }
</script>

<div class="docker-panel" in:fade={{ duration: 200 }}>
  <header class="panel-header">
    {#if onBack}
      <Button variant="ghost" size="sm" onclick={onBack}>Back</Button>
    {/if}
    <div class="header-title">
      <Container size={24} class="docker-icon" aria-hidden="true" />
      <h2>Docker</h2>
    </div>
  </header>

  <main class="panel-main">
    <Card padding="md" class="open-docker-card">
      <p class="section-desc">
        Manage containers, images, volumes, and compose stacks in Docker Desktop. Use the button
        below to open Docker Desktop (or install it if needed).
      </p>
      <div class="actions">
        <Button variant="primary" size="md" onclick={openDockerDesktop}>
          <ExternalLink size={18} />
          Open Docker Desktop
        </Button>
        <Button variant="secondary" size="md" onclick={() => setCurrentView('docker-setup')}>
          <Cog size={18} />
          Docker Setup Wizard
        </Button>
      </div>
      <p class="hint">
        <a href={DOCKER_OPEN_URL} target="_blank" rel="noopener noreferrer"
          >app.docker.com/open-desktop</a
        > — opens Docker Desktop if installed.
      </p>
    </Card>
  </main>
</div>

<style>
  .docker-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-subtle, #f5f3ff);
    padding: 1.25rem 1.5rem;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .docker-icon {
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #1f1147);
  }

  .panel-main {
    flex: 1;
    overflow-y: auto;
    max-width: 560px;
  }

  .open-docker-card {
    margin-bottom: 1rem;
  }

  .section-desc {
    font-size: 0.9375rem;
    color: var(--color-text-secondary, #6b7280);
    margin: 0 0 1.25rem;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .actions :global(button) {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .hint {
    margin: 1rem 0 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #9ca3af);
  }

  .hint a {
    color: var(--color-primary, #7c3aed);
  }
</style>
