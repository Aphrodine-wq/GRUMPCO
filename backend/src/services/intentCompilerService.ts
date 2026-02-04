/**
 * Intent Compiler Service
 * Spawns Rust grump-intent CLI, parses output, optionally enriches via LLM Gateway (Kimi K2.5).
 * Supports modes: rust-first (default), hybrid (LLM resolves ambiguity), llm-first (LLM extracts then validate).
 */

import logger from "../middleware/logger.js";
import { env } from "../config/env.js";
import {
  getIntentCompilerPrompt,
  getIntentExtractionFallbackPrompt,
} from "../prompts/intent-compiler.js";
import { withResilience } from "./resilience.js";
import { withCache } from "./cacheService.js";
import { getDatabase } from "../db/database.js";
import { randomUUID } from "crypto";
import { parseIntentWasm } from "./intentParserWasm.js";
import { runIntentCli } from "./intentCliRunner.js";
import { getWorkerPool, TaskPriority } from "./workerPool.js";
import { getStream, type StreamParams } from "./llmGateway.js";
import { getRagContextForPrompt } from "./ragService.js";

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
  applicability: "high" | "medium" | "low";
}

export interface OptimizationOpportunity {
  area: "performance" | "security" | "scalability" | "maintainability";
  suggestion: string;
  impact: "high" | "medium" | "low";
}

export interface CodeQualityRequirements {
  type_safety?: "strict" | "moderate" | "loose";
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

export interface AmbiguityAnalysis {
  score: number;
  reason: string;
  clarification_questions: string[];
}

export interface EnrichedIntent extends StructuredIntent {
  enriched?: {
    reasoning?: string;
    ambiguity_analysis?: AmbiguityAnalysis;
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

// Version tag for intent caching/normalization so we can safely evolve the schema
const INTENT_CACHE_VERSION = "v1";

// Default model for intent operations via NIM (Kimi K2.5)
const DEFAULT_INTENT_MODEL = "moonshotai/kimi-k2.5";

export type IntentCompilerMode = "hybrid" | "rust-first" | "llm-first";

function useWasmIntent(): boolean {
  return (
    process.env.GRUMP_USE_WASM_INTENT === "true" ||
    process.env.GRUMP_USE_WASM_INTENT === "1"
  );
}

function useWorkerPoolIntent(): boolean {
  return (
    process.env.GRUMP_USE_WORKER_POOL_INTENT === "true" ||
    process.env.GRUMP_USE_WORKER_POOL_INTENT === "1"
  );
}

// ============================================================================
// Unified Parser Integration
// ============================================================================

/**
 * Parse intent using the unified parser interface (WASM → CLI → LLM fallback)
 * This is the recommended approach for new code.
 */
export async function parseIntentUnified(
  raw: string,
  constraints?: Record<string, unknown>,
  options?: {
    useCache?: boolean;
    fallbackToLlm?: boolean;
    timeoutMs?: number;
  },
): Promise<StructuredIntent> {
  const { HybridIntentParser } = await import("./unifiedIntentParser.js");
  const parser = new HybridIntentParser();

  const result = await parser.parse(raw.trim(), constraints, {
    useCache: options?.useCache ?? true,
    fallbackToLlm: options?.fallbackToLlm ?? true,
    timeoutMs: options?.timeoutMs ?? 30000,
  });

  logger.debug(
    {
      parser: result.parser,
      durationMs: result.durationMs,
      fromCache: result.fromCache,
    },
    "Intent parsed via unified parser",
  );

  return result.intent;
}

/**
 * Collects streaming LLM response into a complete text response.
 * Uses NIM (Kimi K2.5) as the default provider for non-streaming completions.
 */
async function getCompletion(
  params: StreamParams,
  options?: { model?: string; timeout?: number },
): Promise<string> {
  const modelId = options?.model ?? DEFAULT_INTENT_MODEL;
  const stream = getStream(params, { provider: "nim", modelId });

  let fullText = "";
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
    } else if (event.type === "error") {
      throw new Error(`LLM Gateway error: ${JSON.stringify(event.error)}`);
    }
  }

