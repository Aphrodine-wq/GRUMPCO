/**
 * @fileoverview Tests for Zod Validation Schemas
 * 
 * @module tests/schemas/index.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// Mock dependencies before importing schemas
vi.mock('../../src/middleware/validator.js', () => ({
  MAX_MESSAGE_LENGTH: 10000,
  MAX_CHAT_MESSAGE_LENGTH: 5000,
  MAX_CHAT_MESSAGE_LENGTH_LARGE: 50000,
  MAX_CHAT_MESSAGES: 50,
  MAX_CHAT_MESSAGES_LARGE: 200,
  MAX_SHIP_PROJECT_DESCRIPTION_LENGTH: 10000,
  MAX_PROJECT_NAME_LENGTH: 100,
  MAX_ARCHITECTURE_DESCRIPTION_LENGTH: 20000,
  checkSuspiciousPatterns: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  getRequestLogger: vi.fn().mockReturnValue({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('Validation Schemas', () => {
  describe('Common Schemas', () => {
    it('should validate UUID strings', async () => {
      const { uuidSchema } = await import('../../src/schemas/index.js');
      
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(uuidSchema.parse(validUuid)).toBe(validUuid);
      
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
      expect(() => uuidSchema.parse('')).toThrow();
    });

    it('should validate non-empty strings', async () => {
      const { nonEmptyString } = await import('../../src/schemas/index.js');
      
      expect(nonEmptyString.parse('hello')).toBe('hello');
      expect(() => nonEmptyString.parse('')).toThrow();
    });

    it('should validate pagination parameters', async () => {
      const { paginationSchema } = await import('../../src/schemas/index.js');
      
      const result = paginationSchema.parse({ page: '2', limit: '50' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
      
      // Defaults
      const defaults = paginationSchema.parse({});
      expect(defaults.page).toBe(1);
      expect(defaults.limit).toBe(20);
      
      // Bounds
      expect(() => paginationSchema.parse({ page: 0 })).toThrow();
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
    });

    it('should validate sort order', async () => {
      const { sortOrderSchema } = await import('../../src/schemas/index.js');
      
      expect(sortOrderSchema.parse('asc')).toBe('asc');
      expect(sortOrderSchema.parse('desc')).toBe('desc');
      expect(sortOrderSchema.parse(undefined)).toBe('desc'); // default
      expect(() => sortOrderSchema.parse('invalid')).toThrow();
    });
  });

  describe('Chat Schemas', () => {
    it('should validate message roles', async () => {
      const { messageRoleSchema } = await import('../../src/schemas/index.js');
      
      expect(messageRoleSchema.parse('user')).toBe('user');
      expect(messageRoleSchema.parse('assistant')).toBe('assistant');
      expect(messageRoleSchema.parse('system')).toBe('system');
      expect(() => messageRoleSchema.parse('invalid')).toThrow();
    });

    it('should validate text content blocks', async () => {
      const { textContentBlockSchema } = await import('../../src/schemas/index.js');
      
      const valid = { type: 'text', text: 'Hello world' };
      expect(textContentBlockSchema.parse(valid)).toEqual(valid);
      
      expect(() => textContentBlockSchema.parse({ type: 'text' })).toThrow();
    });

    it('should validate image content blocks', async () => {
      const { imageContentBlockSchema } = await import('../../src/schemas/index.js');
      
      const valid = { 
        type: 'image_url', 
        image_url: { url: 'https://example.com/image.png' } 
      };
      expect(imageContentBlockSchema.parse(valid)).toEqual(valid);
      
      expect(() => imageContentBlockSchema.parse({ 
        type: 'image_url', 
        image_url: { url: 'not-a-url' } 
      })).toThrow();
    });

    it('should validate chat messages', async () => {
      const { chatMessageSchema } = await import('../../src/schemas/index.js');
      
      // String content
      const stringMsg = { role: 'user', content: 'Hello' };
      expect(chatMessageSchema.parse(stringMsg)).toEqual(stringMsg);
      
      // Multimodal content
      const multimodalMsg = {
        role: 'user',
        content: [
          { type: 'text', text: 'Check this image' },
          { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
        ],
      };
      expect(chatMessageSchema.parse(multimodalMsg)).toEqual(multimodalMsg);
    });

    it('should validate chat modes', async () => {
      const { chatModeSchema } = await import('../../src/schemas/index.js');
      
      const validModes = ['normal', 'plan', 'spec', 'execute', 'argument'];
      for (const mode of validModes) {
        expect(chatModeSchema.parse(mode)).toBe(mode);
      }
      expect(() => chatModeSchema.parse('invalid')).toThrow();
    });

    it('should validate agent profiles', async () => {
      const { agentProfileSchema } = await import('../../src/schemas/index.js');
      
      const validProfiles = ['general', 'router', 'frontend', 'backend', 'devops', 'test'];
      for (const profile of validProfiles) {
        expect(agentProfileSchema.parse(profile)).toBe(profile);
      }
      expect(() => agentProfileSchema.parse('invalid')).toThrow();
    });

    it('should validate LLM providers', async () => {
      const { llmProviderSchema } = await import('../../src/schemas/index.js');

      // Only nim and mock are valid providers in the exclusive NVIDIA NIM setup
      const validProviders = ['nim', 'mock'];
      for (const provider of validProviders) {
        expect(llmProviderSchema.parse(provider)).toBe(provider);
      }
      expect(() => llmProviderSchema.parse('invalid')).toThrow();
      expect(() => llmProviderSchema.parse('openrouter')).toThrow();
    });
  });

  describe('Type Exports', () => {
    it('should export proper TypeScript types', async () => {
      const schemas = await import('../../src/schemas/index.js');
      
      // Verify schemas exist and are Zod schemas
      expect(schemas.uuidSchema).toBeDefined();
      expect(schemas.nonEmptyString).toBeDefined();
      expect(schemas.paginationSchema).toBeDefined();
      expect(schemas.messageRoleSchema).toBeDefined();
      expect(schemas.chatMessageSchema).toBeDefined();
    });
  });
});
