import crypto from 'crypto';

export interface EncryptedPayload {
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
}

function loadKey(): Buffer {
  const raw = process.env.MASTER_KEY;
  if (!raw || !raw.trim()) {
    throw new Error('MASTER_KEY is required for encryption');
  }
  const trimmed = raw.trim();
  const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;
  const buf = Buffer.from(trimmed, isHex ? 'hex' : 'base64');
  if (buf.length !== 32) {
    throw new Error('MASTER_KEY must be 32 bytes (base64 or hex)');
  }
  return buf;
}

export function encryptValue(plainText: string): EncryptedPayload {
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: data.toString('base64'),
  };
}

export function decryptValue(payload: EncryptedPayload): string {
  if (payload.alg !== 'aes-256-gcm') {
    throw new Error(`Unsupported encryption alg: ${payload.alg}`);
  }
  const key = loadKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const data = Buffer.from(payload.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString('utf8');
}

export function encryptJson(value: unknown): EncryptedPayload {
  return encryptValue(JSON.stringify(value));
}

export function decryptJson<T>(payload: EncryptedPayload): T {
  return JSON.parse(decryptValue(payload)) as T;
}
