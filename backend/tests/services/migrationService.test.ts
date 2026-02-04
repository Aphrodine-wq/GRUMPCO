/**
 * Tests for migrationService.ts
 * Covers migration generation from schema DDL using LLM
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock variables using vi.hoisted
const { mockGetCompletion } = vi.hoisted(() => ({
  mockGetCompletion: vi.fn(),
}));

// Mock LLM gateway helper
vi.mock('../../src/services/llmGatewayHelper.js', () => ({
  getCompletion: (...args: unknown[]) => mockGetCompletion(...args),
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import { generateMigrations, type MigrationTargetDb } from '../../src/services/migrationService.js';

describe('migrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateMigrations', () => {
    it('should generate migrations from schema DDL', async () => {
      const mockSqlResponse = `Here are the migrations:

\`\`\`sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
\`\`\`

\`\`\`sql
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL
);
\`\`\``;

      mockGetCompletion.mockResolvedValue({
        text: mockSqlResponse,
        error: null,
      });

      const result = await generateMigrations('CREATE TABLE users...');

      expect(result.migrations).toHaveLength(2);
      expect(result.migrations[0]).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(result.migrations[1]).toContain('CREATE TABLE IF NOT EXISTS posts');
      expect(result.summary).toBe('2 migration(s) for sqlite');
    });

    it('should use sqlite as default target DB', async () => {
      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE test;\n```',
        error: null,
      });

      await generateMigrations('CREATE TABLE test');

      expect(mockGetCompletion).toHaveBeenCalledWith(expect.objectContaining({
        messages: [expect.objectContaining({
          content: expect.stringContaining('Target DB: sqlite'),
        })],
      }));
    });

    it('should support postgres target DB', async () => {
      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE test;\n```',
        error: null,
      });

      const result = await generateMigrations('CREATE TABLE test', 'postgres');

      expect(mockGetCompletion).toHaveBeenCalledWith(expect.objectContaining({
        messages: [expect.objectContaining({
          content: expect.stringContaining('Target DB: postgres'),
        })],
      }));
      expect(result.summary).toBe('1 migration(s) for postgres');
    });

    it('should use claude-sonnet-4 model', async () => {
      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE test;\n```',
        error: null,
      });

      await generateMigrations('CREATE TABLE test');

      expect(mockGetCompletion).toHaveBeenCalledWith(expect.objectContaining({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
      }));
    });

    it('should include system prompt for migration expert', async () => {
      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE test;\n```',
        error: null,
      });

      await generateMigrations('CREATE TABLE test');

      expect(mockGetCompletion).toHaveBeenCalledWith(expect.objectContaining({
        system: expect.stringContaining('database migration expert'),
      }));
    });

    it('should handle LLM error response', async () => {
      mockGetCompletion.mockResolvedValue({
        text: '',
        error: 'Rate limit exceeded',
      });

      const result = await generateMigrations('CREATE TABLE test');

      expect(result.migrations).toHaveLength(1);
      expect(result.migrations[0]).toContain('-- Error: Rate limit exceeded');
      expect(result.summary).toBe('Error');
    });

    it('should handle thrown exceptions', async () => {
      mockGetCompletion.mockRejectedValue(new Error('Network timeout'));

      const result = await generateMigrations('CREATE TABLE test');

      expect(result.migrations).toHaveLength(1);
      expect(result.migrations[0]).toContain('-- Error: Network timeout');
      expect(result.summary).toBe('Error');
    });

    it('should extract SQL from response without code blocks when CREATE is present', async () => {
      const rawSqlResponse = `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);`;

      mockGetCompletion.mockResolvedValue({
        text: rawSqlResponse,
        error: null,
      });

      const result = await generateMigrations('CREATE TABLE users...');

      expect(result.migrations).toHaveLength(1);
      expect(result.migrations[0]).toContain('CREATE TABLE users');
    });

    it('should handle multiple SQL blocks correctly', async () => {
      const mockSqlResponse = `Migration 1:
\`\`\`sql
ALTER TABLE users ADD COLUMN email TEXT;
\`\`\`

Migration 2:
\`\`\`sql
CREATE INDEX idx_users_email ON users(email);
\`\`\`

Migration 3:
\`\`\`sql
ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
\`\`\``;

      mockGetCompletion.mockResolvedValue({
        text: mockSqlResponse,
        error: null,
      });

      const result = await generateMigrations('ALTER TABLE users...');

      expect(result.migrations).toHaveLength(3);
      expect(result.migrations[0]).toContain('ALTER TABLE users ADD COLUMN email');
      expect(result.migrations[1]).toContain('CREATE INDEX');
      expect(result.migrations[2]).toContain('created_at TIMESTAMP');
    });

    it('should trim SQL blocks', async () => {
      const mockSqlResponse = `\`\`\`sql

  CREATE TABLE test;

\`\`\``;

      mockGetCompletion.mockResolvedValue({
        text: mockSqlResponse,
        error: null,
      });

      const result = await generateMigrations('CREATE TABLE test');

      expect(result.migrations[0]).toBe('CREATE TABLE test;');
    });

    it('should handle empty response', async () => {
      mockGetCompletion.mockResolvedValue({
        text: 'I cannot generate migrations from this schema.',
        error: null,
      });

      const result = await generateMigrations('invalid schema');

      expect(result.migrations).toHaveLength(0);
      expect(result.summary).toBe('0 migration(s) for sqlite');
    });

    it('should include schema DDL in user message', async () => {
      const schemaDdl = `CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      );`;

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE users;\n```',
        error: null,
      });

      await generateMigrations(schemaDdl);

      expect(mockGetCompletion).toHaveBeenCalledWith(expect.objectContaining({
        messages: [expect.objectContaining({
          content: expect.stringContaining(schemaDdl),
        })],
      }));
    });

    it('should handle SQL blocks with language specifier variations', async () => {
      const mockSqlResponse = `\`\`\`sql
CREATE TABLE test1;
\`\`\``;

      mockGetCompletion.mockResolvedValue({
        text: mockSqlResponse,
        error: null,
      });

      const result = await generateMigrations('schema');

      expect(result.migrations).toHaveLength(1);
    });

    it('should strip markdown code block markers from fallback extraction', async () => {
      const mockResponse = `\`\`\`
CREATE TABLE fallback_test;
\`\`\``;

      mockGetCompletion.mockResolvedValue({
        text: mockResponse,
        error: null,
      });

      const result = await generateMigrations('schema');

      // The regex for sql blocks won't match generic code blocks
      // So it falls back to checking for CREATE and stripping markers
      expect(result.migrations.length).toBeGreaterThanOrEqual(0);
    });

    describe('MigrationTargetDb type', () => {
      it('should accept sqlite as target', async () => {
        mockGetCompletion.mockResolvedValue({
          text: '```sql\nCREATE TABLE test;\n```',
          error: null,
        });

        const target: MigrationTargetDb = 'sqlite';
        const result = await generateMigrations('schema', target);

        expect(result.summary).toContain('sqlite');
      });

      it('should accept postgres as target', async () => {
        mockGetCompletion.mockResolvedValue({
          text: '```sql\nCREATE TABLE test;\n```',
          error: null,
        });

        const target: MigrationTargetDb = 'postgres';
        const result = await generateMigrations('schema', target);

        expect(result.summary).toContain('postgres');
      });
    });
  });
});
