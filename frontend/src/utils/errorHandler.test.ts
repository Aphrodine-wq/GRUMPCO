/**
 * Error Handler Tests
 *
 * Comprehensive tests for error classification and handling utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  classifyError,
  getErrorSeverity,
  getUserFriendlyMessage,
  getRecoveryOptions,
  isRetryable,
  processError,
  logError,
  type ErrorContext,
  type ApiError,
} from './errorHandler';

describe('errorHandler', () => {
  describe('classifyError', () => {
    it('should classify fetch TypeError as network error', () => {
      const error = new TypeError('Failed to fetch');
      expect(classifyError(error)).toBe('network');
    });

    it('should classify timeout errors', () => {
      const error = new Error('Request timed out');
      expect(classifyError(error)).toBe('timeout');
    });

    it('should classify validation errors', () => {
      const error = new Error('Validation failed: invalid input');
      expect(classifyError(error)).toBe('validation');
    });

    it('should classify network/connection errors', () => {
      const error = new Error('Network connection lost');
      expect(classifyError(error)).toBe('network');
    });

    it('should classify errors with status as API errors', () => {
      const error = Object.assign(new Error('API Error'), { status: 500 });
      expect(classifyError(error)).toBe('api');
    });

    it('should classify errors with statusCode as API errors', () => {
      const error = Object.assign(new Error('API Error'), { statusCode: 404 });
      expect(classifyError(error)).toBe('api');
    });

    it('should classify unknown errors', () => {
      const error = new Error('Something weird happened');
      expect(classifyError(error)).toBe('unknown');
    });

    it('should handle non-Error objects', () => {
      expect(classifyError('string error')).toBe('unknown');
      expect(classifyError(null)).toBe('unknown');
      expect(classifyError(undefined)).toBe('unknown');
    });
  });

  describe('getErrorSeverity', () => {
    it('should return critical for unauthorized errors', () => {
      const error = new Error('Unauthorized access');
      expect(getErrorSeverity(error, 'api')).toBe('critical');
    });

    it('should return critical for forbidden errors', () => {
      const error = new Error('Forbidden');
      expect(getErrorSeverity(error, 'api')).toBe('critical');
    });

    it('should return high for API errors', () => {
      const error = new Error('Some API error');
      expect(getErrorSeverity(error, 'api')).toBe('high');
    });

    it('should return high for service unavailable', () => {
      const error = new Error('Service unavailable');
      expect(getErrorSeverity(error, 'network')).toBe('high');
    });

    it('should return medium for network errors', () => {
      const error = new Error('Some network issue');
      expect(getErrorSeverity(error, 'network')).toBe('medium');
    });

    it('should return medium for timeout errors', () => {
      const error = new Error('Request timeout');
      expect(getErrorSeverity(error, 'timeout')).toBe('medium');
    });

    it('should return low for validation errors', () => {
      const error = new Error('Invalid input');
      expect(getErrorSeverity(error, 'validation')).toBe('low');
    });

    it('should return low for user errors', () => {
      const error = new Error('User did something wrong');
      expect(getErrorSeverity(error, 'user')).toBe('low');
    });

    it('should return medium for unknown errors', () => {
      const error = new Error('Unknown');
      expect(getErrorSeverity(error, 'unknown')).toBe('medium');
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return connection error message for network type', () => {
      const error = new Error('Network failed');
      const msg = getUserFriendlyMessage(error, 'network');
      expect(msg).toContain('Connection error');
    });

    it('should return timeout message for timeout type', () => {
      const error = new Error('Timed out');
      const msg = getUserFriendlyMessage(error, 'timeout');
      expect(msg).toContain('timed out');
    });

    it('should return diagram syntax message for mermaid validation', () => {
      const error = new Error('Invalid mermaid diagram');
      const msg = getUserFriendlyMessage(error, 'validation');
      expect(msg).toContain('diagram syntax');
    });

    it('should return generic validation message', () => {
      const error = new Error('Validation failed');
      const msg = getUserFriendlyMessage(error, 'validation');
      expect(msg).toContain('Invalid input');
    });

    it('should return auth message for 401 errors', () => {
      const error = new Error('401 Unauthorized');
      const msg = getUserFriendlyMessage(error, 'api');
      expect(msg).toMatch(/API key|Authentication|401|Settings/i);
    });

    it('should return rate limit message for 429 errors', () => {
      const error = new Error('429 Rate limit exceeded');
      const msg = getUserFriendlyMessage(error, 'api');
      expect(msg).toContain('Rate limit');
    });

    it('should return server error message for 500 errors', () => {
      const error = new Error('500 Internal server error');
      const msg = getUserFriendlyMessage(error, 'api');
      expect(msg).toContain('Server error');
    });

    it('should return service unavailable message for 503 errors', () => {
      const error = new Error('503 Service unavailable');
      const msg = getUserFriendlyMessage(error, 'api');
      expect(msg).toContain('temporarily unavailable');
    });

    it('should return original message for user errors', () => {
      const error = new Error('Custom user message');
      const msg = getUserFriendlyMessage(error, 'user');
      expect(msg).toBe('Custom user message');
    });

    it('should return generic message for unknown errors', () => {
      const error = new Error('Something');
      const msg = getUserFriendlyMessage(error, 'unknown');
      expect(msg).toContain('unexpected error');
    });

    it('should handle non-Error objects', () => {
      const msg = getUserFriendlyMessage('string error', 'unknown');
      expect(msg).toContain('unexpected error');
    });
  });

  describe('getRecoveryOptions', () => {
    it('should include retry option for network errors', () => {
      const onRetry = vi.fn();
      const options = getRecoveryOptions(new Error('Network'), 'network', onRetry);

      expect(options).toHaveLength(1);
      expect(options[0].label).toBe('Retry');
      expect(options[0].primary).toBe(true);
    });

    it('should include retry option for timeout errors', () => {
      const onRetry = vi.fn();
      const options = getRecoveryOptions(new Error('Timeout'), 'timeout', onRetry);

      expect(options.find((o) => o.label === 'Retry')).toBeDefined();
    });

    it('should include retry option for API errors', () => {
      const onRetry = vi.fn();
      const options = getRecoveryOptions(new Error('API'), 'api', onRetry);

      expect(options.find((o) => o.label === 'Retry')).toBeDefined();
    });

    it('should include fix input option for validation errors', () => {
      const options = getRecoveryOptions(new Error('Invalid'), 'validation');

      expect(options.find((o) => o.label === 'Fix Input')).toBeDefined();
    });

    it('should include cancel option when provided', () => {
      const onCancel = vi.fn();
      const options = getRecoveryOptions(new Error('Error'), 'network', undefined, onCancel);

      expect(options.find((o) => o.label === 'Cancel')).toBeDefined();
    });

    it('should return empty array when no options apply', () => {
      const options = getRecoveryOptions(new Error('Error'), 'unknown');

      expect(options).toHaveLength(0);
    });

    it('should include Open Settings for 401 API errors when onOpenSettings provided', () => {
      const onOpenSettings = vi.fn();
      const err = Object.assign(new Error('Unauthorized'), { status: 401 }) as ApiError;
      const options = getRecoveryOptions(err, 'api', undefined, undefined, onOpenSettings);
      expect(options.some((o) => o.label === 'Open Settings')).toBe(true);
    });
  });

  describe('isRetryable', () => {
    it('should return true for network errors', () => {
      expect(isRetryable(new Error('Network'), 'network')).toBe(true);
    });

    it('should return true for timeout errors', () => {
      expect(isRetryable(new Error('Timeout'), 'timeout')).toBe(true);
    });

    it('should return true for 429 errors', () => {
      const error = Object.assign(new Error('Rate limit'), { status: 429 });
      expect(isRetryable(error, 'api')).toBe(true);
    });

    it('should return true for 500 errors', () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      expect(isRetryable(error, 'api')).toBe(true);
    });

    it('should return true for 502 errors', () => {
      const error = Object.assign(new Error('Bad gateway'), { status: 502 });
      expect(isRetryable(error, 'api')).toBe(true);
    });

    it('should return true for 503 errors', () => {
      const error = Object.assign(new Error('Unavailable'), { status: 503 });
      expect(isRetryable(error, 'api')).toBe(true);
    });

    it('should return true for 504 errors', () => {
      const error = Object.assign(new Error('Gateway timeout'), { status: 504 });
      expect(isRetryable(error, 'api')).toBe(true);
    });

    it('should return false for 400 errors', () => {
      const error = Object.assign(new Error('Bad request'), { status: 400 });
      expect(isRetryable(error, 'api')).toBe(false);
    });

    it('should return false for 401 errors', () => {
      const error = Object.assign(new Error('Unauthorized'), { status: 401 });
      expect(isRetryable(error, 'api')).toBe(false);
    });

    it('should return false for 404 errors', () => {
      const error = Object.assign(new Error('Not found'), { status: 404 });
      expect(isRetryable(error, 'api')).toBe(false);
    });

    it('should return true for generic API errors without status', () => {
      expect(isRetryable(new Error('API error'), 'api')).toBe(true);
    });
  });

  describe('processError', () => {
    it('should return complete error context', () => {
      const error = new Error('Network failed');
      const context = processError(error);

      expect(context).toHaveProperty('type');
      expect(context).toHaveProperty('severity');
      expect(context).toHaveProperty('message');
      expect(context).toHaveProperty('userMessage');
      expect(context).toHaveProperty('retryable');
    });

    it('should include original error', () => {
      const error = new Error('Test error');
      const context = processError(error);

      expect(context.originalError).toBe(error);
    });

    it('should include recovery options when callbacks provided', () => {
      const onRetry = vi.fn();
      const onCancel = vi.fn();
      const context = processError(new Error('Network'), onRetry, onCancel);

      expect(context.recovery).toBeDefined();
      expect(context.recovery?.length).toBeGreaterThan(0);
    });

    it('should include metadata from error', () => {
      const error = Object.assign(new Error('API error'), { status: 500 });
      const context = processError(error);

      expect(context.metadata).toBeDefined();
      expect(context.metadata?.status).toBe(500);
    });

    it('should handle non-Error objects', () => {
      const context = processError('string error');

      expect(context.message).toBe('string error');
      expect(context.originalError).toBeUndefined();
    });
  });

  describe('logError', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should log error to console', () => {
      const context: ErrorContext = {
        type: 'network',
        severity: 'medium',
        message: 'Test error',
        userMessage: 'Test user message',
        retryable: true,
      };

      logError(context);

      expect(console.error).toHaveBeenCalled();
    });

    it('should include additional data in log', () => {
      const context: ErrorContext = {
        type: 'api',
        severity: 'high',
        message: 'API error',
        userMessage: 'Something went wrong',
        retryable: false,
      };

      logError(context, { userId: '123', endpoint: '/api/test' });

      expect(console.error).toHaveBeenCalledWith(
        'Error occurred:',
        expect.objectContaining({
          userId: '123',
          endpoint: '/api/test',
        })
      );
    });
  });
});
