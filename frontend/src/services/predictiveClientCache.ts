/// <reference lib="dom" />
/* global IDBDatabase, IDBOpenDBRequest, IDBRequest, indexedDB */

/**
 * Predictive Client Cache
 * Uses IndexedDB to cache responses client-side for instant retrieval
 *
 * Features:
 * - IndexedDB storage for persistence
 * - LRU eviction
 * - Semantic matching (find similar queries)
 * - Offline support
 */

const DB_NAME = 'grump-predictive-cache';
const DB_VERSION = 1;
const STORE_NAME = 'responses';
const MAX_CACHE_SIZE = 100; // Max entries

interface CacheEntry {
  id: string;
  query: string;
  queryHash: string;
  response: string;
  tokens: number;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

class PredictiveClientCache {
  private db: IDBDatabase | null = null;
  private memoryCache = new Map<string, CacheEntry>();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (typeof window === 'undefined') return; // Server-side skip

    try {
      this.db = await this.openDB();
      this.isInitialized = true;

      // Load recent entries into memory
      await this.warmMemoryCache();

      // eslint-disable-next-line no-console
      console.log('[PredictiveCache] Initialized');
    } catch (error) {
      console.warn('[PredictiveCache] Failed to initialize:', error);
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('queryHash', 'queryHash', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
      };
    });
  }

  /**
   * Warm memory cache from IndexedDB
   */
  private async warmMemoryCache(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('lastAccessed');

    const request = index.openCursor(null, 'prev'); // Most recent first
    let count = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;

      if (cursor && count < 20) {
        // Load top 20 into memory
        const entry = cursor.value as CacheEntry;
        this.memoryCache.set(entry.id, entry);
        count++;
        cursor.continue();
      }
    };

    await new Promise((resolve) => {
      transaction.oncomplete = resolve;
    });
  }

  /**
   * Get cached response with semantic matching
   */
  async get(query: string, similarityThreshold = 0.85): Promise<string | null> {
    if (!this.isInitialized) await this.initialize();

    const queryHash = this.hashQuery(query);

    // Check memory cache first (fastest)
    for (const entry of this.memoryCache.values()) {
      const similarity = this.calculateSimilarity(query, entry.query);
      if (similarity > similarityThreshold) {
        this.updateAccessStats(entry);
        return entry.response;
      }
    }

    // Check IndexedDB
    if (this.db) {
      const entry = await this.getFromIndexedDB(queryHash);
      if (entry) {
        const similarity = this.calculateSimilarity(query, entry.query);
        if (similarity > similarityThreshold) {
          // Add to memory cache
          this.memoryCache.set(entry.id, entry);
          this.updateAccessStats(entry);
          return entry.response;
        }
      }
    }

    return null;
  }

  /**
   * Store response in cache
   */
  async set(query: string, response: string, tokens: number): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    const id = this.generateId();
    const entry: CacheEntry = {
      id,
      query: query.slice(0, 500), // Limit storage
      queryHash: this.hashQuery(query),
      response: response.slice(0, 10000), // Limit storage
      tokens,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
    };

    // Add to memory cache
    this.memoryCache.set(id, entry);

    // Persist to IndexedDB
    if (this.db) {
      await this.saveToIndexedDB(entry);
    }

    // Evict old entries if needed
    await this.evictIfNeeded();
  }

  /**
   * Preload likely responses based on context
   */
  async preload(context: string[]): Promise<void> {
    if (!this.isInitialized) return;

    // Analyze context and predict likely queries
    const predictions = this.predictQueries(context);

    for (const prediction of predictions) {
      // Check if we already have it
      const exists = await this.get(prediction.query, 0.95);
      if (!exists) {
        // Mark for server-side pre-computation
        this.markForPreload(prediction.query);
      }
    }
  }

  /**
   * Predict likely queries from context
   */
  private predictQueries(context: string[]): Array<{ query: string; confidence: number }> {
    const predictions: Array<{ query: string; confidence: number }> = [];

    // Analyze last message for patterns
    const lastMessage = context[context.length - 1] || '';

    // Code patterns
    if (lastMessage.includes('function') || lastMessage.includes('class')) {
      predictions.push({
        query: `Explain this ${lastMessage.includes('class') ? 'class' : 'function'}`,
        confidence: 0.7,
      });
    }

    // Debug patterns
    if (lastMessage.includes('error') || lastMessage.includes('bug')) {
      predictions.push({
        query: 'How to fix this error?',
        confidence: 0.8,
      });
    }

    // Common follow-ups
    if (context.length > 1) {
      predictions.push({
        query: 'Can you show me an example?',
        confidence: 0.6,
      });
      predictions.push({
        query: 'How do I implement this?',
        confidence: 0.65,
      });
    }

    return predictions;
  }

  private markForPreload(query: string): void {
    // Send to server for pre-computation
    fetch('/api/preload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).catch(() => {}); // Silent fail
  }

  private async getFromIndexedDB(queryHash: string): Promise<CacheEntry | null> {
    if (!this.db) return null;
    const db = this.db;

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('queryHash');
      const request = index.get(queryHash);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private async saveToIndexedDB(entry: CacheEntry): Promise<void> {
    if (!this.db) return;
    const db = this.db;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async evictIfNeeded(): Promise<void> {
    if (!this.db) return;

    const count = await this.getCount();

    if (count > MAX_CACHE_SIZE) {
      // Evict oldest entries
      const toEvict = count - MAX_CACHE_SIZE + 10; // Evict extra for headroom

      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('lastAccessed');

      const request = index.openCursor();
      let evicted = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && evicted < toEvict) {
          const entry = cursor.value as CacheEntry;

          // Don't evict frequently accessed entries
          if (entry.accessCount < 3) {
            cursor.delete();
            this.memoryCache.delete(entry.id);
            evicted++;
          }

          cursor.continue();
        }
      };

      await new Promise((resolve) => {
        transaction.oncomplete = resolve;
      });
    }
  }

  private async getCount(): Promise<number> {
    if (!this.db) return 0;
    const db = this.db;

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  }

  private updateAccessStats(entry: CacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Update in IndexedDB (async, fire-and-forget)
    if (this.db) {
      this.saveToIndexedDB(entry).catch(() => {});
    }
  }

  private calculateSimilarity(a: string, b: string): number {
    // Jaccard similarity on word sets
    const setA = new Set(
      a
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
    const setB = new Set(
      b
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }

  private hashQuery(query: string): string {
    // Simple hash for lookup
    let hash = 0;
    const str = query
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 100);

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return hash.toString(36);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.db) {
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await new Promise((resolve) => {
        const request = store.clear();
        request.onsuccess = () => resolve(undefined);
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { memorySize: number; initialized: boolean } {
    return {
      memorySize: this.memoryCache.size,
      initialized: this.isInitialized,
    };
  }
}

// Singleton instance
export const predictiveClientCache = new PredictiveClientCache();

// Auto-initialize on client
if (typeof window !== 'undefined') {
  predictiveClientCache.initialize();
}
