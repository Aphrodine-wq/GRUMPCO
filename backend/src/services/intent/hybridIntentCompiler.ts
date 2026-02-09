/**
 * Hybrid Intent Compiler Service
 * AI-integrated compiler that combines Rust's speed with LLM's intelligence for intent parsing.
 *
 * Features:
 * - Hybrid parsing: Rust for structural extraction, LLM for ambiguity resolution
 * - LLM-first mode for unstructured prompts with Rust validation
 * - Parallel processing: Rust for speed, LLM for intelligence
 * - Confidence scoring to determine when to use LLM vs Rust
 * - Caching layer with Redis for parsed intents
 * - Fallback mechanisms if LLM fails
 */

import logger from "../../middleware/logger.js";
import { getStream, type StreamParams } from "../ai-providers/llmGateway.js";
import { withResilience } from "../infra/resilience.js";
import { withCache, type CacheType } from "../caching/cacheService.js";
import {
  parseIntent as _parseIntentRust,
  parseIntentWithFallback as parseIntentRustWithFallback,
} from "./intentCompilerService.js";
import type {
  StructuredIntent,
  EnrichedIntent,
} from "./intentCompilerService.js";
import { getConfidenceThreshold } from "../session/adaptiveConfidenceService.js";

// Configuration types
export interface HybridCompilerConfig {
  /** Primary parsing mode */
  mode: "hybrid" | "rust-first" | "llm-first";
  /** Confidence threshold for using LLM (0.0-1.0) */
  confidenceThreshold: number;
  /** Enable parallel processing */
  parallelProcessing: boolean;
  /** Enable caching */
  cachingEnabled: boolean;
  /** Cache type for intents */
  cacheType: CacheType;
  /** LLM provider to use for LLM-first mode (NVIDIA NIM exclusive) */
  llmProvider: "nim";
  /** LLM model to use */
  llmModel: string;
  /** Timeout for LLM parsing in ms */
  llmTimeout: number;
  /** Timeout for Rust parsing in ms */
  rustTimeout: number;
  /** Max tokens for LLM parsing */
  maxTokens: number;
  /** Enable fallback to other method on failure */
  fallbackEnabled: boolean;
}

// Default configuration
export const DEFAULT_HYBRID_CONFIG: HybridCompilerConfig = {
  mode: "hybrid",
  confidenceThreshold: 0.7,
  parallelProcessing: true,
  cachingEnabled: true,
  cacheType: "intent",
  llmProvider: "nim",
  llmModel: "moonshotai/kimi-k2.5",
  llmTimeout: 30000,
  rustTimeout: 5000,
  maxTokens: 4096,
  fallbackEnabled: true,
};

// Parse result with confidence score
export interface ParseResult {
  intent: EnrichedIntent;
  confidence: number;
  method: "rust" | "llm" | "hybrid";
  processingTimeMs: number;
  cacheHit: boolean;
  ambiguityScore: number;
  fallbackUsed: boolean;
}

// Ambiguity detection result
interface AmbiguityResult {
  score: number;
  reasons: string[];
  needsLLM: boolean;
}

// Parse attempt result for parallel processing
interface ParseAttempt {
  method: "rust" | "llm";
  result?: EnrichedIntent;
  error?: Error;
  timeMs: number;
  confidence: number;
}

/**
 * Get configuration from environment variables
 */
