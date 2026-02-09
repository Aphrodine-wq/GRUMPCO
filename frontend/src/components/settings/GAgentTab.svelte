<script lang="ts">
  /**
   * GAgentTab – Extracted from TabbedSettingsScreen.svelte (tab: 'gagent')
   * Phase 2 decomposition.
   *
   * TODO: Replace `any` props with explicit types for full type safety.
   */
  import { Card, Badge } from '../../lib/design-system';
  import type { GAgentCapabilityKey } from '../../stores/preferencesStore';

  interface Props {
    CAPABILITY_DESCRIPTIONS: any;
    PREMIUM_CAPABILITIES: any;
    gAgentAutoApprove: any;
    gAgentCapabilities: any;
    gAgentExternalAllowlist: any;
    gAgentOllamaModel: any;
    gAgentPersistent: any;
    gAgentPersona: any;
    gAgentPreferredModelSource: any;
    preferencesStore: any;
  }

  let {
    CAPABILITY_DESCRIPTIONS,
    PREMIUM_CAPABILITIES,
    gAgentAutoApprove,
    gAgentCapabilities,
    gAgentExternalAllowlist,
    gAgentOllamaModel,
    gAgentPersistent,
    gAgentPersona,
    gAgentPreferredModelSource,
    preferencesStore,
  }: Props = $props();
</script>

