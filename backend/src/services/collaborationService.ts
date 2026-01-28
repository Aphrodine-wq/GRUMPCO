/**
 * Collaboration service – project sharing and team access.
 * In-memory; persist to DB (projects, project_members) when wired.
 */

import logger from '../middleware/logger.js';

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export interface ProjectMember {
  userId: string;
  projectId: string;
  role: ProjectRole;
  addedAt: string;
}

const inMemoryMembers = new Map<string, ProjectMember[]>();

function projectKey(projectId: string): string {
  return `members:${projectId}`;
}

export function addMember(projectId: string, userId: string, role: ProjectRole): void {
  const key = projectKey(projectId);
  const list = inMemoryMembers.get(key) ?? [];
  if (list.some((m) => m.userId === userId)) return;
  list.push({ userId, projectId, role, addedAt: new Date().toISOString() });
  inMemoryMembers.set(key, list);
  logger.info({ projectId, userId, role }, 'Member added');
}

export function getMembers(projectId: string): ProjectMember[] {
  return inMemoryMembers.get(projectKey(projectId)) ?? [];
}

export function removeMember(projectId: string, userId: string): boolean {
  const key = projectKey(projectId);
  const list = inMemoryMembers.get(key) ?? [];
  const prev = list.length;
  const next = list.filter((m) => m.userId !== userId);
  if (next.length < prev) {
    inMemoryMembers.set(key, next);
    logger.info({ projectId, userId }, 'Member removed');
    return true;
  }
  return false;
}

export function canAccess(userId: string, projectId: string, minRole: ProjectRole): boolean {
  const members = getMembers(projectId);
  const m = members.find((x) => x.userId === userId);
  if (!m) return false;
  const order: ProjectRole[] = ['viewer', 'editor', 'owner'];
  return order.indexOf(m.role) >= order.indexOf(minRole);
}
