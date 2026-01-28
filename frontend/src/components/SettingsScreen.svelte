<script lang="ts">
  /**
   * SettingsScreen - Professional light theme
   */
  import { onMount } from 'svelte';
  import { settingsStore } from '../stores/settingsStore';
  import { showToast } from '../stores/toastStore';
  import { fetchApi } from '../lib/api.js';
  import type {
    Settings,
    ModelsSettings,
    AccessibilitySettings,
    GuardRailsSettings,
  } from '../types/settings';
  import RecommendedExtensions from './RecommendedExtensions.svelte';
  import ScheduledAgents from './ScheduledAgents.svelte';
  import { Button, Card, Badge } from '../lib/design-system';
  import { colors } from '../lib/design-system/tokens/colors';
  import { workspaceStore } from '../stores/workspaceStore';
  import { analyzeArchitecture } from '../stores/featuresStore';

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
    billingUrl?: string;
  }

  let { onBack, billingUrl = '#' }: Props = $props();

  let settings = $state<Settings | null>(null);
  let saving = $state(false);
  let allowedDirsText = $state('');
  let tiers = $state<Tier[]>([]);
  let billingMe = $state<BillingMe | null>(null);
  let workspaceRoot = $state<string | null>(null);
  let analyzingArchitecture = $state(false);
  let architectureSummary = $state<string | null>(null);
  let architectureDiagram = $state<string | null>(null);

  const modelOptions = [
    {
      provider: 'anthropic' as const,
      modelId: 'claude-sonnet-4-20250514',
      label: 'Claude Sonnet 4',
    },
    { provider: 'anthropic' as const, modelId: 'claude-opus-4-5-20251101', label: 'Claude Opus 4' },
    { provider: 'zhipu' as const, modelId: 'glm-4', label: 'GLM 4.7' },
    { provider: 'copilot' as const, modelId: 'copilot-codex', label: 'Copilot Codex' },
    { provider: 'copilot' as const, modelId: 'copilot-codebase', label: 'Copilot Codebase' },
    {
      provider: 'openrouter' as const,
      modelId: 'anthropic/claude-3.5-sonnet',
      label: 'OpenRouter Claude 3.5 Sonnet',
    },
    { provider: 'openrouter' as const, modelId: 'openai/gpt-4o', label: 'OpenRouter GPT-4o' },
  ];

  onMount(() => {
    const unsubWorkspace = workspaceStore.subscribe((state) => {
      workspaceRoot = state?.root ?? null;
    });

    settingsStore.load().then((s) => {
      settings = s;
      allowedDirsText = (s?.guardRails?.allowedDirs ?? []).join('\n');
    });
    fetchApi('/api/billing/tiers')
      .then((r) => r.json())
      .then((d: { tiers?: Tier[] }) => {
        tiers = d.tiers ?? [];
      })
      .catch(() => {
        tiers = [];
      });
    fetchApi('/api/billing/me')
      .then((r) => r.json())
      .then((d: BillingMe) => {
        billingMe = d;
      })
      .catch(() => {
        billingMe = null;
      });
    const unsubSettings = settingsStore.subscribe((v) => {
      settings = v ?? null;
      if (v?.guardRails?.allowedDirs) allowedDirsText = v.guardRails.allowedDirs.join('\n');
    });

    return () => {
      unsubWorkspace();
      unsubSettings();
    };
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
    if (!m?.defaultModelId) return 'anthropic:claude-sonnet-4-20250514';
    return `${m.defaultProvider ?? 'anthropic'}:${m.defaultModelId}`;
  }

  function handleModelChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    const [provider, modelId] = v.includes(':') ? v.split(':') : ['anthropic', v];
    saveModels({
      ...settings?.models,
      defaultProvider: provider as any,
      defaultModelId: modelId,
    });
  }

  async function handleAnalyzeArchitectureClick() {
    if (!workspaceRoot) {
      showToast('Set a workspace root in Code mode before analyzing the codebase.', 'error');
      return;
    }
    analyzingArchitecture = true;
    architectureSummary = null;
    architectureDiagram = null;
    try {
      const result = await analyzeArchitecture(workspaceRoot);
      architectureSummary = result.summary;
      architectureDiagram = result.mermaidDiagram;
      showToast('Codebase architecture diagram generated from workspace.', 'success');
    } catch (err) {
      showToast('Failed to analyze workspace architecture', 'error');
    } finally {
      analyzingArchitecture = false;
    }
  }
</script>

