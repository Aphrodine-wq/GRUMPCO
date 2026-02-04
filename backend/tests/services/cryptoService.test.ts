/**
 * Crypto Service Unit Tests
 * Tests encryption, decryption, key loading, and JSON handling.
 *
 * Run: npm test -- cryptoService.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

// Store original env
const originalEnv = { ...process.env };

// Generate a valid 32-byte key for testing
const validHexKey = crypto.randomBytes(32).toString('hex');
const validBase64Key = crypto.randomBytes(32).toString('base64');

describe('cryptoService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('loadKey (via encryptValue/decryptValue)', () => {
    it('should throw error when MASTER_KEY is not set', async () => {
      delete process.env.MASTER_KEY;

      const { encryptValue } = await import('../../src/services/cryptoService.js');

      expect(() => encryptValue('test')).toThrow('MASTER_KEY is required for encryption');
    });

    it('should throw error when MASTER_KEY is empty string', async () => {
      process.env.MASTER_KEY = '';

      const { encryptValue } = await import('../../src/services/cryptoService.js');

      expect(() => encryptValue('test')).toThrow('MASTER_KEY is required for encryption');
    });

    it('should throw error when MASTER_KEY is only whitespace', async () => {
      process.env.MASTER_KEY = '   ';

      const { encryptValue } = await import('../../src/services/cryptoService.js');

      expect(() => encryptValue('test')).toThrow('MASTER_KEY is required for encryption');
    });

    it('should throw error when MASTER_KEY is not 32 bytes (base64)', async () => {
      // 16-byte key encoded as base64 - too short
      process.env.MASTER_KEY = crypto.randomBytes(16).toString('base64');

      const { encryptValue } = await import('../../src/services/cryptoService.js');

      expect(() => encryptValue('test')).toThrow('MASTER_KEY must be 32 bytes (base64 or hex)');
    });

    it('should throw error when MASTER_KEY is not 32 bytes (hex)', async () => {
      // 16-byte key encoded as hex - too short
      process.env.MASTER_KEY = crypto.randomBytes(16).toString('hex');

      const { encryptValue } = await import('../../src/services/cryptoService.js');

      expect(() => encryptValue('test')).toThrow('MASTER_KEY must be 32 bytes (base64 or hex)');
    });

    it('should accept valid 32-byte hex key', async () => {
      process.env.MASTER_KEY = validHexKey;

      const { encryptValue } = await import('../../src/services/cryptoService.js');

      expect(() => encryptValue('test')).not.toThrow();
    });

    it('should accept valid 32-byte base64 key', async () => {
      process.env.MASTER_KEY = validBase64Key;

      const { encryptValue } = await import('../../src/services/cryptoService.js');

      expect(() => encryptValue('test')).not.toThrow();
    });

    it('should trim whitespace from MASTER_KEY', async () => {
      process.env.MASTER_KEY = `  ${validHexKey}  `;

      const { encryptValue } = await import('../../src/services/cryptoService.js');

      expect(() => encryptValue('test')).not.toThrow();
    });

    it('should handle key with mixed case hex characters', async () => {
      // Create a hex key with mixed case
      const mixedCaseHex = validHexKey.split('').map((c, i) =>
        i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
      ).join('');
      process.env.MASTER_KEY = mixedCaseHex;

      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptValue('test data');
      const decrypted = decryptValue(encrypted);

      expect(decrypted).toBe('test data');
    });
  });

  describe('encryptValue', () => {
    beforeEach(() => {
      process.env.MASTER_KEY = validHexKey;
    });

    it('should return encrypted payload with correct structure', async () => {
      const { encryptValue } = await import('../../src/services/cryptoService.js');

      const result = encryptValue('test plaintext');

      expect(result).toHaveProperty('alg', 'aes-256-gcm');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');
      expect(result).toHaveProperty('data');
    });

    it('should return base64 encoded iv', async () => {
      const { encryptValue } = await import('../../src/services/cryptoService.js');

      const result = encryptValue('test');

      // IV should be valid base64
      expect(() => Buffer.from(result.iv, 'base64')).not.toThrow();
      // IV should be 12 bytes for GCM
      expect(Buffer.from(result.iv, 'base64').length).toBe(12);
    });

    it('should return base64 encoded tag', async () => {
      const { encryptValue } = await import('../../src/services/cryptoService.js');

      const result = encryptValue('test');

      // Tag should be valid base64
      expect(() => Buffer.from(result.tag, 'base64')).not.toThrow();
      // Tag should be 16 bytes for AES-GCM
      expect(Buffer.from(result.tag, 'base64').length).toBe(16);
    });

    it('should return base64 encoded data', async () => {
      const { encryptValue } = await import('../../src/services/cryptoService.js');

      const result = encryptValue('test');

      // Data should be valid base64
      expect(() => Buffer.from(result.data, 'base64')).not.toThrow();
    });

    it('should produce different IVs for each encryption', async () => {
      const { encryptValue } = await import('../../src/services/cryptoService.js');

      const result1 = encryptValue('same plaintext');
      const result2 = encryptValue('same plaintext');

      expect(result1.iv).not.toBe(result2.iv);
    });

    it('should encrypt empty string', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptValue('');
      const decrypted = decryptValue(encrypted);

      expect(decrypted).toBe('');
    });

    it('should encrypt long strings', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const longString = 'x'.repeat(100000);
      const encrypted = encryptValue(longString);
      const decrypted = decryptValue(encrypted);

      expect(decrypted).toBe(longString);
    });

    it('should encrypt unicode characters', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const unicodeString = 'Hello, World!';
      const encrypted = encryptValue(unicodeString);
      const decrypted = decryptValue(encrypted);

      expect(decrypted).toBe(unicodeString);
    });

    it('should encrypt special characters', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const specialChars = '!@#$%^&*()_+-=[]{}|;\':",./<>?\n\t\r';
      const encrypted = encryptValue(specialChars);
      const decrypted = decryptValue(encrypted);

      expect(decrypted).toBe(specialChars);
    });
  });

  describe('decryptValue', () => {
    beforeEach(() => {
      process.env.MASTER_KEY = validHexKey;
    });

    it('should decrypt encrypted value correctly', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const plaintext = 'secret message';
      const encrypted = encryptValue(plaintext);
      const decrypted = decryptValue(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for unsupported algorithm', async () => {
      const { decryptValue } = await import('../../src/services/cryptoService.js');

      const invalidPayload = {
        alg: 'aes-128-cbc' as 'aes-256-gcm', // Invalid algorithm
        iv: Buffer.from('test').toString('base64'),
        tag: Buffer.from('test').toString('base64'),
        data: Buffer.from('test').toString('base64'),
      };

      expect(() => decryptValue(invalidPayload)).toThrow('Unsupported encryption alg: aes-128-cbc');
    });

    it('should throw error for tampered data', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptValue('secret message');

      // Tamper with the data
      const tamperedData = Buffer.from(encrypted.data, 'base64');
      tamperedData[0] ^= 0xff; // Flip bits
      encrypted.data = tamperedData.toString('base64');

      expect(() => decryptValue(encrypted)).toThrow();
    });

    it('should throw error for tampered tag', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptValue('secret message');

      // Tamper with the tag
      const tamperedTag = Buffer.from(encrypted.tag, 'base64');
      tamperedTag[0] ^= 0xff; // Flip bits
      encrypted.tag = tamperedTag.toString('base64');

      expect(() => decryptValue(encrypted)).toThrow();
    });

    it('should throw error for tampered iv', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptValue('secret message');

      // Tamper with the IV
      const tamperedIv = Buffer.from(encrypted.iv, 'base64');
      tamperedIv[0] ^= 0xff; // Flip bits
      encrypted.iv = tamperedIv.toString('base64');

      expect(() => decryptValue(encrypted)).toThrow();
    });

    it('should throw error when using different key for decryption', async () => {
      const { encryptValue } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptValue('secret message');

      // Reset modules and use different key
      vi.resetModules();
      process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');

      const { decryptValue } = await import('../../src/services/cryptoService.js');

      expect(() => decryptValue(encrypted)).toThrow();
    });

    it('should handle payload with invalid base64 in iv', async () => {
      const { decryptValue } = await import('../../src/services/cryptoService.js');

      const invalidPayload = {
        alg: 'aes-256-gcm' as const,
        iv: 'not-valid-base64!!!',
        tag: Buffer.from('test-tag-16bytes').toString('base64'),
        data: Buffer.from('test-data').toString('base64'),
      };

      expect(() => decryptValue(invalidPayload)).toThrow();
    });
  });

  describe('encryptJson', () => {
    beforeEach(() => {
      process.env.MASTER_KEY = validHexKey;
    });

    it('should encrypt and return valid payload for object', async () => {
      const { encryptJson } = await import('../../src/services/cryptoService.js');

      const data = { key: 'value', nested: { a: 1 } };
      const result = encryptJson(data);

      expect(result).toHaveProperty('alg', 'aes-256-gcm');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');
      expect(result).toHaveProperty('data');
    });

    it('should encrypt array', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const data = [1, 2, 3, { nested: 'value' }];
      const encrypted = encryptJson(data);
      const decrypted = decryptJson(encrypted);

      expect(decrypted).toEqual(data);
    });

    it('should encrypt number', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const data = 42.5;
      const encrypted = encryptJson(data);
      const decrypted = decryptJson<number>(encrypted);

      expect(decrypted).toBe(data);
    });

    it('should encrypt string', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const data = 'test string';
      const encrypted = encryptJson(data);
      const decrypted = decryptJson<string>(encrypted);

      expect(decrypted).toBe(data);
    });

    it('should encrypt boolean', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptJson(true);
      const decrypted = decryptJson<boolean>(encrypted);

      expect(decrypted).toBe(true);
    });

    it('should encrypt null', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptJson(null);
      const decrypted = decryptJson<null>(encrypted);

      expect(decrypted).toBeNull();
    });

    it('should handle complex nested objects', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const data = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, { deep: 'value' }],
              boolean: true,
              number: 123.456,
              string: 'nested string',
            },
          },
        },
      };
      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);

      expect(decrypted).toEqual(data);
    });
  });

  describe('decryptJson', () => {
    beforeEach(() => {
      process.env.MASTER_KEY = validHexKey;
    });

    it('should decrypt to original object', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const original = { user: 'test', permissions: ['read', 'write'] };
      const encrypted = encryptJson(original);
      const decrypted = decryptJson<typeof original>(encrypted);

      expect(decrypted).toEqual(original);
    });

    it('should preserve object types after decryption', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      interface UserData {
        id: number;
        name: string;
        active: boolean;
        roles: string[];
      }

      const original: UserData = {
        id: 123,
        name: 'Test User',
        active: true,
        roles: ['admin', 'user'],
      };

      const encrypted = encryptJson(original);
      const decrypted = decryptJson<UserData>(encrypted);

      expect(typeof decrypted.id).toBe('number');
      expect(typeof decrypted.name).toBe('string');
      expect(typeof decrypted.active).toBe('boolean');
      expect(Array.isArray(decrypted.roles)).toBe(true);
    });

    it('should throw error for invalid JSON after decryption', async () => {
      const { encryptValue, decryptJson } = await import('../../src/services/cryptoService.js');

      // Encrypt invalid JSON (just a plain string that's not JSON)
      const encrypted = encryptValue('not valid json {{{');

      expect(() => decryptJson(encrypted)).toThrow();
    });

    it('should handle empty object', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptJson({});
      const decrypted = decryptJson<object>(encrypted);

      expect(decrypted).toEqual({});
    });

    it('should handle empty array', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptJson([]);
      const decrypted = decryptJson<unknown[]>(encrypted);

      expect(decrypted).toEqual([]);
    });
  });

  describe('EncryptedPayload interface', () => {
    beforeEach(() => {
      process.env.MASTER_KEY = validHexKey;
    });

    it('should have immutable alg field of aes-256-gcm', async () => {
      const { encryptValue } = await import('../../src/services/cryptoService.js');

      const result = encryptValue('test');

      expect(result.alg).toBe('aes-256-gcm');
    });

    it('should be serializable to JSON', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptValue('test message');
      const serialized = JSON.stringify(encrypted);
      const deserialized = JSON.parse(serialized);
      const decrypted = decryptValue(deserialized);

      expect(decrypted).toBe('test message');
    });

    it('should support round-trip through database-like storage', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const original = 'sensitive data for storage';
      const encrypted = encryptValue(original);

      // Simulate storing as JSON string (like in a database column)
      const stored = JSON.stringify(encrypted);

      // Simulate retrieving and parsing
      const retrieved = JSON.parse(stored);
      const decrypted = decryptValue(retrieved);

      expect(decrypted).toBe(original);
    });
  });

  describe('Key format detection', () => {
    it('should detect hex key with even length', async () => {
      // 64 hex characters = 32 bytes
      const hexKey = 'a'.repeat(64);
      process.env.MASTER_KEY = hexKey;

      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptValue('test');
      const decrypted = decryptValue(encrypted);

      expect(decrypted).toBe('test');
    });

    it('should treat non-hex string as base64', async () => {
      // Create a valid base64 key that contains non-hex chars (like /)
      const base64Key = validBase64Key;
      process.env.MASTER_KEY = base64Key;

      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptValue('test');
      const decrypted = decryptValue(encrypted);

      expect(decrypted).toBe('test');
    });

    it('should reject odd-length hex-like string that decodes to wrong size', async () => {
      // Odd length hex-like string gets treated as base64, which will likely not be 32 bytes
      process.env.MASTER_KEY = 'abc'; // Not hex (odd length), and too short as base64

      const { encryptValue } = await import('../../src/services/cryptoService.js');

      expect(() => encryptValue('test')).toThrow('MASTER_KEY must be 32 bytes');
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      process.env.MASTER_KEY = validHexKey;
    });

    it('should handle newlines in plaintext', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const textWithNewlines = 'line1\nline2\r\nline3\n';
      const encrypted = encryptValue(textWithNewlines);
      const decrypted = decryptValue(encrypted);

      expect(decrypted).toBe(textWithNewlines);
    });

    it('should handle null bytes in plaintext', async () => {
      const { encryptValue, decryptValue } = await import('../../src/services/cryptoService.js');

      const textWithNullBytes = 'before\x00after';
      const encrypted = encryptValue(textWithNullBytes);
      const decrypted = decryptValue(encrypted);

      expect(decrypted).toBe(textWithNullBytes);
    });

    it('should handle very long JSON values', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `item-${i}`,
        data: 'x'.repeat(100),
      }));

      const encrypted = encryptJson(largeArray);
      const decrypted = decryptJson<typeof largeArray>(encrypted);

      expect(decrypted.length).toBe(10000);
      expect(decrypted[0]).toEqual({ id: 0, name: 'item-0', data: 'x'.repeat(100) });
      expect(decrypted[9999]).toEqual({ id: 9999, name: 'item-9999', data: 'x'.repeat(100) });
    });

    it('should handle JSON with Date-like strings', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const data = {
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
      };

      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);

      expect(decrypted.createdAt).toBe('2024-01-15T10:30:00.000Z');
      expect(decrypted.updatedAt).toBe('2024-01-15T11:00:00.000Z');
    });

    it('should handle undefined values in objects (converted to null by JSON)', async () => {
      const { encryptJson, decryptJson } = await import('../../src/services/cryptoService.js');

      const data = { defined: 'value', undef: undefined };
      const encrypted = encryptJson(data);
      const decrypted = decryptJson<{ defined: string; undef?: unknown }>(encrypted);

      expect(decrypted.defined).toBe('value');
      // undefined becomes missing key after JSON.stringify/parse
      expect('undef' in decrypted).toBe(false);
    });
  });

  describe('Security considerations', () => {
    beforeEach(() => {
      process.env.MASTER_KEY = validHexKey;
    });

    it('should not leak plaintext in encrypted payload', async () => {
      const { encryptValue } = await import('../../src/services/cryptoService.js');

      const secret = 'super-secret-password-12345';
      const encrypted = encryptValue(secret);

      // Check that the secret doesn't appear in any of the encrypted fields
      expect(encrypted.iv).not.toContain(secret);
      expect(encrypted.tag).not.toContain(secret);
      expect(encrypted.data).not.toContain(secret);

      // Also check the JSON stringified version
      const serialized = JSON.stringify(encrypted);
      expect(serialized).not.toContain(secret);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const { encryptValue } = await import('../../src/services/cryptoService.js');

      const plaintext = 'identical message';
      const encrypted1 = encryptValue(plaintext);
      const encrypted2 = encryptValue(plaintext);

      // Different IVs should produce different data
      expect(encrypted1.data).not.toBe(encrypted2.data);
    });

    it('should use authenticated encryption (GCM mode)', async () => {
      const { encryptValue } = await import('../../src/services/cryptoService.js');

      const encrypted = encryptValue('test');

      // Verify it's using AES-256-GCM
      expect(encrypted.alg).toBe('aes-256-gcm');

      // Tag should exist for authentication
      expect(encrypted.tag).toBeDefined();
      expect(Buffer.from(encrypted.tag, 'base64').length).toBe(16);
    });
  });
});
