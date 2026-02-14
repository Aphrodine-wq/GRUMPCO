/**
 * Context Compressor — Token Efficiency Layer
 *
 * Reduces token consumption by 40–60% by:
 *  1. Flattening nested JSON → Markdown/CSV tables
 *  2. Summarizing old tool outputs (observation masking)
 *  3. Deduplicating repeated content in context windows
 *
 * @module services/ai-providers/contextCompressor
 */

// ============================================================================
// Types
// ============================================================================

export interface ContextItem {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Tool call/result name */
  name?: string;
  /** Timestamp for recency-based masking */
  timestamp?: number;
  /** Original token count (estimated) */
  tokenEstimate?: number;
}

export interface CompressionResult {
  items: ContextItem[];
  originalTokens: number;
  compressedTokens: number;
  savings: number; // 0.0 – 1.0
}

export interface CompressorOptions {
  /** Max age in ms before tool outputs get summarized. @default 300_000 (5 min) */
  observationMaxAgeMs: number;
  /** Min content length (chars) before compression kicks in. @default 500 */
  minContentLength: number;
  /** Target max tokens for the compressed context. @default 100_000 */
  targetMaxTokens: number;
  /** Whether to convert JSON objects to markdown tables. @default true */
  flattenJson: boolean;
  /** Whether to mask old tool observations. @default true */
  maskObservations: boolean;
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Rough token estimate: ~4 chars per token (GPT-class models).
 * Good enough for compression decisions; exact count not needed.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================================
// JSON → Markdown Flattener
// ============================================================================

/**
 * Convert a JSON object/array to a compact Markdown representation.
 * Arrays of objects → tables. Nested objects → indented key-value lists.
 * This typically saves 40–60% of tokens compared to raw JSON.
 */
export function jsonToMarkdown(data: unknown, depth = 0): string {
  if (data === null || data === undefined) return '_null_';
  if (typeof data !== 'object') return String(data);

  const indent = '  '.repeat(depth);

  // Arrays of objects → Markdown table
  if (Array.isArray(data)) {
    if (data.length === 0) return '_empty array_';

    // Check if it's an array of homogeneous objects
    if (typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
      const keys = Object.keys(data[0] as Record<string, unknown>);
      if (keys.length > 0 && keys.length <= 10) {
        // Build markdown table
        const header = `| ${keys.join(' | ')} |`;
        const separator = `| ${keys.map(() => '---').join(' | ')} |`;
        const rows = data.map((item) => {
          const record = item as Record<string, unknown>;
          const values = keys.map((k) => {
            const val = record[k];
            if (typeof val === 'object') return JSON.stringify(val);
            return String(val ?? '');
          });
          return `| ${values.join(' | ')} |`;
        });
        return [header, separator, ...rows].join('\n');
      }
    }

    // Heterogeneous array or primitives
    return data.map((item, i) => `${indent}- [${i}] ${jsonToMarkdown(item, depth + 1)}`).join('\n');
  }

  // Object → key-value list
  const record = data as Record<string, unknown>;
  const entries = Object.entries(record);
  if (entries.length === 0) return '_empty object_';

  return entries
    .map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        return `${indent}**${key}**:\n${jsonToMarkdown(value, depth + 1)}`;
      }
      return `${indent}**${key}**: ${String(value)}`;
    })
    .join('\n');
}

/**
 * Try to detect and convert JSON strings within content to Markdown.
 * Only converts JSON blocks that are at least `minLength` characters.
 */
export function flattenJsonInContent(content: string, minLength = 200): string {
  // Match JSON objects/arrays in the content
  return content.replace(/```(?:json)?\s*\n?([\s\S]*?)\n?```/g, (_match, jsonStr: string) => {
    if (jsonStr.length < minLength) return _match; // Too small to bother

    try {
      const parsed = JSON.parse(jsonStr.trim());
      const markdown = jsonToMarkdown(parsed);
      // Only use markdown if it's actually shorter
      if (markdown.length < jsonStr.length * 0.8) {
        return '```\n' + markdown + '\n```';
      }
    } catch {
      // Not valid JSON, leave as-is
    }
    return _match;
  });
}

// ============================================================================
// Observation Masking
// ============================================================================

/**
 * Summarize old tool outputs to reclaim context window space.
 * Replaces long tool outputs with a brief summary.
 */
