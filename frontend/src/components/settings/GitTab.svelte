<script lang="ts">
  /**
   * GitTab – Extracted from TabbedSettingsScreen.svelte (tab: 'git')
   * Phase 2 decomposition.
   *
   * TODO: Replace `any` props with explicit types for full type safety.
   */
  import { Card, Button } from '../../lib/design-system';
  import type { GAgentCapabilityKey } from '../../stores/preferencesStore';

  interface Props {
    gAgentCapabilities: any;
    preferencesStore: any;
    saveGit: any;
    setCurrentView: any;
    settings: any;
    workspaceRoot: any;
    workspaceStore: any;
  }

  let {
    gAgentCapabilities,
    preferencesStore,
    saveGit,
    setCurrentView,
    settings,
    workspaceRoot,
    workspaceStore,
  }: Props = $props();
</script>

<div class="tab-section git-tab">
  {#if !$workspaceStore?.repoUrl}
    <Card title="Connect GitHub" padding="md" class="git-oauth-card">
      <p class="section-desc">
        Connect your GitHub account with OAuth to link repos and enable push/pull from the app.
      </p>
      <Button variant="primary" size="md" onclick={() => setCurrentView('integrations')}>
        Connect GitHub with OAuth
      </Button>
    </Card>
  {/if}
  <Card title="Workspace & Repository" padding="md">
    <p class="section-desc">
      Current workspace and Git repository. Connect a GitHub repo in Integrations or open a folder
      in the app.
    </p>
    <div class="field-group">
      <span class="field-label">Workspace root</span>
      <p class="field-value monospace">{workspaceRoot ?? 'Not set'}</p>
    </div>
    <div class="field-group">
      <span class="field-label">Repository URL</span>
      <p class="field-value monospace">{$workspaceStore?.repoUrl ?? 'None (local only)'}</p>
    </div>
    <Button variant="ghost" size="sm" onclick={() => setCurrentView('integrations')}>
      Connect GitHub (OAuth) in Integrations
    </Button>
  </Card>
  <Card title="Git preferences" padding="md">
    <p class="section-desc">Default branch and auto-fetch behavior for Git operations.</p>
    <div class="field-group">
      <label class="field-label" for="git-default-branch">Default branch</label>
      <input
        id="git-default-branch"
        type="text"
        class="settings-text-input"
        placeholder="main"
        value={settings?.git?.defaultBranch ?? ''}
        onchange={(e) => {
          const v = (e.target as HTMLInputElement).value.trim();
          saveGit({ ...settings?.git, defaultBranch: v || undefined });
        }}
      />
      <p class="field-hint">Branch name used when creating new repos or suggesting pushes.</p>
    </div>
    <div class="field-group">
      <label class="field-label" for="git-auto-fetch">Auto-fetch interval (minutes)</label>
      <input
        id="git-auto-fetch"
        type="number"
        min="0"
        max="1440"
        step="1"
        class="settings-number-input"
        value={settings?.git?.autoFetchIntervalMinutes ?? ''}
        onchange={(e) => {
          const v = parseInt((e.target as HTMLInputElement).value, 10);
          if (!Number.isNaN(v) && v >= 0)
            saveGit({ ...settings?.git, autoFetchIntervalMinutes: v });
          else if ((e.target as HTMLInputElement).value === '')
            saveGit({ ...settings?.git, autoFetchIntervalMinutes: undefined });
        }}
        placeholder="0 (disabled)"
      />
      <p class="field-hint">0 = disabled. How often to run git fetch in the background.</p>
    </div>
  </Card>
  <Card title="Agent Git Capability" padding="md">
    <p class="section-desc">
      Allow the agent to run Git commands (status, diff, commit, branch, push) in your workspace.
    </p>
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={$gAgentCapabilities?.includes('git') ?? false}
          onchange={(e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            const current: GAgentCapabilityKey[] = $gAgentCapabilities ?? [];
            const next: GAgentCapabilityKey[] = enabled
              ? current.includes('git')
                ? current
                : [...current, 'git']
              : current.filter((c) => c !== 'git');
            preferencesStore.setGAgentCapabilities(next);
          }}
        />
        <span class="checkbox-label-text">Enable Git for the agent</span>
      </label>
    </div>
  </Card>
  <Card title="Git Tips" padding="md">
    <ul class="tips-list">
      <li>Use Ship mode to push generated code to a new GitHub repo.</li>
      <li>Connect GitHub in Integrations for OAuth and repo access.</li>
      <li>The agent can run git status, diff, commit, and push when the capability is enabled.</li>
    </ul>
  </Card>
</div>

<style>
  .tab-section {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 28px;
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

  .settings-number-input,
  .settings-text-input {
    max-width: 200px;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    background: var(--color-bg-card, #fff);
  }

  .settings-text-input {
    width: 100%;
    max-width: 280px;
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

  .field-value {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary, #4a4a5a);
  }

  .field-value.monospace {
    font-family: ui-monospace, monospace;
    font-size: 0.8125rem;
    word-break: break-all;
  }

  .tips-list {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary, #4a4a5a);
    line-height: 1.6;
  }

  .tips-list li {
    margin-bottom: 0.5rem;
  }

  .field-hint code {
    font-size: 0.75em;
    padding: 0.1em 0.35em;
    background: var(--color-bg-card, #f4f4f5);
    border-radius: 4px;
  }

  .checkbox-field {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label-text {
    font-size: 14px;
    color: var(--color-text-secondary, #3f3f46);
  }
</style>
