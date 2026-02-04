/**
 * Small-to-Big Retrieval Chunker
 *
 * Retrieves on small chunks (precise matching) but returns parent chunks (richer context).
 * Small chunks ~128 tokens for embedding; parent chunks 512-1024 tokens for LLM context.
 */

/** Document type for RAG chunks. */
export type DocType = 'doc' | 'code' | 'spec' | 'grump';

/** Approximate chars per token (4 for English) */
const CHARS_PER_TOKEN = 4;

export interface SmallChunk {
  id: string;
  content: string;
  source: string;
  type: DocType;
  parentChunkId: string;
  parentContent: string;
  metadata?: Record<string, unknown>;
}

export interface SmallToBigChunkerOptions {
  /** Small chunk size in tokens (for retrieval). Default 128. */
  smallChunkTokens?: number;
  /** Parent chunk size in tokens (for context). Default 512. */
  parentChunkTokens?: number;
  /** Overlap between small chunks. Default 32 tokens. */
  smallOverlapTokens?: number;
  /** Overlap between parent chunks. Default 64 tokens. */
  parentOverlapTokens?: number;
  /** Separators for splitting. Default paragraph, then line. */
  separators?: string[];
}

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

/**
 * Chunk document with small-to-big strategy.
 * Produces small chunks for embedding/retrieval, each linked to a parent chunk for context.
 */
export function chunkSmallToBig(
  text: string,
  source: string,
  type: DocType,
  options?: SmallToBigChunkerOptions
): SmallChunk[] {
  const smallTokens = options?.smallChunkTokens ?? 128;
  const parentTokens = options?.parentChunkTokens ?? 512;
  const smallOverlap = options?.smallOverlapTokens ?? 32;
  const parentOverlap = options?.parentOverlapTokens ?? 64;
  const separators = options?.separators ?? DEFAULT_SEPARATORS;

  const smallSize = smallTokens * CHARS_PER_TOKEN;
  const smallOverlapChars = smallOverlap * CHARS_PER_TOKEN;
  const parentSize = parentTokens * CHARS_PER_TOKEN;
  const parentOverlapChars = parentOverlap * CHARS_PER_TOKEN;

  // First create parent chunks
  const parentChunks = splitIntoChunks(text, parentSize, parentOverlapChars, separators);
  const baseId = `parent_${source.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

  const result: SmallChunk[] = [];
  for (let pIdx = 0; pIdx < parentChunks.length; pIdx++) {
    const parentContent = parentChunks[pIdx];
    if (!parentContent.trim()) continue;

    const parentId = `${baseId}_p${pIdx}`;
    const smallChunks = splitIntoChunks(parentContent, smallSize, smallOverlapChars, separators);

    for (let sIdx = 0; sIdx < smallChunks.length; sIdx++) {
      const smallContent = smallChunks[sIdx];
      if (!smallContent.trim()) continue;

      result.push({
        id: `${parentId}_s${sIdx}`,
        content: smallContent.trim(),
        source,
        type,
        parentChunkId: parentId,
        parentContent: parentContent.trim(),
        metadata: {
          parentIndex: pIdx,
          smallIndex: sIdx,
          totalParents: parentChunks.length,
          totalSmallInParent: smallChunks.length,
        },
      });
    }
  }

  return result;
}

function splitIntoChunks(
  text: string,
  chunkSize: number,
  overlap: number,
  separators: string[]
): string[] {
  if (text.length <= chunkSize) {
    return [text.trim()].filter(Boolean);
  }

  const sep = separators[0];
  const rest = separators.slice(1);

  if (sep === '') {
    return splitBySize(text, chunkSize, overlap);
  }

  const parts = text.split(sep).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const p of parts) {
    const candidate = current ? current + sep + p : p;
    if (candidate.length <= chunkSize) {
      current = candidate;
    } else {
      if (current) {
        chunks.push(current.trim());
        const tail = current.slice(-overlap);
        current = tail ? tail + sep + p : p;
      } else {
        if (p.length > chunkSize && rest.length > 0) {
          chunks.push(...splitIntoChunks(p, chunkSize, overlap, rest));
          current = '';
        } else {
          chunks.push(p.slice(0, chunkSize).trim());
          current = p.slice(chunkSize - overlap);
        }
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function splitBySize(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}
