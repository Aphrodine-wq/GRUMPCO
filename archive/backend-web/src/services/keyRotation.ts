/**
 * Key rotation service - triggers vault refresh and (optional) rotation.
 * For env-based keys, rotation = updating env and restarting or calling keyVault refresh.
 * For AWS Secrets Manager, implement rotateKey() to update the secret.
 */
import { hasKeys } from './keyVault.js'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

let lastRotationCheck = 0

/**
 * Called periodically (e.g. from a cron or health check).
 * With env-based keys, this just validates that keys exist.
 */
export function runRotationCheck(): void {
  const now = Date.now()
  if (now - lastRotationCheck < 60_000) return // at most once per minute
  lastRotationCheck = now

  if (!hasKeys()) {
    logger.warn('Rotation check: no API keys configured')
    return
  }
  logger.debug('Rotation check: keys available')
}

/**
 * Optional: rotate a specific key id (for vault implementations).
 * No-op for env-based setup.
 */
export async function rotateKey(_keyId: string): Promise<void> {
  logger.info({ keyId: _keyId }, 'Key rotation requested (no-op for env vault)')
}
