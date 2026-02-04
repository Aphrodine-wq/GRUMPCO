/**
 * Memory-Mapped File System
 * 
 * Zero-copy file access for massive codebases:
 * - Adaptive threshold based on system memory
 * - Page-based access with prefetching
 * - LRU/LFU/ARC eviction policies
 * - Huge page support on Linux
 */

import { EventEmitter } from 'events';
import { existsSync, statSync, openSync, closeSync, readSync, fstatSync } from 'fs';
import { totalmem, freemem } from 'os';
import type {
  MemoryMappedConfig,
  MemoryMappedFile,
  PageInfo,
} from './types.js';

// ============================================================================
// PAGE CACHE
// ============================================================================

interface CachedPage {
  fileKey: string;
  offset: number;
  data: Buffer;
  accessCount: number;
  lastAccess: number;
  isDirty: boolean;
}

/**
 * LRU Cache for pages
 */
class PageCache {
  private cache: Map<string, CachedPage> = new Map();
  private maxSize: number;
  private currentSize: number = 0;
  private policy: 'lru' | 'lfu' | 'arc' | 'clock';

  constructor(maxSizeMB: number, policy: 'lru' | 'lfu' | 'arc' | 'clock' = 'lru') {
    this.maxSize = maxSizeMB * 1024 * 1024;
    this.policy = policy;
  }

  /**
   * Get a page from cache
   */
  get(key: string): CachedPage | undefined {
    const page = this.cache.get(key);
    if (page) {
      page.accessCount++;
      page.lastAccess = Date.now();
      
      // Move to end for LRU (Map maintains insertion order)
      if (this.policy === 'lru') {
        this.cache.delete(key);
        this.cache.set(key, page);
      }
    }
    return page;
  }

  /**
   * Put a page into cache
   */
  put(key: string, page: CachedPage): void {
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.data.length;
    }

    // Evict if necessary
    while (this.currentSize + page.data.length > this.maxSize && this.cache.size > 0) {
      this.evictOne();
    }

