/**
 * Secrets Service
 * Manages encrypted storage of API keys and other secrets
 */

import { getDatabase } from '../../db/database.js';
import { encryptValue, decryptValue, type EncryptedPayload } from './cryptoService.js';
import { writeAuditLog } from './auditLogService.js';
import logger from '../../middleware/logger.js';
import type {
  IntegrationProviderId,
  IntegrationSecretRecord,
  CreateSecretInput,
} from '../../types/integrations.js';

/**
 * Store an encrypted secret
 */
export async function storeSecret(input: CreateSecretInput): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Encrypt the secret
  const encrypted = encryptValue(input.secretEnc);

  const record: IntegrationSecretRecord = {
    id: `secret_${input.provider}_${input.name}_${Date.now()}`,
    user_id: input.userId,
    provider: input.provider,
    name: input.name,
    secret_enc: JSON.stringify(encrypted),
    created_at: now,
    updated_at: now,
  };

  await db.saveIntegrationSecret(record);

  await writeAuditLog({
    userId: input.userId,
    action: 'secret.stored',
    category: 'security',
    target: `${input.provider}:${input.name}`,
  });

  logger.info({ provider: input.provider, name: input.name }, 'Secret stored');
}

/**
 * Get a decrypted secret
 */
export async function getSecret(
  userId: string,
  provider: IntegrationProviderId,
  name: string
): Promise<string | null> {
  const db = getDatabase();
  const record = await db.getIntegrationSecret(userId, provider, name);
  if (!record) return null;

  try {
    const payload = JSON.parse(record.secret_enc) as EncryptedPayload;
    return decryptValue(payload);
  } catch (err) {
    logger.error({ provider, name, error: (err as Error).message }, 'Failed to decrypt secret');
    return null;
  }
}

/**
 * Delete a secret
 */
export async function deleteSecret(
  userId: string,
  provider: IntegrationProviderId,
  name: string
): Promise<void> {
  const db = getDatabase();
  await db.deleteIntegrationSecret(userId, provider, name);

  await writeAuditLog({
    userId,
    action: 'secret.deleted',
    category: 'security',
    target: `${provider}:${name}`,
  });

  logger.info({ provider, name }, 'Secret deleted');
}

/**
 * Check if a secret exists
 */
export async function hasSecret(
  userId: string,
  provider: IntegrationProviderId,
  name: string
): Promise<boolean> {
  const db = getDatabase();
  const record = await db.getIntegrationSecret(userId, provider, name);
  return record !== null;
}

/**
 * Get or create a secret (returns null if doesn't exist and no default)
 */
export async function getOrCreateSecret(
  userId: string,
  provider: IntegrationProviderId,
  name: string,
  defaultValue?: string
): Promise<string | null> {
  const existing = await getSecret(userId, provider, name);
  if (existing) return existing;

  if (defaultValue) {
    await storeSecret({
      userId,
      provider,
      name,
      secretEnc: defaultValue,
    });
    return defaultValue;
  }

  return null;
}

// ========== Common Secret Names ==========

export const SECRET_NAMES = {
  API_KEY: 'api_key',
  API_SECRET: 'api_secret',
  BOT_TOKEN: 'bot_token',
  WEBHOOK_SECRET: 'webhook_secret',
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  VAULT_PATH: 'vault_path',
  HOME_URL: 'home_url',
} as const;

/**
 * Store an API key for a provider
 */
export async function storeApiKey(
  userId: string,
  provider: IntegrationProviderId,
  apiKey: string
): Promise<void> {
  await storeSecret({
    userId,
    provider,
    name: SECRET_NAMES.API_KEY,
    secretEnc: apiKey,
  });
}

/**
 * Get an API key for a provider
 */
export async function getApiKey(
  userId: string,
  provider: IntegrationProviderId
): Promise<string | null> {
  return getSecret(userId, provider, SECRET_NAMES.API_KEY);
}

/**
 * Store a bot token for a provider
 */
export async function storeBotToken(
  userId: string,
  provider: IntegrationProviderId,
  token: string
): Promise<void> {
  await storeSecret({
    userId,
    provider,
    name: SECRET_NAMES.BOT_TOKEN,
    secretEnc: token,
  });
}

/**
 * Get a bot token for a provider
 */
export async function getBotToken(
  userId: string,
  provider: IntegrationProviderId
): Promise<string | null> {
  return getSecret(userId, provider, SECRET_NAMES.BOT_TOKEN);
}