  return fullText;
}

/**
 * Run grump-intent CLI with raw NL + optional constraints.
 * When GRUMP_USE_WASM_INTENT=true, tries WASM first (same process); falls back to CLI if unavailable or on error.
 * Returns structured intent JSON.
 */
export async function parseIntent(
  raw: string,
  constraints?: Record<string, unknown>,
): Promise<StructuredIntent> {
  if (useWasmIntent()) {
    try {
      const wasmResult = await parseIntentWasm(raw.trim(), constraints);
      if (wasmResult && Array.isArray(wasmResult.actors)) {
        return wasmResult as StructuredIntent;
      }
    } catch (e) {
      logger.debug(
        { err: e instanceof Error ? e.message : String(e) },
        "WASM intent parse failed, falling back to CLI",
      );
    }
  }

  return runIntentCli(raw, constraints);
}

/**
 * Enrich structured intent via LLM Gateway (Kimi K2.5) analysis.
 * Extracts features, users, data flows, tech stack, code patterns, architecture hints,
 * optimization opportunities, and code quality requirements.
 * When INTENT_RAG_AUGMENT_ENRICH is enabled, injects RAG context for consistency with the knowledge base.
 */
export async function enrichIntentViaLLM(
  intent: StructuredIntent,
  rawText?: string,
): Promise<EnrichedIntent> {
  // Check if NIM is available
  if (!process.env.NVIDIA_NIM_API_KEY) {
    logger.debug({}, "NIM not configured, skipping intent enrichment");
    return { ...intent, enriched: {} };
  }

  // Create resilient wrapper for LLM Gateway calls
  const resilientLlmCall = withResilience(
    async (params: StreamParams): Promise<string> => {
      return await getCompletion(params, { model: DEFAULT_INTENT_MODEL });
    },
    "nim-intent-enrichment",
  );

  let systemPrompt = getIntentCompilerPrompt();
  if (
    process.env.INTENT_RAG_AUGMENT_ENRICH !== "false" &&
    process.env.INTENT_RAG_AUGMENT_ENRICH !== "0"
  ) {
    try {
      const rawForRag =
        rawText ?? (intent as { raw?: string }).raw ?? JSON.stringify(intent);
      const ragResult = await getRagContextForPrompt(rawForRag, {
        maxChunks: 4,
      });
      if (ragResult?.context) {
        systemPrompt += `\n\nRelevant excerpts from the knowledge base for consistency:\n\n${ragResult.context}`;
      }
    } catch (ragErr) {
      logger.debug(
        { error: (ragErr as Error).message },
        "RAG context for intent enrichment failed, continuing without",
      );
    }
  }
  const contextHint = `Consider a modern web application structure (Frontend + Backend + Database).`;

  const userMsg = `Structured intent from parser:\n${JSON.stringify(intent, null, 2)}\n\nContext Hint: ${contextHint}\n\nAnalyze and enrich this intent with code-specific insights, patterns, architecture hints, optimization opportunities, and quality requirements. FOLLOW THE JSON SCHEMA EXACTLY.`;

  try {
    const res = await resilientLlmCall({
      model: DEFAULT_INTENT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    });

    let raw = res.trim();
    // Extract JSON from markdown code blocks if present
    if (raw.includes("```json")) {
      const match = raw.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) raw = match[1];
    } else if (raw.includes("```")) {
      const match = raw.match(/```\n?([\s\S]*?)\n?```/);
      if (match) raw = match[1];
    } else {
      // Try to find JSON object
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
    }
    const enriched = JSON.parse(raw) as EnrichedIntent["enriched"];
    return { ...intent, enriched: enriched || {} };
  } catch (e) {
    logger.warn(
      { err: (e as Error).message },
      "Intent enrichment failed, using raw intent",
    );
    return { ...intent, enriched: {} };
  }
}

/**
 * When Rust intent compiler fails, extract structured intent via LLM Gateway and optionally store for analysis.
 * When GRUMP_USE_WORKER_POOL_INTENT=true, offloads parsing to worker pool (CLI in worker) first.
 */
export async function parseIntentWithFallback(
  raw: string,
  constraints?: Record<string, unknown>,
): Promise<StructuredIntent> {
  try {
    if (useWorkerPoolIntent()) {
      try {
        const pool = getWorkerPool();
        return await pool.execute<
          { text: string; constraints?: Record<string, unknown> },
          StructuredIntent
        >(
          "parseIntent",
          { text: raw.trim(), constraints },
          TaskPriority.NORMAL,
        );
      } catch (poolErr) {
        logger.debug(
          { err: poolErr instanceof Error ? poolErr.message : String(poolErr) },
          "Worker pool intent parse failed, falling back to main-thread",
        );
        return await parseIntent(raw, constraints);
      }
    }
    return await parseIntent(raw, constraints);
  } catch (rustErr) {
    const err = rustErr as Error;
    logger.warn(
      { rustError: err.message, inputLength: raw.length },
      "Intent compiler fallback: Rust failed, using LLM Gateway",
    );
    let llmIntent: StructuredIntent;
    try {
      llmIntent = await extractIntentViaLLM(raw, err.message);
    } catch (llmErr) {
      logger.error(
        { llmError: (llmErr as Error).message },
        "Intent compiler fallback: LLM extraction failed",
      );
      throw rustErr;
    }
    try {
      storeIntentCompilerFailure(raw.trim(), err.message, llmIntent);
    } catch (storeErr) {
      logger.debug(
        { storeError: (storeErr as Error).message },
        "Could not store intent compiler failure",
      );
    }
    return llmIntent;
  }
}

