<script lang="ts">
  /**
   * IntegrationsTab – Extracted from TabbedSettingsScreen.svelte (tab: 'integrations')
   * Redesigned as a clean single-column layout.
   */
  import { Card, Button } from '../../lib/design-system';
  import RecommendedExtensions from '../RecommendedExtensions.svelte';
  import ScheduledAgents from '../ScheduledAgents.svelte';

  interface Props {
    analyzingArchitecture: any;
    architectureDiagram: any;
    architectureSummary: any;
    handleAnalyzeArchitectureClick: any;
    setCurrentView: any;
  }

  let {
    analyzingArchitecture,
    architectureDiagram,
    architectureSummary,
    handleAnalyzeArchitectureClick,
    setCurrentView,
  }: Props = $props();
</script>

<div class="tab-section integrations-tab">
  <!-- Local section -->
  <Card title="Docker & Containers" padding="md">
    <p class="section-desc">
      Manage containers and stacks in Docker Desktop. Open Docker Desktop to start/stop containers
      and run compose.
    </p>
    <div class="actions-row">
      <Button
        variant="primary"
        size="sm"
        onclick={() =>
          window.open('https://app.docker.com/open-desktop', '_blank', 'noopener,noreferrer')}
      >
        Open Docker Desktop
      </Button>
      <Button variant="ghost" size="sm" onclick={() => setCurrentView('docker')}>Docker</Button>
      <Button variant="ghost" size="sm" onclick={() => setCurrentView('docker-setup')}>
        Docker Setup Wizard
      </Button>
    </div>
  </Card>

  <Card title="Scheduled Agents" padding="md">
    <p class="section-desc">
      Automate recurring tasks with scheduled agent runs. Manage cron schedules and agent configs.
    </p>
    <ScheduledAgents />
  </Card>

  <!-- Workspace section -->
  <Card title="Codebase Architecture" padding="md">
    <p class="section-desc">
      Scan your current workspace and generate a Mermaid architecture diagram.
    </p>
    <div class="field-group">
      <Button
        variant="primary"
        size="sm"
        onclick={handleAnalyzeArchitectureClick}
        disabled={analyzingArchitecture}
      >
        {#if analyzingArchitecture}
          Analyzing workspace…
        {:else}
          Generate diagram from workspace
        {/if}
      </Button>
      <p class="field-hint">
        Uses the workspace root from Code mode. Diagram is generated using codebase analysis.
      </p>
    </div>
    {#if architectureSummary || architectureDiagram}
      {#if architectureSummary}
        <div class="field-group">
          <p class="field-label">Summary</p>
          <p class="architecture-summary">{architectureSummary}</p>
        </div>
      {/if}
      {#if architectureDiagram}
        <div class="field-group">
          <p class="field-label">Mermaid diagram</p>
          <pre class="mermaid-output"><code>{architectureDiagram}</code></pre>
          <p class="field-hint">
            Copy this into Architecture mode or any Mermaid viewer to visualize.
          </p>
        </div>
      {/if}
    {/if}
  </Card>

  <Card title="Tools & Extensions" padding="md">
    <p class="section-desc">
      Integrate into G-Rump: extensions that work with our platform and your workflow (ESLint,
      Prettier, GitLens, Docker, Thunder Client). Install from the Marketplace or enable recommended
      extensions below.
    </p>
    <RecommendedExtensions />
  </Card>
</div>

<style>
  .tab-section {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .tab-section :global(.card) {
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .section-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
    line-height: 1.5;
    margin-bottom: 1rem;
  }

  .field-group {
    margin-bottom: 20px;
  }

  .field-group:last-child {
    margin-bottom: 0;
  }

  .field-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary, #3f3f46);
    margin-bottom: 8px;
  }

  .field-hint {
    font-size: 12px;
    color: var(--color-text-muted, #a1a1aa);
    margin-top: 6px;
  }

  .actions-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .architecture-summary {
    font-size: 14px;
    color: var(--color-text-secondary, #3f3f46);
    line-height: 1.5;
    background: var(--color-bg-subtle, #f9fafb);
    padding: 12px;
    border-radius: 6px;
  }

  .mermaid-output {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 13px;
  }

  .mermaid-output code {
    font-family: ui-monospace, monospace;
  }
</style>
