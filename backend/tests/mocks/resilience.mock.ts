/**
 * Mock Resilience Utilities
 * Provides configurable mock circuit breakers and retry logic
 */

export type CircuitState = 'closed' | 'half-open' | 'open';

export class MockCircuitBreaker<T extends unknown[], R> {
  private state: CircuitState = 'closed';
  private fireCount = 0;
  private shouldFail = false;
  private failAfter = 0;
  private errorToThrow: Error | null = null;

  /**
   * Set circuit breaker state
   */
  setState(state: CircuitState): void {
    this.state = state;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Configure to fail after N calls
   */
  setFailAfter(count: number, error?: Error): void {
    this.shouldFail = true;
    this.failAfter = count;
    this.errorToThrow = error || new Error('Mock circuit breaker failure');
  }

  /**
   * Reset breaker
   */
  reset(): void {
    this.state = 'closed';
    this.fireCount = 0;
    this.shouldFail = false;
    this.failAfter = 0;
    this.errorToThrow = null;
  }

  /**
   * Get fire count
   */
  getFireCount(): number {
    return this.fireCount;
  }

  /**
   * Mock fire method
   */
  async fire(...args: T): Promise<R> {
    this.fireCount++;

    if (this.state === 'open') {
      const error: any = new Error('Circuit breaker is open');
      error.code = 'CIRCUIT_OPEN';
      error.status = 503;
      throw error;
    }

    if (this.shouldFail && this.fireCount > this.failAfter) {
      if (this.errorToThrow) {
        throw this.errorToThrow;
      }
      throw new Error('Mock circuit breaker failure');
    }

    // Call the wrapped function
    const fn = (this as any).wrappedFunction;
    if (fn) {
      return await fn(...args);
    }

    throw new Error('No wrapped function set');
  }

  /**
   * Set wrapped function
   */
  setWrappedFunction(fn: (...args: T) => Promise<R>): void {
    (this as any).wrappedFunction = fn;
  }

  get opened(): boolean {
    return this.state === 'open';
  }

  get halfOpen(): boolean {
    return this.state === 'half-open';
  }

  get stats(): unknown {
    return {
      fires: this.fireCount,
      state: this.state,
    };
  }
}

export class MockRetryWrapper {
  private retryCount = 0;
  private maxRetries = 3;
  private shouldFail = false;
  private failAfter = 0;

  /**
   * Configure retry behavior
   */
  setMaxRetries(count: number): void {
    this.maxRetries = count;
  }

  /**
   * Configure to fail after N retries
   */
  setFailAfter(count: number): void {
    this.shouldFail = true;
    this.failAfter = count;
  }

  /**
   * Reset retry state
   */
  reset(): void {
    this.retryCount = 0;
    this.shouldFail = false;
    this.failAfter = 0;
  }

  /**
   * Get retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Wrap a function with retry logic
   */
  wrap<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          if (this.shouldFail && attempt >= this.failAfter) {
            throw new Error('Mock retry failure');
          }

          return await fn(...args);
        } catch (error) {
          lastError = error as Error;
          this.retryCount++;

          if (attempt === this.maxRetries) {
            throw lastError;
          }

          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
        }
      }

      throw lastError || new Error('Retry exhausted');
    };
  }
}

/**
 * Create a mock circuit breaker
 */
export function createMockCircuitBreaker<T extends unknown[], R>(): MockCircuitBreaker<T, R> {
  return new MockCircuitBreaker<T, R>();
}

/**
 * Create a mock retry wrapper
 */
export function createMockRetryWrapper(): MockRetryWrapper {
  return new MockRetryWrapper();
}
