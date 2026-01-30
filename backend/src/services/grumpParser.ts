/**
 * G-Rump language parser – minimal .grump spec (entities, components, systems, animations).
 * Outputs AST for code-aware RAG chunking.
 */

export type GrumpNodeType = 'entity' | 'component' | 'system' | 'anim';

export interface GrumpBlock {
  type: GrumpNodeType;
  name: string;
  body: string;
  start: number;
  end: number;
}

export interface GrumpAST {
  blocks: GrumpBlock[];
  raw: string;
}

const BLOCK_RE = /^\s*(entity|component|system|anim)\s+(\w+)\s*\{/gm;

/**
 * Parse .grump source into blocks (entity, component, system, anim).
 * Each block is the declaration plus body up to matching `}`.
 */
export function parseGrump(source: string): GrumpAST {
  const blocks: GrumpBlock[] = [];
  let m: RegExpExecArray | null;
  BLOCK_RE.lastIndex = 0;
  const matches: { type: GrumpNodeType; name: string; start: number }[] = [];
  while ((m = BLOCK_RE.exec(source)) !== null) {
    const type = m[1] as GrumpNodeType;
    const name = m[2] ?? '';
    matches.push({ type, name, start: m.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const { type, name, start } = matches[i]!;
    const nextStart = i + 1 < matches.length ? matches[i + 1]!.start : source.length;
    let depth = 0;
    let end = start;
    for (let j = source.indexOf('{', start); j < nextStart && j >= 0; j++) {
      if (source[j] === '{') depth++;
      if (source[j] === '}') {
        depth--;
        if (depth === 0) {
          end = j + 1;
          break;
        }
      }
    }
    const body = source.slice(start, end);
    blocks.push({ type, name, body, start, end });
  }
  return { blocks, raw: source };
}

/**
 * Chunk .grump source by semantic blocks for RAG. Each chunk is one block (entity/component/system/anim).
 */
export function chunkGrumpByAST(source: string, filePath: string): { content: string; source: string; type: 'grump' }[] {
  const ast = parseGrump(source);
  if (ast.blocks.length === 0) {
    return [{ content: source.trim(), source: filePath, type: 'grump' }];
  }
  return ast.blocks.map((b) => ({
    content: b.body.trim(),
    source: `${filePath}#${b.type}:${b.name}`,
    type: 'grump' as const,
  }));
}
