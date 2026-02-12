/**
 * Database schema and migration tool definitions
 */

import { z } from 'zod';
import type { Tool } from '../types.js';

// ============================================================================
// DB SCHEMA TOOL
// ============================================================================

export const generateDbSchemaInputSchema = z.object({
  description: z.string().describe('Architecture description or PRD excerpt'),
  targetDb: z
    .enum(['sqlite', 'postgres', 'mysql'])
    .optional()
    .default('sqlite')
    .describe('Target DB'),
  format: z.enum(['sql', 'drizzle']).optional().default('sql').describe('Output format'),
});

export type GenerateDbSchemaInput = z.infer<typeof generateDbSchemaInputSchema>;

export const generateDbSchemaTool: Tool = {
  name: 'generate_db_schema',
  description: 'Generate database schema from architecture description. Use for user DB creation.',
  input_schema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Architecture/PRD description',
      },
      targetDb: {
        type: 'string',
        enum: ['sqlite', 'postgres', 'mysql'],
        description: 'Target DB',
      },
      format: {
        type: 'string',
        enum: ['sql', 'drizzle'],
        description: 'Output format',
      },
    },
    required: ['description'],
  },
};

// ============================================================================
// MIGRATIONS TOOL
// ============================================================================

export const generateMigrationsInputSchema = z.object({
  schemaDdl: z.string().describe('Existing schema DDL to migrate'),
  targetDb: z.enum(['sqlite', 'postgres']).optional().default('sqlite').describe('Target DB'),
});

export type GenerateMigrationsInput = z.infer<typeof generateMigrationsInputSchema>;

export const generateMigrationsTool: Tool = {
  name: 'generate_migrations',
  description: 'Generate migration files from schema DDL. Output is for user to review and apply.',
  input_schema: {
    type: 'object',
    properties: {
      schemaDdl: { type: 'string', description: 'Schema DDL to migrate' },
      targetDb: {
        type: 'string',
        enum: ['sqlite', 'postgres'],
        description: 'Target DB',
      },
    },
    required: ['schemaDdl'],
  },
};

// ============================================================================
// EXPORT ALL DB TOOLS
// ============================================================================

export const DB_TOOLS: Tool[] = [generateDbSchemaTool, generateMigrationsTool];
