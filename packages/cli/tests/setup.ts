/**
 * Test Setup and Utilities for G-Rump CLI Tests
 * Provides mocking utilities and test helpers
 */

import { vi } from 'vitest';

// Mock console methods to keep test output clean
export function mockConsole() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalClear = console.clear;

  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    console.clear = vi.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    console.clear = originalClear;
  });

  return {
    getLogs: () => (console.log as any).mock.calls,
    getErrors: () => (console.error as any).mock.calls,
    getWarnings: () => (console.warn as any).mock.calls,
  };
}

// Mock fs module
export function mockFs(mockFiles: Record<string, string> = {}) {
  const fs = {
    existsSync: vi.fn((path: string) => path in mockFiles || path.includes('test')),
    readFileSync: vi.fn((path: string) => {
      if (path in mockFiles) {
        return mockFiles[path];
      }
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }),
    statSync: vi.fn(() => ({ size: 1024 })),
    readdirSync: vi.fn(() => ['file1.ts', 'file2.js']),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };

  return fs;
}

// Mock child_process
export function mockChildProcess(mockOutput: string = '') {
  return {
    execSync: vi.fn(() => mockOutput || `
^hash123 (John Doe 2024-01-15 14:30:00 +0000 1) const x = 1;
^hash456 (Jane Smith 2024-01-14 09:20:00 +0000 2) const y = 2;
    `),
  };
}

// Mock branding module for testing
export const mockBranding = {
  getLogo: vi.fn(() => '☹️ G-RUMP CLI'),
  getFrownyFace: vi.fn(() => '(╭╮╭)'),
  getSassyLogo: vi.fn(() => '🙄 G-Rump'),
  getErrorFace: vi.fn(() => '[ERROR FACE]'),
  getSuccessFace: vi.fn(() => '[SUCCESS FACE]'),
  getThinkingFace: vi.fn(() => '[THINKING]'),
  getShockedFace: vi.fn(() => '[SHOCKED]'),
  getSassyFace: vi.fn(() => '[SASSY]'),
  format: vi.fn((text: string) => text),
  getDivider: vi.fn(() => '━'.repeat(60)),
  getThinDivider: vi.fn(() => '─'.repeat(60)),
  status: vi.fn((text: string) => text),
  getSpinnerFrames: vi.fn(() => ['◐', '◓', '◑', '◒']),
  getProgressBar: vi.fn((percent: number) => `[${'█'.repeat(percent / 10)}${'░'.repeat(10 - percent / 10)}] ${percent}%`),
  applyGradient: vi.fn((text: string) => text),
  getSass: vi.fn(() => 'Test sass message'),
  box: vi.fn((text: string) => `┌${'─'.repeat(50)}┐\n│ ${text} │\n└${'─'.repeat(50)}┘`),
  getEmoji: vi.fn(() => '🙄'),
  colors: {
    darkPurple: '#6B46C1',
    mediumPurple: '#8B5CF6',
    lightPurple: '#A855F7',
    white: '#FFFFFF',
  },
};

// Helper to wait for async operations
export function wait(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mock Math.random for predictable tests
export function mockRandom(values: number[] = [0.5]) {
  let index = 0;
  const originalRandom = Math.random;

  Math.random = vi.fn(() => {
    const value = values[index % values.length];
    index++;
    return value;
  });

  return () => {
    Math.random = originalRandom;
  };
}

// Sample code content for testing
export const sampleCode = `
// TODO: Fix this later
import { something } from 'somewhere';

function doStuff(data: any) {
  console.log('debug');
  console.log('more debug');
  try {
    return process(data);
  } catch (e) {
    console.log('error', e);
  }
}

var x = 1;
const y = 2;
let z = 3;

// FIXME: This is temporary
// HACK: Don't look at this
function process(input: any) {
  return input.map(item => item.value);
}
`;

// Helper to check if output contains branding elements
export function containsBranding(output: any[]): boolean {
  const outputStr = output.map(call => call[0]).join(' ');
  return outputStr.includes('G-Rump') || 
         outputStr.includes('☹️') || 
         outputStr.includes('━') ||
         outputStr.includes('purple') ||
         outputStr.includes('#6B46C1');
}

// Test timeout helper
export function withTimeout<T>(promise: Promise<T>, ms: number = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Test timed out after ${ms}ms`)), ms)
    )
  ]);
}
