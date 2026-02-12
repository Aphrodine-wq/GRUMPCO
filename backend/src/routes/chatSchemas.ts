/**
 * Chat API - Zod Schemas & Type Definitions
 *
 * Extracted from chat.ts for better modularity.
 * Contains all request validation schemas and the ChatStreamRequest type.
 *
 * @module routes/chatSchemas
 */

import { z } from 'zod';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

/**
 * Schema for multimodal content blocks (text or image_url).
 */
export const multimodalContentBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('image_url'),
    image_url: z.object({
      url: z.string().url('Invalid image URL'),
    }),
  }),
]);

/**
 * Schema for a single chat message.
 * Content can be a string or multimodal array.
 */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(multimodalContentBlockSchema)]),
});

/**
 * Schema for guard rail options.
 */
export const guardRailOptionsSchema = z
  .object({
    allowedDirs: z.array(z.string()).optional(),
  })
  .optional();

/**
 * Schema for model preference (G-Agent).
 */
export const modelPreferenceSchema = z
  .object({
    source: z.enum(['cloud', 'auto']).optional(),
    provider: z.string().optional(),
    modelId: z.string().optional(),
  })
  .optional();

/**
 * Main schema for chat stream request body.
 */
export const chatStreamRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1, 'messages array must not be empty'),
  workspaceRoot: z.string().optional(),
  mode: z
    .enum(['normal', 'plan', 'spec', 'execute', 'design', 'argument', 'code', 'ship'])
    .optional(),
  planMode: z.boolean().optional(), // Deprecated
  planId: z.string().optional(),
  specSessionId: z.string().optional(),
  agentProfile: z.enum(['general', 'router', 'frontend', 'backend', 'devops', 'test']).optional(),
  provider: z.enum(['nim', 'openrouter', 'ollama', 'anthropic', 'grump', 'mock']).optional(),
  modelId: z.string().optional(),
  modelKey: z.string().optional(),
  guardRailOptions: guardRailOptionsSchema,
  tier: z.enum(['free', 'pro', 'team', 'enterprise']).optional(),
  autonomous: z.boolean().optional(),
  largeContext: z.boolean().optional(),
  preferNim: z.boolean().optional(),
  maxLatencyMs: z.number().positive().optional(),
  modelPreset: z.enum(['fast', 'quality', 'balanced']).optional(),
  sessionType: z.enum(['chat', 'gAgent', 'freeAgent']).optional(),
  freeAgentModelPreference: modelPreferenceSchema, // Legacy field, kept for backward compat
  gAgentModelPreference: modelPreferenceSchema,
  includeRagContext: z.boolean().optional(),
  toolAllowlist: z.array(z.string()).optional(),
  toolDenylist: z.array(z.string()).optional(),
  memoryContext: z.array(z.string()).optional(),
});

/** Type inferred from the chat stream request schema */
export type ChatStreamRequest = z.infer<typeof chatStreamRequestSchema>;
