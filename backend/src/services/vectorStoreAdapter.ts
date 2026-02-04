/**
 * Vector store adapter – abstract index/query/upsert for RAG.
 * Implementations: file (default), Pinecone when RAG_VECTOR_STORE=pinecone and PINECONE_* set.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { existsSync } from 'fs';
import type { DocType } from './ragService.js';
import { PineconeVectorStore } from './pineconeVectorStore.js';

export interface VectorChunk {
  id: string;
  content: string;
  embedding: number[];
  source: string;
  type: DocType;
  metadata?: Record<string, unknown>;
}

export interface VectorQueryOptions {
  topK?: number;
  types?: DocType | DocType[];
  namespace?: string;
}

export interface ChunkWithScore {
  chunk: VectorChunk;
  score: number;
}

export interface VectorUpsertOptions {
  namespace?: string;
}

export interface IVectorStore {
  query(embedding: number[], options?: VectorQueryOptions): Promise<ChunkWithScore[]>;
  upsert(chunks: VectorChunk[], options?: VectorUpsertOptions): Promise<void>;
  clear?(options?: { namespace?: string }): Promise<void>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den === 0 ? 0 : dot / den;
}

function matchesType(chunk: VectorChunk, types?: DocType | DocType[]): boolean {
  if (!types) return true;
  const arr = Array.isArray(types) ? types : [types];
  return arr.includes(chunk.type);
}

/**
 * File-based vector store (default). Single JSON file per namespace or one file with all chunks.
 */
export class FileVectorStore implements IVectorStore {
  private chunks: VectorChunk[] = [];
  private path: string;

  constructor(indexPath: string) {
    this.path = indexPath;
  }

  async load(): Promise<void> {
    if (!existsSync(this.path)) {
      this.chunks = [];
      return;
    }
    const raw = await readFile(this.path, 'utf8');
    const data = JSON.parse(raw) as { chunks?: VectorChunk[] };
    this.chunks = data.chunks ?? [];
  }

  async save(): Promise<void> {
    const dir = dirname(this.path);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await writeFile(
      this.path,
      JSON.stringify({ chunks: this.chunks, savedAt: new Date().toISOString() }),
      'utf8'
    );
  }

  async query(embedding: number[], options?: VectorQueryOptions): Promise<ChunkWithScore[]> {
    await this.load();
    const topK = options?.topK ?? 10;
    const filtered = this.chunks.filter((c) => matchesType(c, options?.types));
    const withScores: ChunkWithScore[] = filtered.map((c) => ({
      chunk: c,
      score: cosineSimilarity(c.embedding, embedding),
    }));
    withScores.sort((a, b) => b.score - a.score);
    return withScores.slice(0, topK);
  }

  async upsert(chunks: VectorChunk[], _options?: { namespace?: string }): Promise<void> {
    await this.load();
    const ids = new Set(chunks.map((c) => c.id));
    this.chunks = this.chunks.filter((c) => !ids.has(c.id));
    this.chunks.push(...chunks);
    await this.save();
  }

  async clear(_options?: { namespace?: string }): Promise<void> {
    this.chunks = [];
    await this.save();
  }
}

const DEFAULT_INDEX_PATH = process.env.RAG_INDEX_PATH ?? './data/rag-index.json';
const MEMORY_INDEX_PATH = process.env.RAG_MEMORY_INDEX_PATH ?? './data/rag-memory.json';

let defaultStore: IVectorStore | null = null;
let memoryStore: IVectorStore | null = null;

/**
 * Get the configured vector store. Default: file-based at RAG_INDEX_PATH.
 * Set RAG_VECTOR_STORE=pinecone, PINECONE_API_KEY, and PINECONE_INDEX for Pinecone.
 * Optional: PINECONE_NAMESPACE (default namespace), PINECONE_HOST (custom endpoint).
 */
export function getVectorStore(): IVectorStore {
  if (defaultStore) return defaultStore;
  const kind = process.env.RAG_VECTOR_STORE;
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX;
  if (kind === 'pinecone' && apiKey && indexName) {
    defaultStore = new PineconeVectorStore({
      apiKey,
      indexName,
      defaultNamespace: process.env.PINECONE_NAMESPACE ?? 'default',
      host: process.env.PINECONE_HOST,
    });
  } else {
    defaultStore = new FileVectorStore(DEFAULT_INDEX_PATH);
  }
  return defaultStore;
}

/**
 * Get the memory vector store (separate index for long-term user memory).
 */
export function getMemoryStore(): IVectorStore {
  if (memoryStore) return memoryStore;
  memoryStore = new FileVectorStore(MEMORY_INDEX_PATH);
  return memoryStore;
}
