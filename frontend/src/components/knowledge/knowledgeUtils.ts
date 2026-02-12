/**
 * Constants, types, and helpers for the KnowledgeBase component.
 * Extracted to reduce KnowledgeBase.svelte size.
 */
import type { MemoryType } from '../../lib/integrationsApi';

export interface DocCollection {
  id: string;
  name: string;
  documentCount: number;
  totalSize: string;
  status: 'indexed' | 'indexing' | 'error';
  lastUpdated: string;
}

export const MEMORY_TYPES: { value: MemoryType; label: string; color: string }[] = [
  { value: 'fact', label: 'Fact', color: '#6366f1' },
  { value: 'preference', label: 'Preference', color: '#ec4899' },
  { value: 'task', label: 'Task', color: '#10b981' },
  { value: 'context', label: 'Context', color: '#f59e0b' },
  { value: 'conversation', label: 'Conversation', color: '#8b5cf6' },
];

export const INITIAL_COLLECTIONS: DocCollection[] = [
  {
    id: '1',
    name: 'Project Documentation',
    documentCount: 24,
    totalSize: '2.4 MB',
    status: 'indexed',
    lastUpdated: '2 hours ago',
  },
  {
    id: '2',
    name: 'API References',
    documentCount: 12,
    totalSize: '1.1 MB',
    status: 'indexed',
    lastUpdated: '1 day ago',
  },
  {
    id: '3',
    name: 'Meeting Notes',
    documentCount: 8,
    totalSize: '640 KB',
    status: 'indexing',
    lastUpdated: '5 minutes ago',
  },
];

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getTypeColor(type: MemoryType): string {
  return MEMORY_TYPES.find((t) => t.value === type)?.color ?? '#6b7280';
}
