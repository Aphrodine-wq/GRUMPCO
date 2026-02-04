/**
 * View Registry – data-driven view definitions for App.svelte
 *
 * Each entry maps a ViewType to its lazy-loaded component, loading label,
 * and back-navigation target.  App.svelte iterates this registry instead
 * of maintaining a massive if/else chain.
 */

import type { ViewType } from '../stores/uiStore';

/** Lazy-loaded view: components receive onBack and optional extraProps from LazyView */
export interface ViewDefinition {
  loader: () => Promise<{ default: import('svelte').Component }>;
  /** Text shown in the spinner while loading */
  loadingLabel: string;
  /** View to navigate to when the user clicks "Back" */
  backTo: ViewType;
  /** Extra props forwarded to the component (besides onBack) */
  extraProps?: Record<string, unknown>;
}

/**
 * Registry of all lazy-loaded views.
 * Views NOT listed here (chat, onboarding, auth gate, setup) are handled
 * inline in App.svelte because they have special rendering logic.
 */
export const VIEW_REGISTRY = {
  // ── Core AI screens ────────────────────────────────────────────────────
  askDocs: {
    loader: () => import('../components/AskDocsScreen.svelte'),
    loadingLabel: 'Loading Ask docs…',
    backTo: 'chat',
  },
  voiceCode: {
    loader: () => import('../components/VoiceCodeScreen.svelte'),
    loadingLabel: 'Loading Voice code…',
    backTo: 'chat',
  },
  talkMode: {
    loader: () => import('../components/TalkModeScreen.svelte'),
    loadingLabel: 'Loading Talk Mode…',
    backTo: 'chat',
  },
  canvas: {
    loader: () => import('../components/LiveCanvas.svelte'),
    loadingLabel: 'Loading Canvas…',
    backTo: 'chat',
  },
  skills: {
    loader: () => import('../components/SkillsScreen.svelte'),
    loadingLabel: 'Loading Skills…',
    backTo: 'chat',
  },
  swarm: {
    loader: () => import('../components/AgentSwarmVisualizer.svelte'),
    loadingLabel: 'Loading Agent swarm…',
    backTo: 'chat',
  },
  designToCode: {
    loader: () => import('../components/DesignToCodeScreen.svelte'),
    loadingLabel: 'Loading Design to code…',
    backTo: 'chat',
  },
  // G-Agent: Both 'freeAgent' and 'gAgent' route to the same consolidated screen
  freeAgent: {
    loader: () => import('../components/GAgentScreen.svelte'),
    loadingLabel: 'Loading G-Agent…',
    backTo: 'chat',
  },
  gAgent: {
    loader: () => import('../components/GAgentScreen.svelte'),
    loadingLabel: 'Loading G-Agent…',
    backTo: 'chat',
  },
  advancedAI: {
    loader: () => import('../components/AdvancedAIDashboard.svelte'),
    loadingLabel: 'Loading Advanced AI…',
    backTo: 'chat',
  },

  // ── Cost & Billing ─────────────────────────────────────────────────────
  cost: {
    loader: () => import('../components/LazyCostDashboard.svelte'),
    loadingLabel: 'Loading Cost dashboard…',
    backTo: 'chat',
  },

  // ── Integrations & Platform ────────────────────────────────────────────
  integrations: {
    loader: () => import('../components/IntegrationsHub.svelte'),
    loadingLabel: 'Loading Integrations…',
    backTo: 'chat',
  },
  approvals: {
    loader: () => import('../components/ApprovalsCenter.svelte'),
    loadingLabel: 'Loading Approvals…',
    backTo: 'chat',
  },
  heartbeats: {
    loader: () => import('../components/HeartbeatsManager.svelte'),
    loadingLabel: 'Loading Scheduled tasks…',
    backTo: 'chat',
  },
  memory: {
    loader: () => import('../components/MemoryManager.svelte'),
    loadingLabel: 'Loading Memory bank…',
    backTo: 'chat',
  },
  auditLog: {
    loader: () => import('../components/AuditLogViewer.svelte'),
    loadingLabel: 'Loading Audit log…',
    backTo: 'chat',
  },

  // ── Infrastructure ─────────────────────────────────────────────────────
  docker: {
    loader: () => import('../components/DockerPanel.svelte'),
    loadingLabel: 'Loading Docker…',
    backTo: 'chat',
  },
  'docker-setup': {
    loader: () => import('../components/DockerSetupWizard.svelte'),
    loadingLabel: 'Loading Docker setup…',
    backTo: 'settings',
  },
  cloud: {
    loader: () => import('../components/CloudDashboard.svelte'),
    loadingLabel: 'Loading Cloud…',
    backTo: 'chat',
  },

  // ── Settings sub-screens ───────────────────────────────────────────────
  'model-benchmark': {
    loader: () => import('../components/ModelBenchmark.svelte'),
    loadingLabel: 'Loading Model benchmark…',
    backTo: 'settings',
  },
  troubleshooting: {
    loader: () => import('../components/TroubleshootingWizard.svelte'),
    loadingLabel: 'Loading Troubleshooting…',
    backTo: 'settings',
  },
  reset: {
    loader: () => import('../components/ResetSettings.svelte'),
    loadingLabel: 'Loading Reset settings…',
    backTo: 'settings',
  },
} as Partial<Record<ViewType, ViewDefinition>>;
