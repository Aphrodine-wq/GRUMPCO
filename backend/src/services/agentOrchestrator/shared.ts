/**
 * Shared utilities for the agent orchestrator subsystem.
 *
 * Provides common functionality used across all agent orchestrator modules:
 * - Resilient LLM calls with retry and circuit breaker
 * - JSON extraction from LLM responses
 * - File conversion from agent output format
 *
 * @module agentOrchestrator/shared
 */

import { withResilience } from '../resilience.js';
import { getCompletion, type CompletionResult } from '../llmGatewayHelper.js';
import type { StreamParams } from '../llmGateway.js';
import type { GeneratedFile } from '../../types/agents.js';

/**
 * Default model for codegen agent orchestration.
 * Uses NVIDIA NIM with Llama 3.1 405B for high-quality code generation.
 *
 * Powered by NVIDIA NIM - https://build.nvidia.com/
 */
function getCodegenDefault(): { provider: 'nim'; modelId: string } {
  // Use Llama 3.1 405B for complex code generation tasks
  return { provider: 'nim', modelId: 'meta/llama-3.1-405b-instruct' };
}

export const DEFAULT_AGENT_MODEL = getCodegenDefault().modelId;

/**
 * Quality standard identifier for agent outputs.
 * All agent outputs must satisfy type safety, tests, security, and maintainability.
 */
export const AGENT_QUALITY_STANDARD = 'kimi-k2.5' as const;

/**
 * Resilient wrapper for LLM Gateway calls.
 *
 * Automatically handles retries, circuit breaking, and error recovery
 * for agent LLM calls. Uses 'kimi-agent' bulkhead for isolation.
 *
 * @param params - Stream parameters for the LLM call
 * @returns Completion result with text and optional error
 *
 * @example
 * ```typescript
 * const result = await resilientLlmCall({
 *   model: DEFAULT_AGENT_MODEL,
 *   max_tokens: 4096,
 *   system: 'You are a code generation agent.',
 *   messages: [{ role: 'user', content: 'Generate a REST API' }]
 * });
 * if (result.error) {
 *   console.error('LLM call failed:', result.error);
 * } else {
 *   console.log('Generated:', result.text);
 * }
 * ```
 */
export const resilientLlmCall = withResilience(
  async (params: StreamParams): Promise<CompletionResult> => {
    const { provider, modelId } = getCodegenDefault();
    return await getCompletion(
      { ...params, model: params.model || modelId },
      { provider, modelId: params.model || modelId }
    );
  },
  'kimi-agent'
);

/**
 * Extract JSON from an LLM response that may be wrapped in markdown code fences.
 *
 * Handles responses with:
 * - ```json ... ``` blocks
 * - ``` ... ``` generic code blocks
 * - Plain JSON without fences
 *
 * @param text - Raw LLM response text
 * @returns Extracted JSON string
 *
 * @example
 * ```typescript
 * const response = '```json\n{"files": [...]}\n```';
 * const json = extractJsonFromResponse(response);
 * const data = JSON.parse(json);
 * ```
 */
export function extractJsonFromResponse(text: string): string {
  if (text.includes('```json')) {
    const match = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (match) return match[1];
  } else if (text.includes('```')) {
    const match = text.match(/```\n?([\s\S]*?)\n?```/);
    if (match) return match[1];
  }
  return text;
}

/**
 * Convert agent output to GeneratedFile array.
 *
 * Parses the structured output from agents and converts it to
 * the GeneratedFile format used by the session.
 *
 * @param agentOutput - Parsed JSON output from an agent
 * @returns Array of GeneratedFile objects
 *
 * @example
 * ```typescript
 * const output = JSON.parse(extractJsonFromResponse(llmResponse));
 * const files = convertAgentOutputToFiles(output);
 * session.generatedFiles.push(...files);
 * ```
 */
export function convertAgentOutputToFiles(agentOutput: Record<string, unknown>): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  for (const key of Object.keys(agentOutput)) {
    const items = agentOutput[key];
    if (Array.isArray(items)) {
      for (const item of items as Array<{ path?: string; content?: string; type?: string }>) {
        if (item.path && item.content) {
          files.push({
            path: item.path,
            type: (item.type === 'test' || item.type === 'config' || item.type === 'doc'
              ? item.type
              : 'source') as GeneratedFile['type'],
            language: getLanguageFromPath(item.path),
            size: item.content.length,
            content: item.content,
          });
        }
      }
    }
  }

  return files;
}

/**
 * Infer programming language from file path extension.
 *
 * @param path - File path with extension
 * @returns Language identifier string
 *
 * @example
 * ```typescript
 * getLanguageFromPath('src/components/App.tsx') // 'typescript'
 * getLanguageFromPath('main.py') // 'python'
 * getLanguageFromPath('README.md') // 'markdown'
 * ```
 */
export function getLanguageFromPath(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.vue')) return 'vue';
  if (path.endsWith('.go')) return 'go';
  if (path.endsWith('.sql')) return 'sql';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.sh')) return 'shell';
  return 'text';
}
