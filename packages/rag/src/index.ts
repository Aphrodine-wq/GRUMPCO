/**
 * @grump/rag – vector store and RAG types.
 * Implementations live in backend; this package provides shared types and interfaces.
 */

export type DocType = 'doc' | 'code' | 'spec' | 'grump';

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

export interface IVectorStore {
  query(embedding: number[], options?: VectorQueryOptions): Promise<ChunkWithScore[]>;
  upsert(chunks: VectorChunk[]): Promise<void>;
  clear?(): Promise<void>;
}
