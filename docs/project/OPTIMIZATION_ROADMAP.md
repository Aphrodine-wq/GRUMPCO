# 🚀 G-Rump 10/10 Project Optimization Roadmap

## Executive Summary

Current System Rating: **900/1000** (Enterprise Grade)
Target Rating: **1000/1000** (World Class)

This roadmap delivers **sub-100ms P50** and **sub-500ms P95** latency with a consumer experience that rivals the best AI applications.

---

## 📊 Current Architecture Strengths

✅ **Sophisticated 3-tier caching** (L1/L2/L3 with cross-instance invalidation)  
✅ **Cost-aware model routing** (5x savings on simple tasks)  
✅ **Comprehensive observability** (Prometheus, OpenTelemetry, NIM-aligned metrics)  
✅ **NVIDIA Golden Developer** (NGC deployment, NeMo Curator, NeMo training, Nemotron/NIM)
✅ **Lazy loading & code splitting** for fast startup  
✅ **11+ AI provider failover options**  

---

## ⚡ PHASE 1: Critical Latency Fixes (Week 1-2)

### 1.1 Fix Timeout Mismatches (CRITICAL)

**Problem:** LLM gateway uses 120s timeout but chat route allows 600s. Users wait in limbo.

**Solution:** Adaptive timeouts per provider

```typescript
// backend/src/services/llmGateway.ts - Add provider-specific timeouts
const PROVIDER_TIMEOUTS: Record<LLMProvider, number> = {
  groq: 30_000,      // Fast inference
  nim: 60_000,       // Kimi K2.5 - reliable
  anthropic: 120_000, // Claude can be slow
  gemini: 90_000,
  openrouter: 120_000,
  // ... etc
};

// Use dynamic timeout based on provider
signal: AbortSignal.timeout(PROVIDER_TIMEOUTS[provider] || 120_000)
```

### 1.2 Increase L1 Cache Size (HIGH IMPACT)

**Problem:** 500 entries causes cache thrashing under load.

**Solution:** Scale L1 cache based on available memory

```typescript
// backend/src/services/tieredCache.ts - Line 112
// Calculate optimal L1 size based on available memory
function calculateOptimalL1Size(): number {
  const totalMemoryMB = require('os').totalmem() / 1024 / 1024;
  // Use 2% of available memory, min 1000, max 50000
  const calculated = Math.floor(totalMemoryMB * 0.02);
  return Math.max(1000, Math.min(50000, calculated));
}

this.l1Cache = new LRUCache<string, Buffer>({
  max: options.l1MaxSize || calculateOptimalL1Size(),
  ttl: options.l1TTL || 5 * 60 * 1000,
  updateAgeOnGet: true,
  updateAgeOnHas: true,
  dispose: (value, key) => {
    if (this.costAwareEviction) {
      this.entryMetadata.delete(key);
    }
  },
});
```

**Environment Variables:**
```bash
# .env
TIERED_CACHE_L1_MAX=10000          # Override auto-calculation
TIERED_CACHE_L1_TTL_MS=300000      # 5 minutes
CACHE_WARMUP_ON_START=true         # Pre-warm common entries
```

### 1.3 Implement Request Deduplication (HIGH IMPACT)

**Problem:** Identical concurrent requests hit LLM multiple times.

**Solution:** Dedupe in-flight requests

```typescript
// backend/src/services/requestDeduper.ts
import { getTieredCache } from './tieredCache.js';

interface InFlightRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  key: string;
}

class RequestDeduper {
  private inFlight = new Map<string, InFlightRequest<unknown>>();
  private readonly maxAgeMs = 30000; // 30s max dedupe window

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    
    if (existing && Date.now() - existing.timestamp < this.maxAgeMs) {
      return existing.promise as Promise<T>;
    }

    const promise = fn().finally(() => {
      setTimeout(() => this.inFlight.delete(key), 100); // Small cleanup delay
    });

    this.inFlight.set(key, { promise, timestamp: Date.now(), key });
    return promise;
  }

  getStats() {
    return {
      activeRequests: this.inFlight.size,
      keys: Array.from(this.inFlight.keys()),
    };
  }
}

export const requestDeduper = new RequestDeduper();

// Usage in chat route:
const cacheKey = `chat:${sessionId}:${hashRequest(messages)}`;
const response = await requestDeduper.dedupe(cacheKey, () => {
  return streamFromLLM(params);
});
```

