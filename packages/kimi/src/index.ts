/**
 * @grump/kimi – Kimi/NIM vision and swarm types.
 * Implementation in backend (kimiVisionService, swarmService).
 */

export type DesignToCodeFramework = 'svelte' | 'react' | 'vue' | 'flutter';

export interface DesignToCodeInput {
  image?: string | Buffer;
  figmaUrl?: string;
  description: string;
  targetFramework: DesignToCodeFramework;
}

export interface DesignToCodeResult {
  code: string;
  explanation?: string;
}

export const SWARM_AGENT_IDS = [
  'arch', 'frontend', 'backend', 'devops', 'test', 'docs',
  'ux', 'security', 'perf', 'a11y', 'data', 'review',
] as const;
