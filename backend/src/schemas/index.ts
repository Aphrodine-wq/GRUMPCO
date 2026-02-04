/**
 * Zod Validation Schemas for API Routes
 * Provides type-safe request validation with detailed error messages.
 *
 * @module schemas
 */

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import {
  MAX_MESSAGE_LENGTH as _MAX_MESSAGE_LENGTH,
  MAX_CHAT_MESSAGE_LENGTH as _MAX_CHAT_MESSAGE_LENGTH,
  MAX_CHAT_MESSAGE_LENGTH_LARGE as _MAX_CHAT_MESSAGE_LENGTH_LARGE,
  MAX_CHAT_MESSAGES,
  MAX_CHAT_MESSAGES_LARGE,
  MAX_SHIP_PROJECT_DESCRIPTION_LENGTH,
  MAX_PROJECT_NAME_LENGTH,
  MAX_ARCHITECTURE_DESCRIPTION_LENGTH,
  checkSuspiciousPatterns,
} from '../middleware/validator.js';
import { getRequestLogger } from '../middleware/logger.js';

// ============================================================================
// Common Schemas
// ============================================================================

/** UUID validation */
export const uuidSchema = z.string().uuid();

/** Non-empty string */
export const nonEmptyString = z.string().min(1);

/** Pagination parameters */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

/** Sort order */
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

// ============================================================================
// Chat Schemas
// ============================================================================

/** Message role */
export const messageRoleSchema = z.enum(['user', 'assistant', 'system']);

/** Text content block */
export const textContentBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

/** Image content block */
export const imageContentBlockSchema = z.object({
  type: z.literal('image_url'),
  image_url: z.object({
    url: z.string().url(),
  }),
});

/** Multimodal content */
export const multimodalContentSchema = z.array(
  z.union([textContentBlockSchema, imageContentBlockSchema])
);

/** Chat message */
export const chatMessageSchema = z.object({
  role: messageRoleSchema,
  content: z.union([z.string(), multimodalContentSchema]),
});

/** Chat mode */
export const chatModeSchema = z.enum(['normal', 'plan', 'spec', 'execute', 'argument']);

/** Agent profile */
export const agentProfileSchema = z.enum([
  'general',
  'router',
  'frontend',
  'backend',
  'devops',
  'test',
]);

/** LLM provider (NVIDIA NIM exclusive) - Powered by NVIDIA */
export const llmProviderSchema = z.enum(['nim', 'mock']);

/** Model preset */
export const modelPresetSchema = z.enum(['fast', 'quality', 'balanced']);

/** Tier */
export const tierSchema = z.enum(['free', 'pro', 'team', 'enterprise']);

/** Guard rail options */
export const guardRailOptionsSchema = z.object({
  allowedDirs: z.array(z.string()).optional(),
});

/** Chat stream request - standard context */
export const chatStreamRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, 'At least one message is required')
    .max(MAX_CHAT_MESSAGES, `Maximum ${MAX_CHAT_MESSAGES} messages allowed`),
  workspaceRoot: z.string().optional(),
  mode: chatModeSchema.optional(),
  planMode: z.boolean().optional(),
  planId: z.string().optional(),
  specSessionId: z.string().optional(),
  agentProfile: agentProfileSchema.optional(),
  provider: llmProviderSchema.optional(),
  modelId: z.string().optional(),
  modelKey: z.string().optional(),
  guardRailOptions: guardRailOptionsSchema.optional(),
  tier: tierSchema.optional(),
  autonomous: z.boolean().optional(),
  preferNim: z.boolean().optional(),
  maxLatencyMs: z.number().int().positive().optional(),
  modelPreset: modelPresetSchema.optional(),
  largeContext: z.boolean().optional(),
});

/** Chat stream request - large context */
export const chatStreamRequestLargeSchema = chatStreamRequestSchema.extend({
  messages: z
    .array(chatMessageSchema)
    .min(1, 'At least one message is required')
    .max(MAX_CHAT_MESSAGES_LARGE, `Maximum ${MAX_CHAT_MESSAGES_LARGE} messages allowed`),
  largeContext: z.literal(true),
});

// ============================================================================
// Architecture Schemas
// ============================================================================

/** Project type */
export const projectTypeSchema = z.enum([
  'web',
  'mobile',
  'api',
  'cli',
  'library',
  'fullstack',
  'microservices',
  'desktop',
  'embedded',
  'ml',
]);

