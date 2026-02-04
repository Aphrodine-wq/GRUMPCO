/**
 * RAG Service – embeddings via NIM, vector store (file or Pinecone), LLM via model router and gateway.
 * Query → embed → vector + optional hybrid (keyword) → optional re-ranker → format context → generate.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { existsSync } from "fs";
import logger from "../middleware/logger.js";
import {
  getVectorStore,
  type ChunkWithScore,
  type VectorChunk,
} from "./vectorStoreAdapter.js";
import { chunkGrumpByAST } from "./grumpParser.js";
import { BM25ChunkIndex } from "./bm25Index.js";
import { rerankWithCrossEncoder } from "./crossEncoderReranker.js";
import {
  buildGraph,
  loadGraph,
  saveGraph,
  getRelatedChunkIds,
  clearGraphCache,
} from "./graphRagService.js";
import { getFromPrefetchCache } from "./ragPrefetchCache.js";
import { embed as embedViaService } from "./embeddingService.js";
import { parseIntent, type StructuredIntent } from "./intentCompilerService.js";
import { getRAGModel } from "./modelRouter.js";
import { getCompletion } from "./llmGatewayHelper.js";
import type { LLMProvider } from "./llmGateway.js";
const RAG_EMBED_MODEL_DEFAULT = "nvidia/nv-embedqa-e5-v5";
const DEFAULT_INDEX_PATH = "./data/rag-index.json";
const DEFAULT_BM25_INDEX_PATH = "./data/rag-bm25.json";
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
/** Small-to-big: small chunks for retrieval (~128 tokens ≈ 512 chars). */
const SMALL_CHUNK_SIZE = 512;
const SMALL_CHUNK_OVERLAP = 128;
/** Parent chunk size for context (~512 tokens ≈ 2048 chars). */
const PARENT_CHUNK_SIZE = 2048;
const PARENT_CHUNK_OVERLAP = 256;
const TOP_K = 6;
const TOP_K_HYBRID = 12;
const RRF_K = 60;

export type DocType = "doc" | "code" | "spec" | "grump";

export interface IndexChunk {
  id: string;
  content: string;
  embedding: number[];
  source: string;
  type: DocType;
}

export interface RagIndex {
  chunks: IndexChunk[];
  embeddedAt: string;
}

export interface RagCitation {
  id: number;
  source: string;
  type: DocType;
  url?: string;
}

export interface RagQueryOptions {
  outputFormat?: "natural" | "structured";
  structuredSchema?: string;
  /** Filter by doc type(s). */
  types?: DocType | DocType[];
  /** Use hybrid (vector + keyword) merge with RRF. */
  hybrid?: boolean;
  /** Namespace for multi-tenant (workspace/project id). */
  namespace?: string;
  /** Use intent-guided retrieval (parse intent, expand query, then retrieve). Default when RAG_INTENT_GUIDED is set. */
  intentGuided?: boolean;
}

export interface RagQueryResult {
  answer: string;
  sources?: Array<{ source: string; type: DocType }>;
  confidence?: number;
  fallback?: string;
  citations?: RagCitation[];
  structured?: Record<string, unknown>;
  /** Set when fallback model was used for low confidence responses. */
  fallbackProvider?: string;
}

function getApiKey(): string | null {
  return process.env.NVIDIA_NIM_API_KEY || null;
}

function getIndexPath(): string {
  return process.env.RAG_INDEX_PATH || DEFAULT_INDEX_PATH;
}

function getBm25IndexPath(): string {
  return process.env.RAG_BM25_INDEX_PATH || DEFAULT_BM25_INDEX_PATH;
}

let bm25IndexCache: BM25ChunkIndex | null = null;

async function loadBm25Index(): Promise<BM25ChunkIndex | null> {
  if (bm25IndexCache) return bm25IndexCache;
  const path = getBm25IndexPath();
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, "utf8");
    const data = JSON.parse(raw) as {
      chunks?: Array<{
        id: string;
        content: string;
        source: string;
        type: string;
      }>;
    };
    const chunks = data.chunks ?? [];
    if (chunks.length === 0) return null;
    const index = new BM25ChunkIndex();
    index.addChunks(chunks);
    bm25IndexCache = index;
    return index;
  } catch {
    return null;
  }
}

function getRagEmbedModel(): string {
  return process.env.RAG_EMBED_MODEL || RAG_EMBED_MODEL_DEFAULT;
}

/** Simple keyword score: count of query terms (lowercase) in content. */
function keywordScore(query: string, content: string): number {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  const lower = content.toLowerCase();
  let count = 0;
  for (const t of terms) {
    let idx = 0;
    while ((idx = lower.indexOf(t, idx)) >= 0) {
      count++;
      idx++;
    }
  }
  return count;
}

