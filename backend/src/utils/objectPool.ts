/**
 * Object Pool for frequently created objects
 * Reduces GC pressure by reusing objects instead of creating new ones
 */

export interface Poolable {
  reset(): void;
}

export class ObjectPool<T extends Poolable> {
  private pool: T[] = [];
  private factory: () => T;
  private maxSize: number;
  private activeCount = 0;

  constructor(factory: () => T, maxSize = 100) {
    this.factory = factory;
    this.maxSize = maxSize;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      this.activeCount++;
      const item = this.pool.pop();
      if (item !== undefined) {
        return item;
      }
    }
    this.activeCount++;
    return this.factory();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      obj.reset();
      this.pool.push(obj);
    }
    this.activeCount--;
  }

  get size(): number {
    return this.pool.length;
  }

  get active(): number {
    return this.activeCount;
  }

  clear(): void {
    this.pool.length = 0;
    this.activeCount = 0;
  }
}

/**
 * String builder pool for efficient string concatenation
 */
export class StringBuilder implements Poolable {
  private parts: string[] = [];

  append(str: string): this {
    this.parts.push(str);
    return this;
  }

  toString(): string {
    return this.parts.join("");
  }

  reset(): void {
    this.parts.length = 0;
  }

  get length(): number {
    return this.parts.reduce((sum, part) => sum + part.length, 0);
  }
}

// Global string builder pool
export const stringBuilderPool = new ObjectPool(() => new StringBuilder(), 50);

/**
 * Buffer pool for binary data operations
 */
export class BufferPool {
  private pools = new Map<number, Buffer[]>();
  private maxPoolSize = 10;

  acquire(size: number): Buffer {
    const pool = this.pools.get(size);
    if (pool && pool.length > 0) {
      const buf = pool.pop();
      if (buf !== undefined) {
        return buf;
      }
    }
    return Buffer.alloc(size);
  }

  release(buf: Buffer): void {
    const size = buf.length;
    let pool = this.pools.get(size);
    if (!pool) {
      pool = [];
      this.pools.set(size, pool);
    }
    if (pool.length < this.maxPoolSize) {
      buf.fill(0); // Clear sensitive data
      pool.push(buf);
    }
  }

  clear(): void {
    this.pools.clear();
  }
}

export const bufferPool = new BufferPool();

/**
 * Array pool for temporary arrays
 */
export class ArrayPool<T> {
  private pools = new Map<number, T[][]>();
  private maxPoolSize = 20;

  acquire(initialSize = 16): T[] {
    const pool = this.pools.get(initialSize);
    if (pool && pool.length > 0) {
      const arr = pool.pop();
      if (arr !== undefined) {
        return arr;
      }
    }
    return new Array(initialSize);
  }

  release(arr: T[], expectedSize = 16): void {
    arr.length = 0;
    let pool = this.pools.get(expectedSize);
    if (!pool) {
      pool = [];
      this.pools.set(expectedSize, pool);
    }
    if (pool.length < this.maxPoolSize) {
      pool.push(arr);
    }
  }

  clear(): void {
    this.pools.clear();
  }
}

export const arrayPool = new ArrayPool<unknown>();
