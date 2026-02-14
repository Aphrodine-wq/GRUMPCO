/**
 * Intent Detection Module
 *
 * Analyzes user messages to detect the intended mode of operation.
 * Uses pattern matching to classify requests into different G-Agent modes.
 */

import type { AgentMode } from './types.js';

/**
 * Result of intent detection
 */
export interface DetectedIntent {
  /** Detected mode */
  mode: AgentMode;
  /** Confidence score (0-1) */
  confidence: number;
  /** Keywords that triggered the detection */
  keywords: string[];
}

/**
 * Patterns for detecting each mode
 */
const MODE_PATTERNS: Record<AgentMode, RegExp[]> = {
  goal: [
    /\b(goal|achieve|accomplish|complete)\b/i,
    /\b(i want to|help me|can you)\b.*\b(build|create|make|implement)\b/i,
    /\b(schedule|later|tomorrow|next week)\b/i,
  ],
  plan: [
    /\b(plan|outline|break down|decompose)\b/i,
    /\b(how would you|what steps|what's involved)\b/i,
    /\bdon't execute\b/i,
  ],
  execute: [/\b(execute|run|do it|go ahead|proceed)\b/i, /\bapproved?\b/i],
  swarm: [/\b(swarm|multi-?agent|parallel|team)\b/i, /\b(comprehensive|thorough|all aspects)\b/i],
  codegen: [
    /\b(generate|create|build|implement)\b.*\b(app|application|project|feature|component)\b/i,
    /\b(prd|spec|specification)\b/i,
    /\b(full stack|frontend|backend|api)\b/i,
  ],
  autonomous: [
    /\b(autonomous|auto|on your own|without asking)\b/i,
    /\b(keep going|don't stop|continuous)\b/i,
  ],
  chat: [/\b(explain|what is|how does|tell me about)\b/i, /\b(help|question|ask)\b/i],
};

/**
 * Detect the intended mode from a user message
 *
 * @param message - The user's message
 * @returns Detected intent with mode, confidence, and matched keywords
 *
 * @example
 * ```typescript
 * const intent = detectIntent("Help me build a todo app");
 * // { mode: 'goal', confidence: 0.67, keywords: ['help me', 'build'] }
 * ```
 */
export function detectIntent(message: string): DetectedIntent {
  const results: Array<{ mode: AgentMode; score: number; keywords: string[] }> = [];

  for (const [mode, patterns] of Object.entries(MODE_PATTERNS)) {
    const keywords: string[] = [];
    let score = 0;

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        score += 1;
        keywords.push(match[0]);
      }
    }

    if (score > 0) {
      results.push({ mode: mode as AgentMode, score, keywords });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  if (results.length > 0) {
    const best = results[0];
    return {
      mode: best.mode,
      confidence: Math.min(best.score / 3, 1),
      keywords: best.keywords,
    };
  }

  // Default to chat mode
  return { mode: 'chat', confidence: 0.5, keywords: [] };
}

/**
 * Check if a message explicitly mentions a mode
 *
 * @param message - The user's message
 * @returns The explicitly mentioned mode, or null if none
 */
export function getExplicitMode(message: string): AgentMode | null {
  const modeKeywords: Record<string, AgentMode> = {
    '/goal': 'goal',
    '/plan': 'plan',
    '/execute': 'execute',
    '/swarm': 'swarm',
    '/codegen': 'codegen',
    '/autonomous': 'autonomous',
    '/chat': 'chat',
  };

  for (const [keyword, mode] of Object.entries(modeKeywords)) {
    if (message.toLowerCase().startsWith(keyword)) {
      return mode;
    }
  }

  return null;
}
