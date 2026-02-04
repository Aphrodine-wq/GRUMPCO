/**
 * Skill management tool definitions
 */

import { z } from "zod";
import type { Tool } from "../types.js";

// ============================================================================
// SKILL CREATE TOOL
// ============================================================================

export const skillCreateInputSchema = z.object({
  name: z.string().describe("Unique skill name"),
  description: z.string().describe("Skill description"),
  tools: z.array(z.record(z.unknown())).optional().default([]),
  prompts: z.record(z.string()).optional().default({}),
});

export const skillCreateTool: Tool = {
  name: "skill_create",
  description: "Create a new user skill.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Skill name" },
      description: { type: "string", description: "Skill description" },
      tools: { type: "array", description: "Tool definitions" },
      prompts: { type: "object", description: "System prompts" },
    },
    required: ["name", "description"],
  },
};

// ============================================================================
// SKILL EDIT TOOL
// ============================================================================

export const skillEditInputSchema = z.object({
  skillId: z.string().describe("Skill ID"),
  updates: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    tools: z.array(z.record(z.unknown())).optional(),
    prompts: z.record(z.string()).optional(),
  }),
});

export const skillEditTool: Tool = {
  name: "skill_edit",
  description: "Edit an existing skill.",
  input_schema: {
    type: "object",
    properties: {
      skillId: { type: "string", description: "Skill ID" },
      updates: { type: "object", description: "Fields to update" },
    },
    required: ["skillId", "updates"],
  },
};

// ============================================================================
// SKILL RUN TEST TOOL
// ============================================================================

export const skillRunTestInputSchema = z.object({
  skillId: z.string().describe("Skill ID to test"),
  input: z.record(z.unknown()).optional().default({}),
});

export const skillRunTestTool: Tool = {
  name: "skill_run_test",
  description: "Run a skill test.",
  input_schema: {
    type: "object",
    properties: {
      skillId: { type: "string", description: "Skill ID" },
      input: { type: "object", description: "Test input" },
    },
    required: ["skillId"],
  },
};

// ============================================================================
// SKILL LIST TOOL
// ============================================================================

export const skillListTool: Tool = {
  name: "skill_list",
  description: "List all available skills.",
  input_schema: { type: "object", properties: {} },
};

// ============================================================================
// EXPORT ALL SKILL TOOLS
// ============================================================================

export const SKILL_TOOLS: Tool[] = [
  skillCreateTool,
  skillEditTool,
  skillRunTestTool,
  skillListTool,
];
