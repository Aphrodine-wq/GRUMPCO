/**
 * Graph RAG Service - Knowledge graph layer for dual retrieval.
 * Builds graph at index time, uses graph traversal for relational queries.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { existsSync } from 'fs';
import type { DocType } from './ragService.js';

export interface GraphChunk {
  id: string;
  content: string;
  source: string;
  type: DocType;
}

export interface PersistedGraph {
  entities: Array<{ id: string; name: string; type: string }>;
  relations: Array<{ from: string; to: string; type: string; chunkIds: string[] }>;
  entityToChunks: Record<string, string[]>;
  chunkToEntities: Record<string, string[]>;
  indexedAt: string;
}

const TECH_TERMS = new Set([
  'api',
  'rest',
  'graphql',
  'websocket',
  'docker',
  'kubernetes',
  'postgresql',
  'redis',
  'react',
  'vue',
  'svelte',
  'typescript',
  'python',
  'node',
  'express',
  'fastapi',
  'authentication',
  'authorization',
  'database',
  'cache',
  'queue',
  'microservice',
]);

function extractEntities(content: string): string[] {
  const seen = new Set<string>();
  const entities: string[] = [];

  const words = content.split(/\s+/);
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    if (clean.length >= 2 && TECH_TERMS.has(clean) && !seen.has(clean)) {
      seen.add(clean);
      entities.push(clean);
    }
  }

  const capPhrase = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = capPhrase.exec(content)) !== null) {
    const name = m[1].trim().toLowerCase().replace(/\s+/g, '_');
    if (name.length > 2 && !seen.has(name)) {
      seen.add(name);
      entities.push(name);
    }
  }

  return entities;
}

export function buildGraph(chunks: GraphChunk[]): PersistedGraph {
  const entityToChunks: Record<string, string[]> = {};
  const chunkToEntities: Record<string, string[]> = {};
  const relations: PersistedGraph['relations'] = [];
  const entitySet = new Set<string>();

  for (const chunk of chunks) {
    const ents = extractEntities(chunk.content);
    chunkToEntities[chunk.id] = ents;
    for (const e of ents) {
      entitySet.add(e);
      if (!entityToChunks[e]) entityToChunks[e] = [];
      entityToChunks[e].push(chunk.id);
    }

    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        const a = ents[i];
        const b = ents[j];
        const key = [a, b].sort().join('|');
        const existing = relations.find(
          (r) => `${r.from}|${r.to}` === key || `${r.to}|${r.from}` === key
        );
        if (existing) {
          if (!existing.chunkIds.includes(chunk.id)) existing.chunkIds.push(chunk.id);
        } else {
          relations.push({ from: a, to: b, type: 'co-occurrence', chunkIds: [chunk.id] });
        }
      }
    }
  }

  const entities = Array.from(entitySet).map((id) => ({
    id,
    name: id.replace(/_/g, ' '),
    type: TECH_TERMS.has(id) ? 'technology' : 'concept',
  }));

  return {
    entities,
    relations,
    entityToChunks,
    chunkToEntities,
    indexedAt: new Date().toISOString(),
  };
}

export function getRelatedChunkIds(
  graph: PersistedGraph,
  queryTokens: string[],
  maxChunks: number
): string[] {
  const result = new Set<string>();
  const entityToChunks = graph.entityToChunks ?? {};
  const relations = graph.relations ?? [];
  const normalized = queryTokens.map((t) => t.toLowerCase().replace(/\s+/g, '_'));

  for (const eid of normalized) {
    const chunkIds = entityToChunks[eid];
    if (chunkIds) {
      for (const c of chunkIds) result.add(c);
    }
    for (const rel of relations) {
      if (rel.from === eid || rel.to === eid) {
        for (const c of rel.chunkIds) result.add(c);
      }
    }
  }

  return Array.from(result).slice(0, maxChunks);
}

const DEFAULT_GRAPH_PATH = './data/rag-graph.json';

export function getGraphPath(): string {
  return process.env.RAG_GRAPH_PATH || DEFAULT_GRAPH_PATH;
}

let graphCache: PersistedGraph | null = null;

export async function loadGraph(): Promise<PersistedGraph | null> {
  if (graphCache) return graphCache;
  const path = getGraphPath();
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, 'utf8');
    graphCache = JSON.parse(raw) as PersistedGraph;
    return graphCache;
  } catch {
    return null;
  }
}

export async function saveGraph(graph: PersistedGraph): Promise<void> {
  const path = getGraphPath();
  const dir = dirname(path);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(path, JSON.stringify(graph), 'utf8');
  graphCache = graph;
}

export function clearGraphCache(): void {
  graphCache = null;
}