export function maskObservation(item: ContextItem, maxLength = 200): ContextItem {
  if (item.role !== 'tool') return item;
  if (item.content.length <= maxLength) return item;

  // Keep the first line and last 2 lines for context
  const lines = item.content.split('\n');
  const firstLine = lines[0];
  const lastLines = lines.slice(-2).join('\n');
  const lineCount = lines.length;
  const charCount = item.content.length;

  const summary = [
    `[Observation masked: ${item.name ?? 'tool'} output]`,
    `First line: ${firstLine?.slice(0, 100)}`,
    `...${lineCount} lines, ~${charCount} chars omitted...`,
    `Last lines: ${lastLines.slice(0, 100)}`,
  ].join('\n');

  return {
    ...item,
    content: summary,
    tokenEstimate: estimateTokens(summary),
  };
}

// ============================================================================
// Main Compressor
// ============================================================================

export class ContextCompressor {
  private options: CompressorOptions;

  constructor(options?: Partial<CompressorOptions>) {
    this.options = {
      observationMaxAgeMs: options?.observationMaxAgeMs ?? 300_000,
      minContentLength: options?.minContentLength ?? 500,
      targetMaxTokens: options?.targetMaxTokens ?? 100_000,
      flattenJson: options?.flattenJson ?? true,
      maskObservations: options?.maskObservations ?? true,
    };
  }

  /**
   * Compress a context window for optimal token usage.
   */
  compress(items: ContextItem[]): CompressionResult {
    const originalTokens = items.reduce(
      (sum, item) => sum + (item.tokenEstimate ?? estimateTokens(item.content)),
      0
    );

    let compressed = [...items];
    const now = Date.now();

    // Step 1: Flatten JSON in tool outputs and assistant messages
    if (this.options.flattenJson) {
      compressed = compressed.map((item) => {
        if (item.content.length < this.options.minContentLength) return item;
        if (item.role === 'system') return item; // Don't modify system prompt

        const flattened = flattenJsonInContent(item.content, this.options.minContentLength);
        if (flattened !== item.content) {
          return {
            ...item,
            content: flattened,
            tokenEstimate: estimateTokens(flattened),
          };
        }
        return item;
      });
    }

    // Step 2: Mask old tool observations
    if (this.options.maskObservations) {
      compressed = compressed.map((item) => {
        if (item.role !== 'tool') return item;

        const age = item.timestamp ? now - item.timestamp : Infinity;
        if (age > this.options.observationMaxAgeMs && item.content.length > 300) {
          return maskObservation(item);
        }
        return item;
      });
    }

    // Step 3: Deduplicate repeated content
    compressed = this.deduplicateContent(compressed);

    // Step 4: If still over target, progressively mask more observations
    let compressedTokens = compressed.reduce(
      (sum, item) => sum + (item.tokenEstimate ?? estimateTokens(item.content)),
      0
    );

    if (compressedTokens > this.options.targetMaxTokens) {
      // Sort tool items by age (oldest first) and mask them
      const toolIndices = compressed
        .map((item, i) => ({ item, index: i }))
        .filter(({ item }) => item.role === 'tool' && item.content.length > 200)
        .sort((a, b) => (a.item.timestamp ?? 0) - (b.item.timestamp ?? 0));

      for (const { index } of toolIndices) {
        if (compressedTokens <= this.options.targetMaxTokens) break;
        const before = estimateTokens(compressed[index].content);
        compressed[index] = maskObservation(compressed[index]);
        const after = estimateTokens(compressed[index].content);
        compressedTokens -= before - after;
      }
    }

    compressedTokens = compressed.reduce(
      (sum, item) => sum + (item.tokenEstimate ?? estimateTokens(item.content)),
      0
    );

    return {
      items: compressed,
      originalTokens,
      compressedTokens,
      savings: originalTokens > 0 ? 1 - compressedTokens / originalTokens : 0,
    };
  }

  /**
   * Deduplicate identical or near-identical content across items.
   */
  private deduplicateContent(items: ContextItem[]): ContextItem[] {
    const seen = new Map<string, number>(); // content hash → index
    return items.map((item, index) => {
      if (item.role === 'system') return item; // Never dedup system

      // Use first 200 chars as fingerprint
      const fingerprint = item.content.slice(0, 200).trim();
      if (seen.has(fingerprint) && item.content.length > 100) {
        const prevIndex = seen.get(fingerprint)!;
        return {
          ...item,
          content: `[Duplicate of message ${prevIndex + 1}, ${item.content.length} chars]`,
          tokenEstimate: 15,
        };
      }

      seen.set(fingerprint, index);
      return item;
    });
  }
}