export function getHybridConfig(): HybridCompilerConfig {
  return {
    mode:
      (process.env.HYBRID_INTENT_MODE as HybridCompilerConfig["mode"]) ||
      DEFAULT_HYBRID_CONFIG.mode,
    confidenceThreshold: getConfidenceThreshold(),
    parallelProcessing: process.env.HYBRID_PARALLEL_PROCESSING !== "false",
    cachingEnabled: process.env.HYBRID_CACHING_ENABLED !== "false",
    cacheType:
      (process.env.HYBRID_CACHE_TYPE as CacheType) ||
      DEFAULT_HYBRID_CONFIG.cacheType,
    llmProvider:
      (process.env.HYBRID_LLM_PROVIDER as "nim") ||
      DEFAULT_HYBRID_CONFIG.llmProvider,
    llmModel: process.env.HYBRID_LLM_MODEL || DEFAULT_HYBRID_CONFIG.llmModel,
    llmTimeout: parseInt(
      process.env.HYBRID_LLM_TIMEOUT ||
        String(DEFAULT_HYBRID_CONFIG.llmTimeout),
      10,
    ),
    rustTimeout: parseInt(
      process.env.HYBRID_RUST_TIMEOUT ||
        String(DEFAULT_HYBRID_CONFIG.rustTimeout),
      10,
    ),
    maxTokens: parseInt(
      process.env.HYBRID_MAX_TOKENS || String(DEFAULT_HYBRID_CONFIG.maxTokens),
      10,
    ),
    fallbackEnabled: process.env.HYBRID_FALLBACK_ENABLED !== "false",
  };
}

/**
 * Detect ambiguity in raw input to determine if LLM is needed
 */
export function detectAmbiguity(raw: string): AmbiguityResult {
  const reasons: string[] = [];
  let score = 0.0;

  // Check for ambiguous keywords
  const ambiguousPatterns = [
    {
      pattern: /\b(something|anything|stuff|things?)\b/gi,
      weight: 0.3,
      reason: "Contains vague nouns",
    },
    {
      pattern: /\b(make it|fix it|do it|handle it)\b/gi,
      weight: 0.4,
      reason: "Contains vague action phrases",
    },
    {
      pattern: /\b(better|improve|enhance|optimize)\b/gi,
      weight: 0.3,
      reason: "Contains vague improvement requests",
    },
    { pattern: /\?$/g, weight: 0.2, reason: "Input ends with question mark" },
    {
      pattern: /\b(can you|could you|would you|please)\b/gi,
      weight: 0.1,
      reason: "Polite but potentially ambiguous phrasing",
    },
  ];

  for (const { pattern, weight, reason } of ambiguousPatterns) {
    if (pattern.test(raw)) {
      score += weight;
      reasons.push(reason);
    }
  }

  // Check for structured vs unstructured input
  const hasStructure =
    /\b(create|build|implement|add|remove|update|delete)\s+\w+/i.test(raw);
  const hasSpecifics = /\b(using|with|for|as|to)\s+\w+/i.test(raw);

  if (!hasStructure) {
    score += 0.2;
    reasons.push("Lacks clear action structure");
  }

  if (!hasSpecifics) {
    score += 0.15;
    reasons.push("Lacks specific details (no using/with/for clauses)");
  }

  // Check length - very short inputs are more ambiguous
  const wordCount = raw.trim().split(/\s+/).length;
  if (wordCount < 5) {
    score += 0.2;
    reasons.push("Very short input (< 5 words)");
  } else if (wordCount > 50) {
    // Long inputs might be complex but not necessarily ambiguous
    score += 0.1;
    reasons.push("Long complex input (> 50 words)");
  }

  // Check for technical specificity
  const techKeywords =
    /\b(api|endpoint|database|table|function|class|module|service|component|microservice|graphql|rest|websocket|queue|cache|auth|oauth|jwt)\b/gi;
  const techMatches = raw.match(techKeywords);
  if (!techMatches || techMatches.length < 2) {
    score += 0.15;
    reasons.push("Lacks technical specificity");
  }

  // Cap score at 1.0
  score = Math.min(score, 1.0);

  return {
    score,
    reasons,
    needsLLM: score > 0.5,
  };
}

/**
 * Score the confidence of a Rust parse result
 */