<div class="settings-screen" style:--bg-primary={colors.background.primary}>
  <header class="settings-header">
    <div class="header-left">
      <Button variant="ghost" size="sm" onclick={onBack}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back
      </Button>
      <h1 class="settings-title">Settings</h1>
    </div>
  </header>

  <div class="settings-container">
    <div class="settings-grid">
      <!-- Models Section -->
      <Card title="Models" padding="md">
        <p class="section-desc">Default AI model for code generation and chat.</p>
        <div class="field-group">
          <label class="field-label" for="model-select">AI Model</label>
          <select
            id="model-select"
            class="custom-select"
            value={modelValue()}
            onchange={handleModelChange}
            disabled={saving}
          >
            {#each modelOptions as opt}
              <option value="{opt.provider}:{opt.modelId}">{opt.label}</option>
            {/each}
          </select>
        </div>
      </Card>

      <!-- Guard Rails -->
      <Card title="Security & Guard Rails" padding="md">
        <p class="section-desc">Control file access and safety checks.</p>
        <div class="field-group">
          <label class="field-label" for="allowed-dirs">Allowed Directories</label>
          <textarea
            id="allowed-dirs"
            class="custom-textarea"
            placeholder="C:\projects\my-app"
            bind:value={allowedDirsText}
            onblur={() => {
              const dirs = parseAllowedDirs(allowedDirsText);
              saveGuardRails({
                ...settings?.guardRails,
                allowedDirs: dirs.length ? dirs : undefined,
              });
            }}
            disabled={saving}
          ></textarea>
          <p class="field-hint">One path per line. Only these directories will be accessible.</p>
        </div>
        <div class="field-group">
          <label class="checkbox-field">
            <input
              type="checkbox"
              checked={settings?.guardRails?.confirmEveryWrite !== false}
              onchange={(e) =>
                saveGuardRails({
                  ...settings?.guardRails,
                  confirmEveryWrite: (e.target as HTMLInputElement).checked,
                })}
            />
            <span class="checkbox-label-text">Confirm every file write</span>
          </label>
        </div>
        <div class="field-group">
          <label class="checkbox-field">
            <input
              type="checkbox"
              checked={settings?.guardRails?.autonomousMode ?? false}
              onchange={(e) =>
                saveGuardRails({
                  ...settings?.guardRails,
                  autonomousMode: (e.target as HTMLInputElement).checked,
                })}
            />
            <span class="checkbox-label-text">Autonomous (Yolo) mode</span>
          </label>
          <p class="field-hint">
            Skip tool confirmations; tools run without per-step approval. Use with care.
          </p>
        </div>
        <div class="field-group">
          <label class="checkbox-field">
            <input
              type="checkbox"
              checked={settings?.guardRails?.useLargeContext ?? false}
              onchange={(e) =>
                saveGuardRails({
                  ...settings?.guardRails,
                  useLargeContext: (e.target as HTMLInputElement).checked,
                })}
            />
            <span class="checkbox-label-text">Large context (200K+)</span>
          </label>
          <p class="field-hint">
            Allow longer messages for chat when using models that support large context.
          </p>
        </div>
      </Card>

      <!-- Scheduled agents (24/7) -->
      <ScheduledAgents />

      <!-- Billing Section -->
      <Card title="Subscription & Billing" padding="md">
        <div class="billing-status">
          {#if billingMe?.tier}
            <div class="status-row">
              <span class="status-label">Current Tier</span>
              <Badge variant="primary">{billingMe.tier}</Badge>
            </div>
            <div class="status-row">
              <span class="status-label">Usage</span>
              <span class="status-value"
                >{billingMe.usage ?? 0} / {billingMe.limit ?? '∞'} calls</span
              >
            </div>
            <div class="billing-actions">
              <Button
                variant="secondary"
                size="sm"
                onclick={() => window.open(billingUrl, '_blank')}>Manage Billing</Button
              >
            </div>
            {#if tiers.length}
              <div class="status-row">
                <span class="status-label">Available tiers</span>
                <span class="status-value">{tiers.length}</span>
              </div>
            {/if}
          {:else}
            <p class="billing-empty">Sign in to view your subscription details.</p>
            <Button variant="primary" size="sm" onclick={() => window.open(billingUrl, '_blank')}
              >View Pricing</Button
            >
          {/if}
        </div>
      </Card>

      <!-- Accessibility -->
      <Card title="Accessibility" padding="md">
        <div class="field-group">
          <label class="checkbox-field">
            <input
              type="checkbox"
              checked={settings?.accessibility?.reducedMotion ?? false}
              onchange={(e) =>
                saveAccessibility({
                  ...settings?.accessibility,
                  reducedMotion: (e.target as HTMLInputElement).checked,
                })}
            />
            <span class="checkbox-label-text">Reduced Motion</span>
          </label>
        </div>
        <div class="field-group">
          <label class="checkbox-field">
            <input
              type="checkbox"
              checked={settings?.accessibility?.highContrast ?? false}
              onchange={(e) =>
                saveAccessibility({
                  ...settings?.accessibility,
                  highContrast: (e.target as HTMLInputElement).checked,
                })}
            />
            <span class="checkbox-label-text">High Contrast Mode</span>
          </label>
        </div>
      </Card>

      <Card title="Tools & Extensions" padding="md">
        <RecommendedExtensions />
      </Card>

      <Card title="Codebase Architecture (Mermaid)" padding="md">
        <p class="section-desc">
          Scan your current workspace and generate a Mermaid architecture diagram from the existing
          codebase.
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
            Uses the workspace root from Code mode. The diagram and summary are generated using the
            codebase analysis service.
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
    </div>
  </div>
</div>

<style>
  .settings-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-primary);
    overflow: hidden;
  }

  .settings-header {
    background-color: white;
    border-bottom: 1px solid var(--border-color);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .settings-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .settings-container {
    flex: 1;
    overflow-y: auto;
    padding: 32px 24px;
  }

  .settings-grid {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-desc {
    font-size: 14px;
    color: #71717a;
    margin-bottom: 20px;
  }

  .field-group {
    margin-bottom: 20px;
  }

  .field-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #3f3f46;
    margin-bottom: 8px;
  }

  .field-hint {
    font-size: 12px;
    color: #a1a1aa;
    margin-top: 6px;
  }

  .custom-select {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    background-color: white;
    font-size: 14px;
    outline: none;
    transition: border-color 150ms;
  }

  .custom-select:focus {
    border-color: #0ea5e9;
  }

  .custom-textarea {
    width: 100%;
    min-height: 80px;
    padding: 12px;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    resize: vertical;
  }

  .custom-textarea:focus {
    border-color: #0ea5e9;
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
    color: #3f3f46;
  }

  .billing-status {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 8px;
  }

  .status-label {
    font-size: 14px;
    font-weight: 500;
    color: #71717a;
  }

  .status-value {
    font-size: 14px;
    font-weight: 600;
    color: #18181b;
  }

  .billing-empty {
    font-size: 14px;
    color: #71717a;
    font-style: italic;
  }

  .billing-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
