<script lang="ts">
  /**
   * SecurityTab – Extracted from TabbedSettingsScreen.svelte (tab: 'security')
   * Phase 2 decomposition.
   *
   * TODO: Replace `any` props with explicit types for full type safety.
   */
  import { Card, Button } from '../../lib/design-system';
  import { includeRagContext, gAgentExternalAllowlist } from '../../stores/preferencesStore';

  interface Props {
    allowedDirsText: any;
    isElectron: any;
    parseAllowedDirs: any;
    preferencesStore: any;
    saveGuardRails: any;
    saving: any;
    settings: any;
  }

  let {
    allowedDirsText,
    isElectron,
    parseAllowedDirs,
    preferencesStore,
    saveGuardRails,
    saving,
    settings,
  }: Props = $props();
</script>

<div class="tab-section security-tab">
  <Card title="File Access Control" padding="md">
    <p class="section-desc">
      Restrict which directories the agent can read and write. Leave empty to allow the current
      workspace only.
    </p>
    <div class="field-group">
      <div class="field-label-row">
        <label class="field-label" for="allowed-dirs">Allowed directories</label>
        {#if isElectron}
          <Button
            variant="secondary"
            size="sm"
            disabled={saving}
            onclick={async () => {
              const grump = (
                window as {
                  grump?: {
                    selectDirectory?: () => Promise<{ path?: string; canceled?: boolean }>;
                  };
                }
              ).grump;
              const result = await grump?.selectDirectory?.();
              if (result?.canceled || !result?.path) return;
              const trimmed = result.path.trim();
              if (!trimmed) return;
              allowedDirsText = allowedDirsText.trim()
                ? `${allowedDirsText.trim()}\n${trimmed}`
                : trimmed;
              const dirs = parseAllowedDirs(allowedDirsText);
              saveGuardRails({
                ...settings?.guardRails,
                allowedDirs: dirs.length ? dirs : undefined,
              });
            }}
          >
            Browse
          </Button>
        {/if}
      </div>
      <textarea
        id="allowed-dirs"
        class="custom-textarea security-textarea"
        placeholder="C:\projects\my-app&#10;/home/user/projects&#10;/Users/me/workspace"
        rows={5}
        bind:value={allowedDirsText}
        onfocus={async () => {
          if (!isElectron || saving) return;
          const grump = (
            window as {
              grump?: {
                selectDirectory?: () => Promise<{ path?: string; canceled?: boolean }>;
              };
            }
          ).grump;
          if (!grump?.selectDirectory) return;
          const result = await grump.selectDirectory();
          if (result?.canceled || !result?.path) return;
          const trimmed = result.path.trim();
          if (!trimmed) return;
          allowedDirsText = allowedDirsText.trim()
            ? `${allowedDirsText.trim()}\n${trimmed}`
            : trimmed;
          const dirs = parseAllowedDirs(allowedDirsText);
          saveGuardRails({
            ...settings?.guardRails,
            allowedDirs: dirs.length ? dirs : undefined,
          });
        }}
        onblur={() => {
          const dirs = parseAllowedDirs(allowedDirsText);
          saveGuardRails({
            ...settings?.guardRails,
            allowedDirs: dirs.length ? dirs : undefined,
          });
        }}
        disabled={saving}
        aria-describedby="allowed-dirs-hint"
      ></textarea>
      <p id="allowed-dirs-hint" class="field-hint">
        One path per line. Example: <code>C:\projects\my-app</code> or
        <code>/Users/me/workspace</code>
        {#if isElectron}
          Focus this field to open folder picker (Electron).
        {:else}
          In the desktop app you can use <strong>Browse</strong> or focus the field to pick a folder.
        {/if}
      </p>
    </div>
  </Card>

  <Card title="Guard Rails" padding="md">
    <p class="section-desc">Control how the agent behaves when modifying files and using tools.</p>
    <div class="guard-rail-options">
      <label class="guard-rail-item">
        <input
          type="checkbox"
          checked={settings?.guardRails?.confirmEveryWrite !== false}
          onchange={(e) =>
            saveGuardRails({
              ...settings?.guardRails,
              confirmEveryWrite: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="guard-rail-title">Confirm every file write</span>
        <span class="guard-rail-desc">Require approval before any file is modified</span>
      </label>
      <label class="guard-rail-item">
        <input
          type="checkbox"
          checked={settings?.guardRails?.autonomousMode ?? false}
          onchange={(e) =>
            saveGuardRails({
              ...settings?.guardRails,
              autonomousMode: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="guard-rail-title">Autonomous (YOLO) mode</span>
        <span class="guard-rail-desc"
          >Skip confirmations; tools run without per-step approval. Use with care.</span
        >
      </label>
      <label class="guard-rail-item">
        <input
          type="checkbox"
          checked={settings?.guardRails?.useLargeContext ?? false}
          onchange={(e) =>
            saveGuardRails({
              ...settings?.guardRails,
              useLargeContext: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="guard-rail-title">Large context (200K+)</span>
        <span class="guard-rail-desc">Allow longer messages for models that support it</span>
      </label>
      <label class="guard-rail-item">
        <input
          type="checkbox"
          checked={$includeRagContext}
          onchange={(e) =>
            preferencesStore.setIncludeRagContext((e.target as HTMLInputElement).checked)}
        />
        <span class="guard-rail-title">Include RAG context in chat</span>
        <span class="guard-rail-desc">Inject indexed docs for more tailored answers</span>
      </label>
    </div>
  </Card>

  <Card title="Allowed API domains" padding="md">
    <p class="section-desc">
      Domains the agent may call (HTTP/API). One per line. Leave empty to use defaults. Example: <code
        >api.github.com</code
      >, <code>*.openai.com</code>.
    </p>
    <div class="field-group">
      <textarea
        class="custom-textarea security-textarea"
        rows={4}
        placeholder="api.github.com&#10;api.openai.com"
        value={($gAgentExternalAllowlist ?? []).join('\n')}
        oninput={(e) => {
          const text = (e.target as HTMLTextAreaElement).value;
          const list = text
            .split(/\n/)
            .map((s) => s.trim())
            .filter(Boolean);
          preferencesStore.setGAgentExternalAllowlist(list);
        }}
        aria-describedby="api-domains-hint"
      ></textarea>
      <p id="api-domains-hint" class="field-hint">
        Used to restrict outbound API calls from the agent.
      </p>
    </div>
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

  .field-label-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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

  .custom-textarea {
    width: 100%;
    min-height: 80px;
    padding: 12px;
    border: 1px solid var(--color-border, #e4e4e7);
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    resize: vertical;
  }

  .custom-textarea:focus {
    border-color: var(--color-primary, #7c3aed);
  }

  .security-tab .section-desc {
    margin-bottom: 1rem;
    color: var(--color-text-muted, #71717a);
    line-height: 1.5;
  }

  .security-textarea {
    min-height: 120px;
    font-family: ui-monospace, monospace;
  }

  .field-hint code {
    font-size: 0.75em;
    padding: 0.1em 0.35em;
    background: var(--color-bg-card, #f4f4f5);
    border-radius: 4px;
  }

  .guard-rail-options {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .guard-rail-item {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    gap: 2px 12px;
    padding: 14px 0;
    border-bottom: 1px solid var(--color-border, #f4f4f5);
    cursor: pointer;
    user-select: none;
    align-items: start;
  }

  .guard-rail-item:last-child {
    border-bottom: none;
  }

  .guard-rail-item input {
    grid-row: 1 / -1;
    margin-top: 3px;
    cursor: pointer;
  }

  .guard-rail-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-secondary, #3f3f46);
  }

  .guard-rail-desc {
    font-size: 12px;
    color: var(--color-text-muted, #71717a);
    line-height: 1.4;
  }
</style>