export function scoreRustConfidence(intent: StructuredIntent): number {
  let confidence = 0.5; // Base confidence

  // More features = higher confidence
  if (intent.features && intent.features.length > 0) {
    confidence += Math.min(intent.features.length * 0.1, 0.3);
  }

  // More actors = higher confidence
  if (intent.actors && intent.actors.length > 0) {
    confidence += Math.min(intent.actors.length * 0.05, 0.2);
  }

  // Data flows present = higher confidence
  if (intent.data_flows && intent.data_flows.length > 0) {
    confidence += 0.15;
  }

  // Tech stack hints present = higher confidence
  if (intent.tech_stack_hints && intent.tech_stack_hints.length > 0) {
    confidence += 0.1;
  }

  // Check for empty arrays which indicate low confidence
  const hasEmptyArrays =
    (!intent.features || intent.features.length === 0) &&
    (!intent.actors || intent.actors.length === 0) &&
    (!intent.data_flows || intent.data_flows.length === 0);

  if (hasEmptyArrays) {
    confidence -= 0.4;
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Score the confidence of an LLM parse result
 */
export function scoreLLMConfidence(intent: EnrichedIntent): number {
  let confidence = 0.6; // Base confidence (LLM generally more confident)

  // Check enriched data quality
  if (intent.enriched) {
    if (intent.enriched.reasoning) {
      confidence += 0.1;
    }

    if (intent.enriched.ambiguity_analysis) {
      // If LLM itself detected ambiguity, lower confidence
      confidence -= intent.enriched.ambiguity_analysis.score * 0.3;
    }

    if (intent.enriched.features && intent.enriched.features.length > 0) {
      confidence += Math.min(intent.enriched.features.length * 0.05, 0.2);
    }

    if (
      intent.enriched.architecture_hints &&
      intent.enriched.architecture_hints.length > 0
    ) {
      confidence += 0.1;
    }
  }

  // Validate against base intent
  const baseScore = scoreRustConfidence(intent);
  confidence = (confidence + baseScore) / 2; // Average with base score

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Parse intent using LLM with structured output
 */
async function parseIntentWithLLM(
  raw: string,
  constraints?: Record<string, unknown>,
  config?: Partial<HybridCompilerConfig>,
): Promise<EnrichedIntent> {
  const fullConfig = { ...getHybridConfig(), ...config };

  const systemPrompt = `You are an expert intent parser. Extract structured intent from the user's request.

You MUST respond with a single valid JSON object matching this exact schema:

{
  "actors": ["string"], // User roles, systems, external actors
  "features": ["string"], // Product features, capabilities
  "data_flows": ["string"], // Communication patterns (REST, WebSocket, etc.)
  "tech_stack_hints": ["string"], // Technology suggestions
  "constraints": {}, // Optional key-value constraints
  "enriched": {
    "reasoning": "string", // Your analysis reasoning
    "ambiguity_analysis": {
      "score": 0.0, // 0.0-1.0 ambiguity score
      "reason": "string",
      "clarification_questions": ["string"]
    },
    "features": ["string"], // Enriched feature list
    "users": ["string"], // User roles
    "data_flows": ["string"], // Data flow patterns
    "tech_stack": ["string"], // Recommended tech stack
    "code_patterns": ["string"], // Detected patterns (REST, Microservices, etc.)
    "architecture_hints": [{"pattern": "string", "description": "string", "applicability": "high|medium|low"}],
    "optimization_opportunities": [{"area": "performance|security|scalability|maintainability", "suggestion": "string", "impact": "high|medium|low"}],
    "code_quality_requirements": {
      "type_safety": "strict|moderate|loose",
      "testing": {"unit": true, "integration": true, "e2e": true, "coverage_target": 80},
      "documentation": ["string"],
      "performance": {"response_time_ms": 200, "throughput_rps": 1000},
      "security": ["string"]
    }
  }
}

Return ONLY the JSON object, no markdown, no code blocks, no explanations.`;

  const userMsg = `Parse this request into structured intent:

"""${raw}"""

${constraints ? `Constraints: ${JSON.stringify(constraints)}` : ""}

Extract actors, features, data flows, and provide enriched analysis.`;

  const params: StreamParams = {
    model: fullConfig.llmModel,
    max_tokens: fullConfig.maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMsg }],
  };

  const stream = getStream(params, {
    provider: fullConfig.llmProvider,
    modelId: fullConfig.llmModel,
  });

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

  // Extract JSON from response
  let jsonText = fullText.trim();

  // Try to find JSON in markdown code blocks
  if (jsonText.includes("```json")) {
    const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
    if (match) jsonText = match[1];
  } else if (jsonText.includes("```")) {
    const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
    if (match) jsonText = match[1];
  } else {
    // Try to find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonText = jsonMatch[0];
  }

  const parsed = JSON.parse(jsonText) as EnrichedIntent;

  // Ensure raw field is set
  if (!parsed.raw) {
    parsed.raw = raw;
  }

  return parsed;
}

/**
 * Parse intent using Rust compiler
 */
async function parseIntentWithRust(
  raw: string,
  constraints?: Record<string, unknown>,
  _config?: Partial<HybridCompilerConfig>,
): Promise<EnrichedIntent> {
  // Use existing Rust-based parser
  const result = await parseIntentRustWithFallback(raw, constraints);

  // Convert to EnrichedIntent format
  return {
    ...result,
    enriched: {
      features: result.features,
      users: result.actors,
      data_flows: result.data_flows,
      tech_stack: result.tech_stack_hints,
    },
  };
}

/**
 * Execute Rust parsing with timeout
 */
async function runRustWithTimeout(
  raw: string,
  constraints?: Record<string, unknown>,
  timeoutMs?: number,
): Promise<ParseAttempt> {
  const startTime = Date.now();

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Rust parsing timeout")),
        timeoutMs || 5000,
      );
    });

    const result = await Promise.race([
      parseIntentWithRust(raw, constraints),
      timeoutPromise,
    ]);

    const timeMs = Date.now() - startTime;
    const confidence = scoreRustConfidence(result);

    return {
      method: "rust",
      result,
      timeMs,
      confidence,
    };
  } catch (error) {
    return {
      method: "rust",
      error: error instanceof Error ? error : new Error(String(error)),
      timeMs: Date.now() - startTime,
      confidence: 0,
    };
  }
}

