/**
 * RAG Service – Nemotron embeddings via NIM, vector store (file or Pinecone), NIM LLM.
 * Query → embed → vector + optional hybrid (keyword) → optional re-ranker → format context → generate.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { existsSync } from 'fs';
import logger from '../middleware/logger.js';
import { getVectorStore } from './vectorStoreAdapter.js';
import type { ChunkWithScore, VectorChunk } from './vectorStoreAdapter.js';
import { chunkGrumpByAST } from './grumpParser.js';
import { embed as embedViaService } from './embeddingService.js';
import { getNimChatUrl } from '../config/nim.js';
const RAG_EMBED_MODEL_DEFAULT = 'nvidia/nv-embedqa-e5-v5';
const DEFAULT_INDEX_PATH = './data/rag-index.json';
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const TOP_K = 6;
const TOP_K_HYBRID = 12;
const RRF_K = 60;

export type DocType = 'doc' | 'code' | 'spec' | 'grump';

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
  outputFormat?: 'natural' | 'structured';
  structuredSchema?: string;
  /** Filter by doc type(s). */
  types?: DocType | DocType[];
  /** Use hybrid (vector + keyword) merge with RRF. */
  hybrid?: boolean;
}

export interface RagQueryResult {
  answer: string;
  sources?: Array<{ source: string; type: DocType }>;
  confidence?: number;
  fallback?: string;
  citations?: RagCitation[];
  structured?: Record<string, unknown>;
  /** Set when RAG_CLAUDE_FALLBACK was used (e.g. 'claude'). */
  fallbackProvider?: string;
}

function getApiKey(): string | null {
  return process.env.NVIDIA_NIM_API_KEY || null;
}

function getIndexPath(): string {
  return process.env.RAG_INDEX_PATH || DEFAULT_INDEX_PATH;
}

function getRagModel(): string {
  return process.env.RAG_LLM_MODEL || 'moonshotai/kimi-k2.5';
}

function getRagEmbedModel(): string {
  return process.env.RAG_EMBED_MODEL || RAG_EMBED_MODEL_DEFAULT;
}

/** Simple keyword score: count of query terms (lowercase) in content. */
function keywordScore(query: string, content: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
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
 * Simple chunker: split by \n\n, then \n, then space. Chunk size ~CHUNK_SIZE, overlap ~CHUNK_OVERLAP.
 */
export function chunkText(text: string, source: string, type: DocType): { content: string; source: string; type: DocType }[] {
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

  let acc = '';
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

/**
 * Load index from file.
 */
export async function loadIndex(): Promise<RagIndex | null> {
  const path = getIndexPath();
  if (!existsSync(path)) return null;
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as RagIndex;
}

/**
 * Save index to file.
 */
export async function saveIndex(index: RagIndex): Promise<void> {
  const path = getIndexPath();
  const dir = dirname(path);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(path, JSON.stringify(index), 'utf8');
}

const CONFIDENCE_LOW_THRESHOLD = 0.3;
const FALLBACK_MESSAGE = 'Would you like to rephrase your question or contact support?';
const ANTHROPIC_CHAT_URL = 'https://api.anthropic.com/v1/messages';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
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
  topK: number
): Promise<ChunkWithScore[]> {
  if (candidates.length === 0) return [];
  try {
    const [queryEmb] = await embedViaService([query], { model: getRagEmbedModel(), inputType: 'query' });
    const withScore = candidates.map((c) => ({
      ...c,
      score: cosineSimilarity(queryEmb, c.chunk.embedding),
    }));
    withScore.sort((a, b) => b.score - a.score);
    return withScore.slice(0, topK);
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'RAG NIM re-ranker failed');
    return candidates.slice(0, topK);
  }
}

/**
 * Re-rank candidates with optional external re-ranker (RAG_RERANKER_URL) or NIM (RAG_RERANKER=nim).
 */
async function rerank(
  query: string,
  candidates: ChunkWithScore[],
  topK: number
): Promise<ChunkWithScore[]> {
  if (candidates.length === 0) return [];
  const rerankerKind = process.env.RAG_RERANKER;
  if (rerankerKind === 'nim' && getApiKey()) {
    return rerankViaNim(query, candidates, topK);
  }
  const url = process.env.RAG_RERANKER_URL;
  if (!url) return candidates.slice(0, topK);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        documents: candidates.map((c) => c.chunk.content),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return candidates.slice(0, topK);
    const data = (await res.json()) as { scores?: number[]; order?: number[] };
    const order = data.order ?? (data.scores ? data.scores.map((_, i) => i).sort((a, b) => (data.scores![b]! - data.scores![a]!)) : undefined);
    if (!order?.length) return candidates.slice(0, topK);
    const out: ChunkWithScore[] = order.slice(0, topK).map((i) => candidates[i]!);
    return out;
  } catch {
    return candidates.slice(0, topK);
  }
}

/**
 * Run RAG query: embed query, vector store (+ optional hybrid RRF), optional re-ranker, build context, call NIM chat.
 */
