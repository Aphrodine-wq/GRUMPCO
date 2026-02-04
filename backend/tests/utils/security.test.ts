/**
 * Security utils – timingSafeEqualString
 */

import { describe, it, expect } from 'vitest';
import { timingSafeEqualString } from '../../src/utils/security.js';

describe('security', () => {
  describe('timingSafeEqualString', () => {
    it('returns true for identical strings', () => {
      expect(timingSafeEqualString('secret', 'secret')).toBe(true);
    });

    it('returns false for different strings of same length', () => {
      expect(timingSafeEqualString('secret', 's3cret')).toBe(false);
    });

    it('returns false when lengths differ (shorter)', () => {
      expect(timingSafeEqualString('ab', 'abc')).toBe(false);
    });

    it('returns false when lengths differ (longer)', () => {
      expect(timingSafeEqualString('abc', 'ab')).toBe(false);
    });

    it('handles empty strings', () => {
      expect(timingSafeEqualString('', '')).toBe(true);
      expect(timingSafeEqualString('', 'a')).toBe(false);
      expect(timingSafeEqualString('a', '')).toBe(false);
    });

    it('handles unicode', () => {
      expect(timingSafeEqualString('café', 'café')).toBe(true);
      expect(timingSafeEqualString('café', 'cafe')).toBe(false);
    });
  });
});
