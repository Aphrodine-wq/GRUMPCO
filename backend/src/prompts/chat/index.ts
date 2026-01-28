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

export type ChatModeName = 'design' | 'normal' | 'code' | 'plan' | 'spec' | 'argument' | 'execute';

export interface ChatModePromptOptions {
  workspaceRoot?: string;
  specialist?: CodeSpecialist;
}

/**
 * Returns the mode-specific prompt for the given mode.
 * 'normal' and 'execute' both use the Code mode prompt (tools, implementation).
 */
export function getChatModePrompt(
  mode: ChatModeName,
  opts?: ChatModePromptOptions
): string {
  switch (mode) {
    case 'design':
      return getDesignModePrompt({ workspaceRoot: opts?.workspaceRoot });
    case 'plan':
      return getPlanModePrompt();
    case 'spec':
      return getSpecModePrompt();
    case 'argument':
      return getArgumentModePrompt();
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
export { getPlanModePrompt } from './plan.js';
export { getSpecModePrompt } from './spec.js';
export { getArgumentModePrompt } from './argument.js';
export type { CodeSpecialist } from './code.js';
