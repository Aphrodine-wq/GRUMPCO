/**
 * Graph RAG - Knowledge graph layer for structured retrieval.
 * Entity extraction, graph traversal, dual retrieval (vector + graph).
 */

export interface GraphEntity {
  id: string;
  name: string;
  type: 'concept' | 'technology' | 'component' | 'person' | 'organization' | 'other';
}

export interface GraphRelation {
  from: string;
  to: string;
  type: string;
  chunkIds: string[];
}

export interface KnowledgeGraph {
  entities: Map<string, GraphEntity>;
  relations: Map<string, GraphRelation>;
  entityToChunks: Map<string, Set<string>>;
  chunkToEntities: Map<string, Set<string>>;
}

/**
 * Lightweight rules-based entity extraction (no LLM).
 * Extracts: capitalized phrases, tech terms, common patterns.
 */
const TECH_TERNS = new Set([
  'api', 'rest', 'graphql', 'websocket', 'docker', 'kubernetes', 'postgresql', 'redis',
  'react', 'vue', 'svelte', 'typescript', 'python', 'node', 'express', 'fastapi',
  'authentication', 'authorization', 'database', 'cache', 'queue', 'microservice',
]);

function extractEntitiesRules(text: string): Array<{ name: string; type: GraphEntity['type'] }> {
  const seen = new Set<string>();
  const entities: Array<{ name: string; type: GraphEntity['type'] }> = [];

  const words = text.split(/\s+/);
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    if (clean.length < 2) continue;
    if (TECH_TERNS.has(clean) && !seen.has(clean)) {
      seen.add(clean);
      entities.push({ name: clean, type: 'technology' });
    }
  }

  const capPhrase = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = capPhrase.exec(text)) !== null) {
    const name = m[1].trim().toLowerCase();
    if (name.length > 2 && !seen.has(name)) {
      seen.add(name);
      entities.push({ name, type: 'concept' });
    }
  }

  return entities;
}

export function extractEntities(
  content: string,
  _options?: { useLLM?: boolean }
): Array<{ name: string; type: GraphEntity['type'] }> {
  return extractEntitiesRules(content);
}

function hashRelation(from: string, to: string, type: string): string {
  const [a, b] = [from, to].sort();
  return `${a}|${type}|${b}`;
}

/**
 * Build a knowledge graph from chunks.
 */
export function buildKnowledgeGraph(
  chunks: Array<{ id: string; content: string }>,
  extractor = extractEntities
): KnowledgeGraph {
  const entities = new Map<string, GraphEntity>();
  const relations = new Map<string, GraphRelation>();
  const entityToChunks = new Map<string, Set<string>>();
  const chunkToEntities = new Map<string, Set<string>>();

  for (const chunk of chunks) {
    const chunkEntities = extractor(chunk.content);
    const entityIds = new Set<string>();

    for (const e of chunkEntities) {
      const id = e.name.toLowerCase().replace(/\s+/g, '_');
      if (!entities.has(id)) {
        entities.set(id, { id, name: e.name, type: e.type });
      }
      entityIds.add(id);
      if (!entityToChunks.has(id)) {
        entityToChunks.set(id, new Set());
      }
      entityToChunks.get(id)!.add(chunk.id);
    }

    chunkToEntities.set(chunk.id, entityIds);

    for (const a of entityIds) {
      for (const b of entityIds) {
        if (a >= b) continue;
        const key = hashRelation(a, b, 'co-occurrence');
        const rel = relations.get(key);
        if (rel) {
          rel.chunkIds.push(chunk.id);
        } else {
          relations.set(key, {
            from: a,
            to: b,
            type: 'co-occurrence',
            chunkIds: [chunk.id],
          });
        }
      }
    }
  }

  return {
    entities,
    relations,
    entityToChunks,
    chunkToEntities,
  };
}

/**
 * Get chunk IDs related to query entities via graph traversal.
 */
export function getRelatedChunks(
  graph: KnowledgeGraph,
  queryEntities: string[],
  maxChunks: number
): string[] {
  const result = new Set<string>();
  const normalized = queryEntities.map((e) => e.toLowerCase().replace(/\s+/g, '_'));

  for (const eid of normalized) {
    const chunkIds = graph.entityToChunks.get(eid);
    if (chunkIds) {
      for (const c of chunkIds) result.add(c);
    }

    for (const [, rel] of graph.relations) {
      if (rel.from === eid || rel.to === eid) {
        for (const c of rel.chunkIds) result.add(c);
      }
    }
  }

  return Array.from(result).slice(0, maxChunks);
}
