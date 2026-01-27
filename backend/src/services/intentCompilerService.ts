/**
 * Intent Compiler Service
 * Spawns Rust grump-intent CLI, parses output, optionally enriches via Claude.
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import logger from '../middleware/logger.js';
import { getIntentCompilerPrompt } from '../prompts/intent-compiler.js';
import { withResilience } from './resilience.js';
import { withCache } from './cacheService.js';

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
  const resilientClaudeCall = withResilience(
    async (params: Parameters<typeof client.messages.create>[0]) => {
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
 * Parse raw NL + constraints via Rust, then enrich via Claude.
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
      const structured = await parseIntent(raw, constraints);
      return enrichIntentViaClaude(structured);
    }
  );
}
