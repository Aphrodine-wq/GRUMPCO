import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateProjectZip } from '../../src/services/codeGeneratorService.ts';
import * as claudeCodeService from '../../src/services/claudeCodeService.ts';
import * as projectTemplates from '../../src/services/projectTemplates.ts';
import * as zipService from '../../src/services/zipService.ts';

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

vi.mock('../../src/middleware/logger.ts', () => ({
  getRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('codeGeneratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateProjectZip', () => {
    it('should generate ZIP from diagram code', async () => {
      const mockAiFiles = [
        { path: 'src/controller.js', content: '// Controller code' },
        { path: 'src/model.js', content: '// Model code' },
      ];

      const mockBaseFiles = [
        { path: '.gitignore', content: 'node_modules/' },
        { path: '.env.example', content: 'DATABASE_URL=' },
      ];

      const mockPackageJson = { path: 'package.json', content: '{"name": "test"}' };
      const mockZipStream = { pipe: vi.fn() };

      vi.mocked(claudeCodeService.generateCodeFromDiagram).mockResolvedValue({
        files: mockAiFiles,
        warnings: [],
      });
      vi.mocked(projectTemplates.getBaseTemplate).mockReturnValue(mockBaseFiles);
      vi.mocked(projectTemplates.getPackageJson).mockReturnValue(mockPackageJson);
      vi.mocked(zipService.createProjectZip).mockReturnValue(mockZipStream as never);

      const result = await generateProjectZip({
        diagramType: 'er',
        mermaidCode: 'erDiagram\n  User ||--o{ Order : places',
        techStack: 'react-express-prisma',
        projectName: 'test-project',
      });

      expect(claudeCodeService.generateCodeFromDiagram).toHaveBeenCalledWith(
        'er',
        'erDiagram\n  User ||--o{ Order : places',
        'react-express-prisma'
      );
      expect(projectTemplates.getBaseTemplate).toHaveBeenCalledWith('react-express-prisma');
      expect(zipService.createProjectZip).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should merge AI files with base template', async () => {
      const mockAiFiles = [
        { path: 'src/controller.js', content: '// Controller' },
      ];

      const mockBaseFiles = [
        { path: '.gitignore', content: 'node_modules/' },
      ];

      vi.mocked(claudeCodeService.generateCodeFromDiagram).mockResolvedValue({
        files: mockAiFiles,
        warnings: [],
      });
      vi.mocked(projectTemplates.getBaseTemplate).mockReturnValue(mockBaseFiles);
      vi.mocked(projectTemplates.getPackageJson).mockReturnValue({
        path: 'package.json',
        content: '{}',
      });
      vi.mocked(zipService.createProjectZip).mockReturnValue({ pipe: vi.fn() } as never);

      await generateProjectZip({
        diagramType: 'flowchart',
        mermaidCode: 'flowchart TD\n  A --> B',
        techStack: 'react-express-prisma',
      });

      const zipCall = vi.mocked(zipService.createProjectZip).mock.calls[0][0];
      // Should include both AI files and base files
      expect(zipCall.length).toBeGreaterThan(mockAiFiles.length);
      expect(zipCall.some((f: { path: string }) => f.path === 'src/controller.js')).toBe(true);
      expect(zipCall.some((f: { path: string }) => f.path === '.gitignore')).toBe(true);
    });

    it('should handle different tech stacks', async () => {
      const stacks = ['react-express-prisma', 'fastapi-sqlalchemy', 'nextjs-prisma'] as const;

      for (const stack of stacks) {
        vi.mocked(claudeCodeService.generateCodeFromDiagram).mockResolvedValue({
          files: [],
          warnings: [],
        });
        vi.mocked(projectTemplates.getBaseTemplate).mockReturnValue([]);
        vi.mocked(projectTemplates.getPackageJson).mockReturnValue({
          path: 'package.json',
          content: '{}',
        });
        vi.mocked(zipService.createProjectZip).mockReturnValue({ pipe: vi.fn() } as never);

        await generateProjectZip({
          diagramType: 'er',
          mermaidCode: 'erDiagram\n  User',
          techStack: stack,
        });

        expect(claudeCodeService.generateCodeFromDiagram).toHaveBeenCalledWith(
          'er',
          'erDiagram\n  User',
          stack
        );
      }
    });

    it('should sanitize project name', async () => {
      vi.mocked(claudeCodeService.generateCodeFromDiagram).mockResolvedValue({
        files: [],
        warnings: [],
      });
      vi.mocked(projectTemplates.getBaseTemplate).mockReturnValue([]);
      vi.mocked(projectTemplates.getPackageJson).mockReturnValue({
        path: 'package.json',
        content: '{}',
      });
      vi.mocked(zipService.createProjectZip).mockReturnValue({ pipe: vi.fn() } as never);

      await generateProjectZip({
        diagramType: 'er',
        mermaidCode: 'erDiagram',
        techStack: 'react-express-prisma',
        projectName: 'My Project Name!!!',
      });

      const zipCall = vi.mocked(zipService.createProjectZip).mock.calls[0];
      // Project name should be sanitized
      expect(zipCall[1]).toMatch(/^[a-z0-9-]+$/);
    });
  });
});
