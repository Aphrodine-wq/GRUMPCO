/**
 * Tests for codeGeneration
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectDiagramType,
  downloadCodegenZip,
  generateCode,
  type CodeGenRequest,
  type TechStack,
  type DiagramType,
} from './codeGeneration';

// Mock the api module
vi.mock('./api.js', () => ({
  fetchApi: vi.fn(),
}));

import { fetchApi } from './api.js';

const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

describe('codeGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectDiagramType', () => {
    it('should detect ER diagram', () => {
      const result = detectDiagramType('erDiagram\nUser ||--o{ Order : places');
      expect(result).toBe('er');
    });

    it('should detect sequence diagram', () => {
      const result = detectDiagramType('sequenceDiagram\nAlice->>Bob: Hello');
      expect(result).toBe('sequence');
    });

    it('should detect class diagram', () => {
      const result = detectDiagramType('classDiagram\nclass User');
      expect(result).toBe('class');
    });

    it('should default to flowchart for unknown types', () => {
      const result = detectDiagramType('graph TD\nA-->B');
      expect(result).toBe('flowchart');
    });

    it('should be case insensitive', () => {
      const result = detectDiagramType('ERDIAGRAM\nUser ||--o{ Order');
      expect(result).toBe('er');
    });

    it('should handle whitespace', () => {
      const result = detectDiagramType('  erDiagram\nUser ||--o{ Order');
      expect(result).toBe('er');
    });
  });

  describe('downloadCodegenZip', () => {
    it('should download zip file successfully', async () => {
      const mockBlob = new Blob(['zip content'], { type: 'application/zip' });
      mockFetchApi.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: {
          get: (name: string) =>
            name === 'Content-Disposition' ? 'attachment; filename="project.zip"' : null,
        },
      });

      const createElementSpy = vi.spyOn(document, 'createElement');

      await downloadCodegenZip('session-123');

      expect(mockFetchApi).toHaveBeenCalledWith('/api/codegen/download/session-123');
      expect(createElementSpy).toHaveBeenCalledWith('a');

      createElementSpy.mockRestore();
    });

    it('should handle API error', async () => {
      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Session not found' }),
      });

      await expect(downloadCodegenZip('invalid-session')).rejects.toThrow('Session not found');
    });

    it('should handle missing Content-Disposition header', async () => {
      const mockBlob = new Blob(['zip content'], { type: 'application/zip' });
      mockFetchApi.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: {
          get: () => null,
        },
      });

      const createElementSpy = vi.spyOn(document, 'createElement');

      await downloadCodegenZip('session-123');

      expect(createElementSpy).toHaveBeenCalled();

      createElementSpy.mockRestore();
    });

    it('should handle RFC 5987 encoded filename', async () => {
      const mockBlob = new Blob(['zip content'], { type: 'application/zip' });
      mockFetchApi.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: {
          get: (name: string) =>
            name === 'Content-Disposition'
              ? "attachment; filename*=UTF-8''my-encoded-project.zip"
              : null,
        },
      });

      const createElementSpy = vi.spyOn(document, 'createElement');

      await downloadCodegenZip('session-123');

      expect(createElementSpy).toHaveBeenCalled();

      createElementSpy.mockRestore();
    });

    it('should return default filename when Content-Disposition has no filename', async () => {
      const mockBlob = new Blob(['zip content'], { type: 'application/zip' });
      mockFetchApi.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: {
          get: (name: string) => (name === 'Content-Disposition' ? 'attachment' : null),
        },
      });

      const createElementSpy = vi.spyOn(document, 'createElement');

      await downloadCodegenZip('session-123');

      expect(createElementSpy).toHaveBeenCalled();

      createElementSpy.mockRestore();
    });
  });

  describe('generateCode', () => {
    it('should generate code successfully', async () => {
      const mockBlob = new Blob(['generated code'], { type: 'application/zip' });
      mockFetchApi.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const request: CodeGenRequest = {
        diagramType: 'flowchart',
        mermaidCode: 'graph TD\nA-->B',
        techStack: 'react-express-prisma',
        projectName: 'my-project',
      };

      const result = await generateCode(request);

      expect(result).toBe(true);
      expect(mockFetchApi).toHaveBeenCalledWith('/api/generate-code', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    });

    it('should handle API error and return false', async () => {
      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const request: CodeGenRequest = {
        diagramType: 'flowchart',
        mermaidCode: 'graph TD\nA-->B',
        techStack: 'react-express-prisma',
      };

      const result = await generateCode(request);

      expect(result).toBe(false);
    });

    it('should handle network error and return false', async () => {
      mockFetchApi.mockRejectedValue(new Error('Network error'));

      const request: CodeGenRequest = {
        diagramType: 'flowchart',
        mermaidCode: 'graph TD\nA-->B',
        techStack: 'react-express-prisma',
      };

      const result = await generateCode(request);

      expect(result).toBe(false);
    });

    it('should work without project name', async () => {
      const mockBlob = new Blob(['generated code'], { type: 'application/zip' });
      mockFetchApi.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const request: CodeGenRequest = {
        diagramType: 'er',
        mermaidCode: 'erDiagram\nUser ||--o{ Order',
        techStack: 'fastapi-sqlalchemy',
      };

      const result = await generateCode(request);

      expect(result).toBe(true);
    });
  });

  describe('types', () => {
    it('should have valid TechStack values', () => {
      const validStacks: TechStack[] = [
        'react-express-prisma',
        'fastapi-sqlalchemy',
        'nextjs-prisma',
      ];

      expect(validStacks).toHaveLength(3);
    });

    it('should have valid DiagramType values', () => {
      const validTypes: DiagramType[] = ['er', 'sequence', 'flowchart', 'class'];

      expect(validTypes).toHaveLength(4);
    });
  });
});
