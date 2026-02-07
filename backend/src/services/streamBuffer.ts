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
  /** Tracks whether we have sent the very first token yet */
  private firstChunkSent = false;

  constructor(
    private onFlush: (chunk: string) => void,
    options: { maxDelayMs?: number; maxBufferSize?: number } = {},
  ) {
    this.maxDelayMs = options.maxDelayMs ?? 4;   // SPEED: Reduced from 8ms — flush faster for perceived speed
    this.maxBufferSize = options.maxBufferSize ?? 2; // SPEED: Reduced from 3 — fewer chunks buffered before flush
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

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
      return;
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.maxDelayMs);
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const combined = this.buffer.join("");
    this.buffer = [];

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.onFlush(combined);
  }

  end(): void {
    this.flush();
  }

  /** Reset buffer state (e.g. between requests) */
  reset(): void {
    this.buffer = [];
    this.firstChunkSent = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
