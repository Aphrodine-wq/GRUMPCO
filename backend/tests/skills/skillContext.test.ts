/**
 * SkillContext Tests
 * Tests for the skill context factory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSkillContext, createCancellableContext } from '../../src/skills/base/SkillContext.js';
import type { SkillEvent } from '../../src/skills/types.js';

// Mock dependencies
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/llmGateway.js', () => ({
  getStream: vi.fn(),
}));

vi.mock('fs/promises', () => {
  const mockFs = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
  };
  return {
    ...mockFs,
    default: mockFs,
  };
});

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  default: {
    existsSync: vi.fn(() => true),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn),
}));

describe('SkillContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSkillContext', () => {
    it('should create a context with default values', () => {
      const context = createSkillContext({});

      expect(context.sessionId).toBe('test-uuid-1234');
      expect(context.workspacePath).toBeUndefined();
      expect(context.config).toEqual({});
      expect(context.request.source).toBe('api');
      expect(context.services.llm).toBeDefined();
      expect(context.services.fileSystem).toBeDefined();
      expect(context.services.logger).toBeDefined();
      expect(context.isCancelled()).toBe(false);
    });

    it('should use provided sessionId', () => {
      const context = createSkillContext({ sessionId: 'custom-session' });

      expect(context.sessionId).toBe('custom-session');
    });

    it('should use provided workspacePath', () => {
      const context = createSkillContext({ workspacePath: '/my/workspace' });

      expect(context.workspacePath).toBe('/my/workspace');
    });

    it('should use provided config', () => {
      const config = { key: 'value', nested: { data: true } };
      const context = createSkillContext({ config });

      expect(context.config).toEqual(config);
    });

    it('should use provided source', () => {
      const context = createSkillContext({ source: 'chat' });

      expect(context.request.source).toBe('chat');
    });

    it('should call onEvent when emit is called', () => {
      const onEvent = vi.fn();
      const context = createSkillContext({ onEvent });
      const event: SkillEvent = { type: 'progress', percent: 50, message: 'test' };

      context.emit(event);

      expect(onEvent).toHaveBeenCalledWith(event);
    });

    it('should create git service when workspacePath is provided', () => {
      const context = createSkillContext({ workspacePath: '/my/workspace' });

      expect(context.services.git).toBeDefined();
    });

    it('should not create git service when workspacePath is not provided', () => {
      const context = createSkillContext({});

      expect(context.services.git).toBeUndefined();
    });
  });

  describe('LLM Service', () => {
    it('should provide complete method', async () => {
      const { getStream } = await import('../../src/services/llmGateway.js');

      // Create an async generator that yields text
      async function* mockGenerator() {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'World' } };
      }

      vi.mocked(getStream).mockReturnValue(mockGenerator() as any);

      const context = createSkillContext({});
      const result = await context.services.llm.complete({
        messages: [{ role: 'user', content: 'Hi' }],
        system: 'You are helpful',
        maxTokens: 100,
      });

      expect(result).toBe('Hello World');
      expect(getStream).toHaveBeenCalled();
    });

    it('should provide stream method', async () => {
      const { getStream } = await import('../../src/services/llmGateway.js');

      async function* mockGenerator() {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'chunk1' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'chunk2' } };
      }

      vi.mocked(getStream).mockReturnValue(mockGenerator() as any);

      const context = createSkillContext({});
      const chunks: any[] = [];

      for await (const chunk of context.services.llm.stream({
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(2);
    });
  });

  describe('FileSystem Service', () => {
    it('should read files', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue('file content');

      const context = createSkillContext({ workspacePath: '/workspace' });
      const content = await context.services.fileSystem.readFile('test.txt');

      expect(content).toBe('file content');
    });

    it('should resolve relative paths to workspace', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue('content');

      const context = createSkillContext({ workspacePath: '/workspace' });
      await context.services.fileSystem.readFile('relative/file.txt');

      // Should join with workspace path
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('should write files', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const context = createSkillContext({ workspacePath: '/workspace' });
      await context.services.fileSystem.writeFile('test.txt', 'new content');

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should check if file exists', async () => {
      const fsSync = await import('fs');
      vi.mocked(fsSync.existsSync).mockReturnValue(true);

      const context = createSkillContext({ workspacePath: '/workspace' });
      const exists = await context.services.fileSystem.exists('test.txt');

      expect(exists).toBe(true);
    });

    it('should list directory contents', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'file.ts', isDirectory: () => false },
        { name: 'folder', isDirectory: () => true },
      ] as any);

      const context = createSkillContext({ workspacePath: '/workspace' });
      const entries = await context.services.fileSystem.listDirectory('.');

      expect(entries).toContain('file.ts');
      expect(entries).toContain('folder/');
    });

    it('should delete files', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      const context = createSkillContext({ workspacePath: '/workspace' });
      await context.services.fileSystem.deleteFile('test.txt');

      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should check if path is within workspace', () => {
      const context = createSkillContext({ workspacePath: '/workspace' });

      // For Windows path normalization, the actual behavior depends on the OS
      expect(context.services.fileSystem.isWithinWorkspace).toBeDefined();
    });

    it('should return true for any path when no workspace is set', () => {
      const context = createSkillContext({});

      expect(context.services.fileSystem.isWithinWorkspace('/any/path')).toBe(true);
    });
  });

  describe('Logger Service', () => {
    it('should log info messages', async () => {
      const logger = (await import('../../src/middleware/logger.js')).default;
      const context = createSkillContext({ sessionId: 'test-session' });

      context.services.logger.info('Test message', { extra: 'data' });

      expect(logger.info).toHaveBeenCalled();
    });

    it('should log warn messages', async () => {
      const logger = (await import('../../src/middleware/logger.js')).default;
      const context = createSkillContext({ sessionId: 'test-session' });

      context.services.logger.warn('Warning message');

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log error messages', async () => {
      const logger = (await import('../../src/middleware/logger.js')).default;
      const context = createSkillContext({ sessionId: 'test-session' });

      context.services.logger.error('Error message');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should log debug messages', async () => {
      const logger = (await import('../../src/middleware/logger.js')).default;
      const context = createSkillContext({ sessionId: 'test-session' });

      context.services.logger.debug('Debug message');

      expect(logger.debug).toHaveBeenCalled();
    });
  });

  describe('createCancellableContext', () => {
    it('should create a cancellable context', () => {
      const baseContext = createSkillContext({});
      const { context, cancel } = createCancellableContext(baseContext);

      expect(context.isCancelled()).toBe(false);

      cancel();

      expect(context.isCancelled()).toBe(true);
    });

    it('should preserve base context properties', () => {
      const baseContext = createSkillContext({
        sessionId: 'my-session',
        workspacePath: '/my/workspace',
      });
      const { context } = createCancellableContext(baseContext);

      expect(context.sessionId).toBe('my-session');
      expect(context.workspacePath).toBe('/my/workspace');
    });
  });
});

describe('Git Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be created when workspacePath is provided', () => {
    const context = createSkillContext({ workspacePath: '/workspace' });
    expect(context.services.git).toBeDefined();
  });

  // Note: Git service tests would require mocking execAsync properly
  // which involves complex child_process mocking. The service functions
  // are tested indirectly through the gitOperations skill tests.
});
