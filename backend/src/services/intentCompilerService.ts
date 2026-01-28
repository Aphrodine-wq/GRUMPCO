/**
 * Intent Compiler Service
 * Spawns Rust grump-intent CLI, parses output, optionally enriches via Claude.
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import logger from '../middleware/logger.js';
import { getIntentCompilerPrompt, getIntentExtractionFallbackPrompt } from '../prompts/intent-compiler.js';
import { withResilience } from './resilience.js';
import { withCache } from './cacheService.js';
import { getDatabase } from '../db/database.js';
import { randomUUID } from 'crypto';

export interface StructuredIntent {
  actors: string[];
  features: string[];
  data_flows: string[];
  tech_stack_hints: string[];
  constraints: Record<string, unknown>;
  raw: string;
}

export interface CodePattern {
  pattern: string;
  description: string;
  applicability: 'high' | 'medium' | 'low';
}

export interface OptimizationOpportunity {
  area: 'performance' | 'security' | 'scalability' | 'maintainability';
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
}

export interface CodeQualityRequirements {
  type_safety?: 'strict' | 'moderate' | 'loose';
  testing?: {
    unit?: boolean;
    integration?: boolean;
    e2e?: boolean;
    coverage_target?: number;
  };
  documentation?: string[];
  performance?: {
    response_time_ms?: number;
    throughput_rps?: number;
  };
  security?: string[];
}

export interface EnrichedIntent extends StructuredIntent {
  enriched?: {
    features?: string[];
    users?: string[];
    data_flows?: string[];
    tech_stack?: string[];
    code_patterns?: string[];
    architecture_hints?: CodePattern[];
    optimization_opportunities?: OptimizationOpportunity[];
    code_quality_requirements?: CodeQualityRequirements;
  };
}

function getIntentCompilerPath(): string {
  const override = process.env.GRUMP_INTENT_PATH;
  if (override) return override;
  
  // Production: Check if running from bundled executable (app data directory)
  if (process.env.NODE_ENV === 'production') {
    // When bundled, grump-intent should be in the same directory as the backend executable
    // or in a known location relative to the executable
    const appDataDir = process.env.APPDATA || process.env.LOCALAPPDATA || process.cwd();
    const bundledPath = resolve(appDataDir, 'grump-intent.exe');
    if (require('fs').existsSync(bundledPath)) {
      return bundledPath;
    }
  }
  
  // Development: backend runs from backend/; project root = ..
  const root = resolve(process.cwd(), '..');
  const exe = process.platform === 'win32' ? 'grump-intent.exe' : 'grump-intent';
  const devPath = resolve(root, 'intent-compiler', 'target', 'release', exe);
  
  // Fallback to x86_64-pc-windows-msvc target for Windows
  if (process.platform === 'win32' && !require('fs').existsSync(devPath)) {
    const msvcPath = resolve(root, 'intent-compiler', 'target', 'x86_64-pc-windows-msvc', 'release', exe);
    if (require('fs').existsSync(msvcPath)) {
      return msvcPath;
    }
  }
  
  return devPath;
}

/**
 * Run grump-intent CLI with raw NL + optional constraints.
 * Returns structured intent JSON.
 */
export async function parseIntent(
  raw: string,
  constraints?: Record<string, unknown>
): Promise<StructuredIntent> {
  const bin = getIntentCompilerPath();

  const args: string[] = ['--input', raw.trim()];
  if (constraints && Object.keys(constraints).length > 0) {
    args.push('--constraints', JSON.stringify(constraints));
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      logger.error({ err, bin }, 'Intent compiler spawn failed');
      rejectPromise(new Error(`Intent compiler failed: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        logger.warn({ code, stderr }, 'Intent compiler non-zero exit');
        rejectPromise(new Error(`Intent compiler exited ${code}: ${stderr || 'see logs'}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as StructuredIntent;
        if (!parsed.raw || !Array.isArray(parsed.actors)) {
          rejectPromise(new Error('Invalid intent compiler output'));
          return;
        }
        resolvePromise(parsed);
      } catch (e) {
        logger.error({ stdout: stdout.slice(0, 500) }, 'Intent compiler invalid JSON');
        rejectPromise(new Error('Intent compiler returned invalid JSON'));
      }
    });
  });
}

/**
 * Enrich structured intent via Claude Code-optimized analysis.
 * Extracts features, users, data flows, tech stack, code patterns, architecture hints,
 * optimization opportunities, and code quality requirements.
 */