/** Reciprocal Rank Fusion: 1/(k + rank). */
function rrfScore(rank: number): number {
  return 1 / (RRF_K + rank);
}

/**
 * Splits text into overlapping chunks for embedding and retrieval.
 *
 * Uses a progressive splitting strategy: first by paragraphs (\n\n),
 * then lines (\n), then words if needed. Maintains overlap between
 * chunks to preserve context across boundaries.
 *
 * @param text - The raw text content to chunk
 * @param source - Source identifier (e.g., filename or URL)
 * @param type - Document type: 'doc' | 'code' | 'spec' | 'grump'
 * @returns Array of chunks with content, source, and type metadata
 *
 * @example
 * ```typescript
 * const chunks = chunkText(markdownContent, 'docs/api.md', 'doc');
 * // Each chunk is ~1000 chars with ~200 char overlap
 * ```
 */
export function chunkText(
  text: string,
  source: string,
  type: DocType,
): { content: string; source: string; type: DocType }[] {
  const chunks: { content: string; source: string; type: DocType }[] = [];
  const sep = /\n\n+/;
  let parts = text.split(sep).filter(Boolean);
  if (parts.length <= 1) parts = text.split(/\n/).filter(Boolean);
  if (parts.length <= 1) parts = text.split(/\s+/).filter(Boolean);

  const flat: string[] = [];
  for (const p of parts) {
    if (p.length <= CHUNK_SIZE) {
      flat.push(p);
    } else {
      for (let i = 0; i < p.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        flat.push(p.slice(i, i + CHUNK_SIZE));
      }
    }
  }

  let acc = "";
  for (const p of flat) {
    if (acc.length + p.length + 1 <= CHUNK_SIZE) {
      acc = acc ? `${acc}\n${p}` : p;
      continue;
    }
    if (acc) {
      chunks.push({ content: acc.trim(), source, type });
      const tail = acc.slice(-CHUNK_OVERLAP);
      acc = tail ? `${tail}\n${p}` : p;
    } else {
      chunks.push({ content: p.slice(0, CHUNK_SIZE).trim(), source, type });
      acc = p.slice(CHUNK_SIZE - CHUNK_OVERLAP);
    }
  }
  if (acc.trim()) chunks.push({ content: acc.trim(), source, type });
  return chunks;
}

export interface SmallToBigChunk {
  content: string;
  source: string;
  type: DocType;
  parentChunkId: string;
  parentContent: string;
}

/**
 * Small-to-big chunking: create small chunks for retrieval, linked to parent chunks for context.
 * Retrieves on small chunks (precise matching), returns parent content (richer context).
 */
export function chunkTextSmallToBig(
  text: string,
  source: string,
  type: DocType,
): SmallToBigChunk[] {
  const sep = /\n\n+/;
  let parts = text.split(sep).filter(Boolean);
  if (parts.length <= 1) parts = text.split(/\n/).filter(Boolean);
  if (parts.length <= 1) parts = text.split(/\s+/).filter(Boolean);

  const flat: string[] = [];
  for (const p of parts) {
    if (p.length <= PARENT_CHUNK_SIZE) {
      flat.push(p);
    } else {
      for (
        let i = 0;
        i < p.length;
        i += PARENT_CHUNK_SIZE - PARENT_CHUNK_OVERLAP
      ) {
        flat.push(p.slice(i, i + PARENT_CHUNK_SIZE));
      }
    }
  }

  const parentChunks: string[] = [];
  let acc = "";
  for (const p of flat) {
    if (acc.length + p.length + 1 <= PARENT_CHUNK_SIZE) {
      acc = acc ? `${acc}\n${p}` : p;
      continue;
    }
    if (acc) {
      parentChunks.push(acc.trim());
      const tail = acc.slice(-PARENT_CHUNK_OVERLAP);
      acc = tail ? `${tail}\n${p}` : p;
    } else {
      parentChunks.push(p.slice(0, PARENT_CHUNK_SIZE).trim());
      acc = p.slice(PARENT_CHUNK_SIZE - PARENT_CHUNK_OVERLAP);
    }
  }
  if (acc.trim()) parentChunks.push(acc.trim());

  const baseId = `parent_${source.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`;
  const result: SmallToBigChunk[] = [];

  for (let pIdx = 0; pIdx < parentChunks.length; pIdx++) {
    const parentContent = parentChunks[pIdx];
    if (!parentContent) continue;
    const parentId = `${baseId}_p${pIdx}`;

    const smallParts =
      parentContent.split(sep).filter(Boolean).length <= 1
        ? parentContent.split(/\n/).filter(Boolean)
        : parentContent.split(sep).filter(Boolean);
    const smallFlat: string[] = [];
    for (const s of smallParts) {
      if (s.length <= SMALL_CHUNK_SIZE) {
        smallFlat.push(s);
      } else {
        for (
          let i = 0;
          i < s.length;
          i += SMALL_CHUNK_SIZE - SMALL_CHUNK_OVERLAP
        ) {
          smallFlat.push(s.slice(i, i + SMALL_CHUNK_SIZE));
        }
      }
    }

    let smallAcc = "";
    for (const s of smallFlat) {
      if (smallAcc.length + s.length + 1 <= SMALL_CHUNK_SIZE) {
        smallAcc = smallAcc ? `${smallAcc}\n${s}` : s;
        continue;
      }
      if (smallAcc) {
        result.push({
          content: smallAcc.trim(),
          source,
          type,
          parentChunkId: parentId,
          parentContent,
        });
        const tail = smallAcc.slice(-SMALL_CHUNK_OVERLAP);
        smallAcc = tail ? `${tail}\n${s}` : s;
      } else {
        result.push({
          content: s.slice(0, SMALL_CHUNK_SIZE).trim(),
          source,
          type,
          parentChunkId: parentId,
          parentContent,
        });
        smallAcc = s.slice(SMALL_CHUNK_SIZE - SMALL_CHUNK_OVERLAP);
      }
    }
    if (smallAcc.trim()) {
      result.push({
        content: smallAcc.trim(),
        source,
        type,
        parentChunkId: parentId,
        parentContent,
      });
    }
  }
  return result;
}