### 1.4 Add Streaming Buffer Batching (MEDIUM)

**Problem:** Every token sent as separate SSE event creates network overhead.

**Solution:** Batch small chunks (50-100ms window)

```typescript
// backend/src/services/streamBuffer.ts
export class StreamBuffer {
  private buffer: string[] = [];
  private lastFlush = Date.now();
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly maxDelayMs: number;
  private readonly maxBufferSize: number;

  constructor(
    private onFlush: (chunks: string[]) => void,
    options: { maxDelayMs?: number; maxBufferSize?: number } = {}
  ) {
    this.maxDelayMs = options.maxDelayMs || 50;
    this.maxBufferSize = options.maxBufferSize || 10;
  }

  push(chunk: string): void {
    this.buffer.push(chunk);
    
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    } else if (!this.flushInterval) {
      this.flushInterval = setTimeout(() => this.flush(), this.maxDelayMs);
    }
  }

  private flush(): void {
    if (this.buffer.length === 0) return;
    
    const chunks = [...this.buffer];
    this.buffer = [];
    this.lastFlush = Date.now();
    
    if (this.flushInterval) {
      clearTimeout(this.flushInterval);
      this.flushInterval = null;
    }
    
    this.onFlush(chunks);
  }

  end(): void {
    this.flush();
  }
}

// Usage in chat streaming:
const buffer = new StreamBuffer(
  (chunks) => {
    res.write(`data: ${JSON.stringify({ type: 'batch', content: chunks.join('') })}\n\n`);
  },
  { maxDelayMs: 50, maxBufferSize: 5 }
);

// In stream loop:
for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    buffer.push(event.delta.text);
  }
}
buffer.end();
```

---

## 🎯 PHASE 2: Consumer Experience Excellence (Week 2-4)

### 2.1 Real-Time Latency Dashboard

**Problem:** Users don't know why responses are slow or which provider is being used.

**Solution:** Add connection quality indicator with provider info

```svelte
<!-- frontend/src/components/ConnectionStatus.svelte -->
<script>
  import { connectionStore } from '../stores/connectionStore.js';
  import { onMount } from 'svelte';
  
  let latency = $state(0);
  let provider = $state('');
  let model = $state('');
  let quality = $state('good'); // good | fair | poor
  
  onMount(() => {
    const unsubscribe = connectionStore.subscribe(state => {
      latency = state.latency;
      provider = state.provider;
      model = state.model;
      quality = latency < 100 ? 'good' : latency < 300 ? 'fair' : 'poor';
    });
    
    // Ping server every 5s
    const interval = setInterval(() => {
      const start = performance.now();
      fetch('/api/health')
        .then(() => {
          connectionStore.updateLatency(performance.now() - start);
        })
        .catch(() => {
          connectionStore.updateLatency(9999);
        });
    }, 5000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  });
</script>

<div class="connection-status {quality}" title="Provider: {provider} | Model: {model}">
  <span class="indicator"></span>
  <span class="latency">{latency}ms</span>
  <span class="provider">{provider}</span>
</div>

<style>
  .connection-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.3s ease;
  }
  
  .good { background: rgba(34, 197, 94, 0.1); color: #16a34a; }
  .fair { background: rgba(234, 179, 8, 0.1); color: #ca8a04; }
  .poor { background: rgba(239, 68, 68, 0.1); color: #dc2626; }
  
  .indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
```

### 2.2 Predictive Preloading & Cache Warming

