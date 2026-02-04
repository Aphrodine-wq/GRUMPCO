/**
 * Unified Intent Parser Interface
 * Provides a consistent interface for parsing intents via WASM, CLI, or LLM fallback
 */

import logger from "../middleware/logger.js";
import { parseIntentWasm, isWasmAvailable } from "./intentParserWasm.js";
import { type StructuredIntent } from "./intentCliRunner.js";
import { withResilience } from "./resilience.js";
import { getStream, type StreamParams } from "./llmGateway.js";
import { getIntentExtractionFallbackPrompt } from "../prompts/intent-compiler.js";

// Version tag for intent caching/normalization
export const INTENT_CACHE_VERSION = "v1";

// Default model for LLM fallback
const DEFAULT_INTENT_MODEL = "moonshotai/kimi-k2.5";

/**
 * Parser configuration options
 */
export interface ParserConfig {
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Enable caching */
  useCache?: boolean;
  /** Fallback to LLM on failure */
  fallbackToLlm?: boolean;
  /** Model to use for LLM fallback */
  model?: string;
}

/**
 * Parser result with metadata
 */
export interface ParserResult {
  /** Parsed intent */
  intent: StructuredIntent;
  /** Parser used */
  parser: "wasm" | "cli" | "llm";
  /** Time taken in ms */
  durationMs: number;
  /** Whether result was from cache */
  fromCache?: boolean;
  /** Any warnings */
  warnings?: string[];
}

/**
 * Unified Intent Parser Interface
 * All parser implementations must conform to this interface
 */
export interface IntentParser {
  /**
   * Parse raw text into structured intent
   * @param text Raw natural language text
   * @param constraints Optional constraints
   * @param config Parser configuration
   */
  parse(
    text: string,
    constraints?: Record<string, unknown>,
    config?: ParserConfig,
  ): Promise<ParserResult>;

  /**
   * Check if this parser is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get parser name
   */
  getName(): string;
}

/**
 * Collects streaming LLM response into complete text
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
 * Extract structured intent from raw text using LLM
 */
async function extractIntentViaLlm(
  text: string,
  model: string = DEFAULT_INTENT_MODEL,
): Promise<StructuredIntent> {
  const resilient = withResilience(
    async (params: StreamParams): Promise<string> =>
      getCompletion(params, { model }),
    "nim-intent-extraction",
  );

  const systemPrompt = getIntentExtractionFallbackPrompt();
  const userMsg = `Raw input:\n${text.trim()}\n\nExtract structured intent as JSON.`;

  const res = await resilient({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMsg }],
  });

  let extracted = res.trim();
  const jsonMatch = extracted.match(/\{[\s\S]*\}/);
  if (jsonMatch) extracted = jsonMatch[0];
  if (extracted.includes("```json")) {
    const m = extracted.match(/```json\n?([\s\S]*?)\n?```/);
    if (m) extracted = m[1];
  } else if (extracted.includes("```")) {
    const m = extracted.match(/```\n?([\s\S]*?)\n?```/);
    if (m) extracted = m[1];
  }

  const parsed = JSON.parse(extracted) as Record<string, unknown>;
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
    raw: typeof parsed.raw === "string" ? parsed.raw : text.trim(),
  };
}

/**
 * WASM-based Intent Parser
 * Uses Rust WASM module for high-performance parsing
 */
export class WasmIntentParser implements IntentParser {
  private cache = new Map<string, StructuredIntent>();

  getName(): string {
    return "wasm";
  }

  async isAvailable(): Promise<boolean> {
    return isWasmAvailable();
  }

  async parse(
    text: string,
    constraints?: Record<string, unknown>,
    config?: ParserConfig,
  ): Promise<ParserResult> {
    const startTime = Date.now();
    const cacheKey = JSON.stringify({ text: text.trim(), constraints });

    // Check cache if enabled
    if (config?.useCache !== false && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return {
          intent: cached,
          parser: "wasm",
          durationMs: Date.now() - startTime,
          fromCache: true,
        };
      }
    }

    // Check if WASM is actually available
    if (!(await this.isAvailable())) {
      throw new Error("WASM module not available");
    }

