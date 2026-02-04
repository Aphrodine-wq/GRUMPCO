/**
 * XML-structured prompt composition for token reduction and clearer parsing.
 * Tags: <identity>, <rules>, <capabilities>, <context>, <task>, <tools>.
 */

import { CLAUDE_CODE_QUALITY_BLOCK } from "./shared/claude-code-quality.js";
import {
  getFeatureFlags,
  formatCapabilityListForPrompt,
  type TierId,
} from "../services/featureFlagsService.js";

export interface ComposeHeadOptions {
  tier?: TierId;
  userKey?: string;
  /** When true, include <capabilities> from feature flags. Default true. */
  includeCapabilities?: boolean;
}

function identityBlock(): string {
  return `<identity>
- Name: G-Rump
- Role: Software architect and implementation partner. You understand intent, produce clear diagrams and specs, and write production-ready code.
- Tone: Clear, concise, constructive. Prefer small steps and explicit confirmation when stakes are high.
</identity>`;
}

function rulesBlock(): string {
  return `<rules>
- Prefer small, focused edits over large rewrites.
- When using tools, paths are relative to the workspace root.
- Explain briefly what you did after tool use.
- If the request is ambiguous, ask one short clarifying question or pick a sensible default and say so.
${CLAUDE_CODE_QUALITY_BLOCK.trim()}
</rules>`;
}

function capabilitiesBlock(tier?: TierId, userKey?: string): string {
  const flags = getFeatureFlags(userKey, tier);
  const list = formatCapabilityListForPrompt(flags);
  return `<capabilities>
You can use: Design (intent, architecture, Mermaid), Plan, Spec, Argument, Code (tools). Available in this session:
${list}
</capabilities>`;
}

/**
 * Compose the head system prompt as XML-tagged blocks for token efficiency.
 * Used as the canonical head before mode-specific prompt.
 */
export function composeHead(opts?: ComposeHeadOptions): string {
  const includeCapabilities = opts?.includeCapabilities !== false;
  const parts: string[] = [
    "You are G-Rump, an AI coding assistant that helps users go from idea to code. You follow Claude Code quality standards and work in structured modes.",
    identityBlock(),
    rulesBlock(),
  ];
  if (includeCapabilities) {
    parts.push(capabilitiesBlock(opts?.tier, opts?.userKey));
  }
  return parts.join("\n\n");
}

/**
 * Wrap mode-specific content in <mode_context> for dynamic sections.
 */
export function wrapModeContext(content: string): string {
  return `<mode_context>\n${content.trim()}\n</mode_context>`;
}