/** Complexity level */
export const complexitySchema = z.enum(['simple', 'medium', 'complex', 'enterprise']);

/** Architecture request */
export const architectureRequestSchema = z.object({
  projectDescription: z
    .string()
    .min(1, 'Project description is required')
    .max(MAX_ARCHITECTURE_DESCRIPTION_LENGTH),
  projectName: z.string().max(MAX_PROJECT_NAME_LENGTH).optional(),
  projectType: projectTypeSchema.optional(),
  techStack: z.array(z.string()).optional(),
  complexity: complexitySchema.optional(),
  refinements: z.array(z.string()).optional(),
  conversationHistory: z.array(chatMessageSchema).optional(),
  enrichedIntent: z.record(z.unknown()).optional(),
  demo: z.boolean().optional(),
});

/** Architecture refine request */
export const architectureRefineRequestSchema = z.object({
  architectureId: z.string().optional(),
  refinements: z.array(z.string()).min(1, 'At least one refinement is required'),
});

// ============================================================================
// PRD Schemas
// ============================================================================

/** PRD request */
export const prdRequestSchema = z.object({
  projectName: z.string().max(MAX_PROJECT_NAME_LENGTH).optional(),
  projectDescription: z.string().max(MAX_ARCHITECTURE_DESCRIPTION_LENGTH).optional(),
  architecture: z.record(z.unknown()),
  refinements: z.array(z.string()).optional(),
  conversationHistory: z.array(chatMessageSchema).optional(),
  demo: z.boolean().optional(),
});

/** PRD refine request */
export const prdRefineRequestSchema = z.object({
  prdId: z.string().optional(),
  refinements: z.array(z.string()).min(1, 'At least one refinement is required'),
});

// ============================================================================
// Ship Workflow Schemas
// ============================================================================

/** Ship start request */
export const shipStartRequestSchema = z.object({
  projectDescription: z
    .string()
    .min(1, 'Project description is required')
    .max(MAX_SHIP_PROJECT_DESCRIPTION_LENGTH),
  projectName: z.string().max(MAX_PROJECT_NAME_LENGTH).optional(),
  complexity: complexitySchema.optional(),
  techStack: z.array(z.string()).optional(),
  preferNim: z.boolean().optional(),
  stream: z.boolean().optional(),
});

/** Ship iterate request */
export const shipIterateRequestSchema = z.object({
  sessionId: uuidSchema,
  feedback: z.string().min(1, 'Feedback is required'),
  phase: z.enum(['spec', 'hypothesis', 'implement', 'prove']).optional(),
});

// ============================================================================
// Codegen Schemas
// ============================================================================

/** Codegen request */
export const codegenRequestSchema = z.object({
  prdId: z.string().optional(),
  prd: z.record(z.unknown()).optional(),
  architecture: z.record(z.unknown()).optional(),
  selectedComponents: z.array(z.string()).optional(),
  stream: z.boolean().optional(),
  demo: z.boolean().optional(),
});

// ============================================================================
// Agent Schemas
// ============================================================================

/** Agent create request */
export const agentCreateRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  type: z.enum(['general', 'specialized', 'router']),
  config: z.record(z.unknown()).optional(),
  schedule: z
    .object({
      cron: z.string(),
      timezone: z.string().default('UTC'),
    })
    .optional(),
});

/** Agent run request */
export const agentRunRequestSchema = z.object({
  input: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  stream: z.boolean().optional(),
});

// ============================================================================
// RAG Schemas
// ============================================================================

/** RAG query request */
export const ragQueryRequestSchema = z.object({
  query: z.string().min(1, 'Query is required').max(10000),
  namespace: z.string().optional(),
  topK: z.number().int().min(1).max(100).default(10),
  types: z
    .union([
      z.enum(['doc', 'code', 'spec', 'grump']),
      z.array(z.enum(['doc', 'code', 'spec', 'grump'])),
    ])
    .optional(),
  threshold: z.number().min(0).max(1).optional(),
});