/**
 * Normalize and enrich intent metadata so downstream consumers get a stable shape.
 * - Deduplicate and sort actors, features, data flows, tech hints.
 * - Ensure enriched.features at least mirrors top-level features when missing.
 * - Preserve existing enrichment fields but normalize arrays for consistency.
 */
export function optimizeEnrichedIntent(intent: EnrichedIntent): EnrichedIntent {
  const dedupeSort = (values?: string[]): string[] | undefined => {
    if (!values) return undefined;
    const seen = new Set<string>();
    for (const v of values) {
      const trimmed = v.trim();
      if (trimmed) seen.add(trimmed);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  };

  const baseActors = dedupeSort(intent.actors) ?? [];
  const baseFeatures = dedupeSort(intent.features) ?? [];
  const baseFlows = dedupeSort(intent.data_flows) ?? [];
  const baseTechHints = dedupeSort(intent.tech_stack_hints) ?? [];

  const enriched = intent.enriched ?? {};

  const optimizedEnriched: EnrichedIntent["enriched"] = {
    ...enriched,
    reasoning: enriched.reasoning,
    ambiguity_analysis: enriched.ambiguity_analysis,
    features: dedupeSort(enriched.features ?? baseFeatures),
    users: dedupeSort(enriched.users ?? baseActors),
    data_flows: dedupeSort(enriched.data_flows ?? baseFlows),
    tech_stack: dedupeSort(enriched.tech_stack ?? baseTechHints),
    code_patterns: dedupeSort(enriched.code_patterns),
    architecture_hints: enriched.architecture_hints,
    optimization_opportunities: enriched.optimization_opportunities,
    code_quality_requirements: enriched.code_quality_requirements,
  };

  return {
    ...intent,
    actors: baseActors,
    features: baseFeatures,
    data_flows: baseFlows,
    tech_stack_hints: baseTechHints,
    enriched: optimizedEnriched,
  };
}

/**
 * Extract StructuredIntent from raw NL using LLM Gateway (Kimi K2.5) when Rust compiler is unavailable or failed.
 */
export async function extractIntentViaLLM(
  raw: string,
  _rustError?: string,
): Promise<StructuredIntent> {
  // Check if NIM is available
  if (!process.env.NVIDIA_NIM_API_KEY) {
    logger.debug({}, "NIM not configured, returning default intent structure");
    return {
      actors: ["user"],
      features: [],
      data_flows: [],
      tech_stack_hints: [],
      constraints: {},
      raw: raw.trim(),
    };
  }

  // Create resilient wrapper for LLM Gateway calls
  const resilient = withResilience(
    async (params: StreamParams): Promise<string> =>
      getCompletion(params, { model: DEFAULT_INTENT_MODEL }),
    "nim-intent-extraction",
  );

  const systemPrompt = getIntentExtractionFallbackPrompt();
  const userMsg = `Raw input:\n${raw.trim()}\n\nExtract structured intent as JSON.`;

  try {
    const res = await resilient({
      model: DEFAULT_INTENT_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    });

    let text = res.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    if (text.includes("```json")) {
      const m = text.match(/```json\n?([\s\S]*?)\n?```/);
      if (m) text = m[1];
    } else if (text.includes("```")) {
      const m = text.match(/```\n?([\s\S]*?)\n?```/);
      if (m) text = m[1];
    }
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      actors: Array.isArray(parsed.actors)
        ? (parsed.actors as string[])
        : ["user"],
      features: Array.isArray(parsed.features)
        ? (parsed.features as string[])
        : [],
      data_flows: Array.isArray(parsed.data_flows)
        ? (parsed.data_flows as string[])
        : [],
      tech_stack_hints: Array.isArray(parsed.tech_stack_hints)
        ? (parsed.tech_stack_hints as string[])
        : [],
      constraints:
        parsed.constraints && typeof parsed.constraints === "object"
          ? (parsed.constraints as Record<string, unknown>)
          : {},
      raw: typeof parsed.raw === "string" ? parsed.raw : raw.trim(),
    };
  } catch (e) {
    logger.warn(
      { err: (e as Error).message },
      "LLM intent extraction failed, returning default structure",
    );
    return {
      actors: ["user"],
      features: [],
      data_flows: [],
      tech_stack_hints: [],
      constraints: {},
      raw: raw.trim(),
    };
  }
}

