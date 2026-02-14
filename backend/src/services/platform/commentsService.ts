/**
 * Comments and version history service.
 * Uses DatabaseService when available (SQLite with migration 010); in-memory fallback otherwise.
 */

import { getDatabase, type DatabaseService } from '../../db/database.js';
import logger from '../../middleware/logger.js';

export type EntityType = 'diagram' | 'spec' | 'plan' | 'code' | 'session';

export interface Comment {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface VersionSnapshot {
  id: string;
  version: number;
  data: string;
  created_at: string;
  created_by: string | null;
}

function isDatabaseService(db: unknown): db is DatabaseService {
  return typeof (db as DatabaseService).insertComment === 'function';
}

function randomId(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function versionId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// In-memory fallback when DB doesn't have comments/version_history
const inMemoryComments = new Map<string, Comment[]>();
const inMemoryVersions = new Map<string, VersionSnapshot[]>();

function entityKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function addComment(p: {
  project_id: string;
  entity_type: EntityType;
  entity_id: string;
  user_id: string;
  parent_id?: string | null;
  body: string;
}): Comment {
  const db = getDatabase();
  if (isDatabaseService(db)) {
    const id = randomId();
    db.insertComment({
      id,
      project_id: p.project_id,
      entity_type: p.entity_type,
      entity_id: p.entity_id,
      user_id: p.user_id,
      parent_id: p.parent_id ?? null,
      body: p.body,
    });
    const list = db.listComments(p.entity_type, p.entity_id);
    const comment = list.find((c) => c.id === id);
    if (comment) return comment as Comment;
  }
  const id = randomId();
  const now = new Date().toISOString();
  const comment: Comment = {
    id,
    project_id: p.project_id,
    entity_type: p.entity_type,
    entity_id: p.entity_id,
    user_id: p.user_id,
    parent_id: p.parent_id ?? null,
    body: p.body,
    created_at: now,
    updated_at: now,
  };
  const key = entityKey(p.entity_type, p.entity_id);
  const list = inMemoryComments.get(key) ?? [];
  list.push(comment);
  inMemoryComments.set(key, list);
  logger.info(
    { entity_type: p.entity_type, entity_id: p.entity_id, commentId: id },
    'Comment added'
  );
  return comment;
}

export function listComments(entity_type: string, entity_id: string): Comment[] {
  const db = getDatabase();
  if (isDatabaseService(db)) {
    return db.listComments(entity_type, entity_id) as Comment[];
  }
  const key = entityKey(entity_type, entity_id);
  return inMemoryComments.get(key) ?? [];
}

export function addVersion(p: {
  project_id: string;
  entity_type: 'spec' | 'plan' | 'diagram';
  entity_id: string;
  data: string;
  created_by?: string | null;
}): VersionSnapshot {
  const db = getDatabase();
  if (isDatabaseService(db)) {
    const version = db.getNextVersionNumber(p.entity_type, p.entity_id);
    const id = versionId();
    db.insertVersion({
      id,
      project_id: p.project_id,
      entity_type: p.entity_type,
      entity_id: p.entity_id,
      version,
      data: p.data,
      created_by: p.created_by ?? null,
    });
    const list = db.listVersions(p.entity_type, p.entity_id, 1);
    const snap = list[0];
    if (snap)
      return {
        id: snap.id,
        version: snap.version,
        data: snap.data,
        created_at: snap.created_at,
        created_by: snap.created_by,
      };
  }
  const key = entityKey(p.entity_type, p.entity_id);
  const list = inMemoryVersions.get(key) ?? [];
  const version = list.length + 1;
  const id = versionId();
  const now = new Date().toISOString();
  const snap: VersionSnapshot = {
    id,
    version,
    data: p.data,
    created_at: now,
    created_by: p.created_by ?? null,
  };
  list.unshift(snap);
  inMemoryVersions.set(key, list.slice(0, 100));
  logger.info({ entity_type: p.entity_type, entity_id: p.entity_id, version }, 'Version saved');
  return snap;
}

export function listVersions(
  entity_type: string,
  entity_id: string,
  limit = 50
): VersionSnapshot[] {
  const db = getDatabase();
  if (isDatabaseService(db)) {
    return db.listVersions(entity_type, entity_id, limit) as VersionSnapshot[];
  }
  const key = entityKey(entity_type, entity_id);
  return (inMemoryVersions.get(key) ?? []).slice(0, limit);
}
