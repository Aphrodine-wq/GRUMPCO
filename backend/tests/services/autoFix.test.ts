/**
 * Tests for autoFix.ts
 * Covers auto-fix system for common errors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
const mockExec = vi.fn();

vi.mock('child_process', () => ({
  exec: (...args: unknown[]) => mockExec(...args),
}));

// Import after mocks
import { tryAutoFix, getAutoFixSuggestions } from '../../src/services/autoFix.js';

describe('autoFix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock exec to call the callback
    mockExec.mockImplementation((_cmd: string, callback: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
      if (callback) {
        callback(null, { stdout: '', stderr: '' });
      }
    });
  });

  describe('tryAutoFix', () => {
    it('should return false for unknown error code', async () => {
      const result = await tryAutoFix('UNKNOWN_ERROR');
      expect(result).toBe(false);
    });

    it('should attempt to fix DOCKER_NOT_RUNNING on macOS', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const result = await tryAutoFix('DOCKER_NOT_RUNNING');

      expect(result).toBe(true);
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should attempt to fix DOCKER_NOT_RUNNING on non-macOS', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const result = await tryAutoFix('DOCKER_NOT_RUNNING');

      expect(result).toBe(true);
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should attempt to fix REDIS_NOT_CONNECTED', async () => {
      const result = await tryAutoFix('REDIS_NOT_CONNECTED');
      expect(result).toBe(true);
    });

    it('should handle exec errors gracefully for DOCKER_NOT_RUNNING', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      
      mockExec.mockImplementation((_cmd: string, callback: (err: Error | null) => void) => {
        if (callback) {
          callback(new Error('Command failed'));
        }
      });

      const result = await tryAutoFix('DOCKER_NOT_RUNNING');
      expect(result).toBe(true);
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle exec errors gracefully for REDIS_NOT_CONNECTED', async () => {
      mockExec.mockImplementation((_cmd: string, callback: (err: Error | null) => void) => {
        if (callback) {
          callback(new Error('Docker not available'));
        }
      });

      const result = await tryAutoFix('REDIS_NOT_CONNECTED');
      expect(result).toBe(true);
    });
  });

  describe('getAutoFixSuggestions', () => {
    it('should return suggestions for DOCKER_NOT_RUNNING', () => {
      const suggestions = getAutoFixSuggestions('DOCKER_NOT_RUNNING');
      
      expect(suggestions).toHaveLength(2);
      expect(suggestions).toContain('Start Docker Desktop');
      expect(suggestions).toContain('Run: docker info');
    });

    it('should return suggestions for NIM_AUTH_FAILED', () => {
      const suggestions = getAutoFixSuggestions('NIM_AUTH_FAILED');
      
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]).toContain('NVIDIA_NIM_API_KEY');
      expect(suggestions[1]).toContain('Settings');
    });

    it('should return empty array for unknown error code', () => {
      const suggestions = getAutoFixSuggestions('UNKNOWN_ERROR');
      expect(suggestions).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const suggestions = getAutoFixSuggestions('');
      expect(suggestions).toEqual([]);
    });

    it('should return empty array for REDIS_NOT_CONNECTED (no suggestions defined)', () => {
      const suggestions = getAutoFixSuggestions('REDIS_NOT_CONNECTED');
      expect(suggestions).toEqual([]);
    });
  });
});
