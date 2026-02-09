/**
 * Long-term memory service – store/recall significant interactions and learn from corrections.
 * Uses same embed + vector store; dedicated namespace for memory.
 */

import { embed } from "../ai-providers/embeddingService.js";
import { getMemoryStore, type VectorChunk } from "../rag/vectorStoreAdapter.js";
import logger from "../../middleware/logger.js";

const MEMORY_NAMESPACE = "grump-memory";
const MEMORY_TOP_K = 5;

export type MemoryType = "interaction" | "correction" | "preference";

export interface MemoryRecord {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

function memoryChunkToRecord(c: VectorChunk): MemoryRecord {
  const meta = (c.metadata ?? {}) as Record<string, unknown>;
  return {
    id: c.id,
    userId: (meta.userId as string) ?? "",
    type: (meta.memoryType as MemoryType) ?? "interaction",
    content: c.content,
    summary: meta.summary as string | undefined,
    metadata: meta,
    createdAt: (meta.createdAt as string) ?? "",
  };
}

/**
 * Store a significant interaction or correction. Embeds content and upserts into vector store.
 * Use a dedicated index/namespace via metadata filter (we use same store with metadata.userId and metadata.namespace = MEMORY_NAMESPACE).
 */
export async function remember(
  record: Omit<MemoryRecord, "id" | "createdAt">,
): Promise<void> {
  try {
    const store = getMemoryStore();
    const [embedding] = await embed([record.content], { inputType: "passage" });
    const id = `mem-${record.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const createdAt = new Date().toISOString();
    const chunk: VectorChunk = {
      id,
      content: record.summary ?? record.content,
      embedding,
      source: record.userId,
      type: "doc",
      metadata: {
        namespace: MEMORY_NAMESPACE,
        userId: record.userId,
        memoryType: record.type,
        content: record.content,
        summary: record.summary,
        createdAt,
        ...record.metadata,
      },
    };
    await store.upsert([chunk]);
    logger.debug(
      { id, userId: record.userId, type: record.type },
      "Memory remembered",
    );
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "Memory remember failed");
    throw e;
  }
}

/**
 * Recall relevant memories for a user and query. Returns top MEMORY_TOP_K by similarity.
 */
export async function recall(
  userId: string,
  query: string,
): Promise<MemoryRecord[]> {
  try {
    const store = getMemoryStore();
    const [embedding] = await embed([query], { inputType: "query" });
    const results = await store.query(embedding, { topK: MEMORY_TOP_K * 2 });
    const filtered = results.filter(
      (r) => (r.chunk.metadata as Record<string, unknown>)?.userId === userId,
    );
    return filtered
      .slice(0, MEMORY_TOP_K)
      .map((r) => memoryChunkToRecord(r.chunk));
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "Memory recall failed");
    return [];
  }
}

/**
 * Learn from user correction: store the corrected response and context for future recall.
 */
export async function learnFromFeedback(feedback: {
  userId: string;
  originalResponse: string;
  correctedResponse: string;
  context?: string;
}): Promise<void> {
  await remember({
    userId: feedback.userId,
    type: "correction",
    content: feedback.correctedResponse,
    summary: `Correction: ${feedback.originalResponse.slice(0, 100)} → ${feedback.correctedResponse.slice(0, 100)}`,
    metadata: {
      originalResponse: feedback.originalResponse,
      context: feedback.context,
    },
  });
}
