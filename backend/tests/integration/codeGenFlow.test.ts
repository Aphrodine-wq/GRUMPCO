import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import { PassThrough } from 'stream';

const request = supertest as unknown as (app: any) => any;

// Set up environment
process.env.ANTHROPIC_API_KEY = 'test_api_key_for_testing';
process.env.NODE_ENV = 'test';
process.env.CSRF_PROTECTION = 'false'; // Disable CSRF for tests
process.env.REQUIRE_AUTH_FOR_API = 'false'; // Disable auth requirement for tests

// Mock dependencies
vi.mock('../../src/services/claudeCodeService.ts', () => ({
  generateCodeFromDiagram: vi.fn(),
}));

vi.mock('../../src/services/projectTemplates.ts', () => ({
  getBaseTemplate: vi.fn(),
  getPackageJson: vi.fn(),
}));

vi.mock('../../src/services/zipService.ts', () => ({
  createProjectZip: vi.fn(),
}));

// Import after mocks
const { default: app, appReady } = await import('../../src/index.ts');
const claudeCodeService = await import('../../src/services/claudeCodeService.ts');
const projectTemplates = await import('../../src/services/projectTemplates.ts');
const zipService = await import('../../src/services/zipService.ts');

function createMockZipStream(): PassThrough {
  const stream = new PassThrough();
  setImmediate(() => stream.end('zip'));
  return stream;
}

describe('Code Generation Flow Integration', () => {
  beforeAll(async () => {
    await appReady;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/generate-code', () => {
    it('should generate code project through full flow', async () => {
      const mockAiFiles = [
        { path: 'src/controllers/userController.js', content: '// User controller' },
        { path: 'src/models/user.js', content: '// User model' },
      ];

      const mockBaseFiles = [
        { path: '.gitignore', content: 'node_modules/' },
        { path: '.env.example', content: 'DATABASE_URL=' },
      ];

      const mockPackageJson = {
        path: 'package.json',
        content: JSON.stringify({ name: 'test-project', version: '1.0.0' }),
      };

      const mockZipStream = createMockZipStream();

      vi.mocked(claudeCodeService.generateCodeFromDiagram).mockResolvedValue({
        files: mockAiFiles,
        warnings: [],
      });

      vi.mocked(projectTemplates.getBaseTemplate).mockReturnValue(mockBaseFiles);
      vi.mocked(projectTemplates.getPackageJson).mockReturnValue(mockPackageJson);
      vi.mocked(zipService.createProjectZip).mockReturnValue(mockZipStream as never);

      const response = await request(app)
        .post('/api/generate-code')
        .send({
          diagramType: 'er',
          mermaidCode: 'erDiagram\n  User ||--o{ Order : places',
          techStack: 'react-express-prisma',
          projectName: 'test-project',
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/zip');
      expect(response.headers['content-disposition']).toContain('test-project.zip');
      expect(claudeCodeService.generateCodeFromDiagram).toHaveBeenCalledWith(
        'er',
        'erDiagram\n  User ||--o{ Order : places',
        'react-express-prisma'
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/generate-code')
        .send({
          diagramType: 'er',
          // Missing mermaidCode and techStack
        })
        .expect(400);

      expect(response.body.type).toBe('validation_error');
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should validate tech stack', async () => {
      const response = await request(app)
        .post('/api/generate-code')
        .send({
          diagramType: 'er',
          mermaidCode: 'erDiagram\n  User',
          techStack: 'invalid-stack',
        })
        .expect(400);

      expect(response.body.type).toBe('validation_error');
      expect(response.body.error).toContain('Invalid techStack');
    });

    it('should validate diagram type', async () => {
      const response = await request(app)
        .post('/api/generate-code')
        .send({
          diagramType: 'invalid-type',
          mermaidCode: 'test',
          techStack: 'react-express-prisma',
        })
        .expect(400);

      expect(response.body.type).toBe('validation_error');
      expect(response.body.error).toContain('Invalid diagramType');
    });

    it('should sanitize project name', async () => {
      const mockZipStream = createMockZipStream();

      vi.mocked(claudeCodeService.generateCodeFromDiagram).mockResolvedValue({
        files: [],
        warnings: [],
      });
      vi.mocked(projectTemplates.getBaseTemplate).mockReturnValue([]);
      vi.mocked(projectTemplates.getPackageJson).mockReturnValue({
        path: 'package.json',
        content: '{}',
      });
      vi.mocked(zipService.createProjectZip).mockReturnValue(mockZipStream as never);

      await request(app)
        .post('/api/generate-code')
        .send({
          diagramType: 'er',
          mermaidCode: 'erDiagram',
          techStack: 'react-express-prisma',
          projectName: 'My Project Name!!!',
        })
        .expect(200);

      const zipCall = vi.mocked(zipService.createProjectZip).mock.calls[0];
      // Project name should be sanitized
      expect(zipCall[1]).toMatch(/^[a-z0-9-]+$/);
    });

    it('should handle code generation errors', async () => {
      vi.mocked(claudeCodeService.generateCodeFromDiagram).mockRejectedValue(
        new Error('Code generation failed')
      );

      const response = await request(app)
        .post('/api/generate-code')
        .send({
          diagramType: 'er',
          mermaidCode: 'erDiagram\n  User',
          techStack: 'react-express-prisma',
        })
        .expect(500);

      expect(response.body.type).toBe('internal_error');
    });

    it('should work with different tech stacks', async () => {
      const stacks = ['react-express-prisma', 'fastapi-sqlalchemy', 'nextjs-prisma'] as const;

      for (const stack of stacks) {
        vi.clearAllMocks();

        const mockZipStream = createMockZipStream();

        vi.mocked(claudeCodeService.generateCodeFromDiagram).mockResolvedValue({
          files: [],
          warnings: [],
        });
        vi.mocked(projectTemplates.getBaseTemplate).mockReturnValue([]);
        vi.mocked(projectTemplates.getPackageJson).mockReturnValue({
          path: 'package.json',
          content: '{}',
        });
        vi.mocked(zipService.createProjectZip).mockReturnValue(mockZipStream as never);

        await request(app)
          .post('/api/generate-code')
          .send({
            diagramType: 'er',
            mermaidCode: 'erDiagram\n  User',
            techStack: stack,
          })
          .expect(200);

        expect(claudeCodeService.generateCodeFromDiagram).toHaveBeenCalledWith(
          'er',
          'erDiagram\n  User',
          stack
        );
      }
    });
  });
});