**Problem:** First request after startup is always slow.

**Solution:** Pre-warm cache on startup and predict user needs

```typescript
// backend/src/services/cacheWarmer.ts
import { getTieredCache } from './tieredCache.js';
import logger from '../middleware/logger.js';

interface WarmupEntry {
  namespace: string;
  key: string;
  value: unknown;
  ttl?: number;
}

export class CacheWarmer {
  private readonly commonEntries: WarmupEntry[] = [
    // Model registry info
    { namespace: 'models', key: 'registry', value: '...', ttl: 3600 },
    // Common system prompts
    { namespace: 'prompts', key: 'default-system', value: '...', ttl: 86400 },
    // Popular code snippets
    { namespace: 'snippets', key: 'react-component', value: '...', ttl: 3600 },
  ];

  async warmup(): Promise<void> {
    if (process.env.CACHE_WARMUP_ON_START !== 'true') {
      logger.info('Cache warmup disabled');
      return;
    }

    const cache = getTieredCache();
    const start = Date.now();
    
    await Promise.all(
      this.commonEntries.map(entry => 
        cache.set(entry.namespace, entry.key, entry.value, entry.ttl)
          .catch(err => logger.warn({ err }, 'Failed to warm cache entry'))
      )
    );
    
    logger.info({ duration: Date.now() - start, count: this.commonEntries.length }, 'Cache warmed');
  }

  // Predict and pre-warm based on user patterns
  async predictAndWarm(userId: string, recentContexts: string[]): Promise<void> {
    const cache = getTieredCache();
    
    // Analyze recent contexts for patterns
    const patterns = this.analyzePatterns(recentContexts);
    
    for (const pattern of patterns) {
      if (pattern.confidence > 0.7) {
        // Pre-fetch likely needed data
        await this.preFetchPattern(pattern, cache);
      }
    }
  }

  private analyzePatterns(contexts: string[]): Array<{type: string; confidence: number}> {
    // Simple pattern detection - can be enhanced with ML
    const hasReact = contexts.some(c => c.includes('React') || c.includes('useState'));
    const hasAPI = contexts.some(c => c.includes('API') || c.includes('fetch'));
    
    return [
      { type: 'react', confidence: hasReact ? 0.9 : 0.1 },
      { type: 'api', confidence: hasAPI ? 0.8 : 0.2 },
    ];
  }

  private async preFetchPattern(pattern: {type: string}, cache: any): Promise<void> {
    // Pre-fetch relevant templates/documentation
    logger.debug({ pattern }, 'Pre-fetching pattern data');
  }
}

export const cacheWarmer = new CacheWarmer();
```

### 2.3 Smart Retry with Fallback

**Problem:** Single provider failures cause complete request failure.

**Solution:** Automatic failover with fallback chain

```typescript
// backend/src/services/smartRetry.ts
import type { LLMProvider, StreamParams, StreamEvent } from './llmGateway.js';
import logger from '../middleware/logger.js';

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  fallbackChain: LLMProvider[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  fallbackChain: ['groq', 'nim', 'openrouter', 'anthropic'],
};

export async function* streamWithRetry(
  primaryProvider: LLMProvider,
  params: StreamParams,
  config: Partial<RetryConfig> = {}
): AsyncGenerator<StreamEvent> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const providers = [primaryProvider, ...fullConfig.fallbackChain.filter(p => p !== primaryProvider)];
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < fullConfig.maxAttempts; attempt++) {
    const provider = providers[attempt % providers.length];
    
    try {
      logger.info({ attempt: attempt + 1, provider }, 'Streaming attempt');
      
      const stream = await createStream(provider, params);
      let hasYielded = false;
      
      for await (const event of stream) {
        hasYielded = true;
        yield { ...event, meta: { provider, attempt: attempt + 1 } };
      }
      
      if (hasYielded) {
        return; // Success!
      }
      
      throw new Error('Stream completed without yielding any events');
      
    } catch (error) {
      lastError = error as Error;
      logger.warn({ attempt: attempt + 1, provider, error: lastError.message }, 'Stream failed');
      
      if (attempt < fullConfig.maxAttempts - 1) {
        const delay = Math.min(
          fullConfig.baseDelay * Math.pow(2, attempt),
          fullConfig.maxDelay
        );
        logger.info({ delay, nextProvider: providers[(attempt + 1) % providers.length] }, 'Retrying');
        await sleep(delay);
      }
    }
  }
  
  // All attempts failed
  yield { 
    type: 'error', 
    error: `All ${fullConfig.maxAttempts} attempts failed. Last error: ${lastError?.message}` 
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createStream(provider: LLMProvider, params: StreamParams) {
  // Import and use existing stream provider
  const { getStreamProvider } = await import('@grump/ai-core');
  return getStreamProvider(provider, params);
}
```

