/**
 * Key Vault - secure retrieval of API keys.
 * Option C: env-based (decrypted at runtime from ANTHROPIC_API_KEY / ANTHROPIC_API_KEYS).
 * For AWS/Vault, implement getKey() to call those services.
 */
import { SECURITY } from '../config/security.js'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

let keyPool: string[] = []
let lastRefreshed = 0
const REFRESH_INTERVAL_MS = 60_000 // 1 min

function refreshPool(): void {
  const now = Date.now()
  if (now - lastRefreshed < REFRESH_INTERVAL_MS && keyPool.length > 0) return
  keyPool = SECURITY.getAnthropicKeys()
  lastRefreshed = now
  if (keyPool.length === 0) {
    logger.warn('Key vault: no Anthropic API keys configured')
  } else {
    logger.info({ keyCount: keyPool.length }, 'Key vault refreshed')
  }
}

/**
 * Get the next key from the pool (round-robin).
 * Never log or expose the key value.
 */
export function getKey(): string | null {
  refreshPool()
  if (keyPool.length === 0) return null
  // Round-robin by time (simple)
  const index = Math.floor(Date.now() / 1000) % keyPool.length
  return keyPool[index] ?? keyPool[0]
}

/**
 * Get all keys (e.g. for health checks). Caller must not log or expose.
 */
export function getAllKeys(): string[] {
  refreshPool()
  return [...keyPool]
}

/**
 * Return whether any key is configured.
 */
export function hasKeys(): boolean {
  refreshPool()
  return keyPool.length > 0
}
