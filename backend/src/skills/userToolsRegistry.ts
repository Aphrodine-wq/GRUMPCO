/**
 * User-defined tools registry – add tools from conversation or API.
 * Tools registered here are included in the agent tool list and executed via stub or custom handler.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { SkillContext } from './types.js';

export interface UserToolDef {
  name: string;
  description: string;
  input_schema: Anthropic.Tool['input_schema'];
  /** Optional; if absent, executor returns a placeholder message. */
  handler?: (input: Record<string, unknown>, context: SkillContext) => Promise<{ output: string }>;
}

const userTools = new Map<string, UserToolDef>();

/**
 * Register a user-defined tool (e.g. from "add this tool" in chat).
 */
export function registerUserTool(def: UserToolDef): void {
  const name = def.name.startsWith('user_') ? def.name : `user_${def.name}`;
  userTools.set(name, { ...def, name });
}

/**
 * Unregister a user-defined tool by name.
 */
export function unregisterUserTool(name: string): void {
  userTools.delete(name.startsWith('user_') ? name : `user_${name}`);
}

/**
 * Return tool definitions for the agent (Anthropic.Tool shape).
 */
export function getUserToolDefinitions(): Anthropic.Tool[] {
  return Array.from(userTools.values()).map((d) => ({
    name: d.name,
    description: d.description,
    input_schema: d.input_schema,
  }));
}

/**
 * Execute a user tool by name. Returns result or throws.
 */
export async function executeUserTool(
  name: string,
  input: Record<string, unknown>,
  context: SkillContext
): Promise<{ output: string }> {
  const def = userTools.get(name);
  if (!def) throw new Error(`Unknown user tool: ${name}`);
  if (def.handler) return def.handler(input, context);
  return { output: `Tool "${name}" executed (no custom implementation). Input: ${JSON.stringify(input).slice(0, 200)}` };
}

/**
 * Check if a tool name is a user-defined tool.
 */
export function isUserTool(name: string): boolean {
  return userTools.has(name) || userTools.has(name.startsWith('user_') ? name : `user_${name}`);
}
