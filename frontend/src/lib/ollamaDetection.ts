/**
 * Ollama detection - checks if local Ollama is running and lists available models.
 * Uses backend proxy to avoid CORS when calling Ollama from the renderer.
 */

export interface OllamaStatus {
  detected: boolean;
  host: string;
  models?: string[];
  error?: string;
}

/**
 * Detect Ollama status via backend proxy.
 * Returns detected status, host, and available models.
 */
export async function detectOllama(apiBase?: string): Promise<OllamaStatus> {
  const base =
    apiBase ??
    (typeof window !== 'undefined' && (window as { __API_BASE__?: string }).__API_BASE__) ??
    '/api';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${base}/ollama/status`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = (await res.json()) as OllamaStatus;
    return data;
  } catch (err) {
    return {
      detected: false,
      host: 'localhost:11434',
      models: [],
      error: (err as Error).message,
    };
  }
}
