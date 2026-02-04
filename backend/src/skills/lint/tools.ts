/**
 * Lint Skill - Tool Definitions
 */

import type { SkillContext, ToolExecutionResult } from "../types.js";

/** Generic tool definition compatible with LLM gateway */
export interface LintTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export const lintFileTool: LintTool = {
  name: "lint_file",
  description:
    "Lint a file to identify and fix issues. Analyzes code and provides actionable feedback.",
  input_schema: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Path to the file to lint (relative to workspace root)",
      },
      fix: {
        type: "boolean",
        description: "Automatically fix linting issues if possible",
        default: false,
      },
    },
    required: ["filePath"],
  },
};

export const definitions: LintTool[] = [lintFileTool];

// Tool handlers will be implemented in the skill's index.ts
export const handlers: Record<
  string,
  (
    input: Record<string, unknown>,
    context: SkillContext,
  ) => Promise<ToolExecutionResult>
> = {};
