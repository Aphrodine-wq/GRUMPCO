/**
 * DB Schema Service Unit Tests
 * 
 * Tests the database schema generation from descriptions and architecture metadata.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ArchitectureMetadata, DataModel, Component } from '../../src/types/architecture.js';

// Mock dependencies before imports
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGetCompletion = vi.fn();
vi.mock('../../src/services/llmGatewayHelper.js', () => ({
  getCompletion: (...args: unknown[]) => mockGetCompletion(...args),
}));

describe('dbSchemaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCompletion.mockReset();
  });

  describe('generateSchemaFromDescription', () => {
    it('should generate SQL DDL from a text description', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      const mockSqlResponse = `Here is the schema:
\`\`\`sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT
);
\`\`\``;

      mockGetCompletion.mockResolvedValue({
        text: mockSqlResponse,
      });

      const result = await generateSchemaFromDescription('A blog with users and posts');

      expect(mockGetCompletion).toHaveBeenCalledTimes(1);
      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: expect.stringContaining('database schema expert'),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('A blog with users and posts'),
            }),
          ]),
        })
      );

      expect(result.ddl).toContain('CREATE TABLE users');
      expect(result.ddl).toContain('CREATE TABLE posts');
      expect(result.tables).toContain('users');
      expect(result.tables).toContain('posts');
      expect(result.drizzle).toBeUndefined();
    });

    it('should use default targetDb (sqlite) and format (sql) when not specified', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE test (id INTEGER PRIMARY KEY);\n```',
      });

      await generateSchemaFromDescription('A simple table');

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Target DB: sqlite'),
            }),
          ]),
        })
      );
    });

    it('should respect custom targetDb option', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE test (id SERIAL PRIMARY KEY);\n```',
      });

      await generateSchemaFromDescription('A test table', { targetDb: 'postgres' });

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Target DB: postgres'),
            }),
          ]),
        })
      );
    });

    it('should respect mysql targetDb option', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE test (id INT AUTO_INCREMENT PRIMARY KEY);\n```',
      });

      await generateSchemaFromDescription('A test table', { targetDb: 'mysql' });

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Target DB: mysql'),
            }),
          ]),
        })
      );
    });

    it('should generate Drizzle schema when format is drizzle', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      const mockResponse = `Here is the schema:
\`\`\`sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
\`\`\`

\`\`\`ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});
\`\`\``;

      mockGetCompletion.mockResolvedValue({
        text: mockResponse,
      });

      const result = await generateSchemaFromDescription('Users table', { format: 'drizzle' });

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Format: drizzle'),
            }),
          ]),
        })
      );

      expect(result.ddl).toContain('CREATE TABLE users');
      expect(result.drizzle).toContain('sqliteTable');
      expect(result.drizzle).toContain('drizzle-orm');
      expect(result.tables).toContain('users');
    });

    it('should parse TypeScript code blocks for Drizzle schema', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      const mockResponse = `\`\`\`sql
CREATE TABLE items (id INTEGER PRIMARY KEY);
\`\`\`

\`\`\`typescript
export const items = sqliteTable('items', { id: integer('id') });
\`\`\``;

      mockGetCompletion.mockResolvedValue({
        text: mockResponse,
      });

      const result = await generateSchemaFromDescription('Items', { format: 'drizzle' });

      expect(result.drizzle).toContain("export const items = sqliteTable('items'");
    });

    it('should handle LLM error response', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: '',
        error: 'Rate limit exceeded',
      });

      const result = await generateSchemaFromDescription('Some schema');

      expect(result.ddl).toContain('-- Error: Rate limit exceeded');
      expect(result.tables).toEqual([]);
    });

    it('should handle exception thrown by getCompletion', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockRejectedValue(new Error('Network failure'));

      const result = await generateSchemaFromDescription('A schema');

      expect(result.ddl).toContain('-- Error: Network failure');
      expect(result.tables).toEqual([]);
    });

    it('should handle response with no SQL code block', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: 'I cannot generate the schema for you.',
      });

      const result = await generateSchemaFromDescription('Unclear description');

      expect(result.ddl).toBe('');
      expect(result.tables).toEqual([]);
    });

    it('should extract multiple table names from DDL', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      const mockSql = `\`\`\`sql
CREATE TABLE users (id INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY);
CREATE TABLE "products" (id INTEGER PRIMARY KEY);
CREATE TABLE 'categories' (id INTEGER PRIMARY KEY);
\`\`\``;

      mockGetCompletion.mockResolvedValue({
        text: mockSql,
      });

      const result = await generateSchemaFromDescription('E-commerce schema');

      expect(result.tables).toContain('users');
      expect(result.tables).toContain('orders');
      expect(result.tables).toContain('products');
      expect(result.tables).toContain('categories');
    });

    it('should handle empty description', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: '```sql\n-- No schema to generate\n```',
      });

      const result = await generateSchemaFromDescription('');

      expect(mockGetCompletion).toHaveBeenCalled();
      expect(result.ddl).toBe('-- No schema to generate');
    });

    it('should handle complex multi-table schema with relationships', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      const mockSql = `\`\`\`sql
CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  manager_id INTEGER REFERENCES employees(id)
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  lead_id INTEGER REFERENCES employees(id)
);

CREATE TABLE employee_projects (
  employee_id INTEGER REFERENCES employees(id),
  project_id INTEGER REFERENCES projects(id),
  PRIMARY KEY (employee_id, project_id)
);
\`\`\``;

      mockGetCompletion.mockResolvedValue({
        text: mockSql,
      });

      const result = await generateSchemaFromDescription('HR system with departments, employees, and projects');

      expect(result.tables).toHaveLength(4);
      expect(result.tables).toContain('departments');
      expect(result.tables).toContain('employees');
      expect(result.tables).toContain('projects');
      expect(result.tables).toContain('employee_projects');
    });
  });

  describe('generateSchemaFromArchitecture', () => {
    it('should generate schema from ArchitectureMetadata object with dataModels', async () => {
      const { generateSchemaFromArchitecture } = await import('../../src/services/dbSchemaService.js');
      
      const architecture: ArchitectureMetadata = {
        components: [],
        integrations: [],
        dataModels: [
          {
            id: '1',
            name: 'User',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'email', type: 'string', required: true },
              { name: 'name', type: 'string', required: false },
            ],
            relationships: [
              { field: 'posts', references: 'Post', type: 'one-to-many' },
            ],
          },
          {
            id: '2',
            name: 'Post',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'title', type: 'string', required: true },
              { name: 'user_id', type: 'integer', required: true },
            ],
          },
        ],
        apiEndpoints: [],
        technologies: {},
      };

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE User (id INTEGER, email TEXT NOT NULL);\nCREATE TABLE Post (id INTEGER, title TEXT NOT NULL);\n```',
      });

      const result = await generateSchemaFromArchitecture(architecture);

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Table User'),
            }),
          ]),
        })
      );
      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Table Post'),
            }),
          ]),
        })
      );

      expect(result.tables).toContain('User');
      expect(result.tables).toContain('Post');
    });

    it('should include relationship info in the description', async () => {
      const { generateSchemaFromArchitecture } = await import('../../src/services/dbSchemaService.js');
      
      const architecture: ArchitectureMetadata = {
        components: [],
        integrations: [],
        dataModels: [
          {
            id: '1',
            name: 'Order',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'customer_id', type: 'integer', required: true },
            ],
            relationships: [
              { field: 'customer_id', references: 'Customer', type: 'many-to-many' },
            ],
          },
        ],
        apiEndpoints: [],
        technologies: {},
      };

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE Order (id INTEGER PRIMARY KEY);\n```',
      });

      await generateSchemaFromArchitecture(architecture);

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Relations: customer_id -> Customer (many-to-many)'),
            }),
          ]),
        })
      );
    });

    it('should handle architecture with empty dataModels by using components', async () => {
      const { generateSchemaFromArchitecture } = await import('../../src/services/dbSchemaService.js');
      
      const architecture: ArchitectureMetadata = {
        components: [
          { id: '1', name: 'AuthService', description: 'Auth', type: 'backend' },
          { id: '2', name: 'UserService', description: 'Users', type: 'backend' },
        ],
        integrations: [],
        dataModels: [],
        apiEndpoints: [],
        technologies: {},
      };

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE auth (id INTEGER PRIMARY KEY);\n```',
      });

      await generateSchemaFromArchitecture(architecture);

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Components: AuthService, UserService'),
            }),
          ]),
        })
      );
    });

    it('should parse JSON string and call recursively', async () => {
      const { generateSchemaFromArchitecture } = await import('../../src/services/dbSchemaService.js');
      
      const architectureJson = JSON.stringify({
        components: [],
        integrations: [],
        dataModels: [
          {
            id: '1',
            name: 'Product',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'name', type: 'string', required: true },
            ],
          },
        ],
        apiEndpoints: [],
        technologies: {},
      });

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE Product (id INTEGER PRIMARY KEY);\n```',
      });

      const result = await generateSchemaFromArchitecture(architectureJson);

      expect(result.tables).toContain('Product');
    });

    it('should fallback to description parsing for invalid JSON string', async () => {
      const { generateSchemaFromArchitecture } = await import('../../src/services/dbSchemaService.js');
      
      const invalidJson = 'This is not JSON, just a plain text description of a database schema';

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE something (id INTEGER PRIMARY KEY);\n```',
      });

      const result = await generateSchemaFromArchitecture(invalidJson);

      // Should call getCompletion with the text as description
      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('This is not JSON'),
            }),
          ]),
        })
      );

      expect(result.tables).toContain('something');
    });

    it('should handle dataModels without relationships', async () => {
      const { generateSchemaFromArchitecture } = await import('../../src/services/dbSchemaService.js');
      
      const architecture: ArchitectureMetadata = {
        components: [],
        integrations: [],
        dataModels: [
          {
            id: '1',
            name: 'Config',
            fields: [
              { name: 'key', type: 'string', required: true },
              { name: 'value', type: 'string', required: false },
            ],
            // No relationships
          },
        ],
        apiEndpoints: [],
        technologies: {},
      };

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE Config (key TEXT PRIMARY KEY, value TEXT);\n```',
      });

      const result = await generateSchemaFromArchitecture(architecture);

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.not.stringContaining('Relations:'),
            }),
          ]),
        })
      );

      expect(result.tables).toContain('Config');
    });

    it('should handle architecture with undefined dataModels', async () => {
      const { generateSchemaFromArchitecture } = await import('../../src/services/dbSchemaService.js');
      
      const architecture: ArchitectureMetadata = {
        components: [
          { id: '1', name: 'API', description: 'Main API', type: 'backend' as const },
        ],
        integrations: [],
        dataModels: [], // Empty array instead of undefined
        apiEndpoints: [],
        technologies: {},
      };

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE api_logs (id INTEGER PRIMARY KEY);\n```',
      });

      const result = await generateSchemaFromArchitecture(architecture);

      expect(result.tables).toContain('api_logs');
    });

    it('should handle multiple dataModels with complex relationships', async () => {
      const { generateSchemaFromArchitecture } = await import('../../src/services/dbSchemaService.js');
      
      const architecture: ArchitectureMetadata = {
        components: [],
        integrations: [],
        dataModels: [
          {
            id: '1',
            name: 'Author',
            fields: [
              { name: 'id', type: 'uuid', required: true },
              { name: 'name', type: 'string', required: true },
            ],
            relationships: [
              { field: 'books', references: 'Book', type: 'one-to-many' },
            ],
          },
          {
            id: '2',
            name: 'Book',
            fields: [
              { name: 'id', type: 'uuid', required: true },
              { name: 'title', type: 'string', required: true },
              { name: 'author_id', type: 'uuid', required: true },
            ],
            relationships: [
              { field: 'author_id', references: 'Author', type: 'one-to-one' },
              { field: 'categories', references: 'Category', type: 'many-to-many' },
            ],
          },
          {
            id: '3',
            name: 'Category',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'name', type: 'string', required: true },
            ],
          },
        ],
        apiEndpoints: [],
        technologies: {},
      };

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE Author (id TEXT PRIMARY KEY);\nCREATE TABLE Book (id TEXT PRIMARY KEY);\nCREATE TABLE Category (id INTEGER PRIMARY KEY);\n```',
      });

      const result = await generateSchemaFromArchitecture(architecture);

      expect(result.tables).toHaveLength(3);
      expect(result.tables).toContain('Author');
      expect(result.tables).toContain('Book');
      expect(result.tables).toContain('Category');
    });

    it('should correctly format field types and required constraints', async () => {
      const { generateSchemaFromArchitecture } = await import('../../src/services/dbSchemaService.js');
      
      const architecture: ArchitectureMetadata = {
        components: [],
        integrations: [],
        dataModels: [
          {
            id: '1',
            name: 'TestModel',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'optional_field', type: 'string', required: false },
              { name: 'required_field', type: 'text', required: true },
            ],
          },
        ],
        apiEndpoints: [],
        technologies: {},
      };

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE TestModel (id INTEGER PRIMARY KEY);\n```',
      });

      await generateSchemaFromArchitecture(architecture);

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('id integer NOT NULL'),
            }),
          ]),
        })
      );

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('required_field text NOT NULL'),
            }),
          ]),
        })
      );

      // Optional field should not have NOT NULL
      const call = mockGetCompletion.mock.calls[0];
      const messageContent = call[0].messages[0].content;
      expect(messageContent).toContain('optional_field string');
      expect(messageContent).not.toContain('optional_field string NOT NULL');
    });
  });

  describe('Type Exports', () => {
    it('should export SchemaTargetDb type correctly', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE test (id INTEGER);\n```',
      });

      // Test each valid targetDb value
      const targets: Array<'sqlite' | 'postgres' | 'mysql'> = ['sqlite', 'postgres', 'mysql'];
      for (const targetDb of targets) {
        await generateSchemaFromDescription('test', { targetDb });
        expect(mockGetCompletion).toHaveBeenCalled();
      }
    });

    it('should export SchemaFormat type correctly', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE test (id INTEGER);\n```',
      });

      // Test each valid format value
      const formats: Array<'sql' | 'drizzle'> = ['sql', 'drizzle'];
      for (const format of formats) {
        await generateSchemaFromDescription('test', { format });
        expect(mockGetCompletion).toHaveBeenCalled();
      }
    });
  });

  describe('GenerateSchemaResult interface', () => {
    it('should return correct structure with all fields', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: `\`\`\`sql
CREATE TABLE users (id INTEGER PRIMARY KEY);
\`\`\`

\`\`\`ts
export const users = sqliteTable('users', {});
\`\`\``,
      });

      const result = await generateSchemaFromDescription('users table', { format: 'drizzle' });

      expect(result).toHaveProperty('ddl');
      expect(result).toHaveProperty('drizzle');
      expect(result).toHaveProperty('tables');
      expect(typeof result.ddl).toBe('string');
      expect(typeof result.drizzle).toBe('string');
      expect(Array.isArray(result.tables)).toBe(true);
    });

    it('should return drizzle as undefined when format is sql', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE test (id INTEGER PRIMARY KEY);\n```',
      });

      const result = await generateSchemaFromDescription('test', { format: 'sql' });

      expect(result.drizzle).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle response with only whitespace in code block', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: '```sql\n   \n```',
      });

      const result = await generateSchemaFromDescription('empty schema');

      expect(result.ddl).toBe('');
      expect(result.tables).toEqual([]);
    });

    it('should handle SQL with mixed case CREATE TABLE statements', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: `\`\`\`sql
create table lowercase_table (id INTEGER);
CREATE TABLE uppercase_table (id INTEGER);
Create Table mixedcase_table (id INTEGER);
\`\`\``,
      });

      const result = await generateSchemaFromDescription('mixed case');

      expect(result.tables).toContain('lowercase_table');
      expect(result.tables).toContain('uppercase_table');
      expect(result.tables).toContain('mixedcase_table');
    });

    it('should handle very long descriptions', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      const longDescription = 'A '.repeat(10000) + 'very long description';

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE long_desc_table (id INTEGER);\n```',
      });

      const result = await generateSchemaFromDescription(longDescription);

      expect(mockGetCompletion).toHaveBeenCalled();
      expect(result.tables).toContain('long_desc_table');
    });

    it('should handle special characters in description', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      const specialDescription = "Schema with 'quotes', \"double quotes\", `backticks`, and $pecial ch@racters!";

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE special_table (id INTEGER);\n```',
      });

      const result = await generateSchemaFromDescription(specialDescription);

      expect(mockGetCompletion).toHaveBeenCalled();
      expect(result.tables).toContain('special_table');
    });

    it('should handle response with multiple SQL code blocks (use first)', async () => {
      const { generateSchemaFromDescription } = await import('../../src/services/dbSchemaService.js');
      
      mockGetCompletion.mockResolvedValue({
        text: `\`\`\`sql
CREATE TABLE first_table (id INTEGER);
\`\`\`

Here's another version:

\`\`\`sql
CREATE TABLE second_table (id INTEGER);
\`\`\``,
      });

      const result = await generateSchemaFromDescription('multiple blocks');

      // Should extract from the first SQL block
      expect(result.ddl).toContain('CREATE TABLE first_table');
      expect(result.tables).toContain('first_table');
    });

    it('should handle architecture string that is JSON but missing dataModels key', async () => {
      const { generateSchemaFromArchitecture } = await import('../../src/services/dbSchemaService.js');
      
      const jsonWithoutDataModels = JSON.stringify({
        components: [
          { id: '1', name: 'Service', description: 'A service', type: 'backend' },
        ],
        integrations: [],
        apiEndpoints: [],
        technologies: {},
      });

      mockGetCompletion.mockResolvedValue({
        text: '```sql\nCREATE TABLE service_data (id INTEGER);\n```',
      });

      const result = await generateSchemaFromArchitecture(jsonWithoutDataModels);

      // Should use components fallback
      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Components: Service'),
            }),
          ]),
        })
      );

      expect(result.tables).toContain('service_data');
    });
  });
});