/** RAG index request */
export const ragIndexRequestSchema = z.object({
  documents: z
    .array(
      z.object({
        id: z.string().optional(),
        content: z.string().min(1),
        source: z.string(),
        type: z.enum(['doc', 'code', 'spec', 'grump']),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .min(1, 'At least one document is required'),
  namespace: z.string().optional(),
});

// ============================================================================
// Voice Schemas
// ============================================================================

/** Voice transcribe request */
export const voiceTranscribeRequestSchema = z.object({
  audio: z.string().min(1, 'Audio data is required'), // base64 encoded
  format: z.enum(['wav', 'mp3', 'ogg', 'webm']).default('webm'),
  language: z.string().optional(),
});

/** Voice synthesize request */
export const voiceSynthesizeRequestSchema = z.object({
  text: z.string().min(1, 'Text is required').max(5000),
  voice: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
  format: z.enum(['mp3', 'wav', 'ogg']).default('mp3'),
});

// ============================================================================
// Memory Schemas
// ============================================================================

/** Memory store request */
export const memoryStoreRequestSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  namespace: z.string().optional(),
  ttl: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** Memory query request */
export const memoryQueryRequestSchema = z.object({
  query: z.string().min(1),
  namespace: z.string().optional(),
  topK: z.number().int().min(1).max(100).default(10),
});

// ============================================================================
// Billing Schemas
// ============================================================================

/** Create checkout session request */
export const createCheckoutSessionRequestSchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

/** Create portal session request */
export const createPortalSessionRequestSchema = z.object({
  returnUrl: z.string().url().optional(),
});

// ============================================================================
// Settings Schemas
// ============================================================================

/** Update settings request */
export const updateSettingsRequestSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifications: z.boolean().optional(),
  defaultProvider: llmProviderSchema.optional(),
  defaultModel: z.string().optional(),
  apiKeys: z
    .object({
      nvidia: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates request body against a Zod schema.
 * Returns the parsed data or throws an error with formatted messages.
 */
export function validateRequest<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));

    const error = new Error('Validation failed') as Error & {
      code: string;
      errors: typeof errors;
    };
    error.code = 'VALIDATION_ERROR';
    error.errors = errors;

    throw error;
  }

  return result.data;
}

/**
 * Creates an Express middleware for Zod validation.
 */
export function zodValidator<T extends z.ZodType>(schema: T) {
  return (
    req: { body: unknown },
    res: { status: (code: number) => { json: (data: unknown) => void } },
    next: () => void
  ) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));

      res.status(400).json({
        error: 'Validation failed',
        code: 'validation_error',
        errors,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}

/**
 * Creates an Express middleware for Zod validation with suspicious pattern checking.
 * This is the recommended validator for user-facing text inputs.
 *
 * @param schema - Zod schema to validate against
 * @param suspiciousFields - Fields to check for prompt injection patterns
 */
export function zodValidatorWithSecurity<T extends z.ZodType>(
  schema: T,
  suspiciousFields: string[] = []
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const logger = getRequestLogger();
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));

      logger.warn({ errors }, 'Zod validation failed');

      res.status(400).json({
        error: 'Validation failed',
        type: 'validation_error',
        details: errors,
      });
      return;
    }

    // Check for suspicious patterns in specified fields
    const body = result.data as Record<string, unknown>;
    for (const field of suspiciousFields) {
      const value = body[field];
      if (typeof value === 'string') {
        const matches = checkSuspiciousPatterns(value);
        if (matches.length > 0) {
          if (process.env.BLOCK_SUSPICIOUS_PROMPTS === 'true') {
            logger.warn(
              { patterns: matches, field, preview: value.substring(0, 100) },
              'Suspicious prompt patterns detected; blocking'
            );
            res.status(400).json({
              error: 'Request blocked: suspicious prompt patterns detected',
              type: 'validation_error',
              details: [{ field, message: 'Content matches blocked patterns.' }],
            });
            return;
          }
          logger.warn(
            { patterns: matches, field, preview: value.substring(0, 100) },
            'Suspicious prompt patterns detected'
          );
        }
      }
    }

    req.body = result.data;
    next();
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type ChatStreamRequest = z.infer<typeof chatStreamRequestSchema>;
export type ArchitectureRequest = z.infer<typeof architectureRequestSchema>;
export type PrdRequest = z.infer<typeof prdRequestSchema>;
export type ShipStartRequest = z.infer<typeof shipStartRequestSchema>;
export type CodegenRequest = z.infer<typeof codegenRequestSchema>;
export type AgentCreateRequest = z.infer<typeof agentCreateRequestSchema>;
export type RagQueryRequest = z.infer<typeof ragQueryRequestSchema>;
export type VoiceTranscribeRequest = z.infer<typeof voiceTranscribeRequestSchema>;
export type MemoryStoreRequest = z.infer<typeof memoryStoreRequestSchema>;
