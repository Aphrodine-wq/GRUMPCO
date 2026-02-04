/**
 * Ollama API Routes
 * Proxy for Ollama status and model listing (avoids CORS from frontend).
 */

import { Router, type Request, type Response } from "express";

const router = Router();
const OLLAMA_HOST = process.env.OLLAMA_HOST || "localhost:11434";

/**
 * GET /ollama/status
 * Returns Ollama detection status and available models.
 * Proxies to local Ollama API to avoid CORS.
 */
router.get("/status", async (_req: Request, res: Response): Promise<void> => {
  try {
    const baseUrl = OLLAMA_HOST.startsWith("http")
      ? OLLAMA_HOST
      : `http://${OLLAMA_HOST}`;
    const tagsRes = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!tagsRes.ok) {
      res.json({
        detected: false,
        host: OLLAMA_HOST,
        models: [],
        error: `Ollama returned ${tagsRes.status}`,
      });
      return;
    }
    const data = (await tagsRes.json()) as { models?: Array<{ name: string }> };
    const models = (data.models ?? []).map((m) => m.name);
    res.json({
      detected: true,
      host: OLLAMA_HOST,
      models,
    });
  } catch (err) {
    res.json({
      detected: false,
      host: OLLAMA_HOST,
      models: [],
      error: (err as Error).message,
    });
  }
});

export default router;
