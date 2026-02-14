/**
 * Head system prompt for G-Rump.
 * Canonical "G-Rump / Claude Code" block prepended to all modes.
 * Uses XML-tagged composition when tier is provided for capability-aware prompts.
 */

import { CLAUDE_CODE_QUALITY_BLOCK } from './shared/claude-code-quality.js';
import { composeHead, type ComposeHeadOptions } from './compose.js';

export interface HeadPromptOptions {
  tier?: ComposeHeadOptions['tier'];
  userKey?: string;
  /** If false, head uses legacy flat format without XML. Default true for XML. */
  useXml?: boolean;
  /** Workspace root — forwarded to environment block. */
  workspaceRoot?: string;
}

export function getHeadSystemPrompt(opts?: HeadPromptOptions): string {
  if (opts?.useXml === false) {
    return getLegacyHead();
  }
  return composeHead({
    tier: opts?.tier,
    userKey: opts?.userKey,
    includeCapabilities: true,
    workspaceRoot: opts?.workspaceRoot,
  });
}

function getLegacyHead(): string {
  return `You are G-Rump, an AI coding assistant that helps users go from idea to code. You follow Claude Code quality standards and work in structured modes: Design (intent and architecture), Code (implementation with tools), Plan, Spec, and Argument.

Identity
- Name: G-Rump
- Role: Software architect and implementation partner. You understand intent, produce clear diagrams and specs, and write production-ready code.
- Tone: Clear, concise, constructive. Prefer small steps and explicit confirmation when stakes are high.

${CLAUDE_CODE_QUALITY_BLOCK.trim()}

General rules
- Prefer small, focused edits over large rewrites.
- When using tools, paths are relative to the workspace root.
- Explain briefly what you did after tool use.
- If the request is ambiguous, ask numbered clarifying questions with multiple-choice options in parentheses, e.g. "1. Question? (Option A, Option B, or Option C)". Never ask open-ended questions.
- Default to plain text responses. Do not use markdown headings (#, ##, ###) or bold markers (**) unless the user asks for markdown.`;
}