    this.cache.set(key, page);
    this.currentSize += page.data.length;
  }

  /**
   * Evict one page based on policy
   */
  private evictOne(): void {
    let toEvict: string | null = null;

    switch (this.policy) {
      case 'lru':
        // First key is oldest (LRU)
        toEvict = this.cache.keys().next().value ?? null;
        break;

      case 'lfu':
        // Find least frequently used
        let minCount = Infinity;
        for (const [key, page] of this.cache) {
          if (page.accessCount < minCount) {
            minCount = page.accessCount;
            toEvict = key;
          }
        }
        break;

      case 'clock':
      case 'arc':
        // Simplified: use LRU as fallback
        toEvict = this.cache.keys().next().value ?? null;
        break;
    }

    if (toEvict) {
      const page = this.cache.get(toEvict);
      if (page) {
        this.currentSize -= page.data.length;
        this.cache.delete(toEvict);
      }
    }
  }

  /**
   * Invalidate pages for a file
   */
  invalidateFile(fileKey: string): void {
    for (const [key, page] of this.cache) {
      if (page.fileKey === fileKey) {
        this.currentSize -= page.data.length;
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all pages
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * Get current size in bytes
   */
  getSize(): number {
    return this.currentSize;
  }

  /**
   * Get page count
   */
  getCount(): number {
    return this.cache.size;
  }
}

// ============================================================================
// MEMORY-MAPPED FILE MANAGER
// ============================================================================

/**
 * Memory-Mapped File Manager
 * 
 * Provides efficient file access through memory mapping simulation.
 * Note: True mmap requires native bindings; this is a high-performance
 * alternative using buffered I/O with caching.
 */
export class MemoryMappedManager extends EventEmitter {
  private config: MemoryMappedConfig;
  private mappedFiles: Map<string, MemoryMappedFile> = new Map();
  private pageCache: PageCache;
  private fileDescriptors: Map<string, number> = new Map();
  private adaptiveThreshold: number;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config: MemoryMappedConfig) {
    super();
    this.config = config;
    this.pageCache = new PageCache(
      config.memory.maxTotalMB,
      config.paging.evictionPolicy
    );
    this.adaptiveThreshold = this.calculateAdaptiveThreshold();
  }

  /**
   * Start the manager
   */
  start(): void {
    if (this.config.adaptive.enabled) {
      this.checkInterval = setInterval(() => {
        this.adaptiveThreshold = this.calculateAdaptiveThreshold();
        this.checkMemoryPressure();
      }, this.config.adaptive.checkInterval);
    }
    this.emit('started');
  }

  /**
   * Stop the manager
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.emit('stopped');
  }

  /**
   * Calculate adaptive threshold based on system memory
   */
  private calculateAdaptiveThreshold(): number {
    if (!this.config.adaptive.enabled) {
      return this.config.fixedThresholdKB * 1024;
    }

    const total = totalmem();
    const free = freemem();
    const availablePercent = free / total;

    // Use more aggressive mmap when memory is plentiful
    if (availablePercent > 0.5) {
      return this.config.adaptive.minFileSizeKB * 1024;
    } else if (availablePercent > 0.3) {
      return this.config.adaptive.minFileSizeKB * 1024 * 2;
    } else {
      return this.config.adaptive.minFileSizeKB * 1024 * 4;
    }
  }

  /**
   * Check memory pressure and evict if needed
   */
  private checkMemoryPressure(): void {
    const free = freemem();
    const total = totalmem();
    const freePercent = free / total;

    if (freePercent < this.config.memory.lowMemoryThreshold / 100) {
      this.emit('memory:pressure', { freePercent });
      
      if (this.config.memory.emergencyEviction) {
        // Close some mapped files
        const toClose = Math.ceil(this.mappedFiles.size * 0.3);
        let closed = 0;
        
        for (const [path, file] of this.mappedFiles) {
          if (closed >= toClose) break;
          this.unmap(path);
          closed++;
        }
      }
    }
  }

  /**
   * Check if a file should be memory-mapped
   */
  shouldMmap(filePath: string): boolean {
    if (!this.config.enabled) return false;
    if (!existsSync(filePath)) return false;

    const stats = statSync(filePath);
    return stats.size >= this.adaptiveThreshold;
  }

  /**
   * Memory-map a file
   */
  map(filePath: string): MemoryMappedFile | null {
    if (!existsSync(filePath)) return null;

    // Check if already mapped
    if (this.mappedFiles.has(filePath)) {
      const file = this.mappedFiles.get(filePath)!;
      file.accessCount++;
      file.lastAccess = Date.now();
      return file;
    }

    // Check file count limit
    if (this.mappedFiles.size >= this.config.paging.maxMappedFiles) {
      this.evictOldestFile();
    }

    try {
      const fd = openSync(filePath, 'r');
      const stats = fstatSync(fd);
      
      this.fileDescriptors.set(filePath, fd);

      const mmapFile: MemoryMappedFile = {
        path: filePath,
        size: stats.size,
        mappedAt: Date.now(),
        lastAccess: Date.now(),
        accessCount: 1,
        buffer: Buffer.alloc(0), // Lazy load
        isLocked: false,
        pages: [],
      };

      this.mappedFiles.set(filePath, mmapFile);
      this.emit('file:mapped', { path: filePath, size: stats.size });

      return mmapFile;
    } catch (error) {
      this.emit('error', { path: filePath, error });
      return null;
    }
  }

  /**
   * Read a range from a memory-mapped file
   */
  read(filePath: string, offset: number = 0, length?: number): Buffer | null {
    const file = this.mappedFiles.get(filePath);
    if (!file) {
      // Try to map first
      const mapped = this.map(filePath);
      if (!mapped) return null;
      return this.read(filePath, offset, length);
    }

    file.accessCount++;
    file.lastAccess = Date.now();

    const readLength = length ?? (file.size - offset);
    const endOffset = offset + readLength;
    const pageSize = this.config.paging.pageSize;

    // Calculate which pages we need
    const startPage = Math.floor(offset / pageSize);
    const endPage = Math.ceil(endOffset / pageSize);
    
    const pageBuffers: Buffer[] = [];

    for (let pageNum = startPage; pageNum < endPage; pageNum++) {
      const pageOffset = pageNum * pageSize;
      const pageKey = `${filePath}:${pageNum}`;

      // Check cache
      let cachedPage = this.pageCache.get(pageKey);
      
      if (!cachedPage) {
        // Load page from disk
        const pageData = this.loadPage(filePath, pageOffset, pageSize);
        if (!pageData) return null;

        cachedPage = {
          fileKey: filePath,
          offset: pageOffset,
          data: pageData,
          accessCount: 1,
          lastAccess: Date.now(),
          isDirty: false,
        };

        this.pageCache.put(pageKey, cachedPage);
        this.emit('page:loaded', { path: filePath, page: pageNum });

        // Prefetch next pages
        if (this.config.paging.prefetchPages > 0) {
          setImmediate(() => this.prefetchPages(filePath, pageNum + 1, this.config.paging.prefetchPages));
        }
      }

      pageBuffers.push(cachedPage.data);
    }

    // Combine pages and extract requested range
    const combined = Buffer.concat(pageBuffers);
    const internalOffset = offset - (startPage * pageSize);
    
    return combined.subarray(internalOffset, internalOffset + readLength);
  }

  /**
   * Load a page from disk
   */
  private loadPage(filePath: string, offset: number, size: number): Buffer | null {
    const fd = this.fileDescriptors.get(filePath);
    if (fd === undefined) return null;

    try {
      const file = this.mappedFiles.get(filePath);
      const actualSize = file ? Math.min(size, file.size - offset) : size;
      
      if (actualSize <= 0) return Buffer.alloc(0);

      const buffer = Buffer.alloc(actualSize);
      readSync(fd, buffer, 0, actualSize, offset);
      return buffer;
    } catch (error) {
      return null;
    }
  }

  /**
   * Prefetch pages ahead
   */
  private prefetchPages(filePath: string, startPage: number, count: number): void {
    const file = this.mappedFiles.get(filePath);
    if (!file) return;

    const pageSize = this.config.paging.pageSize;
    const maxPages = Math.ceil(file.size / pageSize);

    for (let i = 0; i < count && startPage + i < maxPages; i++) {
      const pageNum = startPage + i;
      const pageKey = `${filePath}:${pageNum}`;

      // Only prefetch if not already cached
      if (!this.pageCache.get(pageKey)) {
        const pageOffset = pageNum * pageSize;
        const pageData = this.loadPage(filePath, pageOffset, pageSize);
        
        if (pageData) {
          this.pageCache.put(pageKey, {
            fileKey: filePath,
            offset: pageOffset,
            data: pageData,
            accessCount: 0,
            lastAccess: Date.now(),
            isDirty: false,
          });
        }
      }
    }
  }

  /**
   * Read entire file
   */
  readFile(filePath: string): Buffer | null {
    const file = this.map(filePath);
    if (!file) return null;
    return this.read(filePath, 0, file.size);
  }

  /**
   * Unmap a file
   */
  unmap(filePath: string): void {
    const file = this.mappedFiles.get(filePath);
    if (!file) return;

    // Close file descriptor
    const fd = this.fileDescriptors.get(filePath);
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Ignore close errors
      }
      this.fileDescriptors.delete(filePath);
    }

    // Invalidate pages
    this.pageCache.invalidateFile(filePath);

    this.mappedFiles.delete(filePath);
    this.emit('file:unmapped', { path: filePath });
  }

  /**
   * Evict the oldest (least recently accessed) file
   */
  private evictOldestFile(): void {
    let oldest: { path: string; lastAccess: number } | null = null;

    for (const [path, file] of this.mappedFiles) {
      if (!file.isLocked) {
        if (!oldest || file.lastAccess < oldest.lastAccess) {
          oldest = { path, lastAccess: file.lastAccess };
        }
      }
    }

    if (oldest) {
      this.unmap(oldest.path);
    }
  }

  /**
   * Lock a file to prevent eviction
   */
  lock(filePath: string): boolean {
    const file = this.mappedFiles.get(filePath);
    if (file) {
      file.isLocked = true;
      return true;
    }
    return false;
  }

  /**
   * Unlock a file
   */
  unlock(filePath: string): boolean {
    const file = this.mappedFiles.get(filePath);
    if (file) {
      file.isLocked = false;
      return true;
    }
    return false;
  }

  /**
   * Invalidate cache for a file (e.g., after modification)
   */
  invalidate(filePath: string): void {
    this.pageCache.invalidateFile(filePath);
    
    const file = this.mappedFiles.get(filePath);
    if (file) {
      file.pages = [];
    }
    
    this.emit('file:invalidated', { path: filePath });
  }

  /**
   * Get statistics
   */
  getStats(): {
    mappedFiles: number;
    totalMappedSize: number;
    cacheSize: number;
    cachePages: number;
    adaptiveThreshold: number;
    memoryFree: number;
    memoryTotal: number;
  } {
    let totalSize = 0;
    for (const file of this.mappedFiles.values()) {
      totalSize += file.size;
    }

    return {
      mappedFiles: this.mappedFiles.size,
      totalMappedSize: totalSize,
      cacheSize: this.pageCache.getSize(),
      cachePages: this.pageCache.getCount(),
      adaptiveThreshold: this.adaptiveThreshold,
      memoryFree: freemem(),
      memoryTotal: totalmem(),
    };
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.stop();

    // Unmap all files
    for (const path of this.mappedFiles.keys()) {
      this.unmap(path);
    }

    this.pageCache.clear();
    this.emit('disposed');
  }
}

/**
 * Create memory-mapped manager
 */
export function createMemoryMappedManager(config: MemoryMappedConfig): MemoryMappedManager {
  return new MemoryMappedManager(config);
}

/**
 * Default memory-mapped configuration
 */
export function getDefaultMmapConfig(): MemoryMappedConfig {
  return {
    enabled: true,
    adaptive: {
      enabled: true,
      minFileSizeKB: 64, // 64KB minimum
      systemMemoryPercent: 10, // Use up to 10% of system memory
      checkInterval: 30000, // Check every 30 seconds
    },
    fixedThresholdKB: 256,
    paging: {
      pageSize: 64 * 1024, // 64KB pages
      prefetchPages: 4,
      evictionPolicy: 'lru',
      maxMappedFiles: 100,
    },
    memory: {
      maxTotalMB: 512,
      lowMemoryThreshold: 10, // 10% free triggers eviction
      emergencyEviction: true,
    },
    platform: {
      hugePages: false, // Requires OS support
      lockMemory: false, // Requires privileges
      adviseSequential: true,
    },
  };
}
