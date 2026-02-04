/**
 * Tests for workflowStore
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  phase,
  isStreaming,
  error,
  architecture,
  architectureRaw,
  prd,
  prdRaw,
  codegenSession,
  preferences,
  canProceedToPrd,
  canProceedToCodegen,
  canDownload,
  streamArchitecture,
  streamPrd,
  startCodeGeneration,
  downloadProject,
  reset,
  setPreferences,
  exportArchitectureJson,
  exportPrdMarkdown,
  runDemo,
  runFullDemoMode,
  shareArchitectureLink,
  sharePrdLink,
} from './workflowStore';
import type { SystemArchitecture, PRD } from '@grump/shared-types';

// Mock the api module
const mockFetchApi = vi.fn();
const mockGetApiBase = vi.fn(() => 'http://localhost:3000');
const mockCreateShareLink = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchApi: (...args: unknown[]) => mockFetchApi(...args),
  getApiBase: () => mockGetApiBase(),
  createShareLink: (...args: unknown[]) => mockCreateShareLink(...args),
}));

// Mock projectStore
vi.mock('./projectStore.js', () => ({
  getCurrentProjectId: vi.fn(() => 'project-123'),
}));

// Mock EventSource
class MockEventSource {
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  static instances: MockEventSource[] = [];
  static clear() {
    MockEventSource.instances = [];
  }
}

(globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;

// Helper to create a mock readable stream
function createMockReader(chunks: string[]) {
  let index = 0;
  return {
    read: vi.fn(async () => {
      if (index >= chunks.length) {
        return { done: true, value: undefined };
      }
      const chunk = chunks[index++];
      return { done: false, value: new TextEncoder().encode(chunk) };
    }),
  };
}

// Mock architecture for tests
function createMockArchitecture(): SystemArchitecture {
  return {
    id: 'arch-123',
    projectName: 'Test Project',
    projectDescription: 'Test Description',
    projectType: 'fullstack',
    complexity: 'mvp',
    techStack: ['react', 'node'],
    c4Diagrams: { context: 'graph TD', container: '', component: '' },
    metadata: {
      components: [],
      integrations: [],
      dataModels: [],
      apiEndpoints: [],
      technologies: {},
    },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

// Mock PRD for tests
function createMockPrd(): PRD {
  return {
    id: 'prd-123',
    projectName: 'Test Project',
    projectDescription: 'Test Description',
    version: '1.0.0',
    sections: {
      overview: {
        vision: 'Test Vision',
        problem: 'Test Problem',
        solution: 'Test Solution',
        targetMarket: 'Test Market',
      },
      personas: [],
      features: [],
      userStories: [],
      nonFunctionalRequirements: [],
      apis: [],
      dataModels: [],
      successMetrics: [],
    },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

describe('workflowStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    vi.useFakeTimers();
    MockEventSource.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    MockEventSource.clear();
  });

  describe('initial state', () => {
    it('should start in idle phase', () => {
      expect(get(phase)).toBe('idle');
    });

    it('should not be streaming initially', () => {
      expect(get(isStreaming)).toBe(false);
    });

    it('should have no error initially', () => {
      expect(get(error)).toBeNull();
    });

    it('should have no architecture initially', () => {
      expect(get(architecture)).toBeNull();
      expect(get(architectureRaw)).toBe('');
    });

    it('should have no PRD initially', () => {
      expect(get(prd)).toBeNull();
      expect(get(prdRaw)).toBe('');
    });

    it('should have no codegen session initially', () => {
      expect(get(codegenSession)).toBeNull();
    });

    it('should have default preferences', () => {
      expect(get(preferences)).toEqual({
        frontendFramework: 'vue',
        backendRuntime: 'node',
        database: 'postgres',
        includeTests: true,
        includeDocs: true,
      });
    });
  });

  describe('derived stores', () => {
    it('canProceedToPrd should be false initially', () => {
      expect(get(canProceedToPrd)).toBe(false);
    });

    it('canProceedToCodegen should be false initially', () => {
      expect(get(canProceedToCodegen)).toBe(false);
    });

    it('canDownload should be false initially', () => {
      expect(get(canDownload)).toBe(false);
    });
  });

  describe('setPreferences', () => {
    it('should update preferences partially', () => {
      setPreferences({ frontendFramework: 'react' });

      expect(get(preferences).frontendFramework).toBe('react');
      expect(get(preferences).backendRuntime).toBe('node'); // unchanged
    });

    it('should merge multiple preference updates', () => {
      setPreferences({ frontendFramework: 'react' });
      setPreferences({ database: 'mongodb' });

      expect(get(preferences)).toMatchObject({
        frontendFramework: 'react',
        database: 'mongodb',
        backendRuntime: 'node',
        includeTests: true,
      });
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      reset();

      expect(get(phase)).toBe('idle');
      expect(get(isStreaming)).toBe(false);
      expect(get(error)).toBeNull();
      expect(get(architectureRaw)).toBe('');
      expect(get(preferences)).toEqual({
        frontendFramework: 'vue',
        backendRuntime: 'node',
        database: 'postgres',
        includeTests: true,
        includeDocs: true,
      });
    });
  });

  describe('streamArchitecture', () => {
    it('should stream architecture text chunks', async () => {
      const mockReader = createMockReader([
        'data: {"text": "Hello "}\n',
        'data: {"text": "World"}\n',
        'data: [DONE]\n',
      ]);

      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const generator = streamArchitecture('Test description');
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello ', 'World']);
      expect(get(architectureRaw)).toBe('Hello World');
      expect(get(isStreaming)).toBe(false);
    });

    it('should handle complete event with architecture object', async () => {
      const mockArch = createMockArchitecture();
      const mockReader = createMockReader([
        'data: {"text": "Building..."}\n',
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);

      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const generator = streamArchitecture('Test description');
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Building...']);
      expect(get(architecture)).toEqual(mockArch);
    });

    it('should pass options to the API', async () => {
      const mockReader = createMockReader(['data: [DONE]\n']);

      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const generator = streamArchitecture('Test', {
        projectType: 'backend',
        techStack: ['python'],
        complexity: 'enterprise',
        demo: true,
      });

      // Consume generator
      for await (const _ of generator) {
        // consume
      }

      expect(mockFetchApi).toHaveBeenCalledWith('/api/architecture/generate-stream', {
        method: 'POST',
        body: JSON.stringify({
          projectDescription: 'Test',
          projectType: 'backend',
          techStack: ['python'],
          complexity: 'enterprise',
          demo: true,
        }),
      });
    });

    it('should handle API errors', async () => {
      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const generator = streamArchitecture('Test description');

      await expect(generator.next()).rejects.toThrow('Architecture generation failed: 500');
      expect(get(error)).toBe('Architecture generation failed: 500');
      expect(get(isStreaming)).toBe(false);
    });

    it('should handle missing response body', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: null,
      });

      const generator = streamArchitecture('Test description');

      await expect(generator.next()).rejects.toThrow('No response body');
    });

    it('should handle network errors', async () => {
      mockFetchApi.mockRejectedValue(new Error('Network error'));

      const generator = streamArchitecture('Test description');

      await expect(generator.next()).rejects.toThrow('Network error');
    });

    it('should ignore malformed JSON in stream', async () => {
      const mockReader = createMockReader([
        'data: {"text": "Valid"}\n',
        'data: {invalid json}\n',
        'data: {"text": " chunk"}\n',
      ]);

      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const generator = streamArchitecture('Test');
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Valid', ' chunk']);
    });

    it('should handle non-Error exceptions', async () => {
      mockFetchApi.mockRejectedValue('string error');

      const generator = streamArchitecture('Test');

      await expect(generator.next()).rejects.toBe('string error');
      expect(get(error)).toBe('Unknown error');
    });
  });

  describe('streamPrd', () => {
    beforeEach(async () => {
      // Set up architecture first
      const mockArch = createMockArchitecture();
      const mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      const gen = streamArchitecture('Test');
      for await (const _ of gen) {
        // consume
      }
      vi.clearAllMocks();
    });

    it('should throw if no architecture available', async () => {
      reset(); // Clear architecture
      const generator = streamPrd();

      await expect(generator.next()).rejects.toThrow('No architecture available');
    });

    it('should stream PRD text chunks', async () => {
      const mockReader = createMockReader([
        'data: {"text": "# PRD\\n"}\n',
        'data: {"text": "## Overview"}\n',
        'data: [DONE]\n',
      ]);

      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const generator = streamPrd();
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['# PRD\n', '## Overview']);
      expect(get(prdRaw)).toBe('# PRD\n## Overview');
      expect(get(phase)).toBe('prd');
    });

    it('should handle complete event with PRD object', async () => {
      const mockPrd = createMockPrd();
      const mockReader = createMockReader([
        `data: {"type": "complete", "prd": ${JSON.stringify(mockPrd)}}\n`,
      ]);

      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const generator = streamPrd();
      for await (const _ of generator) {
        // consume
      }

      expect(get(prd)).toEqual(mockPrd);
    });

    it('should handle API errors', async () => {
      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 400,
      });

      const generator = streamPrd();

      await expect(generator.next()).rejects.toThrow('PRD generation failed: 400');
      expect(get(error)).toBe('PRD generation failed: 400');
    });

    it('should handle missing response body', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: null,
      });

      const generator = streamPrd();

      await expect(generator.next()).rejects.toThrow('No response body');
    });

    it('should pass demo option', async () => {
      const mockReader = createMockReader(['data: [DONE]\n']);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const generator = streamPrd({ demo: true });
      for await (const _ of generator) {
        // consume
      }

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/api/prd/generate-stream',
        expect.objectContaining({
          body: expect.stringContaining('"demo":true'),
        })
      );
    });
  });

  describe('startCodeGeneration', () => {
    beforeEach(async () => {
      // Set up architecture and PRD
      const mockArch = createMockArchitecture();
      let mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamArchitecture('Test')) {
        // consume
      }

      const mockPrd = createMockPrd();
      mockReader = createMockReader([
        `data: {"type": "complete", "prd": ${JSON.stringify(mockPrd)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamPrd()) {
        // consume
      }
      vi.clearAllMocks();
    });

    it('should throw if no architecture available', async () => {
      reset();
      await expect(startCodeGeneration()).rejects.toThrow('Architecture and PRD required');
    });

    it('should start code generation and set up polling', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'session-123',
            status: 'running',
            agents: {},
          }),
      });

      await startCodeGeneration();

      expect(get(phase)).toBe('codegen');
      expect(get(codegenSession)).toMatchObject({
        sessionId: 'session-123',
        status: 'running',
        progress: 0,
      });
    });

    it('should accept projectIdOverride', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'session-123',
            status: 'running',
            agents: {},
          }),
      });

      await startCodeGeneration('custom-project-id');

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/api/codegen/start',
        expect.objectContaining({
          body: expect.stringContaining('"projectId":"custom-project-id"'),
        })
      );
    });

    it('should handle API errors', async () => {
      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(startCodeGeneration()).rejects.toThrow('Code generation failed: 500');
      expect(get(error)).toBe('Code generation failed: 500');
    });

    it('should poll for status updates', async () => {
      mockFetchApi
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              status: 'running',
              agents: {},
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              status: 'running',
              progress: 50,
              agents: {},
              generatedFileCount: 5,
            }),
        });

      await startCodeGeneration();

      // Advance timers to trigger polling
      await vi.advanceTimersByTimeAsync(2000);

      expect(mockFetchApi).toHaveBeenCalledWith('/api/codegen/status/session-123');
      expect(get(codegenSession)?.progress).toBe(50);
    });

    it('should handle completed status in polling', async () => {
      mockFetchApi
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              status: 'running',
              agents: {},
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              status: 'completed',
              progress: 100,
              agents: {},
              generatedFileCount: 10,
            }),
        });

      await startCodeGeneration();
      await vi.advanceTimersByTimeAsync(2000);

      expect(get(phase)).toBe('complete');
      expect(get(codegenSession)?.status).toBe('completed');
    });

    it('should handle failed status in polling', async () => {
      mockFetchApi
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              status: 'running',
              agents: {},
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              status: 'failed',
              error: 'Agent crashed',
              agents: {},
            }),
        });

      await startCodeGeneration();
      await vi.advanceTimersByTimeAsync(2000);

      expect(get(error)).toBe('Agent crashed');
    });

    it('should handle polling errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetchApi
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              status: 'running',
              agents: {},
            }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      await startCodeGeneration();
      await vi.advanceTimersByTimeAsync(2000);

      expect(consoleSpy).toHaveBeenCalledWith('Status polling error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle non-ok response in polling', async () => {
      mockFetchApi
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              status: 'running',
              agents: {},
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

      await startCodeGeneration();
      await vi.advanceTimersByTimeAsync(2000);

      // Should not throw, just ignore the failed poll
      expect(get(codegenSession)?.status).toBe('running');
    });

    it('should set up EventSource for SSE events', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'session-123',
            status: 'running',
            agents: {},
          }),
      });

      await startCodeGeneration();

      expect(MockEventSource.instances.length).toBe(1);
      expect(MockEventSource.instances[0].url).toContain('/api/events/stream');
    });

    it('should handle codegen.ready SSE event', async () => {
      mockFetchApi
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              status: 'running',
              agents: {},
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'session-123',
              status: 'completed',
              progress: 100,
              agents: {},
              generatedFileCount: 15,
            }),
        });

      await startCodeGeneration();

      const es = MockEventSource.instances[0];
      es.onmessage?.({
        data: JSON.stringify({
          event: 'codegen.ready',
          payload: { sessionId: 'session-123' },
        }),
      } as MessageEvent);

      // Allow promises to resolve
      await vi.advanceTimersByTimeAsync(0);

      expect(get(phase)).toBe('complete');
      expect(es.close).toHaveBeenCalled();
    });

    it('should handle codegen.failed SSE event', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'session-123',
            status: 'running',
            agents: {},
          }),
      });

      await startCodeGeneration();

      const es = MockEventSource.instances[0];
      es.onmessage?.({
        data: JSON.stringify({
          event: 'codegen.failed',
          payload: { sessionId: 'session-123', error: 'Build failed' },
        }),
      } as MessageEvent);

      expect(get(error)).toBe('Build failed');
      expect(es.close).toHaveBeenCalled();
    });

    it('should ignore SSE events for different session', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'session-123',
            status: 'running',
            agents: {},
          }),
      });

      await startCodeGeneration();

      const es = MockEventSource.instances[0];
      es.onmessage?.({
        data: JSON.stringify({
          event: 'codegen.ready',
          payload: { sessionId: 'different-session' },
        }),
      } as MessageEvent);

      // Should not change state
      expect(get(phase)).toBe('codegen');
    });

    it('should handle SSE parse errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'session-123',
            status: 'running',
            agents: {},
          }),
      });

      await startCodeGeneration();

      const es = MockEventSource.instances[0];
      es.onmessage?.({
        data: 'invalid json',
      } as MessageEvent);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to parse codegen event:',
        expect.any(String)
      );
      consoleWarnSpy.mockRestore();
    });

    it('should close EventSource on error', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'session-123',
            status: 'running',
            agents: {},
          }),
      });

      await startCodeGeneration();

      const es = MockEventSource.instances[0];
      es.onerror?.();

      expect(es.close).toHaveBeenCalled();
    });
  });

  describe('downloadProject', () => {
    it('should throw if no codegen session', async () => {
      await expect(downloadProject()).rejects.toThrow('No code generation session');
    });

    it('should download project zip', async () => {
      // Set up codegen session
      const mockArch = createMockArchitecture();
      let mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamArchitecture('Test')) {
        // consume
      }

      const mockPrd = createMockPrd();
      mockReader = createMockReader([
        `data: {"type": "complete", "prd": ${JSON.stringify(mockPrd)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamPrd()) {
        // consume
      }

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'session-123',
            status: 'completed',
            agents: {},
          }),
      });
      await startCodeGeneration();

      vi.clearAllMocks();

      const mockBlob = new Blob(['fake zip content']);
      const mockUrl = 'blob:http://localhost/mock-url';
      const createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue(mockUrl);
      const revokeObjectURLSpy = vi
        .spyOn(window.URL, 'revokeObjectURL')
        .mockImplementation(() => {});
      const appendChildSpy = vi
        .spyOn(document.body, 'appendChild')
        .mockImplementation((node) => node);
      const removeChildSpy = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation((node) => node);

      mockFetchApi.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: {
          get: (name: string) =>
            name === 'Content-Disposition' ? 'attachment; filename="project.zip"' : null,
        },
      });

      await downloadProject();

      expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockUrl);
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('should handle download errors', async () => {
      // Set up codegen session
      const mockArch = createMockArchitecture();
      let mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamArchitecture('Test')) {
        // consume
      }

      const mockPrd = createMockPrd();
      mockReader = createMockReader([
        `data: {"type": "complete", "prd": ${JSON.stringify(mockPrd)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamPrd()) {
        // consume
      }

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'session-123',
            status: 'completed',
            agents: {},
          }),
      });
      await startCodeGeneration();

      vi.clearAllMocks();

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Session not found' }),
      });

      await expect(downloadProject()).rejects.toThrow('Session not found');
      expect(get(error)).toBe('Session not found');
    });

    it('should handle download errors without JSON body', async () => {
      // Set up codegen session
      const mockArch = createMockArchitecture();
      let mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamArchitecture('Test')) {
        // consume
      }

      const mockPrd = createMockPrd();
      mockReader = createMockReader([
        `data: {"type": "complete", "prd": ${JSON.stringify(mockPrd)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamPrd()) {
        // consume
      }

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'session-123',
            status: 'completed',
            agents: {},
          }),
      });
      await startCodeGeneration();

      vi.clearAllMocks();

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Parse error')),
      });

      await expect(downloadProject()).rejects.toThrow('Download failed: 500');
    });

    it('should parse Content-Disposition with encoded filename', async () => {
      // Set up codegen session
      const mockArch = createMockArchitecture();
      let mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamArchitecture('Test')) {
        // consume
      }

      const mockPrd = createMockPrd();
      mockReader = createMockReader([
        `data: {"type": "complete", "prd": ${JSON.stringify(mockPrd)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamPrd()) {
        // consume
      }

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'session-123',
            status: 'completed',
            agents: {},
          }),
      });
      await startCodeGeneration();

      vi.clearAllMocks();

      const mockBlob = new Blob(['fake zip content']);
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock');
      vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      // Store original createElement before mocking
      const originalCreateElement = document.createElement.bind(document);
      let capturedDownload = '';
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          Object.defineProperty(el, 'download', {
            set: (val: string) => {
              capturedDownload = val;
            },
            get: () => capturedDownload,
          });
        }
        return el;
      });

      mockFetchApi.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: {
          get: (name: string) =>
            name === 'Content-Disposition' ? "filename*=UTF-8''my-project" : null,
        },
      });

      await downloadProject();

      expect(capturedDownload).toBe('my-project.zip');
    });
  });

  describe('export functions', () => {
    it('exportArchitectureJson should do nothing when no architecture', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      exportArchitectureJson();

      expect(createElementSpy).not.toHaveBeenCalled();
      createElementSpy.mockRestore();
    });

    it('exportArchitectureJson should create download when architecture exists', async () => {
      const mockArch = createMockArchitecture();
      const mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamArchitecture('Test')) {
        // consume
      }

      const mockUrl = 'blob:mock';
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      let clickCalled = false;
      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: () => {
          clickCalled = true;
        },
      } as unknown as HTMLAnchorElement);

      exportArchitectureJson();

      expect(clickCalled).toBe(true);
    });

    it('exportPrdMarkdown should do nothing when no PRD', () => {
      expect(() => exportPrdMarkdown()).not.toThrow();
    });

    it('exportPrdMarkdown should create download when PRD exists', async () => {
      // Set up architecture first
      const mockArch = createMockArchitecture();
      let mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamArchitecture('Test')) {
        // consume
      }

      // Set up PRD
      const mockPrd = createMockPrd();
      mockReader = createMockReader([
        `data: {"type": "complete", "prd": ${JSON.stringify(mockPrd)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamPrd()) {
        // consume
      }

      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      let clickCalled = false;
      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: () => {
          clickCalled = true;
        },
      } as unknown as HTMLAnchorElement);

      exportPrdMarkdown();

      expect(clickCalled).toBe(true);
    });
  });

  describe('share functions', () => {
    it('shareArchitectureLink should return null when no architecture', async () => {
      const result = await shareArchitectureLink();
      expect(result).toBeNull();
    });

    it('shareArchitectureLink should create share link', async () => {
      const mockArch = createMockArchitecture();
      const mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamArchitecture('Test')) {
        // consume
      }

      mockCreateShareLink.mockResolvedValue({ shareId: 'share-abc' });

      const result = await shareArchitectureLink();

      expect(result).toBe('http://localhost:3000/api/share/share-abc');
      expect(mockCreateShareLink).toHaveBeenCalledWith({
        type: 'architecture',
        content: expect.any(String),
        title: 'Test Project',
        mermaidCode: 'graph TD',
        expiresIn: 168,
      });
    });

    it('shareArchitectureLink should handle errors', async () => {
      const mockArch = createMockArchitecture();
      const mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamArchitecture('Test')) {
        // consume
      }

      mockCreateShareLink.mockRejectedValue(new Error('Network error'));

      const result = await shareArchitectureLink();

      expect(result).toBeNull();
    });

    it('sharePrdLink should return null when no PRD', async () => {
      const result = await sharePrdLink();
      expect(result).toBeNull();
    });

    it('sharePrdLink should create share link', async () => {
      // Set up architecture and PRD
      const mockArch = createMockArchitecture();
      let mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamArchitecture('Test')) {
        // consume
      }

      const mockPrd = createMockPrd();
      mockReader = createMockReader([
        `data: {"type": "complete", "prd": ${JSON.stringify(mockPrd)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamPrd()) {
        // consume
      }

      mockCreateShareLink.mockResolvedValue({ shareId: 'share-prd' });

      const result = await sharePrdLink();

      expect(result).toBe('http://localhost:3000/api/share/share-prd');
    });

    it('sharePrdLink should handle errors', async () => {
      // Set up architecture and PRD
      const mockArch = createMockArchitecture();
      let mockReader = createMockReader([
        `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamArchitecture('Test')) {
        // consume
      }

      const mockPrd = createMockPrd();
      mockReader = createMockReader([
        `data: {"type": "complete", "prd": ${JSON.stringify(mockPrd)}}\n`,
      ]);
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      for await (const _ of streamPrd()) {
        // consume
      }

      mockCreateShareLink.mockRejectedValue(new Error('Failed'));

      const result = await sharePrdLink();

      expect(result).toBeNull();
    });
  });

  describe('runDemo', () => {
    it('should run architecture and PRD streams with demo flag', async () => {
      const mockArch = createMockArchitecture();
      const mockPrd = createMockPrd();

      let callCount = 0;
      mockFetchApi.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            body: {
              getReader: () =>
                createMockReader([
                  `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
                ]),
            },
          });
        }
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () =>
              createMockReader([`data: {"type": "complete", "prd": ${JSON.stringify(mockPrd)}}\n`]),
          },
        });
      });

      await runDemo();

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/api/architecture/generate-stream',
        expect.objectContaining({
          body: expect.stringContaining('"demo":true'),
        })
      );
      expect(mockFetchApi).toHaveBeenCalledWith(
        '/api/prd/generate-stream',
        expect.objectContaining({
          body: expect.stringContaining('"demo":true'),
        })
      );
      expect(get(architecture)).toEqual(mockArch);
      expect(get(prd)).toEqual(mockPrd);
    });
  });

  describe('runFullDemoMode', () => {
    it('should run demo and start code generation', async () => {
      const mockArch = createMockArchitecture();
      const mockPrd = createMockPrd();

      let callCount = 0;
      mockFetchApi.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            body: {
              getReader: () =>
                createMockReader([
                  `data: {"type": "complete", "architecture": ${JSON.stringify(mockArch)}}\n`,
                ]),
            },
          });
        }
        if (callCount === 2) {
          return Promise.resolve({
            ok: true,
            body: {
              getReader: () =>
                createMockReader([
                  `data: {"type": "complete", "prd": ${JSON.stringify(mockPrd)}}\n`,
                ]),
            },
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'demo-session',
              status: 'running',
              agents: {},
            }),
        });
      });

      await runFullDemoMode();

      expect(get(phase)).toBe('codegen');
      expect(get(codegenSession)?.sessionId).toBe('demo-session');
    });
  });
});