/**
 * Store (input, Rust error, LLM result) for later analysis and rule-update pipeline.
 */
export function storeIntentCompilerFailure(
  inputText: string,
  rustError: string,
  llmResult: StructuredIntent,
): void {
  const db = getDatabase().getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO intent_compiler_failures (id, input_text, rust_error, claude_result_json, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
  ).run(id, inputText, rustError, JSON.stringify(llmResult));
}

/**
 * Resolve ambiguity when score exceeds threshold. Uses LLM to refine intent based on clarification questions.
 */
async function resolveAmbiguityViaLLM(
  intent: EnrichedIntent,
): Promise<EnrichedIntent> {
  const amb = intent.enriched?.ambiguity_analysis;
  if (
    !amb?.clarification_questions?.length ||
    !process.env.NVIDIA_NIM_API_KEY
  ) {
    return intent;
  }
  const resilient = withResilience(
    async (params: StreamParams): Promise<string> =>
      getCompletion(params, { model: DEFAULT_INTENT_MODEL }),
    "nim-ambiguity-resolution",
  );
  const prompt = `Given the ambiguous intent and clarification questions, produce a refined structured intent (JSON).
Intent: ${JSON.stringify(intent, null, 2)}
Clarification questions to resolve: ${amb.clarification_questions.join("; ")}
Return JSON with actors, features, data_flows, tech_stack_hints, constraints, raw.`;
  try {
    const res = await resilient({
      model: DEFAULT_INTENT_MODEL,
      max_tokens: 2048,
      system:
        "You resolve ambiguities in software intent. Return valid JSON only.",
      messages: [{ role: "user", content: prompt }],
    });
    let text = res.trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) text = m[0];
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const refined: EnrichedIntent = {
      actors: Array.isArray(parsed.actors)
        ? (parsed.actors as string[])
        : intent.actors,
      features: Array.isArray(parsed.features)
        ? (parsed.features as string[])
        : intent.features,
      data_flows: Array.isArray(parsed.data_flows)
        ? (parsed.data_flows as string[])
        : intent.data_flows,
      tech_stack_hints: Array.isArray(parsed.tech_stack_hints)
        ? (parsed.tech_stack_hints as string[])
        : intent.tech_stack_hints,
      constraints:
        parsed.constraints && typeof parsed.constraints === "object"
          ? (parsed.constraints as Record<string, unknown>)
          : intent.constraints,
      raw: typeof parsed.raw === "string" ? parsed.raw : intent.raw,
      enriched: {
        ...intent.enriched,
        ambiguity_analysis: {
          ...amb,
          score: 0,
          reason: "Resolved",
          clarification_questions: [],
        },
      },
    };
    return optimizeEnrichedIntent(refined);
  } catch (e) {
    logger.warn(
      { err: (e as Error).message },
      "Ambiguity resolution failed, using original intent",
    );
    return intent;
  }
}

/**
 * Parse raw NL + constraints, then enrich. Supports modes:
 * - rust-first: Parse via Rust (with LLM fallback), enrich via LLM.
 * - hybrid: Same as rust-first, but if ambiguity_analysis.score > threshold, resolve via LLM.
 * - llm-first: Extract via LLM first, then enrich (no Rust parse).
 */
export async function parseAndEnrichIntent(
  raw: string,
  constraints?: Record<string, unknown>,
  options?: { mode?: IntentCompilerMode },
): Promise<EnrichedIntent> {
  const mode =
    options?.mode ?? (env.INTENT_COMPILER_MODE as IntentCompilerMode);
  const threshold = env.INTENT_AMBIGUITY_THRESHOLD ?? 0.6;
  const cacheKey = JSON.stringify({
    v: INTENT_CACHE_VERSION,
    raw: raw.trim(),
    constraints,
    mode,
  });

  return await withCache("intent", cacheKey, async () => {
    let enriched: EnrichedIntent;

    if (mode === "llm-first") {
      const structured = await extractIntentViaLLM(raw.trim());
      enriched = await enrichIntentViaLLM(structured, raw.trim());
    } else {
      const structured = await parseIntentWithFallback(raw, constraints);
      enriched = await enrichIntentViaLLM(structured, raw.trim());
    }

    if (mode === "hybrid") {
      const ambScore = enriched.enriched?.ambiguity_analysis?.score ?? 0;
      if (ambScore > threshold) {
        enriched = await resolveAmbiguityViaLLM(enriched);
      }
    }

    return optimizeEnrichedIntent(enriched);
  });
}
