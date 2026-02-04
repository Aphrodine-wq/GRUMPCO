/**
 * ID Generation Utilities
 * 
 * Provides consistent ID generation across all G-Rump packages.
 */

/**
 * Generates a unique ID with an optional prefix.
 * 
 * @param prefix - Optional prefix for the ID (e.g., 'chunk', 'mem', 'task')
 * @returns A unique string ID
 * 
 * @example
 * ```ts
 * const chunkId = generateId('chunk'); // 'chunk_1699876543210_abc123'
 * const taskId = generateId('task');   // 'task_1699876543210_def456'
 * const id = generateId();             // '1699876543210_ghi789'
 * ```
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 9);
  
  if (prefix) {
    return `${prefix}_${timestamp}_${random}`;
  }
  
  return `${timestamp}_${random}`;
}

/**
 * Generates a UUID v4-like string.
 * 
 * @returns A UUID-like string
 * 
 * @example
 * ```ts
 * const uuid = generateUUID(); // 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
 * ```
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates a short, URL-safe ID.
 * 
 * @param length - Length of the ID (default: 8)
 * @returns A short alphanumeric ID
 * 
 * @example
 * ```ts
 * const shortId = generateShortId();   // 'a1b2c3d4'
 * const longerId = generateShortId(12); // 'a1b2c3d4e5f6'
 * ```
 */
export function generateShortId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Validates if a string is a valid ID format.
 * 
 * @param id - The ID to validate
 * @param prefix - Optional expected prefix
 * @returns True if valid
 */
export function isValidId(id: string, prefix?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  
  if (prefix) {
    return id.startsWith(`${prefix}_`) && id.length > prefix.length + 1;
  }
  
  return id.length > 0 && /^[\w-]+$/.test(id);
}
