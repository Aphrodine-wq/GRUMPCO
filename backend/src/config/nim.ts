/**
 * NIM / GPU URL configuration.
 * NVIDIA_NIM_URL: base for local or self-hosted NIM (e.g. http://nim:8000).
 * When set, /v1 is appended if missing. When unset, cloud default is used.
 */

const CLOUD_NIM_BASE = "https://integrate.api.nvidia.com/v1";

export function getNimApiBase(): string {
  const raw = process.env.NVIDIA_NIM_URL?.trim();
  if (!raw) return CLOUD_NIM_BASE;
  const base = raw.replace(/\/$/, "");
  return base.endsWith("/v1") ? base : `${base}/v1`;
}

export function getNimEmbedUrl(): string {
  return `${getNimApiBase()}/embeddings`;
}

export function getNimChatUrl(): string {
  return `${getNimApiBase()}/chat/completions`;
}
