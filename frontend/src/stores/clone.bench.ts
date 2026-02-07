import { bench, describe } from 'vitest';
import type { Message } from '../types';

// Mock data generation
const createMockMessage = (contentLength: number): Message => ({
  role: 'assistant',
  content: Array(5).fill({
    type: 'text',
    content: 'x'.repeat(contentLength),
  }),
  timestamp: Date.now(),
  model: 'gpt-4',
});

const SMALL_SESSION = Array.from({ length: 10 }, () => createMockMessage(50));
const MEDIUM_SESSION = Array.from({ length: 50 }, () => createMockMessage(500));
const LARGE_SESSION = Array.from({ length: 100 }, () => createMockMessage(5000));

describe('Deep Clone Benchmarks', () => {
  bench('Small Session: JSON.parse(JSON.stringify)', () => {
    JSON.parse(JSON.stringify(SMALL_SESSION));
  });

  bench('Small Session: structuredClone', () => {
    structuredClone(SMALL_SESSION);
  });

  bench('Medium Session: JSON.parse(JSON.stringify)', () => {
    JSON.parse(JSON.stringify(MEDIUM_SESSION));
  });

  bench('Medium Session: structuredClone', () => {
    structuredClone(MEDIUM_SESSION);
  });

  bench('Large Session: JSON.parse(JSON.stringify)', () => {
    JSON.parse(JSON.stringify(LARGE_SESSION));
  });

  bench('Large Session: structuredClone', () => {
    structuredClone(LARGE_SESSION);
  });
});
