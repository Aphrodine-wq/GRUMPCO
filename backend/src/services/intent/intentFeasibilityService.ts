/**
 * Intent Feasibility Service
 * Verifies that parsed intent can actually be executed before passing to agents.
 * Maps intent features to G-Agent capabilities, checks constraint satisfiability.
 */

import type { EnrichedIntent } from './intentCompilerService.js';
import type { GAgentCapabilityKey } from '../../types/settings.js';
import { getToolsForCapability } from '../../config/gAgentTools.js';

export interface FeasibilityResult {
  feasible: boolean;
  supportedFeatures: string[];
  unsupportedFeatures: Array<{ feature: string; reason: string }>;
  constraintWarnings: string[];
  actionableFeedback: string;
  requiredCapabilities: GAgentCapabilityKey[];
}

const FEATURE_TO_CAPABILITY: Record<string, GAgentCapabilityKey[]> = {
  auth: ['file', 'bash', 'database'],
  authentication: ['file', 'bash', 'database'],
  api: ['file', 'bash', 'api_call'],
  rest: ['file', 'bash', 'api_call'],
  graphql: ['file', 'bash', 'api_call'],
  database: ['file', 'bash', 'database'],
  postgresql: ['file', 'bash', 'database'],
  mysql: ['file', 'bash', 'database'],
  mongodb: ['file', 'bash', 'database'],
  docker: ['docker', 'bash'],
  kubernetes: ['cloud', 'cicd'],
  k8s: ['cloud', 'cicd'],
  deploy: ['docker', 'cloud', 'cicd'],
  ci: ['cicd'],
  'ci/cd': ['cicd'],
  cicd: ['cicd'],
  testing: ['file', 'bash'],
  tests: ['file', 'bash'],
  frontend: ['file', 'bash', 'npm'],
  backend: ['file', 'bash', 'npm'],
  react: ['file', 'bash', 'npm'],
  vue: ['file', 'bash', 'npm'],
  svelte: ['file', 'bash', 'npm'],
  typescript: ['file', 'bash', 'npm'],
  python: ['file', 'bash'],
  rust: ['file', 'bash'],
  go: ['file', 'bash'],
  websocket: ['file', 'bash', 'api_call'],
  realtime: ['file', 'bash', 'api_call'],
  websockets: ['file', 'bash', 'api_call'],
};

const KNOWN_UNSUPPORTED = new Set([
  'hardware',
  'iot',
  'blockchain',
  'cryptocurrency',
  'crypto',
  'mobile-app',
  'ios',
  'android',
  'native-mobile',
  'embedded',
  'kernel',
  'driver',
]);

const SUPPORTED_DATABASES = new Set([
  'postgresql',
  'postgres',
  'mysql',
  'mongodb',
  'sqlite',
  'redis',
]);
const SUPPORTED_RUNTIMES = new Set(['node', 'nodejs', 'python', 'go', 'rust', 'bun']);

/**
 * Verify intent can be executed with the given capabilities.
 */
export function verifyIntentFeasibility(
  intent: EnrichedIntent,
  availableCapabilities: GAgentCapabilityKey[],
  userTier = 'free'
): FeasibilityResult {
  const supportedFeatures: string[] = [];
  const unsupportedFeatures: Array<{ feature: string; reason: string }> = [];
  const constraintWarnings: string[] = [];
  const requiredCapabilities = new Set<GAgentCapabilityKey>();

  const allFeatures = [
    ...(intent.features ?? []),
    ...(intent.enriched?.features ?? []),
    ...(intent.tech_stack_hints ?? []),
    ...(intent.enriched?.tech_stack ?? []),
  ];
  const uniqueFeatures = [
    ...new Set(allFeatures.map((f) => f.toLowerCase().trim()).filter(Boolean)),
  ];

  for (const f of uniqueFeatures) {
    if (KNOWN_UNSUPPORTED.has(f)) {
      unsupportedFeatures.push({
        feature: f,
        reason: `"${f}" is not supported by G-Agent. Consider manual implementation or different scope.`,
      });
      continue;
    }

    const caps = FEATURE_TO_CAPABILITY[f];
    if (!caps) {
      supportedFeatures.push(f);
      requiredCapabilities.add('file');
      requiredCapabilities.add('bash');
      continue;
    }

    const missing = caps.filter((c) => !availableCapabilities.includes(c));
    const tierBlocked = caps.filter((c) => {
      const tools = getToolsForCapability(c, userTier);
      return tools.length === 0;
    });

    if (missing.length > 0) {
      unsupportedFeatures.push({
        feature: f,
        reason: `Requires capabilities not enabled: ${missing.join(', ')}. Enable these in G-Agent settings.`,
      });
    } else if (tierBlocked.length > 0) {
      unsupportedFeatures.push({
        feature: f,
        reason: `Requires ${tierBlocked.join(', ')} (upgrade to PRO or TEAM tier).`,
      });
    } else {
      supportedFeatures.push(f);
      caps.forEach((c) => requiredCapabilities.add(c));
    }
  }

  const constraints = intent.constraints ?? intent.enriched?.code_quality_requirements;
  if (constraints && typeof constraints === 'object') {
    const dbConstraint =
      (constraints as Record<string, unknown>).database ??
      (constraints as Record<string, unknown>).db;
    if (typeof dbConstraint === 'string') {
      const db = String(dbConstraint).toLowerCase();
      if (!SUPPORTED_DATABASES.has(db)) {
        constraintWarnings.push(
          `Database "${db}" may not have first-class support. We support PostgreSQL, MySQL, MongoDB, SQLite, Redis.`
        );
      }
    }
  }

  const techHints = [...(intent.tech_stack_hints ?? []), ...(intent.enriched?.tech_stack ?? [])];
  for (const t of techHints) {
    const tl = t.toLowerCase();
    if (tl.includes('kubernetes') || tl.includes('k8s')) {
      if (!availableCapabilities.includes('cloud')) {
        constraintWarnings.push('Kubernetes deployment requires cloud capability (PRO+ tier).');
      }
    }
  }

  let actionableFeedback = '';
  if (unsupportedFeatures.length > 0) {
    actionableFeedback = `We can build: ${supportedFeatures.join(', ') || 'core features'}. `;
    actionableFeedback += `The following would require manual setup or capability changes: ${unsupportedFeatures.map((u) => u.feature).join(', ')}.`;
  } else if (constraintWarnings.length > 0) {
    actionableFeedback = `We can proceed. Note: ${constraintWarnings.join(' ')}`;
  } else if (supportedFeatures.length > 0) {
    actionableFeedback = `All requested features are feasible. We can build: ${supportedFeatures.join(', ')}.`;
  }

  return {
    feasible: unsupportedFeatures.length === 0,
    supportedFeatures,
    unsupportedFeatures,
    constraintWarnings,
    actionableFeedback: actionableFeedback || 'Intent appears feasible.',
    requiredCapabilities: [...requiredCapabilities],
  };
}