export async function ragQuery(
  query: string,
  options?: RagQueryOptions
): Promise<RagQueryResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NVIDIA_NIM_API_KEY is not set');

  const store = getVectorStore();
  const fetchK = options?.hybrid ? TOP_K_HYBRID : TOP_K;
  let candidates = await store.query(
    (await embedViaService([query], { model: getRagEmbedModel(), inputType: 'query' }))[0]!,
    { topK: fetchK, types: options?.types }
  );

  if (candidates.length === 0) {
    return {
      answer:
        'The knowledge base has not been indexed yet. Run the RAG indexer (e.g. `npm run rag:index` in backend) and ensure RAG_INDEX_PATH is set.',
      sources: [],
      confidence: 0,
      fallback: FALLBACK_MESSAGE,
      citations: [],
    };
  }

  if (options?.hybrid && candidates.length > 1) {
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
    candidates = merged.slice(0, TOP_K).map(({ chunk, score }) => ({ chunk, score }));
  } else if (candidates.length > TOP_K) {
    candidates = candidates.slice(0, TOP_K);
  }

  candidates = await rerank(query, candidates, TOP_K);

  const outputFormat = options?.outputFormat ?? 'natural';
  const structuredSchema = options?.structuredSchema;

  const top = candidates.map((c) => c.chunk);
  const maxScore = candidates[0]?.score ?? 0;

  // Confidence from max cosine similarity (Option B). Normalize to roughly 0–1 (cosine can be in [-1,1], typical for similar text ~0.3–0.9).
  const confidence = Math.max(0, Math.min(1, (maxScore + 0.2) / 1.1));
  const fallback = confidence < CONFIDENCE_LOW_THRESHOLD ? FALLBACK_MESSAGE : undefined;

  // Numbered context for citations: [1], [2], ...
  const citations: RagCitation[] = top.map((c, i) => ({
    id: i + 1,
    source: c.source,
    type: c.type,
    url: `/docs/${encodeURIComponent(c.source)}`,
  }));
  const context = top
    .map((c, i) => `[${i + 1}] ${c.source} (${c.type})\n${c.content}`)
    .join('\n\n---\n\n');
  const sources = [...new Map(top.map((c) => [c.source, { source: c.source, type: c.type }])).values()];

  const model = getRagModel();
  let sys: string;
  if (outputFormat === 'structured') {
    const schemaDesc =
      structuredSchema ??
      'tasks: string[] (list of action items), or endpoints: Array<{ method: string, path: string, description: string }>';
    sys = `You are a helpful assistant. Extract structured data from the provided context to answer the user's question. Return ONLY valid JSON matching this schema: ${schemaDesc}. No markdown code fence, no extra text. If the context does not contain relevant information, return {"error": "No relevant information found"}.`;
  } else {
    sys = `You are a helpful assistant. Answer the user's question using only the provided context. When you use information from a source, cite it with [1], [2], etc. corresponding to the numbered context. If the context does not contain relevant information, say so. Do not make up facts.`;
  }
  const user = `Context:\n\n${context}\n\nQuestion: ${query}`;

  const canClaudeFallback =
    process.env.RAG_CLAUDE_FALLBACK === 'true' && Boolean(process.env.ANTHROPIC_API_KEY);
  let rawAnswer = '';
  let nimError: string | null = null;

  try {
    const res = await fetch(getNimChatUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      const t = await res.text();
      logger.warn({ status: res.status, body: t.slice(0, 500) }, 'NIM chat error in RAG');
      nimError = `RAG LLM: ${res.status} ${t.slice(0, 200)}`;
    } else {
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      rawAnswer = data.choices?.[0]?.message?.content?.trim() ?? 'No response from model.';
    }
  } catch (e) {
    const message = (e as Error).message;
    logger.warn({ error: message }, 'NIM chat error in RAG');
    nimError = `RAG LLM: ${message}`;
  }

  if (nimError && !canClaudeFallback) {
    throw new Error(nimError);
  }
  let fallbackProvider: string | undefined;

  const useClaudeFallback =
    canClaudeFallback &&
    (Boolean(nimError) || confidence < CONFIDENCE_LOW_THRESHOLD || !rawAnswer.trim());
  if (useClaudeFallback) {
    try {
      const claudeRes = await fetch(ANTHROPIC_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: sys,
          messages: [{ role: 'user', content: user }],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (claudeRes.ok) {
        const claudeData = (await claudeRes.json()) as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const claudeText = claudeData.content?.find((c) => c.type === 'text')?.text?.trim();
        if (claudeText) {
          rawAnswer = claudeText;
          fallbackProvider = 'claude';
        }
      }
    } catch (e) {
      logger.warn({ error: (e as Error).message }, 'RAG Claude fallback failed');
    }
  }
  if (nimError && !fallbackProvider) {
    throw new Error(nimError);
  }

  let structured: Record<string, unknown> | undefined;
  let answer = rawAnswer;
  if (outputFormat === 'structured') {
    const jsonMatch = rawAnswer.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        structured = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        if (!('error' in structured)) {
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

/**
 * Index documents: chunks, embed via NIM, upsert into vector store.
 */
export async function runIndexer(docs: { content: string; source: string; type: DocType }[]): Promise<{ chunks: number }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NVIDIA_NIM_API_KEY is not set');

  const allChunks: { content: string; source: string; type: DocType }[] = [];
  for (const d of docs) {
    if (d.type === 'grump') {
      allChunks.push(...chunkGrumpByAST(d.content, d.source));
    } else {
      allChunks.push(...chunkText(d.content, d.source, d.type));
    }
  }

  const batchSize = 32;
  const chunks: VectorChunk[] = [];
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const texts = batch.map((b) => b.content);
    const embeddings = await embedViaService(texts, { model: getRagEmbedModel(), inputType: 'passage' });
    for (let j = 0; j < batch.length; j++) {
      chunks.push({
        id: `rag-${i + j}-${Date.now()}`,
        content: batch[j]!.content,
        embedding: embeddings[j]!,
        source: batch[j]!.source,
        type: batch[j]!.type,
      });
    }
  }

  const store = getVectorStore();
  if (store.clear) await store.clear();
  await store.upsert(chunks);
  return { chunks: chunks.length };
}
