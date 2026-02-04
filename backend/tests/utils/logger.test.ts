/**
 * Unit tests for logger utility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the middleware logger module before importing the logger utility
vi.mock('../../src/middleware/logger.js', () => ({
  getRequestLogger: vi.fn(),
}));

import { logger } from '../../src/utils/logger.js';
import { getRequestLogger } from '../../src/middleware/logger.js';

describe('logger', () => {
  const mockRequestLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('debug', () => {
    it('uses request logger when available', () => {
      vi.mocked(getRequestLogger).mockReturnValue(mockRequestLogger as unknown as ReturnType<typeof getRequestLogger>);

      logger.debug({ key: 'value' }, 'Debug message');

      expect(getRequestLogger).toHaveBeenCalled();
      expect(mockRequestLogger.debug).toHaveBeenCalledWith({ key: 'value' }, 'Debug message');
    });

    it('falls back to console.debug with message when request logger throws', () => {
      vi.mocked(getRequestLogger).mockImplementation(() => {
        throw new Error('No request context');
      });

      logger.debug({ key: 'value' }, 'Debug message');

      expect(console.debug).toHaveBeenCalledWith('[DEBUG]', 'Debug message', { key: 'value' });
    });

    it('falls back to console.debug with object only when no message', () => {
      vi.mocked(getRequestLogger).mockImplementation(() => {
        throw new Error('No request context');
      });

      logger.debug({ key: 'value' });

      expect(console.debug).toHaveBeenCalledWith('[DEBUG]', { key: 'value' });
    });
  });

  describe('info', () => {
    it('uses request logger when available', () => {
      vi.mocked(getRequestLogger).mockReturnValue(mockRequestLogger as unknown as ReturnType<typeof getRequestLogger>);

      logger.info({ action: 'test' }, 'Info message');

      expect(getRequestLogger).toHaveBeenCalled();
      expect(mockRequestLogger.info).toHaveBeenCalledWith({ action: 'test' }, 'Info message');
    });

    it('falls back to console.info with message when request logger throws', () => {
      vi.mocked(getRequestLogger).mockImplementation(() => {
        throw new Error('No request context');
      });

      logger.info({ action: 'test' }, 'Info message');

      expect(console.info).toHaveBeenCalledWith('[INFO]', 'Info message', { action: 'test' });
    });

    it('falls back to console.info with object only when no message', () => {
      vi.mocked(getRequestLogger).mockImplementation(() => {
        throw new Error('No request context');
      });

      logger.info({ action: 'test' });

      expect(console.info).toHaveBeenCalledWith('[INFO]', { action: 'test' });
    });
  });

  describe('warn', () => {
    it('uses request logger when available', () => {
      vi.mocked(getRequestLogger).mockReturnValue(mockRequestLogger as unknown as ReturnType<typeof getRequestLogger>);

      logger.warn({ warning: true }, 'Warning message');

      expect(getRequestLogger).toHaveBeenCalled();
      expect(mockRequestLogger.warn).toHaveBeenCalledWith({ warning: true }, 'Warning message');
    });

    it('falls back to console.warn with message when request logger throws', () => {
      vi.mocked(getRequestLogger).mockImplementation(() => {
        throw new Error('No request context');
      });

      logger.warn({ warning: true }, 'Warning message');

      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'Warning message', { warning: true });
    });

    it('falls back to console.warn with object only when no message', () => {
      vi.mocked(getRequestLogger).mockImplementation(() => {
        throw new Error('No request context');
      });

      logger.warn({ warning: true });

      expect(console.warn).toHaveBeenCalledWith('[WARN]', { warning: true });
    });
  });

  describe('error', () => {
    it('uses request logger when available', () => {
      vi.mocked(getRequestLogger).mockReturnValue(mockRequestLogger as unknown as ReturnType<typeof getRequestLogger>);

      logger.error({ error: 'test error' }, 'Error message');

      expect(getRequestLogger).toHaveBeenCalled();
      expect(mockRequestLogger.error).toHaveBeenCalledWith({ error: 'test error' }, 'Error message');
    });

    it('falls back to console.error with message when request logger throws', () => {
      vi.mocked(getRequestLogger).mockImplementation(() => {
        throw new Error('No request context');
      });

      logger.error({ error: 'test error' }, 'Error message');

      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'Error message', { error: 'test error' });
    });

    it('falls back to console.error with object only when no message', () => {
      vi.mocked(getRequestLogger).mockImplementation(() => {
        throw new Error('No request context');
      });

      logger.error({ error: 'test error' });

      expect(console.error).toHaveBeenCalledWith('[ERROR]', { error: 'test error' });
    });
  });

  describe('logger exports', () => {
    it('exports all log level methods', () => {
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });
});