export async function enrichIntentViaClaude(intent: StructuredIntent): Promise<EnrichedIntent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...intent, enriched: {} };
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  // Create resilient wrapper
  // Type assertion: since we never pass stream: true, the response is always a Message
  const resilientClaudeCall = withResilience(
    async (params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
      return await client.messages.create(params);
    },
    'claude-intent'
  );
  
  const systemPrompt = getIntentCompilerPrompt();
  const userMsg = `Structured intent from parser:\n${JSON.stringify(intent, null, 2)}\n\nAnalyze and enrich this intent with code-specific insights, patterns, architecture hints, optimization opportunities, and quality requirements.`;

  try {
    const res = await resilientClaudeCall({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
    });
    const block = res.content[0];
    if (block.type !== 'text') {
      return { ...intent, enriched: {} };
    }
    let raw = block.text.trim();
    // Extract JSON from markdown code blocks if present
    if (raw.includes('```json')) {
      const match = raw.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) raw = match[1];
    } else if (raw.includes('```')) {
      const match = raw.match(/```\n?([\s\S]*?)\n?```/);
      if (match) raw = match[1];
    } else {
      // Try to find JSON object
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
    }
    const enriched = JSON.parse(raw) as EnrichedIntent['enriched'];
    return { ...intent, enriched: enriched || {} };
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'Intent enrichment failed, using raw intent');
    return { ...intent, enriched: {} };
  }
}

/**
 * When Rust intent compiler fails, extract structured intent via Claude and optionally store for analysis.
 */
export async function parseIntentWithFallback(
  raw: string,
  constraints?: Record<string, unknown>
): Promise<StructuredIntent> {
  try {
    return await parseIntent(raw, constraints);
  } catch (rustErr) {
    const err = rustErr as Error;
    logger.warn({ rustError: err.message, inputLength: raw.length }, 'Intent compiler fallback: Rust failed, using Claude');
    let claudeIntent: StructuredIntent;
    try {
      claudeIntent = await extractIntentViaClaude(raw, err.message);
    } catch (claudeErr) {
      logger.error({ claudeError: (claudeErr as Error).message }, 'Intent compiler fallback: Claude extraction failed');
      throw rustErr;
    }
    try {
      storeIntentCompilerFailure(raw.trim(), err.message, claudeIntent);
    } catch (storeErr) {
      logger.debug({ storeError: (storeErr as Error).message }, 'Could not store intent compiler failure');
    }
    return claudeIntent;
  }
}

/**
 * Extract StructuredIntent from raw NL using Claude when Rust compiler is unavailable or failed.
 */
export async function extractIntentViaClaude(raw: string, _rustError?: string): Promise<StructuredIntent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      actors: ['user'],
      features: [],
      data_flows: [],
      tech_stack_hints: [],
      constraints: {},
      raw: raw.trim(),
    };
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // Type assertion: since we never pass stream: true, the response is always a Message
  const resilient = withResilience(
    async (params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => client.messages.create(params),
    'claude-intent-fallback'
  );
  const systemPrompt = getIntentExtractionFallbackPrompt();
  const userMsg = `Raw input:\n${raw.trim()}\n\nExtract structured intent as JSON.`;

  const res = await resilient({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  });
  const block = res.content[0];
  if (block.type !== 'text') {
    return { actors: ['user'], features: [], data_flows: [], tech_stack_hints: [], constraints: {}, raw: raw.trim() };
  }
  let text = block.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) text = jsonMatch[0];
  if (text.includes('```json')) {
    const m = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (m) text = m[1];
  } else if (text.includes('```')) {
    const m = text.match(/```\n?([\s\S]*?)\n?```/);
    if (m) text = m[1];
  }
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return {
    actors: Array.isArray(parsed.actors) ? (parsed.actors as string[]) : ['user'],
    features: Array.isArray(parsed.features) ? (parsed.features as string[]) : [],
    data_flows: Array.isArray(parsed.data_flows) ? (parsed.data_flows as string[]) : [],
    tech_stack_hints: Array.isArray(parsed.tech_stack_hints) ? (parsed.tech_stack_hints as string[]) : [],
    constraints: parsed.constraints && typeof parsed.constraints === 'object' ? (parsed.constraints as Record<string, unknown>) : {},
    raw: typeof parsed.raw === 'string' ? parsed.raw : raw.trim(),
  };
}

/**
 * Store (input, Rust error, Claude result) for later analysis and rule-update pipeline.
 */
export function storeIntentCompilerFailure(
  inputText: string,
  rustError: string,
  claudeResult: StructuredIntent
): void {
  try {
    const db = getDatabase().getDb();
    const id = randomUUID();
    db.prepare(
      `INSERT INTO intent_compiler_failures (id, input_text, rust_error, claude_result_json, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(id, inputText, rustError, JSON.stringify(claudeResult));
  } catch (e) {
    throw e;
  }
}

/**
 * Parse raw NL + constraints via Rust (with Claude fallback on failure), then enrich via Claude.
 */
export async function parseAndEnrichIntent(
  raw: string,
  constraints?: Record<string, unknown>
): Promise<EnrichedIntent> {
  // Create cache key from input
  const cacheKey = JSON.stringify({ raw: raw.trim(), constraints });
  
  return await withCache(
    'intent',
    cacheKey,
    async () => {
      const structured = await parseIntentWithFallback(raw, constraints);
      return enrichIntentViaClaude(structured);
    }
  );
}
