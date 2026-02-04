/**
 * Stream Buffer
 * Batches small text chunks into fewer SSE events to reduce overhead.
 */

export class StreamBuffer {
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly maxDelayMs: number;
  private readonly maxBufferSize: number;

  constructor(
    private onFlush: (chunk: string) => void,
    options: { maxDelayMs?: number; maxBufferSize?: number } = {},
  ) {
    this.maxDelayMs = options.maxDelayMs ?? 50;
    this.maxBufferSize = options.maxBufferSize ?? 10;
  }

  push(chunk: string): void {
    if (!chunk) return;
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
}
