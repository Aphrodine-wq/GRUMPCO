/**
 * Store Error Helper
 *
 * Centralized error handling utilities for Svelte stores.
 * Reduces code duplication and ensures consistent error handling patterns.
 *
 * @module utils/storeHelpers
 *
 * @example
 * // Before (repeated in every store):
 * } catch (error) {
 *   const message = error instanceof Error ? error.message : 'Failed to X';
 *   store.update(s => ({ ...s, isLoading: false, error: message }));
 *   throw error;
 * }
 *
 * // After (clean, consistent):
 * } catch (error) {
 *   throw handleStoreError(store, error, 'Failed to X');
 * }
 */

import type { Writable } from 'svelte/store';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Base store state with common loading/error fields
 */
export interface BaseStoreState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Store action result for tracking async operations
 */
export interface StoreActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unknown error occurred';
}

/**
 * Handle store error with consistent pattern.
 * Updates store state and returns the error for re-throwing.
 *
 * @param store - The Svelte writable store
 * @param error - The caught error
 * @param defaultMessage - Fallback message if error has no message
 * @returns The error for re-throwing
 */
export function handleStoreError<T extends BaseStoreState>(
  store: Writable<T>,
  error: unknown,
  defaultMessage: string
): Error {
  const message = error instanceof Error ? error.message : defaultMessage;

  store.update((s) => ({
    ...s,
    isLoading: false,
    error: message,
  }));

  // Return an Error instance for consistent throwing
  return error instanceof Error ? error : new Error(message);
}

/**
 * Set loading state on a store
 */
export function setLoading<T extends BaseStoreState>(store: Writable<T>, isLoading: boolean): void {
  store.update((s) => ({
    ...s,
    isLoading,
    error: isLoading ? null : s.error, // Clear error when starting new operation
  }));
}

/**
 * Set error state on a store
 */
export function setError<T extends BaseStoreState>(store: Writable<T>, error: string | null): void {
  store.update((s) => ({
    ...s,
    error,
    isLoading: false,
  }));
}

/**
 * Clear error state on a store
 */
export function clearError<T extends BaseStoreState>(store: Writable<T>): void {
  store.update((s) => ({
    ...s,
    error: null,
  }));
}

// =============================================================================
// ASYNC ACTION WRAPPER
// =============================================================================

/**
 * Options for async store actions
 */
export interface AsyncActionOptions {
  /** Error message to show if operation fails */
  errorMessage?: string;
  /** Whether to rethrow the error after handling */
  rethrow?: boolean;
  /** Whether to set loading state */
  setLoading?: boolean;
}

/**
 * Wrap an async store action with automatic loading/error handling.
 *
 * @param store - The Svelte writable store
 * @param action - The async action to perform
 * @param options - Configuration options
 * @returns The action result or throws if rethrow is true
 *
 * @example
 * const result = await wrapStoreAction(
 *   store,
 *   async () => {
 *     const response = await fetchApi('/api/data');
 *     return response.json();
 *   },
 *   { errorMessage: 'Failed to load data' }
 * );
 */
export async function wrapStoreAction<T extends BaseStoreState, R>(
  store: Writable<T>,
  action: () => Promise<R>,
  options: AsyncActionOptions = {}
): Promise<StoreActionResult<R>> {
  const {
    errorMessage = 'Operation failed',
    rethrow = false,
    setLoading: shouldSetLoading = true,
  } = options;

  if (shouldSetLoading) {
    setLoading(store, true);
  }

  try {
    const data = await action();

    if (shouldSetLoading) {
      setLoading(store, false);
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : errorMessage;

    store.update((s) => ({
      ...s,
      isLoading: false,
      error: message,
    }));

    if (rethrow) {
      throw error instanceof Error ? error : new Error(message);
    }

    return { success: false, error: message };
  }
}

// =============================================================================
// STORE UTILITIES
// =============================================================================

/**
 * Create a reset function for a store
 */
export function createResetFunction<T>(store: Writable<T>, initialState: T): () => void {
  return () => store.set(initialState);
}

/**
 * Debounce a store update
 */
export function debounceStoreUpdate<T>(
  store: Writable<T>,
  delay: number = 300
): (updater: (state: T) => T) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (updater: (state: T) => T) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      store.update(updater);
      timeoutId = null;
    }, delay);
  };
}