### 2.4 Progressive Web App (PWA) Features

**Problem:** No offline capability, slow initial loads.

**Solution:** Implement PWA with service worker

```javascript
// frontend/public/service-worker.js
const CACHE_NAME = 'grump-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Cache-first strategy for assets, network-first for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (url.pathname.startsWith('/api/')) {
    // Network-first for API with offline fallback
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses
          if (response.ok && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Return cached version if offline
          return caches.match(request);
        })
    );
  } else {
    // Cache-first for static assets
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request).then(fetchResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
});
```

### 2.5 Intelligent Input Prediction

**Problem:** Users wait for entire code generation even for simple completions.

**Solution:** Predictive suggestions as user types

```typescript
// backend/src/services/inputPredictor.ts
import { getTieredCache } from './tieredCache.js';

interface Prediction {
  text: string;
  confidence: number;
  type: 'completion' | 'suggestion' | 'correction';
}

export class InputPredictor {
  private cache = getTieredCache();
  private readonly minConfidence = 0.7;
  
  async predict(input: string, context: string[]): Promise<Prediction[]> {
    // Check cache first
    const cacheKey = `pred:${this.hashInput(input)}`;
    const cached = await this.cache.get<Prediction[]>(predictions, cacheKey);
    if (cached) return cached;
    
    // Simple pattern-based prediction (can be enhanced with ML)
    const predictions = this.generatePredictions(input, context);
    
    // Cache high-confidence predictions
    if (predictions.length > 0) {
      await this.cache.set('predictions', cacheKey, predictions, 60); // 1 min TTL
    }
    
    return predictions;
  }
  
  private generatePredictions(input: string, context: string[]): Prediction[] {
    const predictions: Prediction[] = [];
    
    // Common code patterns
    if (input.includes('function') && !input.includes('(')) {
      predictions.push({
        text: '() {\n  \n}',
        confidence: 0.9,
        type: 'completion'
      });
    }
    
    if (input.includes('import') && !input.includes('from')) {
      predictions.push({
        text: " from '';",
        confidence: 0.85,
        type: 'completion'
      });
    }
    
    if (input.includes('useState') && !input.includes('(')) {
      predictions.push({
        text: "('')",
        confidence: 0.8,
        type: 'completion'
      });
    }
    
    return predictions.filter(p => p.confidence >= this.minConfidence);
  }
  
  private hashInput(input: string): string {
    // Simple hash for cache key
    return input.slice(-50).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  }
}

export const inputPredictor = new InputPredictor();
```

---

## 🔧 PHASE 3: Advanced Optimizations (Week 4-6)

### 3.1 Context Compression Optimization

**Problem:** 100K+ token contexts take 500ms+ to compress, blocking event loop.

**Solution:** Offload to worker thread with streaming compression

