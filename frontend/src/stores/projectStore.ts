/**
 * Current project/workspace identity for linking chat, ship, and codegen sessions.
 * When set, new ship and codegen sessions are associated with this projectId.
 */

import { writable } from 'svelte/store';

export const currentProjectId = writable<string | null>(null);

export function setCurrentProjectId(id: string | null): void {
  currentProjectId.set(id);
}

export function getCurrentProjectId(): string | null {
  let value: string | null = null;
  currentProjectId.subscribe((v) => (value = v))();
  return value;
}
