import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryWithBackoff, createRetryable } from './retryHandler';

describe('retryHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns result on first successful call', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const promise = retryWithBackoff(fn);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');
    const promise = retryWithBackoff(fn, { initialDelay: 10, maxRetries: 2 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('createRetryable wraps a function', async () => {
    const fn = vi.fn().mockResolvedValue('wrapped');
    const wrapped = createRetryable(fn);
    const result = await wrapped('a', 'b');
    expect(result).toBe('wrapped');
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });
});
