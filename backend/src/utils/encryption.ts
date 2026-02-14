/**
 * Encryption utilities for sensitive data (OAuth tokens, API keys, etc.)
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';
import logger from '../middleware/logger.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment or generate a secure one
 * In production, ENCRYPTION_KEY should be set in environment variables
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;

  if (envKey) {
    // Derive key from environment variable using PBKDF2
    const salt = Buffer.from(process.env.ENCRYPTION_SALT || 'grump-default-salt-change-me');
    return crypto.pbkdf2Sync(envKey, salt, 100000, KEY_LENGTH, 'sha256');
  }

  // Development fallback: generate a key (NOT for production!)
  if (process.env.NODE_ENV !== 'production') {
    logger.warn('Using auto-generated encryption key. Set ENCRYPTION_KEY in production!');
    return crypto.randomBytes(KEY_LENGTH);
  }

  throw new Error('ENCRYPTION_KEY must be set in production environment');
}

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (!cachedKey) {
    cachedKey = getEncryptionKey();
  }
  return cachedKey;
}

/**
 * Encrypt data and return as JSON with IV and auth tag
 */
export function encrypt(plaintext: string): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  } catch (error) {
    logger.error({ error }, 'Encryption failed');
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data from JSON format
 */
export function decrypt(encryptedData: { encrypted: string; iv: string; authTag: string }): string {
  try {
    const key = getKey();
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error({ error }, 'Decryption failed');
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash a value (one-way, for comparison)
 */
export function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure random secret
 */
export function generateSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Constant-time string comparison (prevents timing attacks)
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Encrypt and store as JSONB-compatible object
 */
export function encryptForDb(plaintext: string): Record<string, string> {
  return encrypt(plaintext);
}

/**
 * Decrypt from JSONB-compatible object
 */
export function decryptFromDb(encryptedData: Record<string, string>): string {
  return decrypt(encryptedData as { encrypted: string; iv: string; authTag: string });
}
