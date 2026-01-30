/**
 * @grump/memory – long-term memory types.
 * Implementation in backend/src/services/memoryService.ts.
 */

export type MemoryType = 'interaction' | 'correction' | 'preference';

export interface MemoryRecord {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
