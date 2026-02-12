/**
 * Pinecone vector store adapter for RAG.
 * Implements IVectorStore using Pinecone index with optional namespace (multi-tenant).
 * Env: RAG_VECTOR_STORE=pinecone, PINECONE_API_KEY, PINECONE_INDEX, PINECONE_NAMESPACE (optional), PINECONE_HOST (optional).
 */

import { Pinecone } from '@pinecone-database/pinecone';
import type { DocType } from './ragService.js';
import type {
  VectorChunk,
  VectorQueryOptions,
  ChunkWithScore,
  IVectorStore,
} from './vectorStoreAdapter.js';

const BATCH_SIZE = 100;

export interface PineconeVectorStoreOptions {
  apiKey: string;
  indexName: string;
  defaultNamespace?: string;
  host?: string;
}

function getDefaultNamespace(): string {
  return process.env.PINECONE_NAMESPACE ?? 'default';
}

/**
 * Pinecone vector store implementing IVectorStore.
 * Uses namespace for multi-tenant isolation (workspace/project id).
 */
export class PineconeVectorStore implements IVectorStore {
  private client: Pinecone;
  private indexName: string;
  private defaultNamespace: string;
  private host?: string;

  constructor(options: PineconeVectorStoreOptions) {
    this.client = new Pinecone({
      apiKey: options.apiKey,
      ...(options.host && { request: { baseUrl: options.host } }),
    });
    this.indexName = options.indexName;
    this.defaultNamespace = options.defaultNamespace ?? getDefaultNamespace();
    this.host = options.host;
  }

  private getIndex(namespace?: string) {
    const ns = namespace ?? this.defaultNamespace;
    const index = this.client.index(this.indexName);
    return ns ? index.namespace(ns) : index;
  }

  async query(embedding: number[], options?: VectorQueryOptions): Promise<ChunkWithScore[]> {
    const topK = options?.topK ?? 10;
    const namespace = options?.namespace ?? this.defaultNamespace;
    const index = this.getIndex(namespace);

    const filter =
      options?.types !== undefined
        ? {
            type: {
              $in: Array.isArray(options.types) ? options.types : [options.types],
            },
          }
        : undefined;

    const response = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
      includeValues: true,
      ...(filter && { filter }),
    });

    const matches = response.matches ?? [];
    const results: ChunkWithScore[] = matches
      .filter((m) => m.metadata && typeof m.metadata.content === 'string')
      .map((m) => {
        const meta = m.metadata as {
          content: string;
          source: string;
          type: DocType;
          parentChunkId?: string;
          parentContent?: string;
        };
        const chunk: VectorChunk = {
          id: m.id ?? '',
          content: meta.content,
          source: meta.source ?? '',
          type: meta.type ?? 'doc',
          embedding: (m.values as number[]) ?? [],
          ...(meta.parentChunkId != null &&
            meta.parentContent != null && {
              metadata: {
                parentChunkId: meta.parentChunkId,
                parentContent: meta.parentContent,
              },
            }),
        };
        const score = typeof m.score === 'number' ? m.score : 0;
        return { chunk, score };
      });
    return results;
  }

  async upsert(chunks: VectorChunk[], options?: { namespace?: string }): Promise<void> {
    const namespace = options?.namespace ?? this.defaultNamespace;
    const index = this.getIndex(namespace);

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const records = batch.map((c) => ({
        id: c.id,
        values: c.embedding,
        metadata: {
          content: c.content,
          source: c.source,
          type: c.type,
          ...(c.metadata?.parentChunkId != null && {
            parentChunkId: c.metadata.parentChunkId,
          }),
          ...(c.metadata?.parentContent != null && {
            parentContent: c.metadata.parentContent,
          }),
        },
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await index.upsert(records as any);
    }
  }

  async clear(options?: { namespace?: string }): Promise<void> {
    const namespace = options?.namespace ?? this.defaultNamespace;
    const index = this.getIndex(namespace);
    await index.deleteAll();
  }
}
