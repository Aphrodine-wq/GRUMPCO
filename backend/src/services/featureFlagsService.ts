/**
 * Feature Flags and Tier Resolution
 * Resolves user/tier to capability flags for prompts, tools, and routes.
 * Tier can come from env (TIER_DEFAULT), from settings, or from a future billing API.
 */

export type TierId = 'free' | 'pro' | 'team' | 'enterprise';

export interface FeatureFlags {
  has_design: boolean;
  has_plan: boolean;
  has_spec: boolean;
  has_argument: boolean;
  has_code: boolean;
  has_ship: boolean;
  has_codegen: boolean;
  has_mcp_browser: boolean;
  has_github: boolean;
}

/** Which capabilities each tier gets. Free = core chat/design; pro+ = ship, codegen, mcp; etc. */
const TIER_FLAGS: Record<TierId, FeatureFlags> = {
  free: {
    has_design: true,
    has_plan: true,
    has_spec: true,
    has_argument: true,
    has_code: true,
    has_ship: false,
    has_codegen: false,
    has_mcp_browser: false,
    has_github: false,
  },
  pro: {
    has_design: true,
    has_plan: true,
    has_spec: true,
    has_argument: true,
    has_code: true,
    has_ship: true,
    has_codegen: true,
    has_mcp_browser: true,
    has_github: true,
  },
  team: {
    has_design: true,
    has_plan: true,
    has_spec: true,
    has_argument: true,
    has_code: true,
    has_ship: true,
    has_codegen: true,
    has_mcp_browser: true,
    has_github: true,
  },
  enterprise: {
    has_design: true,
    has_plan: true,
    has_spec: true,
    has_argument: true,
    has_code: true,
    has_ship: true,
    has_codegen: true,
    has_mcp_browser: true,
    has_github: true,
  },
};

function parseTier(s: string | undefined): TierId {
  if (s === 'pro' || s === 'team' || s === 'enterprise') return s;
  return 'free';
}

/**
 * Resolve tier for a user/key. Uses TIER_DEFAULT when set; otherwise free.
 * When backend-web/billing is wired, lookup by userKey can be added (billing API or settings).
 */
export function getTierForUser(_userKey?: string): TierId {
  const fromEnv = process.env.TIER_DEFAULT;
  if (fromEnv) return parseTier(fromEnv);
  return 'free';
}

/**
 * Return feature flags for a given tier.
 */
export function getFeatureFlagsForTier(tier: TierId): FeatureFlags {
  return { ...(TIER_FLAGS[tier] ?? TIER_FLAGS.free) };
}

/**
 * Resolve feature flags for a user (tier + overrides). Use when building prompts or deciding routes/tools.
 */
export function getFeatureFlags(userKey?: string, tierOverride?: TierId): FeatureFlags {
  const tier = tierOverride ?? getTierForUser(userKey);
  return getFeatureFlagsForTier(tier);
}

/**
 * Short capability list string for prompts: only enabled capabilities, one line per item.
 */
export function formatCapabilityListForPrompt(flags: FeatureFlags): string {
  const list: string[] = [];
  if (flags.has_design) list.push('Design (intent, architecture, Mermaid)');
  if (flags.has_plan) list.push('Plan (generate and execute plans)');
  if (flags.has_spec) list.push('Spec (Q&A spec generation)');
  if (flags.has_argument) list.push('Argument (discuss, then implement on confirmation)');
  if (flags.has_code) list.push('Code (implement with file/bash tools)');
  if (flags.has_ship) list.push('SHIP (design→spec→plan→code pipeline)');
  if (flags.has_codegen) list.push('Codegen (multi-agent code generation)');
  if (flags.has_mcp_browser) list.push('MCP/browser tools');
  if (flags.has_github) list.push('GitHub (create repo, push)');
  return list.length
    ? list.map((l) => `- ${l}`).join('\n')
    : '- Design, Plan, Spec, Argument, Code (basic)';
}
