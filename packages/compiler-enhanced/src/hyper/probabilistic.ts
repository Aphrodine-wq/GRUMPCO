/**
 * Probabilistic Caching System
 * 
 * Implements space-efficient probabilistic data structures:
 * - Bloom Filter: Fast membership testing (O(1))
 * - Count-Min Sketch: Frequency estimation for hot paths
 * - HyperLogLog: Cardinality estimation
 * - Cuckoo Filter: Membership with deletion support
 * 
 * These reduce memory usage by 10-100x while maintaining
 * high accuracy (configurable false positive rates).
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  ProbabilisticCacheConfig,
  BloomFilter,
  CountMinSketch,
  CacheStatistics,
} from './types.js';

// ============================================================================
// BLOOM FILTER
// ============================================================================

/**
 * Space-efficient probabilistic set membership test
 * 
 * Uses multiple hash functions to set bits in a bit array.
 * False positives are possible (configurable), but false negatives never occur.
 */
export class BloomFilterImpl {
  private bitArray: Uint8Array;
  private hashCount: number;
  private expectedElements: number;
  private insertedElements: number = 0;
  private falsePositiveRate: number;

  constructor(expectedElements: number, falsePositiveRate: number = 0.01) {
    this.expectedElements = expectedElements;
    this.falsePositiveRate = falsePositiveRate;

    // Calculate optimal size and hash count
    // m = -(n * ln(p)) / (ln(2)^2)
    const m = Math.ceil(-(expectedElements * Math.log(falsePositiveRate)) / Math.pow(Math.log(2), 2));
    // k = (m/n) * ln(2)
    const k = Math.round((m / expectedElements) * Math.log(2));

    this.bitArray = new Uint8Array(Math.ceil(m / 8));
    this.hashCount = Math.max(1, k);
  }

  /**
   * Add an item to the filter
   */
  add(item: string): void {
    const hashes = this.getHashes(item);
    const bits = this.bitArray.length * 8;

    for (const hash of hashes) {
      const index = Math.abs(hash) % bits;
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      this.bitArray[byteIndex] |= (1 << bitIndex);
    }

    this.insertedElements++;
  }