/**
 * Execute LLM parsing with timeout and resilience
 */
async function runLLMWithTimeout(
  raw: string,
  constraints?: Record<string, unknown>,
  timeoutMs?: number,
  config?: Partial<HybridCompilerConfig>,
): Promise<ParseAttempt> {
  const startTime = Date.now();
  const fullConfig = { ...getHybridConfig(), ...config };

  try {
    const resilientParse = withResilience(async () => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("LLM parsing timeout")),
          timeoutMs || fullConfig.llmTimeout,
        );
      });

      return await Promise.race([
        parseIntentWithLLM(raw, constraints, config),
        timeoutPromise,
      ]);
    }, "hybrid-intent-llm");

    const result = await resilientParse();
    const timeMs = Date.now() - startTime;
    const confidence = scoreLLMConfidence(result);

    return {
      method: "llm",
      result,
      timeMs,
      confidence,
    };
  } catch (error) {
    return {
      method: "llm",
      error: error instanceof Error ? error : new Error(String(error)),
      timeMs: Date.now() - startTime,
      confidence: 0,
    };
  }
}

/**
 * Merge Rust and LLM results for hybrid mode
 */
function mergeResults(
  rustResult: EnrichedIntent,
  llmResult: EnrichedIntent,
): EnrichedIntent {
  // Deduplication helper
  const dedupe = (arr: string[] | undefined): string[] => {
    if (!arr) return [];
    return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
  };

  // Merge base fields
  const merged: EnrichedIntent = {
    actors: dedupe([...(rustResult.actors || []), ...(llmResult.actors || [])]),
    features: dedupe([
      ...(rustResult.features || []),
      ...(llmResult.features || []),
    ]),
    data_flows: dedupe([
      ...(rustResult.data_flows || []),
      ...(llmResult.data_flows || []),
    ]),
    tech_stack_hints: dedupe([
      ...(rustResult.tech_stack_hints || []),
      ...(llmResult.tech_stack_hints || []),
    ]),
    constraints: {
      ...(rustResult.constraints || {}),
      ...(llmResult.constraints || {}),
    },
    raw: rustResult.raw || llmResult.raw,
    enriched: {
      // Prefer LLM enriched data as it's more detailed
      ...(llmResult.enriched || {}),
      // But merge with Rust data if LLM is missing fields
      features: dedupe([
        ...(rustResult.features || []),
        ...(llmResult.enriched?.features || llmResult.features || []),
      ]),
      users: dedupe([
        ...(rustResult.actors || []),
        ...(llmResult.enriched?.users || llmResult.actors || []),
      ]),
      data_flows: dedupe([
        ...(rustResult.data_flows || []),
        ...(llmResult.enriched?.data_flows || llmResult.data_flows || []),
      ]),
      tech_stack: dedupe([
        ...(rustResult.tech_stack_hints || []),
        ...(llmResult.enriched?.tech_stack || llmResult.tech_stack_hints || []),
      ]),
    },
  };

  return merged;
}

