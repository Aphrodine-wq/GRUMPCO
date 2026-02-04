/**
 * Holographic Memory Service
 *
 * Implements Holographic Reduced Representations (HRR) for fixed-size associative memory.
 * This allows storing unlimited key-value pairs in a fixed-dimension vector using
 * circular convolution (binding) and correlation (unbinding).
 *
 * Key insight: In frequency domain, circular convolution = element-wise multiply.
 * So we use FFT to make this O(n log n) instead of O(n²).
 *
 * Memory = v1 ⊛ k1 + v2 ⊛ k2 + ... + vN ⊛ kN
 * Retrieve v_i ≈ Memory ⊛ k_i⁻¹ (correlation with inverse)
 *
 * This is the "HoloKV" concept - infinite context in fixed memory.
 */

// Complex number representation (reserved for future use)
interface _Complex {
  re: number;
  im: number;
}

/**
 * Pure TypeScript FFT implementation (Cooley-Tukey radix-2)
 * For production, you'd want to use WASM-accelerated FFT or native bindings.
 */
class FFT {
  private size: number;
  private cosTable: Float64Array;
  private sinTable: Float64Array;

  constructor(size: number) {
    if (size < 1 || (size & (size - 1)) !== 0) {
      throw new Error('FFT size must be a power of 2');
    }
    this.size = size;
    this.cosTable = new Float64Array(size / 2);
    this.sinTable = new Float64Array(size / 2);

    for (let i = 0; i < size / 2; i++) {
      this.cosTable[i] = Math.cos((2 * Math.PI * i) / size);
      this.sinTable[i] = Math.sin((2 * Math.PI * i) / size);
    }
  }

  /**
   * In-place FFT (Cooley-Tukey decimation-in-time)
   */
  forward(real: Float64Array, imag: Float64Array): void {
    const n = this.size;

    // Bit-reversal permutation
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    // Cooley-Tukey iterative FFT
    for (let size = 2; size <= n; size <<= 1) {
      const halfSize = size >> 1;
      const tableStep = n / size;

      for (let i = 0; i < n; i += size) {
        for (let k = 0, tableIdx = 0; k < halfSize; k++, tableIdx += tableStep) {
          const l = i + k;
          const r = l + halfSize;
          const tpre = real[r] * this.cosTable[tableIdx] + imag[r] * this.sinTable[tableIdx];
          const tpim = -real[r] * this.sinTable[tableIdx] + imag[r] * this.cosTable[tableIdx];
          real[r] = real[l] - tpre;
          imag[r] = imag[l] - tpim;
          real[l] += tpre;
          imag[l] += tpim;
        }
      }
    }
  }

  /**
   * Inverse FFT
   */
  inverse(real: Float64Array, imag: Float64Array): void {
    // Conjugate
    for (let i = 0; i < this.size; i++) {
      imag[i] = -imag[i];
    }

    // Forward FFT
    this.forward(real, imag);

    // Conjugate and scale
    const scale = 1 / this.size;
    for (let i = 0; i < this.size; i++) {
      real[i] *= scale;
      imag[i] = -imag[i] * scale;
    }
  }
}

/**
 * Holographic Reduced Representation Vector
 * Fixed-size complex vector that can store unlimited associations
 */
export class HRRVector {
  readonly dimension: number;
  real: Float64Array;
  imag: Float64Array;
  private fft: FFT;

  constructor(dimension: number = 4096) {
    // Ensure power of 2 for FFT
    this.dimension = 1 << Math.ceil(Math.log2(dimension));
    this.real = new Float64Array(this.dimension);
    this.imag = new Float64Array(this.dimension);
    this.fft = new FFT(this.dimension);
  }

