<script lang="ts">
  /**
   * IntegrationsTab – Extracted from TabbedSettingsScreen.svelte (tab: 'integrations')
   * Phase 2 decomposition.
   *
   * TODO: Replace `any` props with explicit types for full type safety.
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

  let { analyzingArchitecture, architectureDiagram, architectureSummary, handleAnalyzeArchitectureClick, setCurrentView }: Props = $props();
</script>

<div class="tab-section integrations-tab">
  <section class="integrations-section">
    <h2 class="integrations-section-title">Local</h2>
    <p class="integrations-section-desc">Docker stack and scheduled agents.</p>
    <div class="integrations-section-content integrations-grid-two">
      <Card title="Docker" padding="md">
        <p class="section-desc">
          Manage containers and stacks in Docker Desktop. Open Docker Desktop to start/stop
          containers and run compose.
        </p>
        <div class="docker-actions">
          <Button
            variant="primary"
            size="sm"
            onclick={() =>
              window.open(
                'https://app.docker.com/open-desktop',
                '_blank',
                'noopener,noreferrer'
              )}
          >
            Open Docker Desktop
          </Button>
          <Button variant="ghost" size="sm" onclick={() => setCurrentView('docker')}>
            Docker
          </Button>
          <Button variant="ghost" size="sm" onclick={() => setCurrentView('docker-setup')}>
            Docker Setup Wizard
          </Button>
        </div>
      </Card>
      <ScheduledAgents />
    </div>
  </section>

  <section class="integrations-section">
    <h2 class="integrations-section-title">Workspace</h2>
    <p class="integrations-section-desc">
      Codebase diagram and recommended VS Code extensions.
    </p>
    <div class="integrations-section-content integrations-grid-two">
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
            Uses the workspace root from Code mode. Diagram is generated using codebase
            analysis.
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
      <div class="integrations-grid-cell-tools">
        <Card title="Tools & Extensions" padding="md">
          <p class="section-desc">
            Integrate into G-Rump: extensions that work with our platform and your workflow
            (ESLint, Prettier, GitLens, Docker, Thunder Client). We support multiple users
            and workspaces—install from the Marketplace or enable recommended extensions
            below.
          </p>
          <RecommendedExtensions />
        </Card>
      </div>
    </div>
  </section>
</div>

<style>

.tab-section {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

.tab-section.integrations-tab {
    max-width: none;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

.integrations-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

.integrations-section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #18181b;
    margin: 0;
  }

.integrations-section-desc {
    font-size: 0.875rem;
    color: #71717a;
    margin: 0;
  }

.integrations-section-content {
    min-width: 0;
  }

.integrations-section-content.integrations-grid-two {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    align-items: start;
  }

.integrations-grid-cell-tools {
    min-width: 0;
    min-height: 0;
  }

.integrations-grid-cell-tools :global(.card) {
    overflow: visible;
    height: auto;
  }

.tab-section.integrations-tab .section-desc {
    font-size: 0.8125rem;
    line-height: 1.4;
    margin-bottom: 0.5rem;
  }

.tab-section.integrations-tab .field-label {
    font-size: 0.8125rem;
  }

.tab-section.integrations-tab .docker-actions {
    margin-top: 0.5rem;
    gap: 0.5rem;
  }

.tab-section :global(.card) {
    border: 1px solid #e5e7eb;
  }

.default-model-row .field-label {
    flex-shrink: 0;
  }

.advanced-finetuning .field-label {
    display: block;
    margin-bottom: 0.5rem;
  }

.inline-config-input-group .field-label {
    margin-bottom: 0.5rem;
  }

.models-custom-inner .section-desc {
    margin-bottom: 0.75rem;
  }

.section-desc {
    font-size: 14px;
    color: var(--color-text-muted, #71717a);
    margin-bottom: 20px;
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

.field-label-row .field-label {
    margin-bottom: 0;
  }

.field-hint {
    font-size: 12px;
    color: var(--color-text-muted, #a1a1aa);
    margin-top: 6px;
  }

.field-hint code {
    font-size: 0.75em;
    padding: 0.1em 0.35em;
    background: var(--color-bg-card, #f4f4f5);
    border-radius: 4px;
  }

.docker-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
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