```typescript
// backend/src/services/contextCompressor.ts - Enhanced
import { Worker } from 'worker_threads';
import { getTieredCache } from './tieredCache.js';
import logger from '../middleware/logger.js';

export class AsyncContextCompressor {
  private worker: Worker | null = null;
  private cache = getTieredCache();
  
  constructor() {
    this.initWorker();
  }
  
  private initWorker(): void {
    try {
      this.worker = new Worker('./workers/compressionWorker.js');
      
      this.worker.on('error', (error) => {
        logger.error({ error }, 'Compression worker error');
        this.initWorker(); // Restart worker
      });
    } catch (error) {
      logger.warn({ error }, 'Worker threads not available, using main thread');
    }
  }
  
  async compress(context: string): Promise<string> {
    // Check cache first
    const cacheKey = `ctx:${this.hashContext(context)}`;
    const cached = await this.cache.get<string>('context', cacheKey);
    if (cached) return cached;
    
    if (!this.worker) {
      // Fallback to main thread
      return this.compressMainThread(context);
    }
    
    return new Promise((resolve, reject) => {
      const start = Date.now();
      
      const timeout = setTimeout(() => {
        reject(new Error('Compression timeout'));
      }, 5000);
      
      this.worker!.once('message', async (result) => {
        clearTimeout(timeout);
        
        if (result.error) {
          reject(new Error(result.error));
          return;
        }
        
        // Cache result
        await this.cache.set('context', cacheKey, result.compressed, 300); // 5 min
        
        logger.debug({ duration: Date.now() - start }, 'Context compressed');
        resolve(result.compressed);
      });
      
      this.worker!.postMessage({ context });
    });
  }
  
  private compressMainThread(context: string): string {
    // Existing compression logic
    return context; // Simplified
  }
  
  private hashContext(context: string): string {
    return require('crypto').createHash('md5').update(context.slice(0, 1000)).digest('hex');
  }
}

// workers/compressionWorker.js
const { parentPort } = require('worker_threads');

parentPort.on('message', async ({ context }) => {
  try {
    // Perform compression in worker thread
    const compressed = await compressContext(context);
    parentPort.postMessage({ compressed });
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
});

async function compressContext(context: string): Promise<string> {
  // Compression logic here
  // This runs in parallel, not blocking main thread
  return context.slice(0, 10000); // Simplified
}
```

### 3.2 Database Query Optimization

**Problem:** No limit on prepared statement cache, potential memory leak.

**Solution:** Add LRU cache with size limit

```typescript
// backend/src/services/database.ts - Enhanced statement cache
import { LRUCache } from 'lru-cache';

class StatementCache {
  private cache: LRUCache<string, Database.Statement>;
  private readonly maxSize: number;
  
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new LRUCache({
      max: maxSize,
      dispose: (stmt) => {
        try {
          stmt.finalize();
        } catch (error) {
          // Ignore
        }
      }
    });
  }
  
  get(sql: string): Database.Statement | undefined {
    return this.cache.get(sql);
  }
  
  set(sql: string, stmt: Database.Statement): void {
    if (this.cache.size >= this.maxSize) {
      // LRU will handle eviction
      logger.debug('Statement cache evicting oldest entry');
    }
    this.cache.set(sql, stmt);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: this.cache.size / this.maxSize,
    };
  }
}

// Replace existing Map with LRU cache
// private statementCache = new Map<string, Database.Statement>();
private statementCache = new StatementCache(100);
```

### 3.3 Redis Connection Resilience

**Problem:** Cold start latency when Redis unavailable.

**Solution:** Async connection with circuit breaker pattern

