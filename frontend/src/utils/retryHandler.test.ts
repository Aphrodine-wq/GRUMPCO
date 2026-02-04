import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryWithBackoff, retryWithUserConfirmation, createRetryable } from './retryHandler';

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
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('ok');
    const promise = retryWithBackoff(fn, { initialDelay: 10, maxRetries: 2 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('calls onRetry callback on each retry', async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce('ok');
    const promise = retryWithBackoff(fn, {
      initialDelay: 10,
      maxRetries: 3,
      onRetry,
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
  });

  it('throws last error when all retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));
    const promise = retryWithBackoff(fn, {
      initialDelay: 10,
      maxRetries: 2,
    });
    const assertion = expect(promise).rejects.toThrow('persistent failure');
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retryWithUserConfirmation succeeds on first try', async () => {
    const fn = vi.fn().mockResolvedValue('done');
    const onConfirm = vi.fn();
    const result = await retryWithUserConfirmation(fn, onConfirm);
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('retryWithUserConfirmation retries when user confirms', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('ok');
    const onConfirm = vi.fn().mockResolvedValue(true);
    const promise = retryWithUserConfirmation(fn, onConfirm, {
      initialDelay: 10,
      maxRetries: 2,
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retryWithUserConfirmation throws when user declines', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const onConfirm = vi.fn().mockResolvedValue(false);
    const promise = retryWithUserConfirmation(fn, onConfirm, {
      initialDelay: 10,
      maxRetries: 2,
    });
    const assertion = expect(promise).rejects.toThrow('fail');
    await vi.runAllTimersAsync();
    await assertion;
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('createRetryable wraps a function', async () => {
    const fn = vi.fn().mockResolvedValue('wrapped');
    const wrapped = createRetryable(fn);
    const result = await wrapped('a', 'b');
    expect(result).toBe('wrapped');
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });

  it('createRetryable retries on failure', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('ok');
    const wrapped = createRetryable(fn, { initialDelay: 10, maxRetries: 2 });
    const promise = wrapped();
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
