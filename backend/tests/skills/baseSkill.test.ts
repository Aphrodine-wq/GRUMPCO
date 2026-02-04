/**
 * BaseSkill Tests
 * Tests for the abstract base skill class
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseSkill } from '../../src/skills/base/BaseSkill.js';
import type {
  SkillManifest,
  SkillContext,
  SkillExecutionInput,
  SkillEvent,
} from '../../src/skills/types.js';

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Concrete implementation for testing
class TestSkill extends BaseSkill {
  manifest: SkillManifest = {
    id: 'test-skill',
    name: 'Test Skill',
    version: '1.0.0',
    description: 'A test skill',
    category: 'code',
    capabilities: {
      providesTools: true,
      providesRoutes: false,
      providesPrompts: true,
      requiresWorkspace: false,
      supportsStreaming: true,
    },
    permissions: ['file_read'],
    triggers: {
      keywords: ['test', 'check'],
      patterns: ['^/test\\s+'],
      commands: ['/test'],
    },
  };

  prompts = {
    system: 'You are a test assistant.',
  };

  public exposedProcess = this.process.bind(this);
}

// Create mock context
function createMockContext(overrides: Partial<SkillContext> = {}): SkillContext {
  const emitFn = vi.fn();
  return {
    sessionId: 'test-session',
    workspacePath: '/test/workspace',
    config: {},
    request: {
      id: 'req-123',
      timestamp: new Date(),
      source: 'api' as const,
    },
    services: {
      llm: {
        complete: vi.fn().mockResolvedValue('LLM response'),
        stream: vi.fn(),
      },
      fileSystem: {
        readFile: vi.fn().mockResolvedValue('file content'),
        writeFile: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        listDirectory: vi.fn().mockResolvedValue(['file1.ts', 'file2.ts']),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        isWithinWorkspace: vi.fn().mockReturnValue(true),
      },
      git: {
        status: vi.fn().mockResolvedValue({
          branch: 'main',
          staged: [],
          unstaged: [],
          untracked: [],
        }),
        diff: vi.fn().mockResolvedValue(''),
        commit: vi.fn().mockResolvedValue(''),
        log: vi.fn().mockResolvedValue([]),
        branch: vi.fn().mockResolvedValue('main'),
        branches: vi.fn().mockResolvedValue(['main']),
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    },
    emit: emitFn,
    isCancelled: () => false,
    ...overrides,
  };
}

describe('BaseSkill', () => {
  let skill: TestSkill;
  let context: SkillContext;

  beforeEach(() => {
    vi.clearAllMocks();
    skill = new TestSkill();
    context = createMockContext();
  });

  describe('lifecycle hooks', () => {
    it('should have default initialize that does nothing', async () => {
      await expect(skill.initialize({})).resolves.toBeUndefined();
    });

    it('should have default activate that does nothing', async () => {
      await expect(skill.activate(context)).resolves.toBeUndefined();
    });

    it('should have default deactivate that does nothing', async () => {
      await expect(skill.deactivate(context)).resolves.toBeUndefined();
    });

    it('should have default cleanup that does nothing', async () => {
      await expect(skill.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('shouldHandle', () => {
    it('should match keywords', () => {
      expect(skill.shouldHandle('please test this code', context)).toBe(true);
      expect(skill.shouldHandle('check my function', context)).toBe(true);
    });

    it('should match patterns', () => {
      expect(skill.shouldHandle('/test my code', context)).toBe(true);
    });

    it('should match commands', () => {
      expect(skill.shouldHandle('/test', context)).toBe(true);
    });

    it('should return false for non-matching input', () => {
      expect(skill.shouldHandle('hello world', context)).toBe(false);
      expect(skill.shouldHandle('refactor this', context)).toBe(false);
    });

    it('should return false if no triggers defined', () => {
      const noTriggersSkill = new TestSkill();
      noTriggersSkill.manifest.triggers = undefined;
      expect(noTriggersSkill.shouldHandle('test something', context)).toBe(false);
    });

    it('should be case insensitive for keywords', () => {
      expect(skill.shouldHandle('TEST THIS', context)).toBe(true);
      expect(skill.shouldHandle('Check My Code', context)).toBe(true);
    });
  });

  describe('run', () => {
    it('should call process and return success result', async () => {
      class ProcessSkill extends TestSkill {
        protected async process(): Promise<string> {
          return 'processed output';
        }
      }

      const processSkill = new ProcessSkill();
      const input: SkillExecutionInput = { message: 'test' };

      const result = await processSkill.run(input, context);

      expect(result.success).toBe(true);
      expect(result.output).toBe('processed output');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return error result when process throws', async () => {
      class ErrorSkill extends TestSkill {
        protected async process(): Promise<string> {
          throw new Error('Processing failed');
        }
      }

      const errorSkill = new ErrorSkill();
      const input: SkillExecutionInput = { message: 'test' };

      const result = await errorSkill.run(input, context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Processing failed');
    });

    it('should handle non-Error throws', async () => {
      class StringErrorSkill extends TestSkill {
        protected async process(): Promise<string> {
          throw 'String error';
        }
      }

      const stringErrorSkill = new StringErrorSkill();
      const input: SkillExecutionInput = { message: 'test' };

      const result = await stringErrorSkill.run(input, context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('String error');
    });
  });

  describe('execute', () => {
    it('should yield events and return result', async () => {
      class ExecuteSkill extends TestSkill {
        protected async process(): Promise<string> {
          return 'execution output';
        }
      }

      const executeSkill = new ExecuteSkill();
      const input: SkillExecutionInput = { message: 'test' };
      const events: SkillEvent[] = [];

      const generator = executeSkill.execute(input, context);
      let result;

      for await (const event of generator) {
        events.push(event);
        // Generator returns the final result which we capture
        const next = await generator.next();
        if (next.done) {
          result = next.value;
          break;
        }
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('started');
    });

    it('should handle process failure gracefully', async () => {
      // When process() throws, run() catches it and returns success: false
      // The execute() method then emits output/completed events with empty content
      // rather than yielding an error event
      class FailingSkill extends TestSkill {
        protected async process(): Promise<string> {
          throw new Error('Execution failed');
        }
      }

      const failingSkill = new FailingSkill();
      const input: SkillExecutionInput = { message: 'test' };
      const events: SkillEvent[] = [];

      const generator = failingSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      // The skill completes but with empty output (error was caught in run())
      const outputEvent = events.find((e) => e.type === 'output');
      const completedEvent = events.find((e) => e.type === 'completed');
      expect(outputEvent).toBeDefined();
      expect(completedEvent).toBeDefined();
    });
  });

  describe('process (default)', () => {
    it('should throw error when not overridden', async () => {
      const input: SkillExecutionInput = { message: 'test' };
      await expect(skill.exposedProcess(input, context)).rejects.toThrow(
        'Skill must implement process() or execute()'
      );
    });
  });

  describe('helper methods', () => {
    describe('createTool', () => {
      it('should create a tool definition', () => {
        const tool = (skill as any).createTool('my_tool', 'Does something', {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        });

        expect(tool.name).toBe('my_tool');
        expect(tool.description).toBe('Does something');
        expect(tool.input_schema).toEqual({
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        });
      });
    });

    describe('successResult', () => {
      it('should create a success result', () => {
        const result = (skill as any).successResult('output text', { key: 'value' });

        expect(result.success).toBe(true);
        expect(result.output).toBe('output text');
        expect(result.metadata).toEqual({ key: 'value' });
      });

      it('should work without metadata', () => {
        const result = (skill as any).successResult('output text');

        expect(result.success).toBe(true);
        expect(result.output).toBe('output text');
        expect(result.metadata).toBeUndefined();
      });
    });

    describe('errorResult', () => {
      it('should create an error result', () => {
        const result = (skill as any).errorResult('error message', { detail: 'info' });

        expect(result.success).toBe(false);
        expect(result.output).toBe('');
        expect(result.error).toBe('error message');
        expect(result.metadata).toEqual({ detail: 'info' });
      });
    });

    describe('emitProgress', () => {
      it('should emit progress event', () => {
        (skill as any).emitProgress(context, 50, 'Halfway done');

        expect(context.emit).toHaveBeenCalledWith({
          type: 'progress',
          percent: 50,
          message: 'Halfway done',
        });
      });
    });

    describe('emitThinking', () => {
      it('should emit thinking event', () => {
        (skill as any).emitThinking(context, 'Processing...');

        expect(context.emit).toHaveBeenCalledWith({
          type: 'thinking',
          content: 'Processing...',
        });
      });
    });

    describe('emitOutput', () => {
      it('should emit output event', () => {
        (skill as any).emitOutput(context, 'Result content');

        expect(context.emit).toHaveBeenCalledWith({
          type: 'output',
          content: 'Result content',
        });
      });
    });
  });

  describe('readFile', () => {
    it('should read file within workspace', async () => {
      const content = await (skill as any).readFile(context, 'src/index.ts');

      expect(context.services.fileSystem.isWithinWorkspace).toHaveBeenCalledWith('src/index.ts');
      expect(context.services.fileSystem.readFile).toHaveBeenCalledWith('src/index.ts');
      expect(content).toBe('file content');
    });

    it('should return null for file outside workspace', async () => {
      vi.mocked(context.services.fileSystem.isWithinWorkspace).mockReturnValue(false);

      const content = await (skill as any).readFile(context, '/etc/passwd');

      expect(content).toBeNull();
      expect(context.services.logger.warn).toHaveBeenCalled();
    });

    it('should return null and log error on read failure', async () => {
      vi.mocked(context.services.fileSystem.readFile).mockRejectedValue(new Error('Read failed'));

      const content = await (skill as any).readFile(context, 'src/index.ts');

      expect(content).toBeNull();
      expect(context.services.logger.error).toHaveBeenCalled();
    });
  });

  describe('writeFile', () => {
    it('should write file within workspace', async () => {
      const result = await (skill as any).writeFile(context, 'src/new.ts', 'content');

      expect(context.services.fileSystem.isWithinWorkspace).toHaveBeenCalledWith('src/new.ts');
      expect(context.services.fileSystem.writeFile).toHaveBeenCalledWith('src/new.ts', 'content');
      expect(result).toBe(true);
      expect(context.emit).toHaveBeenCalledWith({
        type: 'file_change',
        path: 'src/new.ts',
        action: 'modified',
      });
    });

    it('should return false for file outside workspace', async () => {
      vi.mocked(context.services.fileSystem.isWithinWorkspace).mockReturnValue(false);

      const result = await (skill as any).writeFile(context, '/etc/passwd', 'content');

      expect(result).toBe(false);
      expect(context.services.logger.warn).toHaveBeenCalled();
    });

    it('should return false and log error on write failure', async () => {
      vi.mocked(context.services.fileSystem.writeFile).mockRejectedValue(new Error('Write failed'));

      const result = await (skill as any).writeFile(context, 'src/new.ts', 'content');

      expect(result).toBe(false);
      expect(context.services.logger.error).toHaveBeenCalled();
    });
  });

  describe('callLLM', () => {
    it('should call LLM with system prompt', async () => {
      const response = await (skill as any).callLLM(context, 'User message');

      expect(context.services.llm.complete).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: 'User message' }],
        system: 'You are a test assistant.',
        tools: undefined,
        maxTokens: 4096,
      });
      expect(response).toBe('LLM response');
    });

    it('should include tools when specified', async () => {
      skill.tools = {
        definitions: [
          {
            name: 'test_tool',
            description: 'A test tool',
            input_schema: { type: 'object' as const },
          },
        ],
        handlers: {},
      };

      await (skill as any).callLLM(context, 'User message', { includeTools: true });

      expect(context.services.llm.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: skill.tools.definitions,
        })
      );
    });

    it('should use custom maxTokens', async () => {
      await (skill as any).callLLM(context, 'User message', { maxTokens: 2048 });

      expect(context.services.llm.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 2048,
        })
      );
    });
  });
});
