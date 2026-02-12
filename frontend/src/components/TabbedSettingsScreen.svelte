<script module lang="ts">
  declare const __APP_VERSION__: string;
</script>

<script lang="ts">
  /**
   * TabbedSettingsScreen - Reorganized settings with tabbed navigation
   * Replaces the long scrolling SettingsScreen with organized categories
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
  import McpServersCard from './McpServersCard.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import BillingTab from './settings/BillingTab.svelte';
  import AboutTab from './settings/AboutTab.svelte';
  import AiProvidersTab from './settings/AiProvidersTab.svelte';
  import GAgentTab from './settings/GAgentTab.svelte';
  import GeneralTab from './settings/GeneralTab.svelte';
  import GitTab from './settings/GitTab.svelte';
  import IntegrationsTab from './settings/IntegrationsTab.svelte';
  import McpTab from './settings/McpTab.svelte';
  import MemoryTab from './settings/MemoryTab.svelte';
  import MessagingTab from './settings/MessagingTab.svelte';
  import ModelsTab from './settings/ModelsTab.svelte';
  import SecurityTab from './settings/SecurityTab.svelte';
  import StorageTab from './settings/StorageTab.svelte';
  import { Button, Card, Badge, Tabs } from '../lib/design-system';
  import { colors } from '../lib/design-system/tokens/colors';
  import { workspaceStore } from '../stores/workspaceStore';
  import { analyzeArchitecture } from '../stores/featuresStore';
  import { setCurrentView, showPricing, settingsInitialTab } from '../stores/uiStore';

  import { newOnboardingStore } from '../stores/newOnboardingStore';
  import { authGateStore } from '../stores/authGateStore';
  import {
    preferencesStore,
    density,
    includeRagContext,
    gAgentCapabilities,
    gAgentExternalAllowlist,
    gAgentPreferredModelSource,
    gAgentOllamaModel,
    gAgentPersona,
    gAgentAutoApprove,
    gAgentPersistent,
    type GAgentCapabilityKey,
    CAPABILITY_DESCRIPTIONS,
    PREMIUM_CAPABILITIES,
  } from '../stores/preferencesStore';
  import { writable } from 'svelte/store';
  import { getDockerInfo, isDockerSetupAvailable } from '../lib/dockerSetup';

  // Inline wake-word state (previously wakeWordStore, now deleted)
  const WAKE_WORD_KEY = 'g-rump-wake-word-enabled';
  const wakeWordEnabled = writable(false);
  function loadWakeWordEnabled(): boolean {
    try {
      return localStorage.getItem(WAKE_WORD_KEY) === 'true';
    } catch {
      return false;
    }
  }
  function setWakeWordEnabled(v: boolean) {
    wakeWordEnabled.set(v);
    try {
      localStorage.setItem(WAKE_WORD_KEY, String(v));
    } catch {}
  }
  import {
    Settings2,
    Cpu,
    Shield,
    Puzzle,
    CreditCard,
    Info,
    GitBranch,
    Sun,
    Moon,
    Monitor,
    Bot,
    Brain,
    Server,
    Check,
    AlertCircle,
    ExternalLink,
    MessageSquare,
    HardDrive,
  } from 'lucide-svelte';
  import type { AppTheme } from '../stores/newOnboardingStore';
  import { getProviderIconPath, getProviderFallbackLetter } from '../lib/aiProviderIcons.js';
  import { AI_PROVIDER_OPTIONS } from '../stores/newOnboardingStore';

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
    /** When set, open this tab on first render (e.g. 'integrations' when navigating from sidebar). */
    initialTab?: string;
  }

  let { onBack, billingUrl = '#', initialTab }: Props = $props();

  // Tab definitions
  const settingsTabs = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'ai', label: 'AI Providers', icon: Bot },
    { id: 'models', label: 'AI Settings', icon: Cpu },
    { id: 'gagent', label: 'Agent', icon: Bot },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'messaging', label: 'Messaging', icon: MessageSquare },
    { id: 'git', label: 'Git', icon: GitBranch },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'integrations', label: 'Integrations', icon: Puzzle },
    { id: 'mcp', label: 'MCP', icon: Server },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'about', label: 'About', icon: Info },
  ];

  // svelte-ignore state_referenced_locally - initialTab is intentionally used only for initial tab
  let activeTab = $state(
    initialTab && settingsTabs.some((t) => t.id === initialTab) ? initialTab : 'general'
  );

  // State
  let settings = $state<Settings | null>(null);
  let saving = $state(false);
  let allowedDirsText = $state('');
  let tiers = $state<Tier[]>([]);
  let billingMe = $state<BillingMe | null>(null);
  let billingPaymentMethods = $state<{ id: string; brand?: string; last4?: string }[]>([]);
  let billingInvoices = $state<{ id: string; date: string; amount: number; status: string }[]>([]);
  // billingPortalLoading moved to BillingTab sub-component
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
  let isElectron = $state(false);
  let hasWakeWord = $state(false);

  // Messaging settings state
  let messagingEnabled = $state(false);
  let messagingPhoneNumber = $state('');
  let messagingChannel = $state<'sms' | 'whatsapp' | 'both'>('sms');
  let messagingSessionName = $state('G-CompN1 Assistant');
  let messagingSaving = $state(false);

  // Multi-channel messaging
  interface MessagingChannel {
    id: string;
    name: string;
    icon: string;
    configured: boolean;
    webhookUrl: string;
    description: string;
  }
  let messagingChannels = $state<MessagingChannel[]>([]);
  let messagingChannelsLoading = $state(false);
  let messagingSubscriptions = $state<
    Array<{ id: string; platform: string; platform_user_id: string }>
  >([]);
  let newSubPlatform = $state('');
  let newSubUserId = $state('');
  let subscribing = $state(false);

  async function loadMessagingChannels() {
    messagingChannelsLoading = true;
    try {
      const res = await fetchApi('/api/messaging/channels');
      if (res.ok) {
        const data = await res.json();
        messagingChannels = data.channels ?? [];
      }
    } catch {
      /* ignore */
    }
    messagingChannelsLoading = false;
  }

  async function loadMessagingSubscriptions() {
    try {
      const res = await fetchApi('/api/messaging/subscriptions');
      if (res.ok) {
        const data = await res.json();
        messagingSubscriptions = data.subscriptions ?? [];
      }
    } catch {
      /* ignore */
    }
  }

  async function addSubscription() {
    if (!newSubPlatform || !newSubUserId) return;
    subscribing = true;
    try {
      const res = await fetchApi('/api/messaging/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: newSubPlatform, platformUserId: newSubUserId }),
      });
      if (res.ok) {
        showToast(`Subscribed ${newSubPlatform} channel`, 'success');
        newSubPlatform = '';
        newSubUserId = '';
        await loadMessagingSubscriptions();
      } else {
        showToast('Failed to subscribe', 'error');
      }
    } catch {
      showToast('Failed to subscribe', 'error');
    }
    subscribing = false;
  }

  async function removeSubscription(platform: string, platformUserId: string) {
    try {
      const res = await fetchApi('/api/messaging/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, platformUserId }),
      });
      if (res.ok) {
        showToast(`Unsubscribed ${platform}`, 'success');
        await loadMessagingSubscriptions();
      }
    } catch {
      showToast('Failed to unsubscribe', 'error');
    }
  }

  const ACCENT_STORAGE_KEY = 'g-rump-accent';
  const FONT_SIZE_STORAGE_KEY = 'g-rump-font-size';
  const STARTUP_VIEW_KEY = 'g-rump-startup-view';
  const ACCENT_COLORS: Record<string, string> = {
    purple: '#7c3aed',
    blue: '#2563eb',
    green: '#059669',
    amber: '#d97706',
    rose: '#e11d48',
    teal: '#0d9488',
    indigo: '#4f46e5',
    orange: '#ea580c',
    cyan: '#0891b2',
    slate: '#475569',
  };
  const ACCENT_HOVER: Record<string, string> = {
    purple: '#6d28d9',
    blue: '#1d4ed8',
    green: '#047857',
    amber: '#b45309',
    rose: '#be123c',
    teal: '#0f766e',
    indigo: '#4338ca',
    orange: '#c2410c',
    cyan: '#0e7490',
    slate: '#334155',
  };
  const FONT_SCALES: Record<string, string> = { small: '13px', medium: '14px', large: '15px' };
  let accentColor = $state('purple');
  let uiFontSize = $state<'small' | 'medium' | 'large'>('medium');
  let startupView = $state<'chat' | 'projects' | 'last'>('chat');

  function setAccentColor(id: string) {
    accentColor = id;
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    applyAppearance();
  }

  function setUiFontSize(size: 'small' | 'medium' | 'large') {
    uiFontSize = size;
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
    } catch {
      /* ignore */
    }
    applyAppearance();
  }

  function setStartupView(view: 'chat' | 'projects' | 'last') {
    startupView = view;
    try {
      localStorage.setItem(STARTUP_VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }

  function openIntegrationsTab() {
    activeTab = 'integrations';
  }

  function applyAppearance() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.purple;
    const hover = ACCENT_HOVER[accentColor] ?? ACCENT_HOVER.purple;
    root.style.setProperty('--color-primary', accent);
    root.style.setProperty('--color-primary-hover', hover);
    const scale = FONT_SCALES[uiFontSize] ?? FONT_SCALES.medium;
    root.style.setProperty('--app-font-size', scale);
  }

  /** Models list from /api/models/list for provider-first UI */
  interface ModelListItem {
    id: string;
    provider: string;
    capabilities: string[];
    contextWindow: number;
    description?: string;
    isRecommended?: boolean;
  }
  interface ModelListGroup {
    provider: string;
    displayName: string;
    icon: string;
    configured?: boolean;
    configNote?: string;
    models: ModelListItem[];
  }
  let modelGroups = $state<ModelListGroup[]>([]);
  let modelGroupsLoading = $state(false);
  /** Selected provider in AI Providers tab for model picker */
  let selectedProviderInAiTab = $state<string | null>(null);
  /** Inline AI provider config: which provider is being configured */
  let configuringProvider = $state<string | null>(null);
  let configuringApiKey = $state('');
  let configuringTestState = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
  let configuringErrorMessage = $state('');

  function startConfiguringProvider(providerId: string) {
    configuringProvider = providerId;
    configuringApiKey = '';
    configuringTestState = 'idle';
    configuringErrorMessage = '';
  }

  function cancelConfiguringProvider() {
    configuringProvider = null;
    configuringApiKey = '';
    configuringTestState = 'idle';
    configuringErrorMessage = '';
  }

  async function testAndSaveAiProvider() {
    if (!configuringProvider) return;
    const needsKey = configuringProvider !== 'ollama';
    if (needsKey && !configuringApiKey.trim()) {
      configuringTestState = 'error';
      configuringErrorMessage = 'API key is required';
      return;
    }
    configuringTestState = 'testing';
    configuringErrorMessage = '';
    try {
      // For Ollama, test connection to local instance
      if (configuringProvider === 'ollama') {
        try {
          const ollamaRes = await fetchApi('/api/ollama/status');
          const ollamaData = await ollamaRes.json();
          if (!ollamaData.detected) {
            throw new Error('Ollama not detected - make sure Ollama is running');
          }
        } catch (e) {
          configuringTestState = 'error';
          configuringErrorMessage = e instanceof Error ? e.message : 'Cannot connect to Ollama';
          return;
        }
      } else {
        // Simulate API test for other providers; backend may validate in future
        await new Promise((r) => setTimeout(r, 800));
      }

      // Save to onboarding store (localStorage)
      newOnboardingStore.setAiProvider(
        configuringProvider,
        needsKey ? configuringApiKey : undefined
      );

      // Also persist per-provider key to localStorage so ModelPicker can detect it
      if (needsKey && configuringApiKey.trim()) {
        const providerKeyMap: Record<string, string> = {
          anthropic: 'g-rump-anthropic-key',
          google: 'g-rump-google-key',
          openrouter: 'g-rump-openrouter-key',
          'nvidia-nim': 'g-rump-nvidia-nim-key',
        };
        const storageKey = providerKeyMap[configuringProvider];
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, configuringApiKey.trim());
          } catch {
            /* ignore */
          }
        }
      }

      // Also save to backend settings so models API can detect provider
      await settingsStore.save({
        models: {
          defaultProvider: configuringProvider as 'nim' | 'ollama' | 'mock',
        },
      });

      configuringTestState = 'success';
      showToast(
        `${AI_PROVIDER_OPTIONS.find((p) => p.id === configuringProvider)?.name ?? configuringProvider} configured`,
        'success'
      );

      // Refresh models list with user-config overrides
      fetchApi('/api/models/list')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to fetch'))))
        .then((d: { groups?: ModelListGroup[] }) => {
          modelGroups = applyUserConfigOverridesToModelGroups(d.groups ?? []);
        })
        .catch(() => {});
      setTimeout(() => {
        cancelConfiguringProvider();
      }, 1200);
    } catch (e) {
      configuringTestState = 'error';
      configuringErrorMessage = e instanceof Error ? e.message : 'Connection failed';
    }
  }

  const configuringProviderInfo = $derived(
    configuringProvider ? AI_PROVIDER_OPTIONS.find((p) => p.id === configuringProvider) : null
  );

  /**
   * Check user-stored API keys and override configured status on model groups.
   * This ensures that providers configured via the Settings UI (stored in localStorage)
   * show as available even if the backend doesn't have the key in its .env.
   */
  function applyUserConfigOverridesToModelGroups(serverGroups: ModelListGroup[]): ModelListGroup[] {
    const userConfigured = new Set<string>();
    userConfigured.add('grump'); // Always configured
    try {
      const data = newOnboardingStore.get();
      if (data?.aiProvider && data.aiProviderApiKey) {
        userConfigured.add(data.aiProvider);
      }
      const PER_PROVIDER_KEYS: Record<string, string> = {
        anthropic: 'g-rump-anthropic-key',
        google: 'g-rump-google-key',
        openrouter: 'g-rump-openrouter-key',
        'nvidia-nim': 'g-rump-nvidia-nim-key',
      };
      for (const [provider, storageKey] of Object.entries(PER_PROVIDER_KEYS)) {
        try {
          const key = localStorage.getItem(storageKey);
          if (key && key.trim()) userConfigured.add(provider);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    return serverGroups.map((g) => {
      if (g.configured) return g;
      if (userConfigured.has(g.provider)) {
        return { ...g, configured: true, configNote: undefined };
      }
      return g;
    });
  }

  onMount(() => {
    // Clear initial tab after use so next open doesn't default to it
    if (initialTab) settingsInitialTab.set(undefined);
    // Load accent and font size from localStorage and apply
    try {
      const a = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (a && ACCENT_COLORS[a]) accentColor = a;
      const f = localStorage.getItem(FONT_SIZE_STORAGE_KEY) as 'small' | 'medium' | 'large' | null;
      if (f === 'small' || f === 'medium' || f === 'large') uiFontSize = f;
      const sv = localStorage.getItem(STARTUP_VIEW_KEY) as 'chat' | 'projects' | 'last' | null;
      if (sv === 'chat' || sv === 'projects' || sv === 'last') startupView = sv;
      applyAppearance();
    } catch {
      /* ignore */
    }
    // Check Electron features
    if (typeof window !== 'undefined') {
      const grump = (
        window as { grump?: { isElectron?: boolean; wakeWord?: { isSupported?: () => boolean } } }
      ).grump;
      isElectron = grump?.isElectron ?? false;
      hasWakeWord = grump?.wakeWord?.isSupported?.() ?? false;
    }

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
    fetchApi('/api/billing/payment-methods')
      .then((r) => r.json())
      .then((d: { paymentMethods?: { id: string; brand?: string; last4?: string }[] }) => {
        billingPaymentMethods = d.paymentMethods ?? [];
      })
      .catch(() => {
        billingPaymentMethods = [];
      });
    fetchApi('/api/billing/invoices')
      .then((r) => r.json())
      .then((d: { invoices?: { id: string; date: string; amount: number; status: string }[] }) => {
        billingInvoices = d.invoices ?? [];
      })
      .catch(() => {
        billingInvoices = [];
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

    modelGroupsLoading = true;
    fetchApi('/api/models/list')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to fetch models'))))
      .then((d: { groups?: ModelListGroup[] }) => {
        modelGroups = applyUserConfigOverridesToModelGroups(d.groups ?? []);
      })
      .catch(() => {
        // Provide fallback so G-CompN1 is always available
        modelGroups = applyUserConfigOverridesToModelGroups([
          {
            provider: 'grump',
            displayName: 'G-CompN1 Model Mix',
            icon: '/icons/providers/grump.svg',
            models: [
              {
                id: 'g-compn1-auto',
                provider: 'grump',
                capabilities: ['code', 'reasoning', 'vision', 'creative'],
                contextWindow: 200000,
                description: 'Smart routing: Opus 4.6 + Gemini 3 Pro & more',
                isRecommended: true,
              },
            ],
          },
        ]);
      })
      .finally(() => {
        modelGroupsLoading = false;
      });

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

  async function saveMemory(memory: import('../types/settings').MemorySettings) {
    saving = true;
    const ok = await settingsStore.save({ memory });
    saving = false;
    if (ok) showToast('Memory settings saved', 'success');
    else showToast('Failed to save memory settings', 'error');
  }

  async function saveGit(git: import('../types/settings').GitSettings) {
    saving = true;
    const ok = await settingsStore.save({ git });
    saving = false;
    if (ok) showToast('Git settings saved', 'success');
    else showToast('Failed to save git settings', 'error');
  }

  async function saveMcp(mcp: import('../types/settings').McpSettings) {
    saving = true;
    const ok = await settingsStore.save({ mcp });
    saving = false;
    if (ok) showToast('MCP settings saved', 'success');
    else showToast('Failed to save MCP settings', 'error');
  }

  async function savePreferences(next: import('../types/settings').SettingsPreferences) {
    saving = true;
    const ok = await settingsStore.save({
      preferences: { ...settings?.preferences, ...next },
    });
    saving = false;
    if (ok) showToast('Preferences saved', 'success');
    else showToast('Failed to save preferences', 'error');
  }

  // handleBillingPortalClick and formatCredits moved to BillingTab sub-component

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

  <div class="settings-body">
    <div class="tabs-sidebar">
      <Tabs tabs={settingsTabs} bind:activeTab variant="pills" size="md" />
    </div>

    <div class="tab-content">
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <!-- GENERAL TAB -->
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      {#if activeTab === 'general'}
        <GeneralTab
          {accentColor}
          {density}
          {hasWakeWord}
          {newOnboardingStore}
          {preferencesStore}
          {saveAccessibility}
          {savePreferences}
          {setAccentColor}
          {setStartupView}
          {setUiFontSize}
          {setWakeWordEnabled}
          {settings}
          {startupView}
          {uiFontSize}
          {wakeWordEnabled}
        />

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- AI PROVIDERS TAB (provider grid + model picker, connect providers) -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'ai'}
        <AiProvidersTab
          {AI_PROVIDER_OPTIONS}
          {cancelConfiguringProvider}
          {configuringApiKey}
          {configuringErrorMessage}
          {configuringProvider}
          {configuringProviderInfo}
          {configuringTestState}
          {getProviderFallbackLetter}
          {getProviderIconPath}
          {modelGroups}
          {modelGroupsLoading}
          {openIntegrationsTab}
          {preferencesStore}
          {saveModels}
          {saving}
          {selectedProviderInAiTab}
          {settings}
          {startConfiguringProvider}
          {testAndSaveAiProvider}
        />

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- AGENT TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'gagent'}
        <GAgentTab
          {CAPABILITY_DESCRIPTIONS}
          {PREMIUM_CAPABILITIES}
          {gAgentAutoApprove}
          {gAgentCapabilities}
          {gAgentExternalAllowlist}
          {gAgentOllamaModel}
          {gAgentPersistent}
          {gAgentPersona}
          {gAgentPreferredModelSource}
          {preferencesStore}
          {settings}
          {savePreferences}
        />

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- MEMORY TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'memory'}
        <MemoryTab {saveGuardRails} {saveMemory} {setCurrentView} {settings} />

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- MESSAGING TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'messaging'}
        <MessagingTab
          {addSubscription}
          {loadMessagingChannels}
          {loadMessagingSubscriptions}
          {messagingChannels}
          {messagingChannelsLoading}
          {messagingEnabled}
          {messagingPhoneNumber}
          {messagingSaving}
          {messagingSessionName}
          {messagingSubscriptions}
          {newSubPlatform}
          {newSubUserId}
          {removeSubscription}
          {settings}
          {showToast}
          {subscribing}
        />

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- MODELS TAB (redesigned: preset + model, embedding compact, custom collapsible) -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'models'}
        <ModelsTab
          {addCustomModel}
          {customModelDraft}
          {modelGroups}
          {modelGroupsLoading}
          {modelValue}
          {removeCustomModel}
          {saveCustomModel}
          {saveModels}
          {saving}
          {settings}
          {showCustomModelForm}
        />

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- GIT TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'git'}
        <GitTab
          {gAgentCapabilities}
          {preferencesStore}
          {saveGit}
          {setCurrentView}
          {settings}
          {workspaceRoot}
          {workspaceStore}
        />

        <!-- SECURITY TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'security'}
        <SecurityTab
          {allowedDirsText}
          {isElectron}
          {parseAllowedDirs}
          {preferencesStore}
          {saveGuardRails}
          {saving}
          {settings}
        />

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- STORAGE TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'storage'}
        <StorageTab />

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- INTEGRATIONS TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'integrations'}
        <IntegrationsTab
          {analyzingArchitecture}
          {architectureDiagram}
          {architectureSummary}
          {handleAnalyzeArchitectureClick}
          {setCurrentView}
        />

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- MCP TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'mcp'}
        <McpTab {saveMcp} {settings} />

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- BILLING TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'billing'}
        <BillingTab
          {billingMe}
          {tiers}
          {billingPaymentMethods}
          {billingInvoices}
          {billingUrl}
          {settings}
          {savePreferences}
        />

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- ABOUT TAB -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
      {:else if activeTab === 'about'}
        <AboutTab {isElectron} appVersion={__APP_VERSION__} />
      {/if}
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
    background-color: var(--color-bg-card);
    border-bottom: 1px solid var(--border-color, #e4e4e7);
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
    color: var(--color-text);
  }

  .settings-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .tabs-sidebar {
    width: 220px;
    padding: 24px 16px;
    background: var(--color-bg-secondary);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
  }

  .tabs-sidebar :global(.tabs-container) {
    flex-direction: column;
  }

  .tabs-sidebar :global(.tabs-list) {
    flex-direction: column;
    gap: 4px;
  }

  .tabs-sidebar :global(.tab) {
    justify-content: flex-start;
    text-align: left;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-muted);
    transition:
      background 0.15s,
      color 0.15s;
  }

  .tabs-sidebar :global(.tab:hover) {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
  }

  .tabs-sidebar :global(.tab.active) {
    background: var(--color-bg-card);
    color: var(--color-text);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    border: 1px solid var(--color-border);
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px;
    background: var(--color-bg-card);
  }

  @keyframes ai-config-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
