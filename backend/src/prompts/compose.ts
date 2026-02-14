/**
 * XML-structured prompt composition for token reduction and clearer parsing.
 * Tags: <identity>, <rules>, <capabilities>, <environment>, <context>, <task>, <tools>.
 */

import os from 'os';

import { CLAUDE_CODE_QUALITY_BLOCK } from './shared/claude-code-quality.js';
import { TOOL_USAGE_GUIDE } from './shared/tool-usage-guide.js';
import {
  getFeatureFlags,
  formatCapabilityListForPrompt,
  type TierId,
} from '../services/platform/featureFlagsService.js';

export interface ComposeHeadOptions {
  tier?: TierId;
  userKey?: string;
  /** When true, include <capabilities> from feature flags. Default true. */
  includeCapabilities?: boolean;
  /** Workspace root directory — injected into <environment> for OS-aware commands. */
  workspaceRoot?: string;
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
- If requirements are ambiguous, ask numbered clarifying questions with multiple-choice options in parentheses, e.g. "1. Question? (Option A, Option B, or Option C)". Never ask open-ended questions.
- Response formatting defaults to plain text paragraphs and simple bullets.
- Do not use markdown headings (#, ##, ###) or bold markers (**) unless the user explicitly asks for markdown formatting.
- ALWAYS use tools (file_write, file_edit, bash_execute) to create and modify code. Never output code only in text — create real files. When tools are unavailable or fail, output the code in markdown code blocks. Never respond to a code request with only explanation and no code.
- When creating files, use file_write with the complete file content. When editing, use file_edit for targeted changes.
- After making code changes, verify correctness by running builds or tests when possible.
- When generating Mermaid diagrams: max 12 nodes, max 3 subgraphs, short 2-3 word labels, no classDef/style directives, prefer flowchart TD layout. Diagrams render in a ~600px panel.
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
 * Environment block: OS, shell, and workspace root.
 * Essential so the AI uses correct platform commands (cmd/PowerShell on Windows, bash on Unix).
 */
function environmentBlock(workspaceRoot?: string): string {
  const platform = os.platform(); // 'win32', 'darwin', 'linux'
  const osName = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux';
  const shell = platform === 'win32' ? 'cmd.exe / PowerShell' : 'bash / zsh';
  const homedir = os.homedir();
  const wsLine = workspaceRoot
    ? `- Workspace root: ${workspaceRoot}`
    : `- No workspace root set (default: ${process.cwd()})`;
  return `<environment>
- Operating System: ${osName} (${platform})
- Shell: ${shell}
- Home directory: ${homedir}
${wsLine}
- IMPORTANT: Use OS-appropriate commands.${platform === 'win32' ? " Use 'dir' instead of 'ls', 'type' instead of 'cat', Windows-style paths (C:\\...) instead of Unix paths (/home/...). 'find' on Windows is NOT the Unix find command — use 'dir /s /b' or 'Get-ChildItem -Recurse' in PowerShell instead." : ''}
</environment>`;
}

/**
 * Compose the head system prompt as XML-tagged blocks for token efficiency.
 * Used as the canonical head before mode-specific prompt.
 */
export function composeHead(opts?: ComposeHeadOptions): string {
  const includeCapabilities = opts?.includeCapabilities !== false;
  const parts: string[] = [
    'You are G-Rump, an AI coding assistant that helps users go from idea to code. You follow Claude Code quality standards and work in structured modes.',
    identityBlock(),
    environmentBlock(opts?.workspaceRoot),
    rulesBlock(),
    TOOL_USAGE_GUIDE,
  ];
  if (includeCapabilities) {
    parts.push(capabilitiesBlock(opts?.tier, opts?.userKey));
  }
  return parts.join('\n\n');
}

/**
 * Wrap mode-specific content in <mode_context> for dynamic sections.
 */
export function wrapModeContext(content: string): string {
  return `<mode_context>\n${content.trim()}\n</mode_context>`;
}
