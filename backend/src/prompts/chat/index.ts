/**
 * Chat mode prompt router.
 * Returns the mode-specific prompt for a given chat mode.
 * Used by both the chat stream and SHIP phases.
 */

import { getDesignModePrompt } from './design.js';
import { getCodeModePrompt, type CodeSpecialist } from './code.js';
import { getPlanModePrompt } from './plan.js';
import { getSpecModePrompt } from './spec.js';
import { getArgumentModePrompt } from './argument.js';
import { getGAgentModePrompt, type GAgentPromptOptions } from './gAgent.js';

export type ChatModeName =
  | 'design'
  | 'normal'
  | 'code'
  | 'plan'
  | 'spec'
  | 'argument'
  | 'execute'
  | 'gAgent';

export interface ChatModePromptOptions {
  workspaceRoot?: string;
  specialist?: CodeSpecialist;
  // G-Agent specific options
  enabledCapabilities?: string[];
  allowlistDomains?: string[];
  runInDocker?: boolean;
  activePlanId?: string;
  riskTolerance?: 'low' | 'medium' | 'high';
}

/**
 * Returns the mode-specific prompt for the given mode.
 * 'normal' and 'execute' both use the Code mode prompt (tools, implementation).
 * 'gAgent' uses the G-Agent mode prompt (autonomous agent with planning).
 */
export function getChatModePrompt(mode: ChatModeName, opts?: ChatModePromptOptions): string {
  switch (mode) {
    case 'design':
      return getDesignModePrompt({ workspaceRoot: opts?.workspaceRoot });
    case 'plan':
      return getPlanModePrompt();
    case 'spec':
      return getSpecModePrompt();
    case 'argument':
      return getArgumentModePrompt();
    case 'gAgent':
    case 'freeAgent' as ChatModeName: // backward compat: accept legacy sessionType
      return getGAgentModePrompt({
        workspaceRoot: opts?.workspaceRoot,
        specialist: opts?.specialist,
        enabledCapabilities: opts?.enabledCapabilities,
        allowlistDomains: opts?.allowlistDomains,
        runInDocker: opts?.runInDocker,
        activePlanId: opts?.activePlanId,
        riskTolerance: opts?.riskTolerance,
      } as GAgentPromptOptions);
    case 'normal':
    case 'code':
    case 'execute':
    default:
      return getCodeModePrompt({
        workspaceRoot: opts?.workspaceRoot,
        specialist: opts?.specialist,
      });
  }
}

export { getDesignModePrompt } from './design.js';
export { getCodeModePrompt } from './code.js';
export { getGAgentModePrompt } from './gAgent.js';
export { getPlanModePrompt } from './plan.js';
export { getSpecModePrompt } from './spec.js';
export { getArgumentModePrompt } from './argument.js';
export type { CodeSpecialist } from './code.js';
export type { GAgentPromptOptions } from './gAgent.js';
