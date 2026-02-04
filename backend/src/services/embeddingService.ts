/**
 * Unified embedding service – single path for all embeddings (RAG, indexer, etc.).
 * Uses NVIDIA NIM accelerator when configured; supports model override (e.g. RAG_EMBED_MODEL).
 */

import logger from "../middleware/logger.js";
import { getNIMAccelerator } from "./nimAccelerator.js";
import { getNimEmbedUrl } from "../config/nim.js";
const DEFAULT_EMBED_MODEL = "nvidia/nv-embed-v1";

export interface EmbedOptions {
  model?: string;
  inputType?: "query" | "passage";
}

/**
 * Get default embed model from env (NIM_EMBED_MODEL or RAG_EMBED_MODEL for RAG override).
 */
function getDefaultModel(): string {
  return (
    process.env.NIM_EMBED_MODEL ||
    process.env.RAG_EMBED_MODEL ||
    DEFAULT_EMBED_MODEL
  );
}

/**
 * Generate embeddings for one or more texts. Uses NIM accelerator when available and no model override;
 * otherwise calls NIM API directly with the requested model (e.g. for RAG_EMBED_MODEL).
 */
export async function embed(
  texts: string[],
  options?: EmbedOptions,
): Promise<number[][]> {
  const model = options?.model ?? getDefaultModel();
  const nim = getNIMAccelerator();

  // Use NIM accelerator when no model override (accelerator uses its configured model)
  if (nim && !options?.model) {
    return nim.generateEmbeddings(texts);
  }

  // Model override or NIM not configured: call NIM API directly when API key is set
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NVIDIA_NIM_API_KEY is not set and no embedding provider available",
    );
  }

  const res = await fetch(getNimEmbedUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model,
      ...(options?.inputType && { input_type: options.inputType }),
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const t = await res.text();
    logger.warn(
      { status: res.status, body: t.slice(0, 500) },
      "NIM embeddings error",
    );
    throw new Error(`NIM embeddings: ${res.status} ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ embedding: number[]; index?: number }>;
  };
  const raw = data.data ?? [];
  const byIndex = raw.length > 0 && typeof raw[0]?.index === "number";
  const embeddings = byIndex
    ? raw
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((d) => d.embedding)
    : raw.map((d) => d.embedding);
  if (embeddings.length !== texts.length) {
    throw new Error("NIM embeddings: length mismatch");
  }
  return embeddings;
}