```typescript
// backend/src/services/redisResilient.ts
import { createRedisClient, isRedisConnected } from './redis.js';
import logger from '../middleware/logger.js';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

class ResilientRedis {
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    open: false,
  };
  
  private readonly threshold = 5; // Open after 5 failures
  private readonly timeout = 30000; // Reset after 30s
  private readonly fallbackTtl = 60; // 1 min in-memory fallback
  
  private localFallback = new Map<string, { value: string; expires: number }>();
  
  async get(key: string): Promise<string | null> {
    // Check circuit breaker
    if (this.circuitBreaker.open) {
      if (Date.now() - this.circuitBreaker.lastFailure > this.timeout) {
        this.circuitBreaker.open = false;
        this.circuitBreaker.failures = 0;
        logger.info('Circuit breaker reset, retrying Redis');
      } else {
        return this.getFromFallback(key);
      }
    }
    
    try {
      if (!await isRedisConnected()) {
        throw new Error('Redis not connected');
      }
      
      const redis = createRedisClient();
      const value = await redis.get(key);
      
      // Success - reset circuit breaker
      this.circuitBreaker.failures = 0;
      
      // Store in fallback for resilience
      if (value) {
        this.setFallback(key, value);
      }
      
      return value;
      
    } catch (error) {
      this.recordFailure();
      return this.getFromFallback(key);
    }
  }
  
  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    if (this.circuitBreaker.failures >= this.threshold) {
      this.circuitBreaker.open = true;
      logger.warn('Circuit breaker opened for Redis');
    }
  }
  
  private getFromFallback(key: string): string | null {
    const entry = this.localFallback.get(key);
    if (entry && Date.now() < entry.expires) {
      return entry.value;
    }
    this.localFallback.delete(key);
    return null;
  }
  
  private setFallback(key: string, value: string): void {
    this.localFallback.set(key, {
      value,
      expires: Date.now() + (this.fallbackTtl * 1000),
    });
  }
}
```

### 3.4 Frontend Performance Monitoring

**Problem:** No visibility into frontend performance metrics.

**Solution:** Real user monitoring (RUM)

```typescript
// frontend/src/services/performanceMonitor.ts
export class FrontendPerformanceMonitor {
  private metrics: PerformanceEntry[] = [];
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.initObserver();
      this.measureWebVitals();
    }
  }
  
  private initObserver(): void {
    // Observe performance entries
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.metrics.push(entry);
        this.reportToBackend(entry);
      }
    });
    
    observer.observe({ entryTypes: ['measure', 'navigation', 'resource', 'longtask'] });
  }
  
  private measureWebVitals(): void {
    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.reportMetric('LCP', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });
    
    // First Input Delay
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const delay = (entry as PerformanceEventTiming).processingStart - entry.startTime;
        this.reportMetric('FID', delay);
      }
    }).observe({ entryTypes: ['first-input'] });
    
    // Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.reportMetric('CLS', clsValue);
    }).observe({ entryTypes: ['layout-shift'] });
  }
  
  private reportMetric(name: string, value: number): void {
    // Send to backend for aggregation
    fetch('/api/metrics/frontend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value, timestamp: Date.now() }),
    }).catch(() => {}); // Silent fail
  }
  
  private reportToBackend(entry: PerformanceEntry): void {
    // Batch and send periodically
  }
}

// Initialize in App.svelte
export const performanceMonitor = new FrontendPerformanceMonitor();
```

---

## 📈 PHASE 4: Analytics & Intelligence (Week 6-8)

### 4.1 Usage-Based Rate Limiting Dashboard

**Problem:** Users hit rate limits unexpectedly.

**Solution:** Real-time usage dashboard with upgrade prompts