    try {
      const result = await parseIntentWasm(text.trim(), constraints);

      // Cache result if enabled
      if (config?.useCache !== false) {
        this.cache.set(cacheKey, result);
      }

      return {
        intent: result,
        parser: "wasm",
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "WASM intent parser failed",
      );
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * CLI-based Intent Parser
 * Spawns grump-intent CLI process
 */
export class CliIntentParser implements IntentParser {
  private cache = new Map<string, StructuredIntent>();

  getName(): string {
    return "cli";
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Quick check - try to spawn the CLI with --help
      const { runIntentCli } = await import("./intentCliRunner.js");
      await runIntentCli("test", {}, 5000);
      return true;
    } catch {
      return false;
    }
  }

  async parse(
    text: string,
    constraints?: Record<string, unknown>,
    config?: ParserConfig,
  ): Promise<ParserResult> {
    const startTime = Date.now();
    const cacheKey = JSON.stringify({ text: text.trim(), constraints });

    // Check cache if enabled
    if (config?.useCache !== false && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return {
          intent: cached,
          parser: "cli",
          durationMs: Date.now() - startTime,
          fromCache: true,
        };
      }
    }

    try {
      const { runIntentCli } = await import("./intentCliRunner.js");
      const timeoutMs = config?.timeoutMs ?? 20000;
      const result = await runIntentCli(text.trim(), constraints, timeoutMs);

      // Cache result if enabled
      if (config?.useCache !== false) {
        this.cache.set(cacheKey, result);
      }

      return {
        intent: result,
        parser: "cli",
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "CLI intent parser failed",
      );
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * LLM-based Intent Parser
 * Uses LLM Gateway as fallback
 */
export class LlmIntentParser implements IntentParser {
  private cache = new Map<string, StructuredIntent>();
  private model: string;

  constructor(model: string = DEFAULT_INTENT_MODEL) {
    this.model = model;
  }

  getName(): string {
    return "llm";
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.NVIDIA_NIM_API_KEY;
  }

  async parse(
    text: string,
    constraints?: Record<string, unknown>,
    config?: ParserConfig,
  ): Promise<ParserResult> {
    const startTime = Date.now();
    const cacheKey = JSON.stringify({
      text: text.trim(),
      constraints,
      model: this.model,
    });

    // Check cache if enabled
    if (config?.useCache !== false && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return {
          intent: cached,
          parser: "llm",
          durationMs: Date.now() - startTime,
          fromCache: true,
        };
      }
    }

    try {
      const model = config?.model ?? this.model;
      const result = await extractIntentViaLlm(text.trim(), model);

      // Merge with constraints
      if (constraints) {
        result.constraints = { ...result.constraints, ...constraints };
      }

      // Cache result if enabled
      if (config?.useCache !== false) {
        this.cache.set(cacheKey, result);
      }

      return {
        intent: result,
        parser: "llm",
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "LLM intent parser failed",
      );
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Hybrid Intent Parser
 * Tries WASM → CLI → LLM in sequence
 */
export class HybridIntentParser implements IntentParser {
  private wasmParser: WasmIntentParser;
  private cliParser: CliIntentParser;
  private llmParser: LlmIntentParser;

  constructor(llmModel?: string) {
    this.wasmParser = new WasmIntentParser();
    this.cliParser = new CliIntentParser();
    this.llmParser = new LlmIntentParser(llmModel);
  }

  getName(): string {
    return "hybrid";
  }

  async isAvailable(): Promise<boolean> {
    // Hybrid is available if any parser is available
    const [wasm, cli, llm] = await Promise.all([
      this.wasmParser.isAvailable(),
      this.cliParser.isAvailable(),
      this.llmParser.isAvailable(),
    ]);
    return wasm || cli || llm;
  }

  async parse(
    text: string,
    constraints?: Record<string, unknown>,
    config?: ParserConfig,
  ): Promise<ParserResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    // Try WASM first
    if (await this.wasmParser.isAvailable()) {
      try {
        const result = await this.wasmParser.parse(text, constraints, config);
        return {
          ...result,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.debug({ error: message }, "WASM parser failed, trying CLI");
        warnings.push(`WASM failed: ${message}`);
      }
    }

    // Try CLI second
    if (await this.cliParser.isAvailable()) {
      try {
        const result = await this.cliParser.parse(text, constraints, config);
        return {
          ...result,
          durationMs: Date.now() - startTime,
          warnings,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.debug({ error: message }, "CLI parser failed, trying LLM");
        warnings.push(`CLI failed: ${message}`);
      }
    }

    // Try LLM fallback if enabled
    if (
      config?.fallbackToLlm !== false &&
      (await this.llmParser.isAvailable())
    ) {
      try {
        const result = await this.llmParser.parse(text, constraints, config);
        return {
          ...result,
          durationMs: Date.now() - startTime,
          warnings,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, "LLM parser failed");
        warnings.push(`LLM failed: ${message}`);
      }
    }

    // All parsers failed
    throw new Error(
      `All intent parsers failed. Warnings: ${warnings.join("; ")}`,
    );
  }

  clearCache(): void {
    this.wasmParser.clearCache();
    this.cliParser.clearCache();
    this.llmParser.clearCache();
  }

  getCacheSize(): number {
    return (
      this.wasmParser.getCacheSize() +
      this.cliParser.getCacheSize() +
      this.llmParser.getCacheSize()
    );
  }
}

/**
 * Get the default parser based on environment configuration
 */
export function getDefaultParser(): IntentParser {
  const mode = process.env.GRUMP_INTENT_PARSER_MODE ?? "hybrid";

  switch (mode) {
    case "wasm":
      return new WasmIntentParser();
    case "cli":
      return new CliIntentParser();
    case "llm":
      return new LlmIntentParser();
    case "hybrid":
    default:
      return new HybridIntentParser();
  }
}

// Export singleton instance for convenience
export const defaultParser = getDefaultParser();
