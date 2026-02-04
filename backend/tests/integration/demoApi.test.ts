/**
 * Demo API integration tests.
 * Tests DEMO_STEPS export and route module.
 */

import { describe, it, expect } from 'vitest';
import { DEMO_STEPS } from '../../src/routes/demo.js';

describe('Demo API', () => {
  describe('DEMO_STEPS', () => {
    it('exports demo tutorial steps', () => {
      expect(DEMO_STEPS).toBeDefined();
      expect(Array.isArray(DEMO_STEPS)).toBe(true);
      expect(DEMO_STEPS.length).toBe(3);
      DEMO_STEPS.forEach((step) => {
        expect(step).toHaveProperty('target');
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('content');
        expect(step).toHaveProperty('position');
      });
    });

    it('has first step targeting chat input', () => {
      const first = DEMO_STEPS[0];
      expect(first.target).toBe('.chat-input');
      expect(first.title).toContain('Demo');
    });
  });
});