/**
 * Loads the RAG index from the filesystem.
 *
 * Reads the JSON index file from RAG_INDEX_PATH (or default ./data/rag-index.json).
 * Returns null if the file doesn't exist.
 *
 * @returns The loaded RagIndex or null if not found
 */
export async function loadIndex(): Promise<RagIndex | null> {
  const path = getIndexPath();
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as RagIndex;
}

/**
 * Persists the RAG index to the filesystem.
 *
 * Writes to RAG_INDEX_PATH (or default ./data/rag-index.json).
 * Creates parent directories if they don't exist.
 *
 * @param index - The RagIndex to persist
 */
export async function saveIndex(index: RagIndex): Promise<void> {
  const path = getIndexPath();
  const dir = dirname(path);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(path, JSON.stringify(index), "utf8");
}

const CONFIDENCE_LOW_THRESHOLD = 0.3;
const FALLBACK_MESSAGE =
  "Would you like to rephrase your question or contact support?";
// Use Llama 3.1 405B as the fallback model for low-confidence RAG responses
const RAG_FALLBACK_MODEL = "meta/llama-3.1-405b-instruct";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Re-rank candidates using NIM embedding similarity (query vs chunk embeddings).
 */
async function rerankViaNim(
  query: string,
  candidates: ChunkWithScore[],
  topK: number,
): Promise<ChunkWithScore[]> {
  if (candidates.length === 0) return [];
  try {
    const [queryEmb] = await embedViaService([query], {
      model: getRagEmbedModel(),
      inputType: "query",
    });
    const withScore = candidates.map((c) => ({
      ...c,
      score: cosineSimilarity(queryEmb, c.chunk.embedding),
    }));
    withScore.sort((a, b) => b.score - a.score);
    return withScore.slice(0, topK);
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "RAG NIM re-ranker failed");
    return candidates.slice(0, topK);
  }
}

/**
 * Re-rank candidates with optional cross-encoder (RAG_RERANKER=cross-encoder, RAG_CROSS_ENCODER_URL),
 * external re-ranker (RAG_RERANKER_URL), or NIM (RAG_RERANKER=nim).
 */
async function rerank(
  query: string,
  candidates: ChunkWithScore[],
  topK: number,
): Promise<ChunkWithScore[]> {
  if (candidates.length === 0) return [];
  const rerankerKind = process.env.RAG_RERANKER;
  if (rerankerKind === "cross-encoder" && process.env.RAG_CROSS_ENCODER_URL) {
    return rerankWithCrossEncoder(query, candidates, topK, {
      url: process.env.RAG_CROSS_ENCODER_URL,
      timeoutMs: 10_000,
    });
  }
  if (rerankerKind === "nim" && getApiKey()) {
    return rerankViaNim(query, candidates, topK);
  }
  const url = process.env.RAG_RERANKER_URL;
  if (!url) return candidates.slice(0, topK);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        documents: candidates.map((c) => c.chunk.content),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return candidates.slice(0, topK);
    const data = (await res.json()) as { scores?: number[]; order?: number[] };
    const scores = data.scores;
    const order =
      data.order ??
      (scores
        ? scores
            .map((_, i) => i)
            .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
        : undefined);
    if (!order?.length) return candidates.slice(0, topK);
    const out: ChunkWithScore[] = order
      .slice(0, topK)
      .map((i) => candidates[i])
      .filter((c): c is ChunkWithScore => c !== undefined);
    return out;
  } catch {
    return candidates.slice(0, topK);
  }
}

