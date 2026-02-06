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
    ModelPreset,
    CustomModelConfig,
    AccessibilitySettings,
    GuardRailsSettings,
  } from '../types/settings';
  import RecommendedExtensions from './RecommendedExtensions.svelte';
  import ScheduledAgents from './ScheduledAgents.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import { Button, Card, Badge } from '../lib/design-system';
  import { colors } from '../lib/design-system/tokens/colors';
  import { workspaceStore } from '../stores/workspaceStore';
  import { analyzeArchitecture } from '../stores/featuresStore';
  import { setCurrentView, showPricing } from '../stores/uiStore';
  import { onboardingStore } from '../stores/onboardingStore';
  import { authGateStore } from '../stores/authGateStore';
  import { preferencesStore, density, includeRagContext } from '../stores/preferencesStore';
  import {
    wakeWordEnabled,
    setWakeWordEnabled,
    loadWakeWordEnabled,
  } from '../stores/wakeWordStore';
  import { getDockerInfo, isDockerSetupAvailable } from '../lib/dockerSetup';

  interface Tier {
    id: string;
    name: string;
    priceMonthlyCents: number;
    priceYearlyCents?: number;
    apiCallsPerMonth: number;
    seats?: number;
    includedStorageGb?: number;
    includedComputeMinutes?: number;
    features: string[];
  }

  interface BillingMe {
    tier: string | null;
    usage: number | null;
    limit: number | null;
    computeMinutesUsed?: number;
    computeMinutesLimit?: number;
    storageGbUsed?: number;
    storageGbLimit?: number;
    overageRates?: {
      storageGbMonthlyCents: number;
      computeMinuteCents: number;
      extraConcurrentAgentMonthlyCents: number;
    };
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
  let dockerStatus = $state<'running' | 'stopped' | 'error' | null>(null);
  let dockerLoading = $state(false);
  let dockerStartStopLoading = $state(false);
  let showCustomModelForm = $state(false);
  let customModelDraft = $state<Partial<CustomModelConfig>>({
    modelId: '',
    apiEndpoint: '',
    contextLength: 4096,
  });

  onMount(() => {
    wakeWordEnabled.set(loadWakeWordEnabled());
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

    if (isDockerSetupAvailable()) {
      dockerLoading = true;
      getDockerInfo()
        .then((info) => {
          dockerStatus = info.running ? 'running' : info.error ? 'error' : 'stopped';
        })
        .catch(() => {
          dockerStatus = 'error';
        })
        .finally(() => {
          dockerLoading = false;
        });
    }

    return () => {
      unsubWorkspace();
      unsubSettings();
    };
  });

  async function dockerComposeUp() {
    dockerStartStopLoading = true;
    try {
      const res = await fetchApi('/api/docker/compose/up', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.ok) dockerStatus = 'running';
      else dockerStatus = 'error';
    } catch {
      dockerStatus = 'error';
    } finally {
      dockerStartStopLoading = false;
    }
  }

  async function dockerComposeDown() {
    dockerStartStopLoading = true;
    try {
      const res = await fetchApi('/api/docker/compose/down', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.ok) dockerStatus = 'stopped';
      else dockerStatus = 'error';
    } catch {
      dockerStatus = 'error';
    } finally {
      dockerStartStopLoading = false;
    }
  }

  function addCustomModel() {
    showCustomModelForm = true;
    customModelDraft = { modelId: '', apiEndpoint: '', contextLength: 4096 };
  }

  function saveCustomModel() {
    if (!customModelDraft.modelId?.trim() || !customModelDraft.apiEndpoint?.trim()) return;
    const list = settings?.models?.customModels ?? [];
    const newModel: CustomModelConfig = {
      id: `custom-${Date.now()}`,
      modelId: customModelDraft.modelId.trim(),
      apiEndpoint: customModelDraft.apiEndpoint.trim(),
      apiKey: customModelDraft.apiKey?.trim() || undefined,
      contextLength: customModelDraft.contextLength ?? 4096,
    };
    saveModels({ ...settings?.models, customModels: [...list, newModel] });
    showCustomModelForm = false;
    customModelDraft = {};
    showToast('Custom model added. Test connection from backend.', 'success');
  }

  function removeCustomModel(id: string) {
    const list = (settings?.models?.customModels ?? []).filter((m) => m.id !== id);
    saveModels({ ...settings?.models, customModels: list.length ? list : undefined });
    showToast('Custom model removed.', 'success');
  }

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
    if (!m?.defaultModelId) return 'auto';
    return `${m.defaultProvider ?? 'nim'}:${m.defaultModelId}`;
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
          <label class="field-label" for="model-preset">Quality vs speed</label>
          <select
            id="model-preset"
            class="custom-select"
            value={settings?.models?.modelPreset ?? 'balanced'}
            onchange={(e) => {
              const v = (e.target as HTMLSelectElement).value as ModelPreset;
              saveModels({ ...settings?.models, modelPreset: v });
            }}
            disabled={saving}
          >
            <option value="balanced">Balanced (router default)</option>
            <option value="fast">Fast (NIM / Kimi)</option>
            <option value="quality">Quality (Claude / GPT-4)</option>
          </select>
          <p class="field-hint">
            Fast = cheaper and lower latency; Quality = best capability; Balanced = auto by task.
          </p>
        </div>
        <div class="field-group">
          <span class="field-label">AI Model (override)</span>
          <ModelPicker
            value={modelValue()}
            compact={false}
            showAuto={true}
            onSelect={(provider, modelId) => {
              saveModels({
                ...settings?.models,
                defaultProvider: provider as 'nim',
                defaultModelId: modelId ?? undefined,
              });
            }}
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="embedding-model">Embedding model</label>
          <select
            id="embedding-model"
            class="custom-select"
            value={settings?.models?.embeddingModelId ?? 'BAAI/bge-small-en-v1.5'}
            onchange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              saveModels({ ...settings?.models, embeddingModelId: v || undefined });
            }}
            disabled={saving}
          >
            <option value="BAAI/bge-small-en-v1.5">BAAI/bge-small-en-v1.5</option>
            <option value="nvidia/nv-embed-v2">nvidia/nv-embed-v2</option>
            <option value="">Default (backend)</option>
          </select>
          <p class="field-hint">Used for RAG and semantic search. Test connection in backend.</p>
        </div>
        <div class="field-group">
          <span class="field-label">Custom / fine-tuned models</span>
          <p class="field-hint">
            Add a model by ID, API endpoint, and optional API key. Backend must support custom model
            routing.
          </p>
          <Button variant="secondary" size="sm" onclick={() => addCustomModel()} disabled={saving}>
            Add Custom Model
          </Button>
          {#if showCustomModelForm}
            <div class="custom-model-form">
              <input
                type="text"
                class="custom-input"
                placeholder="Model ID"
                bind:value={customModelDraft.modelId}
              />
              <input
                type="text"
                class="custom-input"
                placeholder="API endpoint (e.g. https://api.example.com/v1)"
                bind:value={customModelDraft.apiEndpoint}
              />
              <input
                type="password"
                class="custom-input"
                placeholder="API key (optional)"
                bind:value={customModelDraft.apiKey}
              />
              <input
                type="number"
                class="custom-input"
                placeholder="Context length"
                bind:value={customModelDraft.contextLength}
              />
              <div class="custom-model-form-actions">
                <Button
                  variant="primary"
                  size="sm"
                  onclick={saveCustomModel}
                  disabled={!customModelDraft.modelId?.trim() ||
                    !customModelDraft.apiEndpoint?.trim()}>Save</Button
                >
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={() => {
                    showCustomModelForm = false;
                    customModelDraft = {};
                  }}>Cancel</Button
                >
              </div>
            </div>
          {/if}
          {#if (settings?.models?.customModels ?? []).length > 0}
            <ul class="custom-models-list">
              {#each settings?.models?.customModels ?? [] as model (model.id)}
                <li class="custom-model-item">
                  <span class="custom-model-id">{model.modelId}</span>
                  <span class="custom-model-endpoint">{model.apiEndpoint}</span>
                  <Button variant="ghost" size="sm" onclick={() => removeCustomModel(model.id)}
                    >Remove</Button
                  >
                </li>
              {/each}
            </ul>
          {/if}
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
        <div class="field-group">
          <label class="checkbox-field">
            <input
              type="checkbox"
              checked={$includeRagContext}
              onchange={(e) =>
                preferencesStore.setIncludeRagContext((e.target as HTMLInputElement).checked)}
            />
            <span class="checkbox-label-text">RAG context in chat</span>
          </label>
          <p class="field-hint">
            Inject indexed docs into chat for more tailored answers. Requires RAG index (Ask docs or
            npm run rag:index).
          </p>
        </div>
      </Card>

      <!-- Docker: basic container start/stop and setup -->
      <Card title="Docker" padding="md">
        <p class="section-desc">
          Start or stop the G-Rump Docker stack. Use Setup Wizard for one-click NVIDIA or AMD GPU
          setup.
        </p>
        {#if dockerLoading}
          <p class="status-text">Checking Docker status…</p>
        {:else if dockerStatus}
          <div class="status-row">
            <span class="status-label">Status</span>
            <Badge
              variant={dockerStatus === 'running'
                ? 'success'
                : dockerStatus === 'error'
                  ? 'error'
                  : 'default'}
            >
              {dockerStatus === 'running'
                ? 'Running'
                : dockerStatus === 'error'
                  ? 'Error'
                  : 'Stopped'}
            </Badge>
          </div>
        {/if}
        <div class="docker-actions">
          <Button
            variant="primary"
            size="sm"
            onclick={dockerComposeUp}
            disabled={dockerStartStopLoading}
          >
            Start Stack
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onclick={dockerComposeDown}
            disabled={dockerStartStopLoading}
          >
            Stop Stack
          </Button>
          <Button variant="ghost" size="sm" onclick={() => setCurrentView('docker')}>
            Open Docker Panel
          </Button>
          <Button variant="ghost" size="sm" onclick={() => setCurrentView('docker-setup')}>
            Docker Setup Wizard
          </Button>
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
            {#if billingMe.computeMinutesLimit != null}
              <div class="status-row">
                <span class="status-label">Compute</span>
                <span class="status-value"
                  >{(billingMe.computeMinutesUsed ?? 0).toFixed(1)} / {billingMe.computeMinutesLimit}
                  min</span
                >
              </div>
            {/if}
            {#if billingMe.storageGbLimit != null}
              <div class="status-row">
                <span class="status-label">Storage</span>
                <span class="status-value"
                  >{(billingMe.storageGbUsed ?? 0).toFixed(2)} / {billingMe.storageGbLimit} GB</span
                >
              </div>
            {/if}
            <div class="billing-actions">
              <Button variant="primary" size="sm" onclick={() => showPricing.set(true)}
                >Upgrade</Button
              >
              <Button
                variant="secondary"
                size="sm"
                onclick={() => {
                  setCurrentView('cost');
                }}>Cost dashboard</Button
              >
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
            {#if billingMe.overageRates}
              <div class="status-row">
                <span class="status-label">Overages</span>
                <span class="status-value">
                  ${(billingMe.overageRates.storageGbMonthlyCents / 100).toFixed(2)}/GB • ${(
                    billingMe.overageRates.computeMinuteCents / 100
                  ).toFixed(2)}/min • ${(
                    billingMe.overageRates.extraConcurrentAgentMonthlyCents / 100
                  ).toFixed(2)}/slot
                </span>
              </div>
            {/if}
          {:else}
            <p class="billing-empty">Sign in to view your subscription details.</p>
            <div class="billing-actions">
              <Button variant="primary" size="sm" onclick={() => showPricing.set(true)}
                >Upgrade</Button
              >
              <Button
                variant="secondary"
                size="sm"
                onclick={() => {
                  setCurrentView('cost');
                }}>Cost dashboard</Button
              >
              <Button
                variant="secondary"
                size="sm"
                onclick={() => window.open(billingUrl, '_blank')}>Manage Billing</Button
              >
            </div>
          {/if}
        </div>
      </Card>

      <!-- Onboarding & Help -->
      <Card title="Onboarding & Help" padding="md">
        <p class="section-desc">
          Show the welcome and setup carousel again, run troubleshooting, or factory reset.
        </p>
        <div class="field-group docker-actions">
          <Button
            variant="secondary"
            size="sm"
            onclick={() => {
              onboardingStore.resetOnboarding();
              window.location.reload();
            }}
          >
            Show onboarding again
          </Button>
          {#if typeof window !== 'undefined' && (window as { grump?: { isElectron?: boolean } }).grump?.isElectron}
            <Button
              variant="secondary"
              size="sm"
              onclick={() => {
                authGateStore.resetAuthSkipped();
                window.location.reload();
              }}
            >
              Re-prompt for sign-in
            </Button>
          {/if}
          <Button variant="ghost" size="sm" onclick={() => setCurrentView('troubleshooting')}>
            Troubleshooting
          </Button>
          <Button variant="ghost" size="sm" onclick={() => setCurrentView('reset')}>
            Factory reset
          </Button>
        </div>
      </Card>

      <!-- Voice & Wake Word (Electron) -->
      {#if typeof window !== 'undefined' && (window as { grump?: { wakeWord?: { isSupported?: () => boolean } } }).grump?.wakeWord?.isSupported?.()}
        <Card title="Voice & Wake Word" padding="md">
          <p class="section-desc">
            When enabled, say the wake word to activate Talk Mode. Requires microphone access. Uses
            Picovoice (add PICOVOICE_ACCESS_KEY for detection).
          </p>
          <div class="field-group">
            <label class="checkbox-field">
              <input
                type="checkbox"
                checked={$wakeWordEnabled}
                onchange={(e) => {
                  setWakeWordEnabled((e.target as HTMLInputElement).checked);
                  if ((e.target as HTMLInputElement).checked) {
                    (
                      window as {
                        grump?: { wakeWord?: { start?: (key?: string) => Promise<unknown> } };
                      }
                    ).grump?.wakeWord?.start?.();
                  } else {
                    (
                      window as { grump?: { wakeWord?: { stop?: () => Promise<unknown> } } }
                    ).grump?.wakeWord?.stop?.();
                  }
                }}
              />
              <span>Enable wake word (e.g. "Hey G-Rump")</span>
            </label>
          </div>
        </Card>
      {/if}

      <!-- Appearance: Density -->
      <Card title="Appearance" padding="md">
        <p class="section-desc">
          Layout density for lists and padding. Compact uses about 20% less space.
        </p>
        <div class="field-group" role="group" aria-labelledby="density-label">
          <span id="density-label" class="radio-label">Density</span>
          <div class="radio-row">
            <label class="radio-option">
              <input
                type="radio"
                name="density"
                value="comfortable"
                checked={$density !== 'compact'}
                onchange={() => preferencesStore.setDensity('comfortable')}
              />
              <span>Comfortable</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="density"
                value="compact"
                checked={$density === 'compact'}
                onchange={() => preferencesStore.setDensity('compact')}
              />
              <span>Compact</span>
            </label>
          </div>
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

      <!-- Keyboard shortcuts -->
      <Card title="Keyboard shortcuts" padding="md">
        <p class="section-desc">Use these shortcuts to navigate and focus quickly.</p>
        <ul class="shortcuts-list">
          <li><kbd>Ctrl</kbd> + <kbd>B</kbd> — Toggle sidebar</li>
          <li>
            <kbd>/</kbd> or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> — Focus chat input
          </li>
          <li><kbd>Ctrl</kbd> + <kbd>K</kbd> — Open command palette</li>
        </ul>
      </Card>

      <!-- Legal -->
      <Card title="Legal" padding="md">
        <p class="section-desc">
          Terms of Service, Privacy Policy, and Acceptable Use Policy (open in browser).
        </p>
        <div class="legal-links">
          <Button
            variant="ghost"
            size="sm"
            onclick={() => window.open('https://docs.g-rump.com/legal/terms', '_blank')}
          >
            Terms of Service
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onclick={() => window.open('https://docs.g-rump.com/legal/privacy', '_blank')}
          >
            Privacy Policy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onclick={() => window.open('https://docs.g-rump.com/legal/acceptable-use', '_blank')}
          >
            Acceptable Use
          </Button>
        </div>
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

  .radio-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #3f3f46;
    margin-bottom: 8px;
  }
  .radio-row {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }
  .radio-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #3f3f46;
    cursor: pointer;
  }
  .radio-option input {
    cursor: pointer;
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
    border-color: var(--color-primary);
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
    border-color: var(--color-primary);
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

  .docker-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .status-text {
    margin: 0.5rem 0;
    color: var(--text-secondary, #888);
    font-size: 0.875rem;
  }

  .custom-model-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-secondary, #f9fafb);
    border-radius: 0.5rem;
  }

  .custom-model-form .custom-input {
    padding: 0.5rem;
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .custom-model-form-actions {
    display: flex;
    gap: 0.5rem;
  }

  .custom-models-list {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 0;
  }

  .custom-model-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .custom-model-id {
    font-family: monospace;
    font-weight: 600;
  }

  .custom-model-endpoint {
    font-size: 0.8rem;
    color: var(--text-secondary, #6b7280);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .billing-actions {
    display: flex;
    justify-content: flex-end;
  }

  .shortcuts-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 14px;
    color: #3f3f46;
  }

  .shortcuts-list li {
    padding: 6px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .shortcuts-list kbd {
    padding: 2px 6px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    border-radius: 4px;
  }

  .legal-links {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
</style>