  /**
   * Check if an item might be in the filter
   * False positives possible, false negatives never
   */
  mightContain(item: string): boolean {
    const hashes = this.getHashes(item);
    const bits = this.bitArray.length * 8;

    for (const hash of hashes) {
      const index = Math.abs(hash) % bits;
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      
      if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate hash values using double hashing technique
   */
  private getHashes(item: string): number[] {
    const hash1 = this.hash32(item, 0);
    const hash2 = this.hash32(item, hash1);
    
    const hashes: number[] = [];
    for (let i = 0; i < this.hashCount; i++) {
      hashes.push(hash1 + i * hash2);
    }
    
    return hashes;
  }

  /**
   * 32-bit hash function (FNV-1a variant)
   */
  private hash32(data: string, seed: number = 0): number {
    let hash = 2166136261 ^ seed;
    
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    
    return hash >>> 0;
  }

  /**
   * Get current false positive probability
   */
  getCurrentFPP(): number {
    const k = this.hashCount;
    const n = this.insertedElements;
    const m = this.bitArray.length * 8;
    
    return Math.pow(1 - Math.exp(-k * n / m), k);
  }

  /**
   * Serialize filter for persistence
   */
  serialize(): Buffer {
    const header = Buffer.alloc(16);
    header.writeUInt32LE(this.expectedElements, 0);
    header.writeUInt32LE(this.insertedElements, 4);
    header.writeUInt32LE(this.hashCount, 8);
    header.writeFloatLE(this.falsePositiveRate, 12);
    
    return Buffer.concat([header, Buffer.from(this.bitArray)]);
  }

  /**
   * Deserialize filter from persistence
   */
  static deserialize(data: Buffer): BloomFilterImpl {
    const expectedElements = data.readUInt32LE(0);
    const insertedElements = data.readUInt32LE(4);
    const hashCount = data.readUInt32LE(8);
    const falsePositiveRate = data.readFloatLE(12);
    
    const filter = new BloomFilterImpl(expectedElements, falsePositiveRate);
    filter.insertedElements = insertedElements;
    filter.bitArray = new Uint8Array(data.subarray(16));
    
    return filter;
  }

  /**
   * Get memory usage in bytes
   */
  getMemoryUsage(): number {
    return this.bitArray.length;
  }
}

// ============================================================================
// COUNT-MIN SKETCH
// ============================================================================

/**
 * Frequency estimation with bounded error
 * 
 * Uses multiple hash functions and counters to estimate
 * the frequency of items. Always overestimates, never underestimates.
 */
export class CountMinSketchImpl {
  private table: Uint32Array[];
  private width: number;
  private depth: number;
  private totalCount: number = 0;
  private conservativeUpdate: boolean;

  constructor(width: number = 1024, depth: number = 5, conservativeUpdate: boolean = true) {
    this.width = width;
    this.depth = depth;
    this.conservativeUpdate = conservativeUpdate;
    
    this.table = Array.from({ length: depth }, () => new Uint32Array(width));
  }

  /**
   * Increment count for an item
   */
  add(item: string, count: number = 1): void {
    const hashes = this.getHashes(item);
    
    if (this.conservativeUpdate) {
      // Conservative update: only increment to match minimum estimate
      const currentMin = this.estimateCount(item);
      const newValue = currentMin + count;
      
      for (let i = 0; i < this.depth; i++) {
        const index = Math.abs(hashes[i]) % this.width;
        if (this.table[i][index] < newValue) {
          this.table[i][index] = newValue;
        }
      }
    } else {
      // Standard update
      for (let i = 0; i < this.depth; i++) {
        const index = Math.abs(hashes[i]) % this.width;
        this.table[i][index] += count;
      }
    }
    
    this.totalCount += count;
  }

  /**
   * Estimate count for an item
   */
  estimateCount(item: string): number {
    const hashes = this.getHashes(item);
    let minCount = Infinity;
    
    for (let i = 0; i < this.depth; i++) {
      const index = Math.abs(hashes[i]) % this.width;
      minCount = Math.min(minCount, this.table[i][index]);
    }
    
    return minCount;
  }

  /**
   * Generate hash values
   */
  private getHashes(item: string): number[] {
    const hash = createHash('md5').update(item).digest();
    const hashes: number[] = [];
    
    for (let i = 0; i < this.depth; i++) {
      hashes.push(hash.readInt32LE((i * 4) % 12));
    }
    
    return hashes;
  }

  /**
   * Get heavy hitters (items above threshold)
   */
  getHeavyHitters(threshold: number, candidates: string[]): Array<{ item: string; count: number }> {
    return candidates
      .map(item => ({ item, count: this.estimateCount(item) }))
      .filter(x => x.count >= threshold)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Merge another sketch into this one
   */
  merge(other: CountMinSketchImpl): void {
    if (other.width !== this.width || other.depth !== this.depth) {
      throw new Error('Cannot merge sketches with different dimensions');
    }
    
    for (let i = 0; i < this.depth; i++) {
      for (let j = 0; j < this.width; j++) {
        this.table[i][j] += other.table[i][j];
      }
    }
    
    this.totalCount += other.totalCount;
  }

  /**
   * Serialize sketch for persistence
   */
  serialize(): Buffer {
    const header = Buffer.alloc(16);
    header.writeUInt32LE(this.width, 0);
    header.writeUInt32LE(this.depth, 4);
    header.writeUInt32LE(this.totalCount, 8);
    header.writeUInt8(this.conservativeUpdate ? 1 : 0, 12);
    
    const tableBuffers = this.table.map(row => Buffer.from(row.buffer));
    return Buffer.concat([header, ...tableBuffers]);
  }

  /**
   * Get memory usage in bytes
   */
  getMemoryUsage(): number {
    return this.width * this.depth * 4;
  }
}

// ============================================================================
// HYPERLOGLOG
// ============================================================================

/**
 * Cardinality estimation with very low memory usage
 * 
 * Uses probabilistic counting to estimate the number of unique items
 * with ~2% error using only 1.5KB of memory.
 */
export class HyperLogLogImpl {
  private registers: Uint8Array;
  private precision: number;
  private m: number; // Number of registers

  constructor(precision: number = 14) {
    // Precision of 14 gives ~16K registers and ~0.81% error
    this.precision = Math.max(4, Math.min(16, precision));
    this.m = 1 << this.precision;
    this.registers = new Uint8Array(this.m);
  }

  /**
   * Add an item to the estimator
   */
  add(item: string): void {
    const hash = this.hash64(item);
    
    // Use first p bits for register index
    const index = hash & (this.m - 1);
    
    // Count leading zeros in remaining bits + 1
    const w = hash >>> this.precision;
    const leadingZeros = this.countLeadingZeros(w) + 1;
    
    // Update register with maximum
    if (leadingZeros > this.registers[index]) {
      this.registers[index] = leadingZeros;
    }
  }

  /**
   * Estimate cardinality (number of unique items)
   */
  estimate(): number {
    // Calculate harmonic mean
    let sum = 0;
    let zeros = 0;
    
    for (let i = 0; i < this.m; i++) {
      sum += Math.pow(2, -this.registers[i]);
      if (this.registers[i] === 0) {
        zeros++;
      }
    }
    
    // Alpha correction factor
    const alpha = this.getAlpha();
    let estimate = alpha * this.m * this.m / sum;
    
    // Small range correction (linear counting)
    if (estimate <= 2.5 * this.m && zeros > 0) {
      estimate = this.m * Math.log(this.m / zeros);
    }
    
    // Large range correction
    const pow32 = Math.pow(2, 32);
    if (estimate > pow32 / 30) {
      estimate = -pow32 * Math.log(1 - estimate / pow32);
    }
    
    return Math.round(estimate);
  }

  /**
   * Get alpha correction factor based on precision
   */
  private getAlpha(): number {
    switch (this.precision) {
      case 4: return 0.673;
      case 5: return 0.697;
      case 6: return 0.709;
      default: return 0.7213 / (1 + 1.079 / this.m);
    }
  }

  /**
   * 64-bit hash function
   */
  private hash64(data: string): number {
    const hash = createHash('md5').update(data).digest();
    // Take first 8 bytes as a number (simplified)
    return hash.readUInt32LE(0);
  }

  /**
   * Count leading zeros in a 32-bit integer
   */
  private countLeadingZeros(n: number): number {
    if (n === 0) return 32;
    let count = 0;
    if ((n & 0xFFFF0000) === 0) { count += 16; n <<= 16; }
    if ((n & 0xFF000000) === 0) { count += 8; n <<= 8; }
    if ((n & 0xF0000000) === 0) { count += 4; n <<= 4; }
    if ((n & 0xC0000000) === 0) { count += 2; n <<= 2; }
    if ((n & 0x80000000) === 0) { count += 1; }
    return count;
  }

  /**
   * Merge another HyperLogLog into this one
   */
  merge(other: HyperLogLogImpl): void {
    if (other.precision !== this.precision) {
      throw new Error('Cannot merge HyperLogLogs with different precision');
    }
    
    for (let i = 0; i < this.m; i++) {
      this.registers[i] = Math.max(this.registers[i], other.registers[i]);
    }
  }

  /**
   * Get memory usage in bytes
   */
  getMemoryUsage(): number {
    return this.registers.length;
  }
}

// ============================================================================
// CUCKOO FILTER
// ============================================================================

/**
 * Probabilistic set membership with deletion support
 * 
 * Uses cuckoo hashing to store fingerprints, allowing deletion
 * unlike Bloom filters.
 */
export class CuckooFilterImpl {
  private buckets: Array<Uint16Array>;
  private bucketSize: number;
  private fingerprintSize: number;
  private maxKicks: number;
  private size: number = 0;

  constructor(capacity: number, bucketSize: number = 4, fingerprintSize: number = 16, maxKicks: number = 500) {
    const numBuckets = Math.ceil(capacity / bucketSize);
    this.bucketSize = bucketSize;
    this.fingerprintSize = fingerprintSize;
    this.maxKicks = maxKicks;
    
    this.buckets = Array.from({ length: numBuckets }, () => new Uint16Array(bucketSize));
  }

  /**
   * Add an item to the filter
   */
  add(item: string): boolean {
    const { i1, i2, fingerprint } = this.getPositions(item);
    
    // Try first bucket
    if (this.insertToBucket(i1, fingerprint)) {
      this.size++;
      return true;
    }
    
    // Try second bucket
    if (this.insertToBucket(i2, fingerprint)) {
      this.size++;
      return true;
    }
    
    // Both buckets full, start kicking
    let currentIndex = Math.random() < 0.5 ? i1 : i2;
    let currentFingerprint = fingerprint;
    
    for (let kicks = 0; kicks < this.maxKicks; kicks++) {
      // Randomly select an entry to kick
      const slotIndex = Math.floor(Math.random() * this.bucketSize);
      
      // Swap
      const temp = this.buckets[currentIndex][slotIndex];
      this.buckets[currentIndex][slotIndex] = currentFingerprint;
      currentFingerprint = temp;
      
      // Move to alternate bucket
      currentIndex = (currentIndex ^ this.hash32(currentFingerprint.toString())) % this.buckets.length;
      
      // Try to insert kicked fingerprint
      if (this.insertToBucket(currentIndex, currentFingerprint)) {
        this.size++;
        return true;
      }
    }
    
    // Filter is full
    return false;
  }

  /**
   * Check if an item might be in the filter
   */
  mightContain(item: string): boolean {
    const { i1, i2, fingerprint } = this.getPositions(item);
    return this.bucketContains(i1, fingerprint) || this.bucketContains(i2, fingerprint);
  }

  /**
   * Remove an item from the filter
   */
  remove(item: string): boolean {
    const { i1, i2, fingerprint } = this.getPositions(item);
    
    if (this.removeFromBucket(i1, fingerprint)) {
      this.size--;
      return true;
    }
    
    if (this.removeFromBucket(i2, fingerprint)) {
      this.size--;
      return true;
    }
    
    return false;
  }

  private getPositions(item: string): { i1: number; i2: number; fingerprint: number } {
    const hash = this.hash32(item);
    const fingerprint = (hash & 0xFFFF) || 1; // Ensure non-zero
    const i1 = (hash >>> 16) % this.buckets.length;
    const i2 = (i1 ^ this.hash32(fingerprint.toString())) % this.buckets.length;
    
    return { i1, i2, fingerprint };
  }

  private insertToBucket(bucketIndex: number, fingerprint: number): boolean {
    const bucket = this.buckets[bucketIndex];
    for (let i = 0; i < this.bucketSize; i++) {
      if (bucket[i] === 0) {
        bucket[i] = fingerprint;
        return true;
      }
    }
    return false;
  }

  private bucketContains(bucketIndex: number, fingerprint: number): boolean {
    const bucket = this.buckets[bucketIndex];
    for (let i = 0; i < this.bucketSize; i++) {
      if (bucket[i] === fingerprint) {
        return true;
      }
    }
    return false;
  }

  private removeFromBucket(bucketIndex: number, fingerprint: number): boolean {
    const bucket = this.buckets[bucketIndex];
    for (let i = 0; i < this.bucketSize; i++) {
      if (bucket[i] === fingerprint) {
        bucket[i] = 0;
        return true;
      }
    }
    return false;
  }

  private hash32(data: string): number {
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /**
   * Get memory usage in bytes
   */
  getMemoryUsage(): number {
    return this.buckets.length * this.bucketSize * 2;
  }
}

// ============================================================================
// PROBABILISTIC CACHE MANAGER
// ============================================================================

/**
 * Unified probabilistic cache manager
 * 
 * Combines all probabilistic data structures for optimal caching
 */
export class ProbabilisticCacheManager extends EventEmitter {
  private config: ProbabilisticCacheConfig;
  private bloomFilter: BloomFilterImpl | null = null;
  private countMinSketch: CountMinSketchImpl | null = null;
  private hyperLogLog: HyperLogLogImpl | null = null;
  private cuckooFilter: CuckooFilterImpl | null = null;
  
  private stats: CacheStatistics = {
    hits: 0,
    misses: 0,
    falsePositives: 0,
    evictions: 0,
    memoryUsage: 0,
    hitRate: 0,
    estimatedCardinality: 0,
    hotItems: [],
  };
  
  private allKeys: Set<string> = new Set(); // For tracking candidates

  constructor(config: ProbabilisticCacheConfig) {
    super();
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    if (this.config.bloomFilter.enabled) {
      this.bloomFilter = new BloomFilterImpl(
        this.config.bloomFilter.expectedElements,
        this.config.bloomFilter.falsePositiveRate
      );
    }

    if (this.config.countMinSketch.enabled) {
      this.countMinSketch = new CountMinSketchImpl(
        this.config.countMinSketch.width,
        this.config.countMinSketch.depth,
        this.config.countMinSketch.conservativeUpdate
      );
    }

    if (this.config.hyperLogLog.enabled) {
      this.hyperLogLog = new HyperLogLogImpl(this.config.hyperLogLog.precision);
    }

    if (this.config.cuckooFilter.enabled) {
      this.cuckooFilter = new CuckooFilterImpl(
        this.config.bloomFilter.expectedElements,
        this.config.cuckooFilter.bucketSize,
        this.config.cuckooFilter.fingerprintSize,
        this.config.cuckooFilter.maxKicks
      );
    }

    // Load persisted data if available
    if (this.config.behavior.persistenceEnabled) {
      this.loadFromDisk();
    }

    this.updateMemoryUsage();
  }

  /**
   * Record an access (for frequency tracking)
   */
  recordAccess(key: string): void {
    this.allKeys.add(key);

    // Add to Bloom filter
    if (this.bloomFilter) {
      this.bloomFilter.add(key);
    }

    // Increment in Count-Min Sketch
    if (this.countMinSketch) {
      this.countMinSketch.add(key);
    }

    // Add to HyperLogLog
    if (this.hyperLogLog) {
      this.hyperLogLog.add(key);
    }

    // Add to Cuckoo filter
    if (this.cuckooFilter) {
      this.cuckooFilter.add(key);
    }

    this.stats.hits++;
    this.updateStats();
  }

  /**
   * Check if a key was likely accessed before
   */
  wasLikelyAccessed(key: string): boolean {
    // Use Cuckoo filter if available (supports deletion)
    if (this.cuckooFilter) {
      return this.cuckooFilter.mightContain(key);
    }

    // Fall back to Bloom filter
    if (this.bloomFilter) {
      return this.bloomFilter.mightContain(key);
    }

    return false;
  }

  /**
   * Estimate access frequency for a key
   */
  estimateFrequency(key: string): number {
    if (this.countMinSketch) {
      return this.countMinSketch.estimateCount(key);
    }
    return 0;
  }

  /**
   * Get estimated unique key count
   */
  estimateCardinality(): number {
    if (this.hyperLogLog) {
      return this.hyperLogLog.estimate();
    }
    return this.allKeys.size;
  }

  /**
   * Get hot items (frequently accessed)
   */
  getHotItems(threshold: number = 10): Array<{ key: string; frequency: number }> {
    if (!this.countMinSketch) {
      return [];
    }

    return this.countMinSketch.getHeavyHitters(threshold, Array.from(this.allKeys))
      .map(({ item, count }) => ({ key: item, frequency: count }));
  }

  /**
   * Remove a key (only works with Cuckoo filter)
   */
  remove(key: string): boolean {
    if (this.cuckooFilter) {
      return this.cuckooFilter.remove(key);
    }
    return false;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStatistics {
    return { ...this.stats };
  }

  /**
   * Update internal statistics
   */
  private updateStats(): void {
    this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    this.stats.estimatedCardinality = this.estimateCardinality();
    this.stats.hotItems = this.getHotItems(10).slice(0, 10);
    this.updateMemoryUsage();
  }

  /**
   * Update memory usage statistic
   */
  private updateMemoryUsage(): void {
    let usage = 0;
    if (this.bloomFilter) usage += this.bloomFilter.getMemoryUsage();
    if (this.countMinSketch) usage += this.countMinSketch.getMemoryUsage();
    if (this.hyperLogLog) usage += this.hyperLogLog.getMemoryUsage();
    if (this.cuckooFilter) usage += this.cuckooFilter.getMemoryUsage();
    this.stats.memoryUsage = usage;
  }

  /**
   * Save to disk
   */
  async saveToDisk(): Promise<void> {
    if (!this.config.behavior.persistenceEnabled) return;

    const dir = this.config.behavior.persistencePath;
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (this.bloomFilter) {
      writeFileSync(join(dir, 'bloom.bin'), this.bloomFilter.serialize());
    }

    if (this.countMinSketch) {
      writeFileSync(join(dir, 'cms.bin'), this.countMinSketch.serialize());
    }

    // Save keys for CMS heavy hitter queries
    writeFileSync(join(dir, 'keys.json'), JSON.stringify(Array.from(this.allKeys)));
  }

  /**
   * Load from disk
   */
  private loadFromDisk(): void {
    const dir = this.config.behavior.persistencePath;
    if (!existsSync(dir)) return;

    try {
      const bloomPath = join(dir, 'bloom.bin');
      if (existsSync(bloomPath) && this.config.bloomFilter.enabled) {
        this.bloomFilter = BloomFilterImpl.deserialize(readFileSync(bloomPath));
      }

      const keysPath = join(dir, 'keys.json');
      if (existsSync(keysPath)) {
        const keys = JSON.parse(readFileSync(keysPath, 'utf-8'));
        this.allKeys = new Set(keys);
      }
    } catch (error) {
      console.warn('Failed to load probabilistic cache from disk:', error);
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.config.behavior.persistenceEnabled) {
      await this.saveToDisk();
    }
    
    this.bloomFilter = null;
    this.countMinSketch = null;
    this.hyperLogLog = null;
    this.cuckooFilter = null;
    this.allKeys.clear();
  }
}

/**
 * Create probabilistic cache manager
 */
export function createProbabilisticCache(config: ProbabilisticCacheConfig): ProbabilisticCacheManager {
  return new ProbabilisticCacheManager(config);
}

/**
 * Default probabilistic cache configuration
 */
export function getDefaultProbabilisticConfig(): ProbabilisticCacheConfig {
  return {
    enabled: true,
    bloomFilter: {
      enabled: true,
      expectedElements: 100000,
      falsePositiveRate: 0.01,
      hashFunctions: 0,
      bitArraySize: 0,
    },
    countMinSketch: {
      enabled: true,
      width: 2048,
      depth: 5,
      conservativeUpdate: true,
    },
    hyperLogLog: {
      enabled: true,
      precision: 14,
    },
    cuckooFilter: {
      enabled: true,
      bucketSize: 4,
      fingerprintSize: 16,
      maxKicks: 500,
    },
    behavior: {
      warmupPeriod: 1000,
      adaptiveThreshold: true,
      compressionLevel: 6,
      persistenceEnabled: true,
      persistencePath: '.grump/prob-cache',
    },
  };
}