export interface GetRagContextOptions {
  namespace?: string;
  types?: DocType | DocType[];
  maxChunks?: number;
  /** When true (default when RAG_INTENT_GUIDED is set), use intent-guided retrieval. Set false to skip. */
  intentGuided?: boolean;
}

export interface RagContextResult {
  context: string;
  sources?: Array<{ source: string; type: DocType }>;
  /** Set when intent-guided retrieval was used. */
  intent?: StructuredIntent;
}

/**
 * Retrieves relevant context from the vector store without calling the LLM.
 *
 * Embeds the query, searches the vector store, and formats the top chunks
 * as a context string suitable for injection into an LLM prompt.
 *
 * @param query - The search query to embed and match
 * @param options - Optional filtering and limit settings
 * @param options.namespace - Multi-tenant namespace (e.g., workspace ID)
 * @param options.types - Filter by document type(s)
 * @param options.maxChunks - Maximum chunks to return (default: 6)
 * @returns Context string and sources, or null if unavailable
 *
 * @example
 * ```typescript
 * const result = await getRagContextForPrompt('How do I authenticate?', {
 *   types: ['doc', 'spec'],
 *   maxChunks: 4,
 * });
 * if (result) {
 *   const prompt = `Context:\n${result.context}\n\nQuestion: ...`;
 * }
 * ```
 */
export async function getRagContextForPrompt(
  query: string,
  options?: GetRagContextOptions,
): Promise<RagContextResult | null> {
  if (!getApiKey()) return null;

  if (process.env.RAG_PREDICTIVE_PREFETCH === "true") {
    // Convert options for cache lookup (normalize types to string[])
    const cacheOptions = options
      ? {
          namespace: options.namespace,
          types: options.types
            ? ((Array.isArray(options.types)
                ? options.types
                : [options.types]) as string[])
            : undefined,
        }
      : undefined;
    const cached = getFromPrefetchCache(query, cacheOptions);
    if (cached) return cached as import("./ragService.js").RagContextResult;
  }

  const maxChunks = options?.maxChunks ?? 6;
  try {
    const [queryEmb] = await embedViaService([query], {
      model: getRagEmbedModel(),
      inputType: "query",
    });
    const store = getVectorStore();
    const candidates = await store.query(queryEmb, {
      topK: maxChunks,
      types: options?.types,
      namespace: options?.namespace,
    });
    if (candidates.length === 0) return null;
    const top = candidates.map((c) => c.chunk);
    const contentForContext = (chunk: (typeof top)[0]) =>
      (chunk.metadata?.parentContent as string | undefined) ?? chunk.content;
    const context = top
      .map(
        (c, i) => `[${i + 1}] ${c.source} (${c.type})\n${contentForContext(c)}`,
      )
      .join("\n\n---\n\n");
    const sources = [
      ...new Map(
        top.map((c) => [c.source, { source: c.source, type: c.type }]),
      ).values(),
    ];
    return { context, sources };
  } catch (e) {
    logger.debug(
      { error: (e as Error).message },
      "getRagContextForPrompt failed",
    );
    return null;
  }
}

const INTENT_PARSE_TIMEOUT_MS = 3000;

function isIntentGuidedEnabled(options?: GetRagContextOptions): boolean {
  if (options?.intentGuided === false) return false;
  return (
    process.env.RAG_INTENT_GUIDED !== "false" &&
    process.env.RAG_INTENT_GUIDED !== "0"
  );
}

/**
 * Intent-guided RAG context: parse intent from the query, expand the query with features/tech/data_flows,
 * then run vector retrieval (and optional rerank) to get more relevant chunks.
 * Falls back to getRagContextForPrompt when intent parsing is disabled, times out, or returns empty intent.
 */
