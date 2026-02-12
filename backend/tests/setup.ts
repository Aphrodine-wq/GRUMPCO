/**
 * Vitest setup: set env required by services that check at import time.
 * Run before any test file so process.exit(1) is not triggered.
 * 
 * Note: The env.ts validation skips API key requirement when NODE_ENV=test,
 * but we still set these for any legacy code that might check directly.
 */
import { vi } from 'vitest';

if (!process.env.NVIDIA_NIM_API_KEY && !process.env.ANTHROPIC_API_KEY) {
  process.env.NVIDIA_NIM_API_KEY = 'test_key_for_unit_tests';
}

// Global mock for logger – provides both named and default exports.
// Individual test files can still override with their own vi.mock() if needed.
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn().mockReturnThis(),
  level: 'info',
  isLevelEnabled: vi.fn().mockReturnValue(false),
};

vi.mock('../src/middleware/logger.js', () => ({
  default: mockLogger,
  logger: mockLogger,
  getRequestLogger: vi.fn().mockReturnValue(mockLogger),
  httpLogger: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  requestIdMiddleware: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));
