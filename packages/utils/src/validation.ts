/**
 * Validation Utilities
 * 
 * Common validation functions used across packages.
 */

/**
 * Checks if a value is defined (not null or undefined).
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Checks if a string is non-empty after trimming.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Checks if a value is a valid positive number.
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

/**
 * Checks if a value is a valid non-negative number.
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}

/**
 * Checks if a value is a valid integer.
 */
export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Checks if a value is a valid positive integer.
 */
export function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

/**
 * Checks if a value is a valid array.
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Checks if a value is a non-empty array.
 */
export function isNonEmptyArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Checks if a value is a plain object.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Checks if a string is a valid URL.
 */
export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a string is a valid email (basic check).
 */
export function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Asserts a condition and throws if false.
 * 
 * @param condition - The condition to check
 * @param message - Error message if assertion fails
 * @throws Error if condition is false
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Asserts a value is defined and throws if not.
 * 
 * @param value - The value to check
 * @param name - Name of the value for error message
 * @returns The value if defined
 * @throws Error if value is null or undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  name: string
): T {
  if (value === null || value === undefined) {
    throw new Error(`${name} is required but was ${value}`);
  }
  return value;
}

/**
 * Clamps a number within a range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Truncates a string to a maximum length, adding ellipsis if needed.
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}
