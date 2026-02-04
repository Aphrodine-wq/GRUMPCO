/**
 * Codebase Analysis Service Unit Tests
 *
 * Tests for codebase analysis, architecture diagram generation, dependency analysis,
 * metrics calculation, and code smell detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics
vi.mock('../../src/middleware/metrics.js', () => ({
  recordLlmStreamMetrics: vi.fn(),
}));

// Mock nim config
vi.mock('../../src/config/nim.js', () => ({
  getNimChatUrl: vi.fn(() => 'https://api.nim.nvidia.com/v1/chat/completions'),
}));

// Mock ai-core
vi.mock('@grump/ai-core', () => ({
  getStreamProvider: vi.fn(() => null),
  registerStreamProvider: vi.fn(),
}));

// Mock fs module
vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Helper to create mock Dirent objects
const createMockDirent = (name: string, isDir: boolean) => ({
  name,
  isDirectory: () => isDir,
  isFile: () => !isDir,
  isBlockDevice: () => false,
  isCharacterDevice: () => false,
  isSymbolicLink: () => false,
  isFIFO: () => false,
  isSocket: () => false,
  path: '',
  parentPath: '',
});

// Helper to create mock LLM stream
const createMockStream = (content: string) => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: {"choices":[{"delta":{"content":${JSON.stringify(content)}}}]}\n\n`
        )
      );
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
};

describe('Codebase Analysis Service', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    vi.mocked(fs.readdirSync).mockReset();
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.statSync).mockReset();
    vi.mocked(fs.existsSync).mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('analyzeCodebase', () => {
    it('should analyze a TypeScript project', async () => {
      // Setup mocks
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [
            createMockDirent('src', true),
            createMockDirent('package.json', false),
            createMockDirent('tsconfig.json', false),
          ];
        }
        if (dirStr.includes('src')) {
          return [
            createMockDirent('index.ts', false),
            createMockDirent('utils.ts', false),
          ];
        }
        return [];
      });

      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 500 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        if (filePath.includes('package.json')) {
          return JSON.stringify({
            name: 'test-project',
            version: '1.0.0',
            dependencies: { express: '^4.18.0', lodash: '^4.17.21' },
            devDependencies: { vitest: '^0.34.0', typescript: '^5.0.0' },
          });
        }
        return 'const x = 1;\nexport default x;\n';
      });

      const mockResponse = `\`\`\`json
{
  "summary": "A TypeScript backend project using Express",
  "projectType": "Backend API",
  "techStack": [
    {"category": "framework", "name": "Express", "version": "4.18.0"},
    {"category": "language", "name": "TypeScript", "version": "5.0.0"}
  ],
  "architecture": {
    "pattern": "layered",
    "confidence": 0.8,
    "indicators": ["src folder structure", "separate routes and services"]
  },
  "components": [
    {"name": "API Routes", "type": "backend", "path": "/src", "description": "HTTP endpoints"}
  ],
  "entryPoints": ["src/index.ts"],
  "recommendations": ["Add unit tests", "Add API documentation"]
}
\`\`\``;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(mockResponse),
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { analyzeCodebase } = await import('../../src/features/codebase-analysis/service.js');

      const result = await analyzeCodebase({
        workspacePath: '/test/project',
        options: { maxDepth: 5 },
      });

      expect(result.projectName).toBe('test-project');
      expect(result.projectPath).toBe('/test/project');
      expect(result.analyzedAt).toBeDefined();
      expect(result.summary).toBe('A TypeScript backend project using Express');
      expect(result.techStack).toHaveLength(2);
      expect(result.dependencies.production).toHaveLength(2);
      expect(result.dependencies.development).toHaveLength(2);
      expect(result.metrics.totalFiles).toBeGreaterThan(0);
    });

    it('should handle project without package.json', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [createMockDirent('main.py', false)];
        }
        return [];
      });
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 100 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('print("hello")');

      const mockResponse = `\`\`\`json
{
  "summary": "A Python project",
  "projectType": "Script",
  "techStack": [{"category": "language", "name": "Python"}],
  "architecture": {"pattern": "unknown", "confidence": 0.5, "indicators": []},
  "components": [],
  "entryPoints": ["main.py"],
  "recommendations": []
}
\`\`\``;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(mockResponse),
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { analyzeCodebase } = await import('../../src/features/codebase-analysis/service.js');

      const result = await analyzeCodebase({
        workspacePath: '/test/project',
      });

      expect(result.projectName).toBe('project');
      expect(result.dependencies.production).toHaveLength(0);
      expect(result.dependencies.development).toHaveLength(0);
    });

    it('should skip ignored directories', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [
            createMockDirent('node_modules', true),
            createMockDirent('.git', true),
            createMockDirent('dist', true),
            createMockDirent('src', true),
          ];
        }
        if (dirStr.includes('src')) {
          return [createMockDirent('app.ts', false)];
        }
        return [];
      });
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 100 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('export {}');

      const mockResponse = `\`\`\`json
{"summary": "Test", "projectType": "App", "techStack": [], "architecture": {"pattern": "unknown", "confidence": 0, "indicators": []}, "components": [], "entryPoints": [], "recommendations": []}
\`\`\``;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(mockResponse),
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { analyzeCodebase } = await import('../../src/features/codebase-analysis/service.js');

      const result = await analyzeCodebase({
        workspacePath: '/test/project',
      });

      // Should not include node_modules, .git, or dist files
      expect(
        result.languages.every(
          l => !l.includes('node_modules') && !l.includes('.git') && !l.includes('dist')
        )
      ).toBe(true);
    });

    it('should respect exclude patterns', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        createMockDirent('src', true),
        createMockDirent('vendor', true),
      ]);
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 100 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('code');

      const mockResponse = `\`\`\`json
{"summary": "Test", "projectType": "App", "techStack": [], "architecture": {"pattern": "unknown", "confidence": 0, "indicators": []}, "components": [], "entryPoints": [], "recommendations": []}
\`\`\``;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(mockResponse),
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { analyzeCodebase } = await import('../../src/features/codebase-analysis/service.js');

      const result = await analyzeCodebase({
        workspacePath: '/test/project',
        options: { excludePatterns: ['vendor'] },
      });

      expect(result).toBeDefined();
    });

    it('should handle malformed LLM response gracefully', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        createMockDirent('app.js', false),
      ]);
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 100 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('const x = 1;');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream('This is not valid JSON'),
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { analyzeCodebase } = await import('../../src/features/codebase-analysis/service.js');

      const result = await analyzeCodebase({
        workspacePath: '/test/project',
      });

      // Should use defaults when parsing fails
      expect(result.summary).toBe('Analysis complete');
      expect(result.projectType).toBe('Unknown');
    });
  });

  describe('generateArchitectureDiagram', () => {
    it('should generate a component diagram', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [createMockDirent('src', true), createMockDirent('package.json', false)];
        }
        if (dirStr.includes('src')) {
          return [createMockDirent('index.ts', false)];
        }
        return [];
      });
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 100 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        if (filePath.includes('package.json')) {
          return JSON.stringify({ name: 'test', version: '1.0.0' });
        }
        return 'export {}';
      });

      // First call for analysis
      const analysisResponse = `\`\`\`json
{"summary": "Test app", "projectType": "App", "techStack": [], "architecture": {"pattern": "layered", "confidence": 0.8, "indicators": []}, "components": [{"name": "API", "type": "backend", "path": "/src", "description": "API layer"}], "entryPoints": [], "recommendations": []}
\`\`\``;

      // Second call for diagram
      const diagramResponse = `\`\`\`mermaid
graph TD
    A[Client] --> B[API Gateway]
    B --> C[Service Layer]
    C --> D[Database]
\`\`\``;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          body: createMockStream(analysisResponse),
          headers: new Headers({ 'content-type': 'text/event-stream' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          body: createMockStream(diagramResponse),
          headers: new Headers({ 'content-type': 'text/event-stream' }),
        });

      const { generateArchitectureDiagram } = await import('../../src/features/codebase-analysis/service.js');

      const result = await generateArchitectureDiagram({
        workspacePath: '/test/project',
        diagramType: 'component',
      });

      expect(result.mermaidDiagram).toContain('graph TD');
      expect(result.summary).toBe('Test app');
      expect(result.diagramType).toBe('component');
    });

    it('should handle empty mermaid response', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 100 } as fs.Stats);

      const analysisResponse = `\`\`\`json
{"summary": "Empty", "projectType": "Unknown", "techStack": [], "architecture": {"pattern": "unknown", "confidence": 0, "indicators": []}, "components": [], "entryPoints": [], "recommendations": []}
\`\`\``;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          body: createMockStream(analysisResponse),
          headers: new Headers({ 'content-type': 'text/event-stream' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          body: createMockStream('No diagram available'),
          headers: new Headers({ 'content-type': 'text/event-stream' }),
        });

      const { generateArchitectureDiagram } = await import('../../src/features/codebase-analysis/service.js');

      const result = await generateArchitectureDiagram({
        workspacePath: '/empty/project',
      });

      expect(result.mermaidDiagram).toBe('');
    });
  });

  describe('analyzeDependencies', () => {
    it('should analyze project dependencies', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        return p.includes('package.json') || p.includes('package-lock.json');
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        if (p.includes('package.json')) {
          return JSON.stringify({
            name: 'test',
            dependencies: { express: '^4.18.0', axios: '^1.4.0' },
            devDependencies: { vitest: '^0.34.0' },
          });
        }
        if (p.includes('package-lock.json')) {
          return JSON.stringify({ lockfileVersion: 3 });
        }
        return '';
      });

      const mockResponse = `\`\`\`json
{
  "summary": "Dependencies look healthy",
  "totalDeps": 3,
  "productionDeps": 2,
  "devDeps": 1,
  "concerns": [
    {"type": "outdated", "package": "express", "details": "New major version available", "recommendation": "Update to v5"}
  ],
  "recommendations": ["Keep dependencies updated"]
}
\`\`\``;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(mockResponse),
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { analyzeDependencies } = await import('../../src/features/codebase-analysis/service.js');

      const result = await analyzeDependencies({
        workspacePath: '/test/project',
        includeDevDeps: true,
      });

      expect(result.summary).toBe('Dependencies look healthy');
      expect(result.totalDeps).toBe(3);
    });

    it('should return error when no package.json', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { analyzeDependencies } = await import('../../src/features/codebase-analysis/service.js');

      const result = await analyzeDependencies({
        workspacePath: '/test/project',
      });

      expect(result.error).toBe('No package.json found');
    });

    it('should exclude dev dependencies when requested', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        return p.includes('package.json');
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({
          dependencies: { express: '^4.18.0' },
          devDependencies: { vitest: '^0.34.0' },
        })
      );

      const mockResponse = `\`\`\`json
{"summary": "Production deps only", "totalDeps": 1, "productionDeps": 1, "devDeps": 0, "concerns": [], "recommendations": [], "dependencies": [{"name": "express", "version": "^4.18.0", "type": "production"}]}
\`\`\``;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(mockResponse),
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { analyzeDependencies } = await import('../../src/features/codebase-analysis/service.js');

      const result = await analyzeDependencies({
        workspacePath: '/test/project',
        includeDevDeps: false,
      });

      expect(result.dependencies).toHaveLength(1);
    });
  });

  describe('getCodeMetrics', () => {
    it('should calculate code metrics', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [createMockDirent('src', true)];
        }
        if (dirStr.includes('src')) {
          return [
            createMockDirent('app.ts', false),
            createMockDirent('utils.ts', false),
            createMockDirent('service.js', false),
          ];
        }
        return [];
      });
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 500 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('line1\nline2\nline3\nline4\nline5\n');

      const { getCodeMetrics } = await import('../../src/features/codebase-analysis/service.js');

      const result = await getCodeMetrics({
        workspacePath: '/test/project',
      });

      expect(result.totalFiles).toBe(3);
      expect(result.totalLines).toBe(18); // 6 lines * 3 files
      expect(result.languages).toBeDefined();
      expect(result.languages['TypeScript']).toBeDefined();
      expect(result.languages['JavaScript']).toBeDefined();
      expect(result.averageFileSize).toBe(6);
    });

    it('should identify largest files', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [
            createMockDirent('small.ts', false),
            createMockDirent('large.ts', false),
          ];
        }
        return [];
      });
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 500 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        if (p.includes('large')) {
          return 'line\n'.repeat(100);
        }
        return 'line\n'.repeat(10);
      });

      const { getCodeMetrics } = await import('../../src/features/codebase-analysis/service.js');

      const result = await getCodeMetrics({
        workspacePath: '/test/project',
      });

      expect(result.largestFiles.length).toBeGreaterThan(0);
      expect(result.largestFiles[0].lines).toBeGreaterThan(result.largestFiles[result.largestFiles.length - 1].lines);
    });

    it('should handle empty project', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const { getCodeMetrics } = await import('../../src/features/codebase-analysis/service.js');

      const result = await getCodeMetrics({
        workspacePath: '/empty/project',
      });

      expect(result.totalFiles).toBe(0);
      expect(result.totalLines).toBe(0);
      expect(result.averageFileSize).toBe(0);
    });
  });

  describe('detectCodeSmells', () => {
    it('should detect large files', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [createMockDirent('large-file.ts', false)];
        }
        return [];
      });
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 50000 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('line\n'.repeat(600));

      const mockResponse = `\`\`\`json
{"codeSmells": [], "overallScore": 70, "summary": "Some issues found"}
\`\`\``;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(mockResponse),
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { detectCodeSmells } = await import('../../src/features/codebase-analysis/service.js');

      const result = await detectCodeSmells('/test/project');

      expect(result.some(s => s.type === 'large-file')).toBe(true);
      expect(result.find(s => s.type === 'large-file')?.severity).toBe('warning');
    });

    it('should mark very large files as errors', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [createMockDirent('huge-file.ts', false)];
        }
        return [];
      });
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 100000 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('line\n'.repeat(1200));

      const mockResponse = `\`\`\`json
{"codeSmells": [], "overallScore": 50, "summary": "Major issues found"}
\`\`\``;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(mockResponse),
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { detectCodeSmells } = await import('../../src/features/codebase-analysis/service.js');

      const result = await detectCodeSmells('/test/project');

      const largeFile = result.find(s => s.type === 'large-file');
      expect(largeFile?.severity).toBe('error');
    });

    it('should include LLM-detected code smells', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [createMockDirent('app.ts', false)];
        }
        return [];
      });
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 1000 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('const x = 42; // magic number');

      const mockResponse = `\`\`\`json
{
  "codeSmells": [
    {"type": "magic-number", "severity": "warning", "file": "/app.ts", "line": 1, "description": "Magic number 42", "suggestion": "Use a named constant"}
  ],
  "overallScore": 80,
  "summary": "Minor issues"
}
\`\`\``;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(mockResponse),
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { detectCodeSmells } = await import('../../src/features/codebase-analysis/service.js');

      const result = await detectCodeSmells('/test/project');

      expect(result.some(s => s.type === 'magic-number')).toBe(true);
    });

    it('should handle empty project gracefully', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const { detectCodeSmells } = await import('../../src/features/codebase-analysis/service.js');

      const result = await detectCodeSmells('/empty/project');

      expect(result).toEqual([]);
    });

    it('should handle LLM parse errors gracefully', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [createMockDirent('app.ts', false)];
        }
        return [];
      });
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 1000 } as fs.Stats);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('const x = 1;');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream('Not valid JSON'),
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { detectCodeSmells } = await import('../../src/features/codebase-analysis/service.js');

      // Should not throw, just return basic smells
      const result = await detectCodeSmells('/test/project');
      expect(result).toBeInstanceOf(Array);
    });
  });
});
