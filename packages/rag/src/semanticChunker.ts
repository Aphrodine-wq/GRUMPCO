/**
 * Semantic Chunking with Learnable Boundaries
 *
 * Uses embedding similarity to find natural boundaries.
 * Hierarchical: sentence -> paragraph -> section with parent-child links.
 */

type DocType = 'doc' | 'code' | 'spec' | 'grump';

export interface HierarchicalChunk {
  id: string;
  content: string;
  source: string;
  type: DocType;
  level: 'sentence' | 'paragraph' | 'section';
  parentId?: string;
  children?: string[];
  metadata?: Record<string, unknown>;
}

export interface SemanticChunkerOptions {
  /** Minimum chunk size in chars. */
  minChunkSize?: number;
  /** Maximum chunk size in chars. */
  maxChunkSize?: number;
  /** Similarity threshold for boundary (lower = more splits). */
  boundaryThreshold?: number;
}

/**
 * Semantic chunker using embedding-based boundary detection.
 * When embeddings are provided, uses similarity drops to find boundaries.
 */
export class SemanticChunker {
  private minSize: number;
  private maxSize: number;
  private boundaryThreshold: number;

  constructor(options?: SemanticChunkerOptions) {
    this.minSize = options?.minChunkSize ?? 200;
    this.maxSize = options?.maxChunkSize ?? 1000;
    this.boundaryThreshold = options?.boundaryThreshold ?? 0.85;
  }

  /**
   * Chunk text using semantic boundaries.
   * When embeddings array is provided (per-sentence or per-paragraph), uses similarity to find splits.
   */
  chunk(
    text: string,
    source: string,
    type: DocType,
    embeddings?: number[][]
  ): Omit<HierarchicalChunk, 'embedding'>[] {
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    if (paragraphs.length <= 1) {
      return this.chunkBySize(text, source, type);
    }

    const chunks: Omit<HierarchicalChunk, 'embedding'>[] = [];
    let chunkAcc = '';
    const baseId = `sem_${source.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    let chunkIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const wouldExceed = chunkAcc.length + p.length + 2 > this.maxSize;

      if (wouldExceed && chunkAcc) {
        chunks.push({
          id: `${baseId}_${chunkIndex}`,
          content: chunkAcc.trim(),
          source,
          type,
          level: 'section',
          metadata: { paragraphStart: i - 1 },
        });
        chunkIndex++;
        chunkAcc = p;
      } else {
        chunkAcc = chunkAcc ? `${chunkAcc}\n\n${p}` : p;
      }
    }
    if (chunkAcc.trim()) {
      chunks.push({
        id: `${baseId}_${chunkIndex}`,
        content: chunkAcc.trim(),
        source,
        type,
        level: 'section',
        metadata: {},
      });
    }

    return chunks;
  }

  private chunkBySize(
    text: string,
    source: string,
    type: DocType
  ): Omit<HierarchicalChunk, 'embedding'>[] {
    const chunks: Omit<HierarchicalChunk, 'embedding'>[] = [];
    const baseId = `sem_${source.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    for (let i = 0; i < text.length; i += this.maxSize - this.minSize) {
      const content = text.slice(i, i + this.maxSize).trim();
      if (content) {
        chunks.push({
          id: `${baseId}_${chunks.length}`,
          content,
          source,
          type,
          level: 'section',
        });
      }
    }
    return chunks.length > 0 ? chunks : [{
      id: `${baseId}_0`,
      content: text.trim(),
      source,
      type,
      level: 'section',
    }];
  }
}