/**
 * Main hybrid intent parsing function
 */
export async function parseIntentHybrid(
  raw: string,
  constraints?: Record<string, unknown>,
  config?: Partial<HybridCompilerConfig>,
): Promise<ParseResult> {
  const fullConfig = { ...getHybridConfig(), ...config };
  const startTime = Date.now();

  // Check cache first if enabled
  if (fullConfig.cachingEnabled) {
    const cacheKey = JSON.stringify({
      raw: raw.trim(),
      constraints,
      mode: fullConfig.mode,
    });
    const _cached = await withCache<ParseResult | null>(
      fullConfig.cacheType,
      cacheKey,
      async () => null,
      { skipCache: true },
    );

    // Note: withCache doesn't work this way for gets, we need to use getFromCache
    // This is handled below via the cache service directly
  }

  // Detect ambiguity to determine parsing strategy
  const ambiguity = detectAmbiguity(raw);

  let result: EnrichedIntent;
  let method: "rust" | "llm" | "hybrid";
  let confidence: number;
  let fallbackUsed = false;
  let rustAttempt: ParseAttempt | undefined;
  let llmAttempt: ParseAttempt | undefined;

  try {
    switch (fullConfig.mode) {
      case "rust-first": {
        // Try Rust first, fall back to LLM if confidence is low
        rustAttempt = await runRustWithTimeout(
          raw,
          constraints,
          fullConfig.rustTimeout,
        );

        if (rustAttempt.error) {
          if (fullConfig.fallbackEnabled) {
            logger.debug(
              { error: rustAttempt.error.message },
              "Rust failed, falling back to LLM",
            );
            llmAttempt = await runLLMWithTimeout(
              raw,
              constraints,
              fullConfig.llmTimeout,
              config,
            );
            if (llmAttempt.error || !llmAttempt.result) {
              throw (
                llmAttempt.error || new Error("LLM parsing returned no result")
              );
            }
            result = llmAttempt.result;
            method = "llm";
            confidence = llmAttempt.confidence;
            fallbackUsed = true;
          } else {
            throw rustAttempt.error;
          }
        } else {
          result = rustAttempt.result ?? {
            actors: [],
            features: [],
            data_flows: [],
            tech_stack_hints: [],
            constraints: {},
            raw,
            enriched: {},
          };
          confidence = rustAttempt.confidence;
          method = "rust";

          // If confidence is low and ambiguity is high, enhance with LLM
          if (
            confidence < fullConfig.confidenceThreshold &&
            ambiguity.needsLLM
          ) {
            if (fullConfig.fallbackEnabled) {
              llmAttempt = await runLLMWithTimeout(
                raw,
                constraints,
                fullConfig.llmTimeout,
                config,
              );
              if (!llmAttempt.error && llmAttempt.result) {
                result = mergeResults(result, llmAttempt.result);
                method = "hybrid";
                confidence = Math.max(confidence, llmAttempt.confidence);
              }
            }
          }
        }
        break;
      }

      case "llm-first": {
        // Try LLM first for unstructured/ambiguous input, validate with Rust
        llmAttempt = await runLLMWithTimeout(
          raw,
          constraints,
          fullConfig.llmTimeout,
          config,
        );

        if (llmAttempt.error) {
          if (fullConfig.fallbackEnabled) {
            logger.debug(
              { error: llmAttempt.error.message },
              "LLM failed, falling back to Rust",
            );
            rustAttempt = await runRustWithTimeout(
              raw,
              constraints,
              fullConfig.rustTimeout,
            );
            if (rustAttempt.error || !rustAttempt.result) {
              throw (
                rustAttempt.error ||
                new Error("Rust parsing returned no result")
              );
            }
            result = rustAttempt.result;
            method = "rust";
            confidence = rustAttempt.confidence;
            fallbackUsed = true;
          } else {
            throw llmAttempt.error;
          }
        } else {
          result = llmAttempt.result ?? {
            actors: [],
            features: [],
            data_flows: [],
            tech_stack_hints: [],
            constraints: {},
            raw,
            enriched: {},
          };
          confidence = llmAttempt.confidence;
          method = "llm";

          // Validate with Rust if available
          if (fullConfig.fallbackEnabled) {
            try {
              rustAttempt = await runRustWithTimeout(
                raw,
                constraints,
                fullConfig.rustTimeout,
              );
              if (!rustAttempt.error && rustAttempt.result) {
                // Merge for validation - prefer LLM but use Rust as backup
                result = mergeResults(rustAttempt.result, result);
                method = "hybrid";
                confidence = Math.max(confidence, rustAttempt.confidence);
              }
            } catch (_e) {
              // Rust validation failed, but we have LLM result
              logger.debug("Rust validation failed, using LLM result only");
            }
          }
        }
        break;
      }

      case "hybrid":
      default: {
        // Parallel processing for maximum speed and intelligence
        if (fullConfig.parallelProcessing) {
          [rustAttempt, llmAttempt] = await Promise.all([
            runRustWithTimeout(raw, constraints, fullConfig.rustTimeout),
            runLLMWithTimeout(raw, constraints, fullConfig.llmTimeout, config),
          ]);

          // Decide which result to use based on success and confidence
          const rustSuccess = !rustAttempt.error && rustAttempt.result;
          const llmSuccess = !llmAttempt.error && llmAttempt.result;

          if (rustSuccess && llmSuccess) {
            // Both succeeded - merge results (safe to access as we checked above)
            result = mergeResults(
              rustAttempt.result as EnrichedIntent,
              llmAttempt.result as EnrichedIntent,
            );
            method = "hybrid";
            confidence = (rustAttempt.confidence + llmAttempt.confidence) / 2;
          } else if (llmSuccess) {
            result = llmAttempt.result as EnrichedIntent;
            method = "llm";
            confidence = llmAttempt.confidence;
            fallbackUsed = true;
          } else if (rustSuccess) {
            result = rustAttempt.result as EnrichedIntent;
            method = "rust";
            confidence = rustAttempt.confidence;
            fallbackUsed = true;
          } else {
            // Both failed
            const error =
              rustAttempt.error ||
              llmAttempt.error ||
              new Error("Both parsing methods failed");
            throw error;
          }
        } else {
          // Sequential: Try Rust first, then LLM if needed
          rustAttempt = await runRustWithTimeout(
            raw,
            constraints,
            fullConfig.rustTimeout,
          );

          if (
            rustAttempt.error ||
            rustAttempt.confidence < fullConfig.confidenceThreshold
          ) {
            llmAttempt = await runLLMWithTimeout(
              raw,
              constraints,
              fullConfig.llmTimeout,
              config,
            );

            if (!llmAttempt.error && llmAttempt.result) {
              if (rustAttempt.result) {
                result = mergeResults(rustAttempt.result, llmAttempt.result);
                method = "hybrid";
                confidence =
                  (rustAttempt.confidence + llmAttempt.confidence) / 2;
              } else {
                result = llmAttempt.result;
                method = "llm";
                confidence = llmAttempt.confidence;
                fallbackUsed = true;
              }
            } else if (rustAttempt.result) {
              result = rustAttempt.result;
              method = "rust";
              confidence = rustAttempt.confidence;
            } else {
              throw (
                llmAttempt.error ||
                rustAttempt.error ||
                new Error("Both parsing methods failed")
              );
            }
          } else {
            // rustAttempt.result is guaranteed to exist here since we passed the threshold check
            result = rustAttempt.result ?? {
              actors: [],
              features: [],
              data_flows: [],
              tech_stack_hints: [],
              constraints: {},
              raw,
              enriched: {},
            };
            method = "rust";
            confidence = rustAttempt.confidence;
          }
        }
        break;
      }
    }

    const processingTimeMs = Date.now() - startTime;

    logger.info(
      {
        method,
        confidence,
        ambiguity: ambiguity.score,
        processingTimeMs,
        fallbackUsed,
        rustTimeMs: rustAttempt?.timeMs,
        llmTimeMs: llmAttempt?.timeMs,
      },
      "Intent parsed successfully",
    );

    return {
      intent: result,
      confidence,
      method,
      processingTimeMs,
      cacheHit: false,
      ambiguityScore: ambiguity.score,
      fallbackUsed,
    };
  } catch (error) {
    logger.error(
      {
        error: (error as Error).message,
        mode: fullConfig.mode,
      },
      "Hybrid intent parsing failed",
    );
    throw error;
  }
}