<div class="tab-section">
  <Card title="Agent Configuration" padding="md">
    <p class="section-desc">
      Configure how the agent behaves: model source, personality, capabilities, and safety
      guardrails.
    </p>

    <div class="field-group">
      <label class="field-label" for="gagent-model-source">Model source</label>
      <select
        id="gagent-model-source"
        class="custom-select"
        value={$gAgentPreferredModelSource ?? 'auto'}
        onchange={(e) => {
          const v = (e.target as HTMLSelectElement).value as 'cloud' | 'ollama' | 'auto';
          preferencesStore.setGAgentPreferredModelSource(v);
        }}
      >
        <option value="auto">Auto (cloud + local fallback)</option>
        <option value="cloud">Cloud only</option>
        <option value="ollama">Ollama (local only)</option>
      </select>
      <p class="field-hint">
        Choose where the agent runs models. Auto uses cloud but falls back to local Ollama.
      </p>
    </div>

    {#if ($gAgentPreferredModelSource ?? 'auto') === 'ollama'}
      <div class="field-group">
        <label class="field-label" for="gagent-ollama-model">Ollama model</label>
        <input
          id="gagent-ollama-model"
          type="text"
          class="settings-text-input"
          placeholder="llama3:latest"
          value={$gAgentOllamaModel ?? ''}
          onchange={(e) => {
            const v = (e.target as HTMLInputElement).value.trim();
            preferencesStore.setGAgentOllamaModel(v || '');
          }}
        />
        <p class="field-hint">e.g. llama3:latest, codellama:13b, deepseek-coder:33b</p>
      </div>
    {/if}
  </Card>

  <Card title="Persona & Style" padding="md">
    <p class="section-desc">Customize the agent's communication style and expertise focus.</p>
    <div class="field-group">
      <label class="field-label" for="gagent-tone">Tone</label>
      <select
        id="gagent-tone"
        class="custom-select"
        value={$gAgentPersona?.tone ?? 'professional'}
        onchange={(e) => {
          const v = (e.target as HTMLSelectElement).value;
          preferencesStore.setGAgentPersona({
            ...$gAgentPersona,
            tone: v,
          });
        }}
      >
        <option value="professional">Professional</option>
        <option value="friendly">Friendly</option>
        <option value="concise">Concise</option>
        <option value="verbose">Verbose</option>
        <option value="casual">Casual</option>
      </select>
    </div>
    <div class="field-group">
      <label class="field-label" for="gagent-style">Response style</label>
      <select
        id="gagent-style"
        class="custom-select"
        value={$gAgentPersona?.style ?? 'balanced'}
        onchange={(e) => {
          const v = (e.target as HTMLSelectElement).value;
          preferencesStore.setGAgentPersona({
            ...$gAgentPersona,
            style: v,
          });
        }}
      >
        <option value="balanced">Balanced</option>
        <option value="code-heavy">Code-heavy</option>
        <option value="explanation-first">Explanation-first</option>
        <option value="minimal">Minimal</option>
      </select>
    </div>
  </Card>

  <Card title="Capabilities" padding="md">
    <p class="section-desc">
      Toggle which capabilities the agent can use. Disabling a capability prevents the agent from
      using that tool even if prompted. Premium capabilities require a PRO+ plan.
    </p>
    <div class="capabilities-grid">
      {#each Object.entries(CAPABILITY_DESCRIPTIONS) as [key, desc]}
        {@const capKey = key as GAgentCapabilityKey}
        {@const isPremium = PREMIUM_CAPABILITIES.includes(capKey)}
        {@const enabled = ($gAgentCapabilities ?? []).includes(capKey)}
        <label class="capability-item" class:premium={isPremium}>
          <input
            type="checkbox"
            checked={enabled}
            onchange={(e) => {
              const checked = (e.target as HTMLInputElement).checked;
              const caps = new Set($gAgentCapabilities ?? []);
              if (checked) caps.add(capKey);
              else caps.delete(capKey);
              preferencesStore.setGAgentCapabilities(Array.from(caps));
            }}
          />
          <div class="capability-info">
            <span class="capability-name">
              {key.replace(/_/g, ' ')}
              {#if isPremium}<Badge variant="default">PRO+</Badge>{/if}
            </span>
            <span class="capability-desc">{desc}</span>
          </div>
        </label>
      {/each}
    </div>
  </Card>

  <Card title="Safety & Autonomy" padding="md">
    <p class="section-desc">Control how much autonomy the agent has when performing tasks.</p>
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={$gAgentAutoApprove}
          onchange={(e) => {
            preferencesStore.setGAgentAutoApprove((e.target as HTMLInputElement).checked);
          }}
        />
        <span class="checkbox-label-text">Auto-approve safe actions</span>
      </label>
      <p class="field-hint">
        When enabled, the agent will automatically run file reads, git status, and other read-only
        operations without asking for confirmation. Destructive actions still require approval.
      </p>
    </div>
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={$gAgentPersistent}
          onchange={(e) => {
            preferencesStore.setGAgentPersistent((e.target as HTMLInputElement).checked);
          }}
        />
        <span class="checkbox-label-text">Persistent mode</span>
      </label>
      <p class="field-hint">
        Keep agent context alive across sessions instead of starting fresh each time.
      </p>
    </div>
    <div class="field-group">
      <label class="field-label" for="gagent-allowlist">External API domain allowlist</label>
      <textarea
        id="gagent-allowlist"
        class="settings-textarea"
        placeholder="api.github.com&#10;api.openai.com&#10;httpbin.org"
        rows="4"
        value={($gAgentExternalAllowlist ?? []).join('\n')}
        onchange={(e) => {
          const domains = (e.target as HTMLTextAreaElement).value
            .split(/[\n,]/)
            .map((d) => d.trim())
            .filter(Boolean);
          preferencesStore.setGAgentExternalAllowlist(domains);
        }}
      ></textarea>
      <p class="field-hint">
        One domain per line. The agent can only make external API calls to these domains (when
        api_call capability is enabled).
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

  .custom-select {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border: 1px solid var(--color-border, #e4e4e7);
    border-radius: 6px;
    background-color: var(--color-bg-elevated, #ffffff);
    color: var(--color-text, #18181b);
    font-size: 14px;
    outline: none;
    transition: border-color 150ms;
  }

  .custom-select:focus {
    border-color: var(--color-primary, #7c3aed);
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

  .capabilities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .capability-item {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-bg-secondary, #f9fafb);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .capability-item:hover {
    background: var(--color-bg-card, #ffffff);
    border-color: var(--color-primary, #7c3aed);
  }

  .capability-item.premium {
    border-color: rgba(234, 179, 8, 0.3);
  }

  .capability-item input[type='checkbox'] {
    margin-top: 0.125rem;
    flex-shrink: 0;
  }

  .capability-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .capability-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
    text-transform: capitalize;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .capability-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted, #71717a);
    line-height: 1.3;
  }

  .settings-textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    line-height: 1.5;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    background: var(--color-bg-secondary, #f9fafb);
    color: var(--color-text, #18181b);
    resize: vertical;
    transition: border-color 0.15s;
  }

  .settings-textarea:focus {
    outline: none;
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
  }
</style>