export async function getIntentGuidedRagContext(
  query: string,
  options?: GetRagContextOptions,
): Promise<RagContextResult | null> {
  if (!getApiKey()) return null;
  if (!isIntentGuidedEnabled(options)) {
    return getRagContextForPrompt(query, options);
  }

  let intent: StructuredIntent;
  try {
    intent = await Promise.race([
      parseIntent(query.trim()),
      new Promise<never>((_, rej) =>
        setTimeout(
          () => rej(new Error("Intent parse timeout")),
          INTENT_PARSE_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (e) {
    logger.debug(
      { error: (e as Error).message },
      "Intent-guided RAG: intent parse failed, using plain RAG",
    );
    return getRagContextForPrompt(query, options);
  }

  const features = intent.features ?? [];
  const tech = intent.tech_stack_hints ?? [];
  const flows = intent.data_flows ?? [];
  const hasIntent = features.length > 0 || tech.length > 0 || flows.length > 0;
  if (!hasIntent) {
    return getRagContextForPrompt(query, options);
  }

  const parts: string[] = [query];
  if (features.length) parts.push(`features: ${features.join(", ")}`);
  if (tech.length) parts.push(`tech: ${tech.join(", ")}`);
  if (flows.length) parts.push(`data flows: ${flows.join(", ")}`);
  const expandedQuery = parts.join(" ");

  const maxChunks = options?.maxChunks ?? 6;
  const fetchK = Math.max(maxChunks * 2, TOP_K_HYBRID);
  try {
    const [expandedEmb] = await embedViaService([expandedQuery], {
      model: getRagEmbedModel(),
      inputType: "query",
    });
    const store = getVectorStore();
    let candidates = await store.query(expandedEmb, {
      topK: fetchK,
      types: options?.types,
      namespace: options?.namespace,
    });
    if (candidates.length === 0) return null;
    candidates = await rerank(expandedQuery, candidates, maxChunks);
    const top = candidates.map((c) => c.chunk);
    const contentForContext = (chunk: (typeof top)[0]) =>
      (chunk.metadata?.parentContent as string | undefined) ?? chunk.content;
    const context = top
      .map(
        (c, i) => `[${i + 1}] ${c.source} (${c.type})\n${contentForContext(c)}`,
      )
      .join("\n\n---\n\n");
    const sources = [
      ...new Map(
        top.map((c) => [c.source, { source: c.source, type: c.type }]),
      ).values(),
    ];
    return { context, sources, intent };
  } catch (e) {
    logger.debug(
      { error: (e as Error).message },
      "getIntentGuidedRagContext failed, falling back to plain RAG",
    );
    return getRagContextForPrompt(query, options);
  }
}

/**
 * Executes a full RAG (Retrieval-Augmented Generation) query.
 *
 * Complete pipeline:
 * 1. Embed query using NIM embeddings
 * 2. Search vector store (+ optional hybrid keyword search with RRF)
 * 3. Re-rank results (optional, via NIM or external service)
 * 4. Build context from top chunks
 * 5. Generate answer via LLM (model router selects optimal model)
 * 6. Optional Claude fallback for low-confidence or failed queries
 *
 * @param query - The user's question
 * @param options - Query configuration options
 * @param options.outputFormat - 'natural' for prose, 'structured' for JSON
 * @param options.structuredSchema - JSON schema description for structured output
 * @param options.types - Filter by document type(s)
 * @param options.hybrid - Enable hybrid search (vector + keyword with RRF merge)
 * @param options.namespace - Multi-tenant namespace for scoped queries
 * @returns Answer with sources, confidence score, citations, and optional structured data
 * @throws {Error} If NVIDIA_NIM_API_KEY is not set
 *
 * @example
 * ```typescript
 * const result = await ragQuery('What are the API endpoints?', {
 *   hybrid: true,
 *   outputFormat: 'structured',
 *   structuredSchema: 'endpoints: Array<{ method: string, path: string }>',
 * });
 * console.log(result.answer);
 * console.log(result.citations); // [{ id: 1, source: 'api.md', ... }]
 * ```
 */
export async function ragQuery(
  query: string,
  options?: RagQueryOptions,
): Promise<RagQueryResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("NVIDIA_NIM_API_KEY is not set");

  const useIntentGuided = options?.intentGuided === true;
  if (useIntentGuided) {
    const irfResult = await getIntentGuidedRagContext(query, {
      namespace: options?.namespace,
      types: options?.types,
      maxChunks: TOP_K,
    });
    if (irfResult?.context && irfResult.sources?.length) {
      const outputFormat = options?.outputFormat ?? "natural";
      const structuredSchema = options?.structuredSchema;
      let sys: string;
      if (outputFormat === "structured") {
        const schemaDesc =
          structuredSchema ??
          "tasks: string[] (list of action items), or endpoints: Array<{ method: string, path: string, description: string }>";
        sys = `You are a helpful assistant. Extract structured data from the provided context to answer the user's question. Return ONLY valid JSON matching this schema: ${schemaDesc}. No markdown code fence, no extra text. If the context does not contain relevant information, return {"error": "No relevant information found"}.`;
      } else {
        sys = `You are a helpful assistant. Answer the user's question using only the provided context. When you use information from a source, cite it with [1], [2], etc. corresponding to the numbered context. If the context does not contain relevant information, say so. Do not make up facts.`;
      }
      const user = `Context:\n\n${irfResult.context}\n\nQuestion: ${query}`;
      const modelId = getRAGModel();
      const completionParams = {
        model: modelId,
        max_tokens: 1024,
        system: sys,
        messages: [{ role: "user" as const, content: user }],
      };
      const completionResult = await getCompletion(completionParams, {
        provider: "nim" as LLMProvider,
        modelId: modelId,
      });
      if (completionResult.error) {
        logger.warn(
          { error: completionResult.error },
          "RAG LLM (intent-guided) error",
        );
      }
      const rawAnswer = (completionResult.text?.trim() ?? "") || "";
      const citations: RagCitation[] = irfResult.sources.map((s, i) => ({
        id: i + 1,
        source: s.source,
        type: s.type,
        url: `/docs/${encodeURIComponent(s.source)}`,
      }));
      let structured: Record<string, unknown> | undefined;
      let answer = rawAnswer;
      if (outputFormat === "structured" && rawAnswer) {
        const jsonMatch = rawAnswer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            structured = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
            if (!("error" in structured))
              answer = JSON.stringify(structured, null, 2);
          } catch {
            // keep raw answer
          }
        }
      }
      return {
        answer:
          answer || "No answer could be generated from the retrieved context.",
        sources: irfResult.sources,
        confidence: 0.7,
        citations,
        structured,
      };
    }
  }

  const store = getVectorStore();
  const fetchK = options?.hybrid ? TOP_K_HYBRID : TOP_K;
  const queryEmbeddings = await embedViaService([query], {
    model: getRagEmbedModel(),
    inputType: "query",
  });
  const queryEmbedding = queryEmbeddings[0];
  if (!queryEmbedding) {
    throw new Error("Failed to generate embedding for query");
  }
  let candidates = await store.query(queryEmbedding, {
    topK: fetchK,
    types: options?.types,
    namespace: options?.namespace,
  });

  if (candidates.length === 0) {
    return {
      answer:
        "The knowledge base has not been indexed yet. Run the RAG indexer (e.g. `npm run rag:index` in backend) and ensure RAG_INDEX_PATH is set.",
      sources: [],
      confidence: 0,
      fallback: FALLBACK_MESSAGE,
      citations: [],
    };
  }

  if (options?.hybrid && candidates.length > 1) {
    const bm25Idx = await loadBm25Index();
    if (bm25Idx && bm25Idx.size > 0) {
      const bm25Results = bm25Idx.search(query, Math.max(TOP_K_HYBRID, 20));
      const bm25RankById = new Map(bm25Results.map((r, i) => [r.chunk.id, i]));
      const merged = candidates.map((c, vectorRank) => {
        const bm25Rank =
          bm25RankById.get(c.chunk.id) ?? TOP_K_HYBRID + vectorRank;
        const rrf = rrfScore(vectorRank) + rrfScore(bm25Rank);
        return { ...c, rrf };
      });
      const graph =
        process.env.RAG_GRAPH_ENABLED !== "false" ? await loadGraph() : null;
      if (graph) {
        const queryTokens = query
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 2);
        const graphChunkIds = new Set(
          getRelatedChunkIds(graph, queryTokens, 50),
        );
        for (const m of merged) {
          if (graphChunkIds.has(m.chunk.id)) {
            m.rrf = (m.rrf ?? 0) + rrfScore(0) * 0.5;
          }
        }
      }
      merged.sort((a, b) => (b.rrf ?? 0) - (a.rrf ?? 0));
      candidates = merged
        .slice(0, TOP_K)
        .map(({ chunk, score }) => ({ chunk, score }));
    } else {
      const withKwScore = candidates.map((c, i) => ({
        ...c,
        keywordScore: keywordScore(query, c.chunk.content),
        vectorRank: i,
      }));
      withKwScore.sort((a, b) => b.keywordScore - a.keywordScore);
      const kwRankByChunkId = new Map<string, number>();
      withKwScore.forEach((x, i) => kwRankByChunkId.set(x.chunk.id, i));
      const merged = candidates.map((c, vectorRank) => {
        const kwRank = kwRankByChunkId.get(c.chunk.id) ?? vectorRank;
        return { ...c, rrf: rrfScore(vectorRank) + rrfScore(kwRank) };
      });
      merged.sort((a, b) => b.rrf - a.rrf);
      candidates = merged
        .slice(0, TOP_K)
        .map(({ chunk, score }) => ({ chunk, score }));
    }
  } else if (candidates.length > TOP_K) {
    candidates = candidates.slice(0, TOP_K);
  }

  candidates = await rerank(query, candidates, TOP_K);

  const outputFormat = options?.outputFormat ?? "natural";
  const structuredSchema = options?.structuredSchema;

  const top = candidates.map((c) => c.chunk);
  const maxScore = candidates[0]?.score ?? 0;

  // Confidence from max cosine similarity (Option B). Normalize to roughly 0–1 (cosine can be in [-1,1], typical for similar text ~0.3–0.9).
  const confidence = Math.max(0, Math.min(1, (maxScore + 0.2) / 1.1));
  const fallback =
    confidence < CONFIDENCE_LOW_THRESHOLD ? FALLBACK_MESSAGE : undefined;

  // Small-to-big: use parentContent for context when available
  const contentForContext = (chunk: (typeof top)[0]) =>
    (chunk.metadata?.parentContent as string | undefined) ?? chunk.content;

  // Numbered context for citations: [1], [2], ...
  const citations: RagCitation[] = top.map((c, i) => ({
    id: i + 1,
    source: c.source,
    type: c.type,
    url: `/docs/${encodeURIComponent(c.source)}`,
  }));
  const context = top
    .map(
      (c, i) => `[${i + 1}] ${c.source} (${c.type})\n${contentForContext(c)}`,
    )
    .join("\n\n---\n\n");
  const sources = [
    ...new Map(
      top.map((c) => [c.source, { source: c.source, type: c.type }]),
    ).values(),
  ];

  let sys: string;
  if (outputFormat === "structured") {
    const schemaDesc =
      structuredSchema ??
      "tasks: string[] (list of action items), or endpoints: Array<{ method: string, path: string, description: string }>";
    sys = `You are a helpful assistant. Extract structured data from the provided context to answer the user's question. Return ONLY valid JSON matching this schema: ${schemaDesc}. No markdown code fence, no extra text. If the context does not contain relevant information, return {"error": "No relevant information found"}.`;
  } else {
    sys = `You are a helpful assistant. Answer the user's question using only the provided context. When you use information from a source, cite it with [1], [2], etc. corresponding to the numbered context. If the context does not contain relevant information, say so. Do not make up facts.`;
  }
  const user = `Context:\n\n${context}\n\nQuestion: ${query}`;

  const modelId = getRAGModel();
  // Enable fallback to Llama 405B for low confidence responses
  const canFallback = process.env.RAG_LLM_FALLBACK === "true";
  let rawAnswer = "";
  let primaryError: string | null = null;

  const completionParams = {
    model: modelId,
    max_tokens: 1024,
    system: sys,
    messages: [{ role: "user" as const, content: user }],
  };
  const completionResult = await getCompletion(completionParams, {
    provider: "nim" as LLMProvider,
    modelId: modelId,
  });
  if (completionResult.error) {
    primaryError = completionResult.error;
    logger.warn({ error: primaryError }, "RAG LLM (router) error");
  } else {
    rawAnswer = completionResult.text?.trim() ?? "";
  }

  if (primaryError && !canFallback) {
    throw new Error(primaryError);
  }
  let fallbackProvider: string | undefined;

  const useFallback =
    canFallback &&
    (Boolean(primaryError) ||
      confidence < CONFIDENCE_LOW_THRESHOLD ||
      !rawAnswer.trim());
  if (useFallback) {
    try {
      const fallbackResult = await getCompletion(completionParams, {
        provider: "nim",
        modelId: RAG_FALLBACK_MODEL,
      });
      if (fallbackResult.text?.trim()) {
        rawAnswer = fallbackResult.text.trim();
        fallbackProvider = "llama-405b";
      }
    } catch (e) {
      logger.warn(
        { error: (e as Error).message },
        "RAG Llama 405B fallback failed",
      );
    }
  }
  if (primaryError && !fallbackProvider) {
    throw new Error(primaryError);
  }

  let structured: Record<string, unknown> | undefined;
  let answer = rawAnswer;
  if (outputFormat === "structured") {
    const jsonMatch = rawAnswer.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        structured = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        if (!("error" in structured)) {
          answer = JSON.stringify(structured, null, 2);
        }
      } catch {
        structured = { raw: rawAnswer };
      }
    }
  }

  return {
    answer,
    sources,
    confidence,
    fallback,
    citations,
    ...(fallbackProvider && { fallbackProvider }),
    ...(structured !== undefined && { structured }),
  };
}

