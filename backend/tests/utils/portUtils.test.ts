/**
 * Unit tests for portUtils.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findAvailablePort } from '../../src/utils/portUtils.js';

describe('portUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAvailablePort', () => {
    it('returns port when available', async () => {
      const port = await findAvailablePort(0, 5); // port 0 lets OS pick; 5 attempts
      expect(port).toBeGreaterThanOrEqual(0);
      expect(port).toBeLessThanOrEqual(65535);
    });

    it('throws on invalid startPort', async () => {
      await expect(findAvailablePort(NaN, 5)).rejects.toThrow('Invalid startPort');
    });

    it('uses default startPort of 3000 when not provided', async () => {
      const port = await findAvailablePort();
      expect(port).toBeGreaterThanOrEqual(3000);
    });

    it('accepts custom maxAttempts', async () => {
      const port = await findAvailablePort(0, 1);
      expect(port).toBeGreaterThanOrEqual(0);
    });
  });
});
