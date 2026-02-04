/**
 * Template service unit tests.
 */

import { describe, it, expect } from 'vitest';
import { listTemplates, getTemplate } from '../../src/services/templateService.js';

describe('templateService', () => {
  describe('listTemplates', () => {
    it('returns all templates when no query or tags', () => {
      const list = listTemplates();
      expect(list.length).toBe(2);
      expect(list.map((t) => t.id)).toContain('rest-api-node');
      expect(list.map((t) => t.id)).toContain('vue-dashboard');
    });

    it('filters by query string', () => {
      const list = listTemplates('rest');
      expect(list.length).toBe(1);
      expect(list[0].id).toBe('rest-api-node');
    });

    it('filters by tags', () => {
      const list = listTemplates(undefined, ['vue']);
      expect(list.length).toBe(1);
      expect(list[0].id).toBe('vue-dashboard');
    });

    it('returns empty when no match', () => {
      const list = listTemplates('nonexistent');
      expect(list.length).toBe(0);
    });
  });

  describe('getTemplate', () => {
    it('returns template by id', () => {
      const t = getTemplate('rest-api-node');
      expect(t).not.toBeNull();
      expect(t!.id).toBe('rest-api-node');
      expect(t!.name).toContain('REST');
    });

    it('returns null for unknown id', () => {
      expect(getTemplate('unknown')).toBeNull();
    });
  });
});
