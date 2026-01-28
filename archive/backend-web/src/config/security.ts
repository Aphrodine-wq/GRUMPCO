/**
 * Security and API key configuration.
 * Keys are read from env; production should use a vault (AWS Secrets Manager / Vault).
 */
export const SECURITY = {
  /** Comma-separated Anthropic API keys for pooling. Falls back to ANTHROPIC_API_KEY. */
  getAnthropicKeys(): string[] {
    const fromPool = process.env.ANTHROPIC_API_KEYS
    if (fromPool && fromPool.trim()) {
      return fromPool.split(',').map((k) => k.trim()).filter(Boolean)
    }
    const single = process.env.ANTHROPIC_API_KEY
    if (single && single.trim()) return [single.trim()]
    return []
  },
  /** Master key for local encryption (Option C). Not used when using vault. */
  getMasterEncryptionKey(): string | undefined {
    return process.env.API_KEY_ENCRYPTION_MASTER?.trim() || undefined
  },
} as const
