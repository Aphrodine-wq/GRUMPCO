<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '../stores/settingsStore';
  import { showToast } from '../stores/toastStore';
  import { fetchApi } from '../lib/api.js';
  import type { Settings, ModelsSettings, AccessibilitySettings, GuardRailsSettings } from '../types/settings';
  import RecommendedExtensions from './RecommendedExtensions.svelte';

  interface Tier {
    id: string;
    name: string;
    priceMonthlyCents: number;
    priceYearlyCents?: number;
    apiCallsPerMonth: number;
    features: string[];
  }

  interface BillingMe {
    tier: string | null;
    usage: number | null;
    limit: number | null;
    message?: string;
  }

  interface Props {
    onBack?: () => void;
    /** URL for "Manage billing" / pricing (e.g. web app or marketing). */
    billingUrl?: string;
  }

  let { onBack, billingUrl = '#' }: Props = $props();

  let settings = $state<Settings | null>(null);
  let saving = $state(false);
  let allowedDirsText = $state('');
  let tiers = $state<Tier[]>([]);
  let billingMe = $state<BillingMe | null>(null);

  const modelOptions = [
    { provider: 'anthropic' as const, modelId: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { provider: 'anthropic' as const, modelId: 'claude-opus-4-5-20251101', label: 'Claude Opus 4' },
    { provider: 'zhipu' as const, modelId: 'glm-4', label: 'GLM 4.7' },
    { provider: 'copilot' as const, modelId: 'copilot-codex', label: 'Copilot Codex' },
    { provider: 'copilot' as const, modelId: 'copilot-codebase', label: 'Copilot Codebase' },
    { provider: 'openrouter' as const, modelId: 'anthropic/claude-3.5-sonnet', label: 'OpenRouter Claude 3.5 Sonnet' },
    { provider: 'openrouter' as const, modelId: 'openai/gpt-4o', label: 'OpenRouter GPT-4o' },
  ];

  onMount(() => {
    settingsStore.load().then((s) => {
      settings = s;
      allowedDirsText = (s?.guardRails?.allowedDirs ?? []).join('\n');
    });
    fetchApi('/api/billing/tiers')
      .then((r) => r.json())
      .then((d: { tiers?: Tier[] }) => { tiers = d.tiers ?? []; })
      .catch(() => { tiers = []; });
    fetchApi('/api/billing/me')
      .then((r) => r.json())
      .then((d: BillingMe) => { billingMe = d; })
      .catch(() => { billingMe = null; });
    return settingsStore.subscribe((v) => {
      settings = v ?? null;
      if (v?.guardRails?.allowedDirs) allowedDirsText = v.guardRails.allowedDirs.join('\n');
    });
  });

  async function saveModels(next: ModelsSettings) {
    saving = true;
    const ok = await settingsStore.save({ models: next });
    saving = false;
    if (ok) showToast('Models saved', 'success');
    else showToast('Failed to save models', 'error');
  }

  async function saveAccessibility(accessibility: AccessibilitySettings) {
    saving = true;
    const ok = await settingsStore.save({ accessibility });
    saving = false;
    if (ok) showToast('Accessibility saved', 'success');
    else showToast('Failed to save accessibility', 'error');
  }

  async function saveGuardRails(guardRails: GuardRailsSettings) {
    saving = true;
    const ok = await settingsStore.save({ guardRails });
    saving = false;
    if (ok) showToast('Guard rails saved', 'success');
    else showToast('Failed to save guard rails', 'error');
  }

  function parseAllowedDirs(s: string): string[] {
    return s
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function modelValue(): string {
    const m = settings?.models;
    if (!m?.defaultModelId) return 'claude-sonnet-4-20250514';
    const opt = modelOptions.find((o) => o.modelId === m.defaultModelId && o.provider === (m.defaultProvider ?? 'anthropic'));
    return opt ? `${opt.provider}:${opt.modelId}` : `${m.defaultProvider ?? 'anthropic'}:${m.defaultModelId}`;
  }

  function handleModelChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    const [provider, modelId] = v.includes(':') ? v.split(':') : ['anthropic', v];
    saveModels({
      ...settings?.models,
      defaultProvider: provider as 'anthropic' | 'zhipu' | 'copilot' | 'openrouter',
      defaultModelId: modelId,
    });
  }
</script>

<div class="settings-screen">
  <header class="settings-header">
    <button type="button" class="back-btn" onclick={onBack} aria-label="Back">← Back</button>
    <h1 class="settings-title">Settings</h1>
  </header>

  <div class="settings-body">
    <section class="settings-section">
      <h2 class="section-title">User</h2>
      <p class="section-desc">Profile and identity (sync from backend when signed in).</p>
      <div class="section-fields">
        <label>
          <span>Display name</span>
          <input type="text" placeholder="Optional" value={settings?.user?.displayName ?? ''} disabled />
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="section-title">Pricing</h2>
      <p class="section-desc">Current tier and usage; manage billing on the web.</p>
      <div class="section-fields">
        {#if billingMe?.tier}
          <p class="muted">Current tier: <strong>{billingMe.tier}</strong>. Usage: {billingMe.usage ?? '—'} / {billingMe.limit ?? '—'} this month.</p>
          <a href={billingUrl} target="_blank" rel="noopener noreferrer" class="link">Manage billing</a>
        {:else}
          <p class="muted">{billingMe?.message ?? 'Sign in to see usage and manage billing.'}</p>
          <a href={billingUrl} target="_blank" rel="noopener noreferrer" class="link">View pricing</a>
        {/if}
        <div class="tier-list">
          {#each tiers as t}
            <div class="tier-row">
              <span class="tier-name">{t.name}</span>
              <span class="tier-price">
                {#if t.priceMonthlyCents === 0}
                  Free
                {:else}
                  ${(t.priceMonthlyCents / 100).toFixed(0)}/mo
                {/if}
              </span>
              <span class="tier-calls">{t.apiCallsPerMonth < 1e6 ? t.apiCallsPerMonth.toLocaleString() : 'Unlimited'} API calls/mo</span>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="section-title">Models</h2>
      <p class="section-desc">Default LLM for chat. Can override per request later.</p>
      <div class="section-fields">
        <label>
          <span>Default model</span>
          <select value={modelValue()} onchange={handleModelChange} disabled={saving}>
            {#each modelOptions as opt}
              <option value="{opt.provider}:{opt.modelId}">{opt.label}</option>
            {/each}
          </select>
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="section-title">MCP</h2>
      <p class="section-desc">Model Context Protocol servers (add/edit in a future update).</p>
      <div class="section-fields">
        <p class="muted">No servers configured.</p>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="section-title">Skills</h2>
      <p class="section-desc">Enabled skills (backend-controlled allowlist).</p>
      <div class="section-fields">
        <p class="muted">Configured on the server.</p>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="section-title">Guard rails</h2>
      <p class="section-desc">Local file access: workspace-only by default; add allowed dirs; optionally confirm each write.</p>
      <div class="section-fields">
        <label>
          <span>Allowed directories (one per line or comma-separated)</span>
          <textarea
            placeholder="C:\other\repo"
            rows="3"
            class="textarea-field"
            bind:value={allowedDirsText}
            onblur={() => {
              const dirs = parseAllowedDirs(allowedDirsText);
              saveGuardRails({ ...settings?.guardRails, allowedDirs: dirs.length ? dirs : undefined });
            }}
            disabled={saving}
          ></textarea>
        </label>
        <label class="checkbox-label">
          <input
            type="checkbox"
            checked={settings?.guardRails?.confirmEveryWrite !== false}
            onchange={(e) => saveGuardRails({ ...settings?.guardRails, confirmEveryWrite: (e.target as HTMLInputElement).checked })}
          />
          <span>Confirm every write/delete (recommended)</span>
        </label>
      </div>
    </section>

    <section class="settings-section">
      <RecommendedExtensions />
    </section>

    <section class="settings-section">
      <h2 class="section-title">Accessibility</h2>
      <p class="section-desc">Reduced motion, contrast, font size.</p>
      <div class="section-fields">
        <label class="checkbox-label">
          <input
            type="checkbox"
            checked={settings?.accessibility?.reducedMotion ?? false}
            onchange={(e) => saveAccessibility({ ...settings?.accessibility, reducedMotion: (e.target as HTMLInputElement).checked })}
          />
          <span>Reduced motion</span>
        </label>
        <label class="checkbox-label">
          <input
            type="checkbox"
            checked={settings?.accessibility?.highContrast ?? false}
            onchange={(e) => saveAccessibility({ ...settings?.accessibility, highContrast: (e.target as HTMLInputElement).checked })}
          />
          <span>High contrast</span>
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="section-title">Integrations</h2>
      <p class="section-desc">GitHub, Twilio (text/call G-Rump), etc.</p>
      <div class="section-fields">
        <p class="muted">GitHub OAuth and Twilio are configured via backend env.</p>
      </div>
    </section>
  </div>
</div>

<style>
  .settings-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fafafa;
    overflow: auto;
  }
  .settings-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    background: #fff;
    border-bottom: 1px solid #e5e5e5;
    flex-shrink: 0;
  }
  .back-btn {
    padding: 8px 12px;
    font-size: 14px;
    color: #555;
    background: transparent;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
  }
  .back-btn:hover {
    background: #f0f0f0;
    color: #333;
  }
  .settings-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
  }
  .settings-body {
    flex: 1;
    padding: 24px;
    max-width: 640px;
  }
  .settings-section {
    margin-bottom: 28px;
    padding: 20px;
    background: #fff;
    border-radius: 10px;
    border: 1px solid #e8e8e8;
  }
  .section-title {
    margin: 0 0 6px 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }
  .section-desc {
    margin: 0 0 14px 0;
    font-size: 13px;
    color: #666;
  }
  .section-fields label {
    display: block;
    margin-bottom: 12px;
  }
  .section-fields label > span {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #444;
    margin-bottom: 4px;
  }
  .section-fields input[type='text'],
  .section-fields select {
    width: 100%;
    max-width: 320px;
    padding: 8px 12px;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 6px;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .checkbox-label input { width: auto; max-width: none; }
  .textarea-field {
    width: 100%;
    max-width: 400px;
    padding: 8px 12px;
    font-size: 13px;
    font-family: inherit;
    border: 1px solid #ccc;
    border-radius: 6px;
    resize: vertical;
  }
  .muted {
    margin: 0;
    font-size: 13px;
    color: #888;
  }
  .link {
    font-size: 14px;
    color: #0066cc;
    text-decoration: none;
  }
  .link:hover { text-decoration: underline; }
  .tier-list {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tier-row {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }
  .tier-name { font-weight: 600; min-width: 80px; }
  .tier-price { color: #333; min-width: 60px; }
  .tier-calls { color: #666; }
</style>