  /**
   * Create HRR vector from text using character-level hashing
   * This is a simple approach - production would use learned embeddings
   */
  static fromText(text: string, dimension: number = 4096): HRRVector {
    const vec = new HRRVector(dimension);

    // Use hash-based random projection (deterministic for same text)
    const seed = HRRVector.hashString(text);
    const rng = HRRVector.seededRandom(seed);

    // Generate pseudo-random unit vector
    let magnitude = 0;
    for (let i = 0; i < vec.dimension; i++) {
      // Box-Muller transform for Gaussian distribution
      const u1 = rng();
      const u2 = rng();
      vec.real[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      vec.imag[i] = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
      magnitude += vec.real[i] * vec.real[i] + vec.imag[i] * vec.imag[i];
    }

    // Normalize to unit vector
    magnitude = Math.sqrt(magnitude);
    for (let i = 0; i < vec.dimension; i++) {
      vec.real[i] /= magnitude;
      vec.imag[i] /= magnitude;
    }

    return vec;
  }

  /**
   * Create from raw embedding (e.g., from OpenAI embeddings)
   */
  static fromEmbedding(embedding: number[], dimension: number = 4096): HRRVector {
    const vec = new HRRVector(dimension);

    // Pad or truncate embedding to match dimension
    const len = Math.min(embedding.length, dimension);
    for (let i = 0; i < len; i++) {
      vec.real[i] = embedding[i];
    }

    // If embedding is smaller, use learned random projection
    if (embedding.length < dimension) {
      const seed = embedding.reduce((a, b) => a + b, 0);
      const rng = HRRVector.seededRandom(seed);
      for (let i = embedding.length; i < dimension; i++) {
        vec.real[i] = (rng() - 0.5) * 0.01;
      }
    }

    return vec;
  }

  /**
   * Clone this vector
   */
  clone(): HRRVector {
    const vec = new HRRVector(this.dimension);
    vec.real.set(this.real);
    vec.imag.set(this.imag);
    return vec;
  }

  /**
   * Circular convolution (binding operation) - O(n log n) via FFT
   * This "binds" two vectors together: key ⊛ value
   */
  bind(other: HRRVector): HRRVector {
    if (this.dimension !== other.dimension) {
      throw new Error('Vectors must have same dimension');
    }

    const result = new HRRVector(this.dimension);

    // Copy to result for FFT
    const aReal = new Float64Array(this.real);
    const aImag = new Float64Array(this.imag);
    const bReal = new Float64Array(other.real);
    const bImag = new Float64Array(other.imag);

    // FFT both vectors
    this.fft.forward(aReal, aImag);
    this.fft.forward(bReal, bImag);

    // Element-wise complex multiply in frequency domain
    for (let i = 0; i < this.dimension; i++) {
      result.real[i] = aReal[i] * bReal[i] - aImag[i] * bImag[i];
      result.imag[i] = aReal[i] * bImag[i] + aImag[i] * bReal[i];
    }

    // Inverse FFT to get circular convolution result
    this.fft.inverse(result.real, result.imag);

    return result;
  }

  /**
   * Circular correlation (unbinding operation)
   * Retrieves value when given the key: memory ⊛ key⁻¹
   */
  unbind(key: HRRVector): HRRVector {
    // Correlation is convolution with the conjugate (time-reversed)
    const invKey = key.inverse();
    return this.bind(invKey);
  }

  /**
   * Compute inverse (for unbinding) - time reversal + conjugate
   */
  inverse(): HRRVector {
    const inv = new HRRVector(this.dimension);

    // Element 0 stays the same
    inv.real[0] = this.real[0];
    inv.imag[0] = -this.imag[0];

    // Reverse the rest
    for (let i = 1; i < this.dimension; i++) {
      inv.real[i] = this.real[this.dimension - i];
      inv.imag[i] = -this.imag[this.dimension - i];
    }

    return inv;
  }

  /**
   * Superposition (bundling) - add vectors together
   */
  add(other: HRRVector): HRRVector {
    const result = new HRRVector(this.dimension);
    for (let i = 0; i < this.dimension; i++) {
      result.real[i] = this.real[i] + other.real[i];
      result.imag[i] = this.imag[i] + other.imag[i];
    }
    return result;
  }

  /**
   * Add in-place (more efficient for accumulation)
   */
  addInPlace(other: HRRVector): void {
    for (let i = 0; i < this.dimension; i++) {
      this.real[i] += other.real[i];
      this.imag[i] += other.imag[i];
    }
  }

  /**
   * Scale vector
   */
  scale(factor: number): HRRVector {
    const result = new HRRVector(this.dimension);
    for (let i = 0; i < this.dimension; i++) {
      result.real[i] = this.real[i] * factor;
      result.imag[i] = this.imag[i] * factor;
    }
    return result;
  }

  /**
   * Normalize to unit vector
   */
  normalize(): HRRVector {
    const mag = this.magnitude();
    if (mag === 0) return this.clone();
    return this.scale(1 / mag);
  }

  /**
   * Compute magnitude
   */
  magnitude(): number {
    let sum = 0;
    for (let i = 0; i < this.dimension; i++) {
      sum += this.real[i] * this.real[i] + this.imag[i] * this.imag[i];
    }
    return Math.sqrt(sum);
  }

  /**
   * Cosine similarity with another vector
   */
  similarity(other: HRRVector): number {
    let dot = 0;
    for (let i = 0; i < this.dimension; i++) {
      dot += this.real[i] * other.real[i] + this.imag[i] * other.imag[i];
    }
    const mag1 = this.magnitude();
    const mag2 = other.magnitude();
    if (mag1 === 0 || mag2 === 0) return 0;
    return dot / (mag1 * mag2);
  }

  /**
   * Serialize to JSON-compatible format
   */
  toJSON(): { dimension: number; real: number[]; imag: number[] } {
    return {
      dimension: this.dimension,
      real: Array.from(this.real),
      imag: Array.from(this.imag),
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: { dimension: number; real: number[]; imag: number[] }): HRRVector {
    const vec = new HRRVector(data.dimension);
    vec.real = new Float64Array(data.real);
    vec.imag = new Float64Array(data.imag);
    return vec;
  }

  // Helper: Simple string hash
  private static hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
  }

  // Helper: Seeded PRNG (Mulberry32)
  private static seededRandom(seed: number): () => number {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
}

/**
 * Holographic Memory Store
 * Stores key-value associations in a fixed-size holographic vector
 */
export class HolographicMemory {
  private memory: HRRVector;
  private dimension: number;
  private entryCount: number = 0;
  private decayFactor: number;

  constructor(dimension: number = 4096, decayFactor: number = 0.999) {
    this.dimension = dimension;
    this.memory = new HRRVector(dimension);
    this.decayFactor = decayFactor;
  }

  /**
   * Store a key-value association
   * The value can be retrieved later using the key
   */
  store(key: string | HRRVector, value: string | HRRVector): void {
    const keyVec = typeof key === 'string' ? HRRVector.fromText(key, this.dimension) : key;
    const valueVec = typeof value === 'string' ? HRRVector.fromText(value, this.dimension) : value;

    // Apply decay to existing memory (prevents saturation over time)
    if (this.decayFactor < 1) {
      for (let i = 0; i < this.dimension; i++) {
        this.memory.real[i] *= this.decayFactor;
        this.memory.imag[i] *= this.decayFactor;
      }
    }

    // Bind key and value, then add to memory
    const binding = keyVec.bind(valueVec);
    this.memory.addInPlace(binding);
    this.entryCount++;
  }

  /**
   * Retrieve value associated with key
   * Returns the reconstructed vector (approximate)
   */
  retrieve(key: string | HRRVector): HRRVector {
    const keyVec = typeof key === 'string' ? HRRVector.fromText(key, this.dimension) : key;
    return this.memory.unbind(keyVec);
  }

  /**
   * Retrieve and compute similarity to known value
   * Useful for checking if a key-value pair exists
   */
  retrieveWithSimilarity(
    key: string | HRRVector,
    expectedValue: string | HRRVector
  ): {
    retrieved: HRRVector;
    similarity: number;
  } {
    const valueVec =
      typeof expectedValue === 'string'
        ? HRRVector.fromText(expectedValue, this.dimension)
        : expectedValue;
    const retrieved = this.retrieve(key);
    return {
      retrieved,
      similarity: retrieved.similarity(valueVec),
    };
  }

  /**
   * Query memory with multiple probe keys, return weighted combination
   */
  queryMultiple(keys: (string | HRRVector)[], weights?: number[]): HRRVector {
    const w = weights || keys.map(() => 1 / keys.length);
    const result = new HRRVector(this.dimension);
    for (let i = 0; i < keys.length; i++) {
      const retrieved = this.retrieve(keys[i]);
      const scaled = retrieved.scale(w[i]);
      result.addInPlace(scaled);
    }

    return result;
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    dimension: number;
    entryCount: number;
    memoryMagnitude: number;
    estimatedCapacity: number;
    memoryUsageBytes: number;
  } {
    return {
      dimension: this.dimension,
      entryCount: this.entryCount,
      memoryMagnitude: this.memory.magnitude(),
      // Theoretical capacity before significant interference
      estimatedCapacity: Math.floor(this.dimension / 10),
      // 2 Float64Arrays of dimension length = 16 bytes per complex element
      memoryUsageBytes: this.dimension * 16,
    };
  }

  /**
   * Clear memory
   */
  clear(): void {
    this.memory = new HRRVector(this.dimension);
    this.entryCount = 0;
  }

  /**
   * Serialize memory state
   */
  toJSON(): object {
    return {
      dimension: this.dimension,
      decayFactor: this.decayFactor,
      entryCount: this.entryCount,
      memory: this.memory.toJSON(),
    };
  }

  /**
   * Deserialize memory state
   */
  static fromJSON(data: {
    dimension: number;
    decayFactor: number;
    entryCount: number;
    memory: { dimension: number; real: number[]; imag: number[] };
  }): HolographicMemory {
    const hm = new HolographicMemory(data.dimension, data.decayFactor);
    hm.entryCount = data.entryCount;
    hm.memory = HRRVector.fromJSON(data.memory);
    return hm;
  }
}

/**
 * Holographic KV Cache - Application to LLM context
 *
 * This is the "HoloKV" concept: store unlimited KV pairs in fixed memory.
 * Traditional KV cache: O(seq_len × d_model × layers)
 * HoloKV cache: O(d_holo × layers) - FIXED regardless of sequence length
 */
export class HoloKVCache {
  private layers: Map<number, HolographicMemory> = new Map();
  private dimension: number;
  private numLayers: number;
  private tokenCount: number = 0;

  constructor(numLayers: number = 32, dimension: number = 4096) {
    this.dimension = dimension;
    this.numLayers = numLayers;

    // Initialize memory for each layer
    for (let i = 0; i < numLayers; i++) {
      this.layers.set(i, new HolographicMemory(dimension));
    }
  }

  /**
   * Encode a token's key-value into the holographic cache
   */
  encodeToken(
    layerIdx: number,
    position: number,
    key: number[] | HRRVector,
    value: number[] | HRRVector
  ): void {
    const layer = this.layers.get(layerIdx);
    if (!layer) throw new Error(`Layer ${layerIdx} not found`);

    // Create position-aware key (include positional encoding)
    const positionVec = HRRVector.fromText(`pos_${position}`, this.dimension);
    const keyVec = Array.isArray(key) ? HRRVector.fromEmbedding(key, this.dimension) : key;
    const valueVec = Array.isArray(value) ? HRRVector.fromEmbedding(value, this.dimension) : value;

    // Bind position with key to create unique retrieval key
    const boundKey = positionVec.bind(keyVec);

    // Store in holographic memory
    layer.store(boundKey, valueVec);

    if (layerIdx === 0) this.tokenCount++;
  }

  /**
   * Retrieve approximate KV for attention computation
   */
  retrieveForAttention(
    layerIdx: number,
    queryPositions: number[],
    queries: (number[] | HRRVector)[]
  ): HRRVector[] {
    const layer = this.layers.get(layerIdx);
    if (!layer) throw new Error(`Layer ${layerIdx} not found`);

    const results: HRRVector[] = [];

    for (let i = 0; i < queryPositions.length; i++) {
      const positionVec = HRRVector.fromText(`pos_${queryPositions[i]}`, this.dimension);
      const queryVec = Array.isArray(queries[i])
        ? HRRVector.fromEmbedding(queries[i] as number[], this.dimension)
        : (queries[i] as HRRVector);

      // Bind position with query to create retrieval key
      const boundQuery = positionVec.bind(queryVec);

      // Retrieve from holographic memory
      results.push(layer.retrieve(boundQuery));
    }

    return results;
  }

  /**
   * Get cache statistics - the magic is here!
   * Memory usage is FIXED regardless of sequence length
   */
  getStats(): {
    numLayers: number;
    dimension: number;
    tokenCount: number;
    totalMemoryBytes: number;
    memoryPerLayer: number;
    traditionalKVCacheBytes: number;
    compressionRatio: number;
  } {
    const memoryPerLayer = this.dimension * 16; // Complex float64
    const totalMemory = memoryPerLayer * this.numLayers;

    // Compare to traditional KV cache
    // Traditional: 2 (K+V) × seq_len × d_model × 2 bytes (fp16) × layers
    const traditionalBytes = 2 * this.tokenCount * this.dimension * 2 * this.numLayers;

    return {
      numLayers: this.numLayers,
      dimension: this.dimension,
      tokenCount: this.tokenCount,
      totalMemoryBytes: totalMemory,
      memoryPerLayer,
      traditionalKVCacheBytes: traditionalBytes,
      compressionRatio: traditionalBytes > 0 ? traditionalBytes / totalMemory : 0,
    };
  }

  /**
   * Clear all layers
   */
  clear(): void {
    for (const layer of this.layers.values()) {
      layer.clear();
    }
    this.tokenCount = 0;
  }
}

/**
 * Service singleton for holographic memory operations
 */
export class HolographicMemoryService {
  private static instance: HolographicMemoryService;
  private memories: Map<string, HolographicMemory> = new Map();
  private kvCaches: Map<string, HoloKVCache> = new Map();

  private constructor() {}

  static getInstance(): HolographicMemoryService {
    if (!HolographicMemoryService.instance) {
      HolographicMemoryService.instance = new HolographicMemoryService();
    }
    return HolographicMemoryService.instance;
  }

  /**
   * Create or get a named holographic memory
   */
  getMemory(name: string, dimension: number = 4096): HolographicMemory {
    let memory = this.memories.get(name);
    if (!memory) {
      memory = new HolographicMemory(dimension);
      this.memories.set(name, memory);
    }
    return memory;
  }

  /**
   * Create or get a named HoloKV cache
   */
  getKVCache(name: string, numLayers: number = 32, dimension: number = 4096): HoloKVCache {
    let cache = this.kvCaches.get(name);
    if (!cache) {
      cache = new HoloKVCache(numLayers, dimension);
      this.kvCaches.set(name, cache);
    }
    return cache;
  }

  /**
   * List all active memories and caches
   */
  listAll(): {
    memories: { name: string; stats: ReturnType<HolographicMemory['getStats']> }[];
    kvCaches: { name: string; stats: ReturnType<HoloKVCache['getStats']> }[];
  } {
    return {
      memories: Array.from(this.memories.entries()).map(([name, mem]) => ({
        name,
        stats: mem.getStats(),
      })),
      kvCaches: Array.from(this.kvCaches.entries()).map(([name, cache]) => ({
        name,
        stats: cache.getStats(),
      })),
    };
  }

  /**
   * Delete a memory or cache
   */
  delete(name: string): boolean {
    return this.memories.delete(name) || this.kvCaches.delete(name);
  }
}

export default HolographicMemoryService;