export interface RunIndexerOptions {
  /** Namespace for multi-tenant (workspace/project id). When set, clear and upsert are scoped to this namespace. */
  namespace?: string;
}

/**
 * Indexes documents for RAG retrieval.
 *
 * Pipeline:
 * 1. Chunk documents (AST-aware for .grump files, text-based otherwise)
 * 2. Embed chunks in batches via NIM embeddings
 * 3. Upsert to vector store (clears existing data first)
 *
 * @param docs - Array of documents to index
 * @param docs[].content - Raw document content
 * @param docs[].source - Source identifier (filename, URL, etc.)
 * @param docs[].type - Document type: 'doc' | 'code' | 'spec' | 'grump'
 * @param options - Indexing options
 * @param options.namespace - Multi-tenant namespace (scopes clear/upsert operations)
 * @returns Object with count of indexed chunks
 * @throws {Error} If NVIDIA_NIM_API_KEY is not set
 *
 * @example
 * ```typescript
 * const { chunks } = await runIndexer([
 *   { content: markdownContent, source: 'docs/api.md', type: 'doc' },
 *   { content: codeContent, source: 'src/auth.ts', type: 'code' },
 * ], { namespace: 'project-123' });
 * console.log(`Indexed ${chunks} chunks`);
 * ```
 */
