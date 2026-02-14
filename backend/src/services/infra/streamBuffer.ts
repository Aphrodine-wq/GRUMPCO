/**
 * Stream Buffer
 * Batches small text chunks into fewer SSE events to reduce overhead.
 *
 * Key optimisation: the *first* chunk is always flushed immediately
 * so the user sees text appear with zero added latency (time-to-first-token).
 * Subsequent chunks are batched normally.
 */

export class StreamBuffer {
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly maxDelayMs: number;
  private readonly maxBufferSize: number;
  /** Max total chars to hold before forcing flush (avoids holding huge chunks). */
  private readonly maxBufferChars: number;
  /** Running char count — avoids O(n) reduce on every push */
  private bufferChars = 0;
  /** Tracks whether we have sent the very first token yet */
  private firstChunkSent = false;

  constructor(
    private onFlush: (chunk: string) => void,
    options: { maxDelayMs?: number; maxBufferSize?: number; maxBufferChars?: number } = {}
  ) {
    this.maxDelayMs = options.maxDelayMs ?? 4; // SPEED: Reduced from 8ms — flush faster for perceived speed
    this.maxBufferSize = options.maxBufferSize ?? 2; // SPEED: Reduced from 3 — fewer chunks buffered before flush
    this.maxBufferChars = options.maxBufferChars ?? 4096; // Cap total buffered chars
  }

  push(chunk: string): void {
    if (!chunk) return;

    // Flush first token immediately — no buffering delay for TTFT
    if (!this.firstChunkSent) {
      this.firstChunkSent = true;
      this.onFlush(chunk);
      return;
    }

    this.buffer.push(chunk);
    this.bufferChars += chunk.length;

    if (this.buffer.length >= this.maxBufferSize || this.bufferChars >= this.maxBufferChars) {
      this.flush();
      return;
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.maxDelayMs);
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const combined = this.buffer.join('');
    this.buffer = [];
    this.bufferChars = 0;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      this.onFlush(combined);
    } catch {
      // onFlush may throw if the underlying stream is destroyed (e.g. client
      // disconnect). Swallow here to prevent uncaught exceptions from
      // setTimeout-triggered flushes that run outside async error boundaries.
    }
  }

  end(): void {
    this.flush();
  }

  /** Reset buffer state (e.g. between requests) */
  reset(): void {
    this.buffer = [];
    this.bufferChars = 0;
    this.firstChunkSent = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