/**
 * Parse intent with caching wrapper
 */
export async function parseIntentHybridWithCache(
  raw: string,
  constraints?: Record<string, unknown>,
  config?: Partial<HybridCompilerConfig>,
): Promise<ParseResult> {
  const fullConfig = { ...getHybridConfig(), ...config };

  if (!fullConfig.cachingEnabled) {
    return parseIntentHybrid(raw, constraints, config);
  }

  const cacheKey = JSON.stringify({
    v: "hybrid-v1",
    raw: raw.trim(),
    constraints,
    mode: fullConfig.mode,
  });

  return await withCache(
    fullConfig.cacheType,
    cacheKey,
    async () => parseIntentHybrid(raw, constraints, config),
    { skipCache: false },
  );
}

/**
 * Batch parse multiple intents
 */
export async function parseIntentsBatch(
  inputs: Array<{ raw: string; constraints?: Record<string, unknown> }>,
  config?: Partial<HybridCompilerConfig>,
): Promise<ParseResult[]> {
  const results: ParseResult[] = [];

  // Process in batches to avoid overwhelming the system
  const batchSize = 5;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(({ raw, constraints }) =>
        parseIntentHybridWithCache(raw, constraints, config).catch((error) => ({
          intent: {
            actors: [],
            features: [],
            data_flows: [],
            tech_stack_hints: [],
            constraints: constraints || {},
            raw,
            enriched: {},
          } as EnrichedIntent,
          confidence: 0,
          method: "rust" as const,
          processingTimeMs: 0,
          cacheHit: false,
          ambiguityScore: 1,
          fallbackUsed: false,
          error: (error as Error).message,
        })),
      ),
    );

    results.push(...(batchResults as ParseResult[]));
  }

  return results;
}

/**
 * Get parsing statistics
 */
export function getHybridCompilerStats(): {
  config: HybridCompilerConfig;
  ambiguityThreshold: number;
} {
  return {
    config: getHybridConfig(),
    ambiguityThreshold: 0.5,
  };
}