```svelte
<!-- frontend/src/components/UsageDashboard.svelte -->
<script>
  import { usageStore } from '../stores/usageStore.js';
  
  let usage = $state({
    requestsToday: 0,
    requestsLimit: 100,
    tokensToday: 0,
    tokensLimit: 100000,
    costToday: 0,
    resetTime: null,
  });
  
  $effect(() => {
    const unsubscribe = usageStore.subscribe(state => {
      usage = state;
    });
    return unsubscribe;
  });
  
  const requestPercent = $derived((usage.requestsToday / usage.requestsLimit) * 100);
  const tokenPercent = $derived((usage.tokensToday / usage.tokensLimit) * 100);
</script>

<div class="usage-dashboard">
  <h3>Today's Usage</h3>
  
  <div class="metric">
    <label>Requests</label>
    <div class="progress-bar">
      <div class="fill" style="width: {Math.min(requestPercent, 100)}%" class:warning={requestPercent > 80}></div>
    </div>
    <span>{usage.requestsToday} / {usage.requestsLimit}</span>
  </div>
  
  <div class="metric">
    <label>Tokens</label>
    <div class="progress-bar">
      <div class="fill" style="width: {Math.min(tokenPercent, 100)}%" class:warning={tokenPercent > 80}></div>
    </div>
    <span>{usage.tokensToday.toLocaleString()} / {usage.tokensLimit.toLocaleString()}</span>
  </div>
  
  {#if requestPercent > 80 || tokenPercent > 80}
    <div class="upgrade-prompt">
      <p>Approaching limit! <a href="/upgrade">Upgrade now</a> for more.</p>
    </div>
  {/if}
  
  {#if usage.resetTime}
    <p class="reset-time">Resets in {formatTimeUntil(usage.resetTime)}</p>
  {/if}
</div>

<style>
  .usage-dashboard {
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }
  
  .metric {
    margin: 12px 0;
  }
  
  .progress-bar {
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
    margin: 4px 0;
  }
  
  .fill {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.3s ease;
  }
  
  .fill.warning {
    background: var(--color-warning);
  }
  
  .upgrade-prompt {
    margin-top: 16px;
    padding: 12px;
    background: rgba(234, 179, 8, 0.1);
    border-radius: 6px;
    text-align: center;
  }
</style>
```

### 4.2 A/B Testing Framework

**Problem:** No data-driven UX improvements.

**Solution:** Built-in A/B testing

```typescript
// packages/shared-types/src/abTesting.ts
export interface Experiment {
  id: string;
  name: string;
  variants: string[];
  weights: number[];
}

export class ABTestingService {
  private experiments: Map<string, Experiment> = new Map();
  private assignments: Map<string, string> = new Map();
  
  registerExperiment(experiment: Experiment): void {
    this.experiments.set(experiment.id, experiment);
  }
  
  getVariant(userId: string, experimentId: string): string {
    const key = `${userId}:${experimentId}`;
    
    if (this.assignments.has(key)) {
      return this.assignments.get(key)!;
    }
    
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return 'control';
    
    // Deterministic assignment based on user ID hash
    const hash = this.hashUserId(userId);
    const variant = this.selectVariant(hash, experiment);
    
    this.assignments.set(key, variant);
    return variant;
  }
  
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  private selectVariant(hash: number, experiment: Experiment): string {
    const totalWeight = experiment.weights.reduce((a, b) => a + b, 0);
    const normalized = (hash % totalWeight) / totalWeight;
    
    let cumulative = 0;
    for (let i = 0; i < experiment.variants.length; i++) {
      cumulative += experiment.weights[i] / totalWeight;
      if (normalized <= cumulative) {
        return experiment.variants[i];
      }
    }
    
    return experiment.variants[0];
  }
}
```

---

## 🎨 PHASE 5: UI/UX Polish (Ongoing)

### 5.1 Skeleton Loading States

Replace generic spinners with content-aware skeletons:

```svelte
<!-- frontend/src/components/ChatMessageSkeleton.svelte -->
<div class="skeleton-message">
  <div class="skeleton-avatar"></div>
  <div class="skeleton-content">
    <div class="skeleton-line" style="width: 80%"></div>
    <div class="skeleton-line" style="width: 60%"></div>
    <div class="skeleton-line" style="width: 40%"></div>
  </div>
</div>

<style>
  .skeleton-message {
    display: flex;
    gap: 12px;
    padding: 16px;
    animation: pulse 2s infinite;
  }
  
  .skeleton-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--skeleton-bg);
  }
  
  .skeleton-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .skeleton-line {
    height: 12px;
    background: var(--skeleton-bg);
    border-radius: 4px;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
```