function useSmallToBig(): boolean {
  return process.env.RAG_SMALL_TO_BIG === "true";
}

export async function runIndexer(
  docs: { content: string; source: string; type: DocType }[],
  options?: RunIndexerOptions,
): Promise<{ chunks: number }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("NVIDIA_NIM_API_KEY is not set");

  const smallToBig = useSmallToBig();
  const allChunks: {
    content: string;
    source: string;
    type: DocType;
    parentChunkId?: string;
    parentContent?: string;
  }[] = [];

  for (const d of docs) {
    if (d.type === "grump") {
      const grumpChunks = chunkGrumpByAST(d.content, d.source);
      if (smallToBig) {
        for (const g of grumpChunks) {
          const s2b = chunkTextSmallToBig(g.content, g.source, g.type);
          allChunks.push(...s2b);
        }
      } else {
        allChunks.push(...grumpChunks);
      }
    } else if (smallToBig) {
      allChunks.push(...chunkTextSmallToBig(d.content, d.source, d.type));
    } else {
      allChunks.push(...chunkText(d.content, d.source, d.type));
    }
  }

  const batchSize = 32;
  const chunks: VectorChunk[] = [];
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const texts = batch.map((b) => b.content);
    const embeddings = await embedViaService(texts, {
      model: getRagEmbedModel(),
      inputType: "passage",
    });
    for (let j = 0; j < batch.length; j++) {
      const batchItem = batch[j];
      const embedding = embeddings[j];
      if (!batchItem || !embedding) continue;
      const metadata: Record<string, unknown> = {};
      if (batchItem.parentChunkId && batchItem.parentContent) {
        metadata.parentChunkId = batchItem.parentChunkId;
        metadata.parentContent = batchItem.parentContent;
      }
      chunks.push({
        id: `rag-${i + j}-${Date.now()}`,
        content: batchItem.content,
        embedding: embedding,
        source: batchItem.source,
        type: batchItem.type,
        ...(Object.keys(metadata).length > 0 && { metadata }),
      });
    }
  }

  const store = getVectorStore();
  const ns = options?.namespace;
  if (store.clear) await store.clear(ns ? { namespace: ns } : undefined);
  await store.upsert(chunks, ns ? { namespace: ns } : undefined);

  const bm25Path = getBm25IndexPath();
  const bm25Dir = dirname(bm25Path);
  if (!existsSync(bm25Dir)) await mkdir(bm25Dir, { recursive: true });
  await writeFile(
    bm25Path,
    JSON.stringify({
      chunks: chunks.map((c) => ({
        id: c.id,
        content: c.content,
        source: c.source,
        type: c.type,
      })),
      indexedAt: new Date().toISOString(),
    }),
    "utf8",
  );
  bm25IndexCache = null;

  const graph = buildGraph(
    chunks.map((c) => ({
      id: c.id,
      content: c.content,
      source: c.source,
      type: c.type,
    })),
  );
  await saveGraph(graph);
  clearGraphCache();

  return { chunks: chunks.length };
}