### 5.2 Keyboard Shortcuts

```typescript
// frontend/src/services/keyboardShortcuts.ts
export class KeyboardShortcuts {
  private shortcuts: Map<string, () => void> = new Map();
  
  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeydown.bind(this));
    }
  }
  
  register(shortcut: string, handler: () => void): void {
    this.shortcuts.set(shortcut.toLowerCase(), handler);
  }
  
  private handleKeydown(event: KeyboardEvent): void {
    const key = this.normalizeKey(event);
    const handler = this.shortcuts.get(key);
    
    if (handler) {
      event.preventDefault();
      handler();
    }
  }
  
  private normalizeKey(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.metaKey) parts.push('cmd');
    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }
}

// Usage
export const shortcuts = new KeyboardShortcuts();
shortcuts.register('cmd+k', () => openCommandPalette());
shortcuts.register('cmd+/', () => openShortcutsHelp());
shortcuts.register('cmd+n', () => createNewChat());
shortcuts.register('esc', () => closeModal());
```

---

## 📋 Implementation Checklist

### Week 1-2: Critical Fixes
- [ ] Implement adaptive provider timeouts
- [ ] Increase L1 cache size (auto-calculate based on memory)
- [ ] Add request deduplication service
- [ ] Implement streaming buffer batching
- [ ] Add connection quality indicator to frontend
- [ ] Fix statement cache memory leak (add LRU limit)

### Week 3-4: Consumer Experience
- [ ] Implement smart retry with fallback
- [ ] Add cache warming on startup
- [ ] Create PWA with service worker
- [ ] Add input prediction feature
- [ ] Implement real-time latency dashboard
- [ ] Add usage dashboard with upgrade prompts

### Week 5-6: Advanced Optimizations
- [ ] Offload context compression to worker threads
- [ ] Implement Redis circuit breaker
- [ ] Add frontend performance monitoring (RUM)
- [ ] Optimize lazy route loading (preload on hover)
- [ ] Add request prioritization queue

### Week 7-8: Intelligence & Analytics
- [ ] Implement A/B testing framework
- [ ] Add detailed analytics dashboard
- [ ] Create automated performance regression tests
- [ ] Implement predictive preloading based on user patterns
- [ ] Add semantic response caching

---

## 🎯 Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| P50 Latency | ~500ms | <100ms | Prometheus histogram |
| P95 Latency | ~2s | <500ms | Prometheus histogram |
| P99 Latency | ~5s | <2s | Prometheus histogram |
| Cache Hit Rate | ~70% | >90% | tiered_cache_hits_total |
| First Contentful Paint | ~2s | <1s | Web Vitals |
| Time to Interactive | ~4s | <2s | Web Vitals |
| Error Rate | ~2% | <0.1% | http_requests_total (5xx) |
| User Satisfaction | N/A | >4.5/5 | In-app surveys |

---

## 🚀 Quick Wins (Do These Today!)

1. **Add to `.env`:**
   ```bash
   TIERED_CACHE_L1_MAX=10000
   CACHE_WARMUP_ON_START=true
   ```

2. **Update timeout configuration:**
   ```typescript
   // In llmGateway.ts, add provider-specific timeouts
   const PROVIDER_TIMEOUTS = { groq: 30_000, nim: 60_000, anthropic: 120_000 };
   ```

3. **Implement request deduplication:** (see code above)

4. **Add latency indicator component:** (see ConnectionStatus.svelte)

5. **Fix statement cache:** Add LRU limit of 100 entries

---

## 📞 Next Steps

1. Review this roadmap with your team
2. Prioritize based on your specific pain points
3. Start with Week 1-2 critical fixes
4. Measure baseline metrics before changes
5. Deploy incrementally with feature flags
6. Monitor metrics dashboard after each change

**Questions or need help implementing?** Check the code examples above or ask for specific implementation guidance!

---

*Generated for G-Rump Project - Target: 1000/1000 System Rating*