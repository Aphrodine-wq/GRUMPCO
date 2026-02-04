/**
 * Claude Service With Tools Tests - Comprehensive
 *
 * Tests for the main Claude AI service with tool execution capabilities.
 * All external dependencies are mocked to enable isolated unit testing.
 */

import { describe, it, expect, beforeEach, vi, afterEach, type MockedFunction } from 'vitest';

// Hoist mock variables to avoid "Cannot access before initialization" errors
const { mockToolExecutionService, mockGetStream, mockSchemas } = vi.hoisted(() => {
  // Create a typed mock schema that supports both success and failure responses
  const createMockSchema = () => ({
    safeParse: vi.fn((x: unknown) => ({ success: true as boolean, data: x, error: undefined as { message: string } | undefined })),
  });

  return {
    mockToolExecutionService: {
      executeBash: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      editFile: vi.fn(),
      listDirectory: vi.fn(),
      searchCodebase: vi.fn(),
      gitStatus: vi.fn(),
      gitDiff: vi.fn(),
      gitLog: vi.fn(),
      gitCommit: vi.fn(),
      gitBranch: vi.fn(),
      gitPush: vi.fn(),
      executeTerminal: vi.fn(),
    },
    mockGetStream: vi.fn(),
    mockSchemas: {
      bashExecuteInputSchema: createMockSchema(),
      fileReadInputSchema: createMockSchema(),
      fileWriteInputSchema: createMockSchema(),
      fileEditInputSchema: createMockSchema(),
      listDirectoryInputSchema: createMockSchema(),
      codebaseSearchInputSchema: createMockSchema(),
      generateDbSchemaInputSchema: createMockSchema(),
      generateMigrationsInputSchema: createMockSchema(),
      screenshotUrlInputSchema: createMockSchema(),
      browserRunScriptInputSchema: createMockSchema(),
      browserNavigateInputSchema: createMockSchema(),
      browserClickInputSchema: createMockSchema(),
      browserTypeInputSchema: createMockSchema(),
      browserGetContentInputSchema: createMockSchema(),
      browserScreenshotInputSchema: createMockSchema(),
      gitStatusInputSchema: createMockSchema(),
      gitDiffInputSchema: createMockSchema(),
      gitLogInputSchema: createMockSchema(),
      gitCommitInputSchema: createMockSchema(),
      gitBranchInputSchema: createMockSchema(),
      gitPushInputSchema: createMockSchema(),
      terminalExecuteInputSchema: createMockSchema(),
    },
  };
});

// Mock all external dependencies
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/tools/definitions.js', () => ({
  AVAILABLE_TOOLS: [
    { name: 'bash_execute', description: 'Execute bash command' },
    { name: 'file_read', description: 'Read a file' },
    { name: 'file_write', description: 'Write to a file' },
    { name: 'file_edit', description: 'Edit a file' },
    { name: 'list_directory', description: 'List directory contents' },
  ],
  bashExecuteInputSchema: mockSchemas.bashExecuteInputSchema,
  fileReadInputSchema: mockSchemas.fileReadInputSchema,
  fileWriteInputSchema: mockSchemas.fileWriteInputSchema,
  fileEditInputSchema: mockSchemas.fileEditInputSchema,
  listDirectoryInputSchema: mockSchemas.listDirectoryInputSchema,
  codebaseSearchInputSchema: mockSchemas.codebaseSearchInputSchema,
  generateDbSchemaInputSchema: mockSchemas.generateDbSchemaInputSchema,
  generateMigrationsInputSchema: mockSchemas.generateMigrationsInputSchema,
  screenshotUrlInputSchema: mockSchemas.screenshotUrlInputSchema,
  browserRunScriptInputSchema: mockSchemas.browserRunScriptInputSchema,
  browserNavigateInputSchema: mockSchemas.browserNavigateInputSchema,
  browserClickInputSchema: mockSchemas.browserClickInputSchema,
  browserTypeInputSchema: mockSchemas.browserTypeInputSchema,
  browserGetContentInputSchema: mockSchemas.browserGetContentInputSchema,
  browserScreenshotInputSchema: mockSchemas.browserScreenshotInputSchema,
  gitStatusInputSchema: mockSchemas.gitStatusInputSchema,
  gitDiffInputSchema: mockSchemas.gitDiffInputSchema,
  gitLogInputSchema: mockSchemas.gitLogInputSchema,
  gitCommitInputSchema: mockSchemas.gitCommitInputSchema,
  gitBranchInputSchema: mockSchemas.gitBranchInputSchema,
  gitPushInputSchema: mockSchemas.gitPushInputSchema,
  terminalExecuteInputSchema: mockSchemas.terminalExecuteInputSchema,
}));

vi.mock('../../src/services/toolExecutionService.js', () => ({
  toolExecutionService: mockToolExecutionService,
  ToolExecutionService: vi.fn().mockImplementation(() => mockToolExecutionService),
}));

vi.mock('../../src/services/dbSchemaService.js', () => ({
  generateSchemaFromDescription: vi.fn(),
}));

vi.mock('../../src/services/migrationService.js', () => ({
  generateMigrations: vi.fn(),
}));

vi.mock('../../src/services/browserService.js', () => ({
  screenshotUrl: vi.fn(),
  browserRunScript: vi.fn(),
  browserNavigate: vi.fn(),
  browserClick: vi.fn(),
  browserType: vi.fn(),
  browserGetContent: vi.fn(),
  browserScreenshot: vi.fn(),
}));

vi.mock('../../src/services/planService.js', () => ({
  getPlan: vi.fn(),
  startPlanExecution: vi.fn(),
}));

vi.mock('../../src/services/specService.js', () => ({
  getSpecSession: vi.fn(),
}));

vi.mock('../../src/services/resilience.js', () => ({
  withRetry: vi.fn((fn) => fn),
  isRetryableError: vi.fn(() => false),
}));

vi.mock('../../src/services/bulkheads.js', () => ({
  checkRateLimit: vi.fn(() => true),
  getCircuitBreaker: vi.fn(() => ({ isOpen: () => false })),
}));

vi.mock('../../src/services/guardrailsService.js', () => ({
  checkInput: vi.fn(() => ({ passed: true, triggeredPolicies: [] })),
  checkOutput: vi.fn(() => ({ passed: true, action: 'allow' })),
}));

vi.mock('../../src/skills/index.js', () => ({
  skillRegistry: {
    getAllTools: vi.fn(() => []),
    getToolHandler: vi.fn(),
  },
}));

vi.mock('../../src/services/userSkillsService.js', () => ({
  createSkill: vi.fn(),
  editSkill: vi.fn(),
  runSkillTest: vi.fn(),
  listSkills: vi.fn(),
}));

vi.mock('../../src/mcp/registry.js', () => ({
  getMcpTools: vi.fn(() => []),
}));

vi.mock('../../src/skills/userToolsRegistry.js', () => ({
  getUserToolDefinitions: vi.fn(() => []),
  executeUserTool: vi.fn(),
  isUserTool: vi.fn(() => false),
}));

vi.mock('../../src/skills/base/SkillContext.js', () => ({
  createSkillContext: vi.fn(() => ({})),
}));

vi.mock('../../src/prompts/head.js', () => ({
  getHeadSystemPrompt: vi.fn(() => 'System prompt header'),
}));

vi.mock('../../src/prompts/compose.js', () => ({
  wrapModeContext: vi.fn((ctx) => ctx),
}));

vi.mock('../../src/prompts/chat/index.js', () => ({
  getChatModePrompt: vi.fn(() => 'Chat mode prompt'),
  getGAgentModePrompt: vi.fn(() => 'G-Agent mode prompt'),
}));

vi.mock('../../src/services/llmGateway.js', () => ({
  getStream: mockGetStream,
  COPILOT_SUB_MODELS: [],
}));

vi.mock('../../src/utils/outputFilters.js', () => ({
  filterOutput: vi.fn((s) => s),
}));

vi.mock('../../src/config/gAgentTools.js', () => ({
  getAllowedToolNames: vi.fn(() => null),
}));

vi.mock('../../src/services/intentCompilerService.js', () => ({
  parseAndEnrichIntent: vi.fn(),
}));

vi.mock('../../src/mcp/client.js', () => ({
  isMcpTool: vi.fn(() => false),
  executeMcpTool: vi.fn(),
}));

import { ClaudeServiceWithTools, type ChatStreamEvent } from '../../src/services/claudeServiceWithTools.js';
import { getPlan, startPlanExecution } from '../../src/services/planService.js';
import { getSpecSession } from '../../src/services/specService.js';
import { checkInput, checkOutput } from '../../src/services/guardrailsService.js';
import { skillRegistry } from '../../src/skills/index.js';
import { listSkills, createSkill, editSkill, runSkillTest } from '../../src/services/userSkillsService.js';
import { screenshotUrl, browserRunScript, browserNavigate, browserClick, browserType, browserGetContent, browserScreenshot } from '../../src/services/browserService.js';
import { generateSchemaFromDescription } from '../../src/services/dbSchemaService.js';
import { generateMigrations } from '../../src/services/migrationService.js';
import {
  bashExecuteInputSchema,
  fileReadInputSchema,
  fileWriteInputSchema,
  fileEditInputSchema,
  listDirectoryInputSchema,
} from '../../src/tools/index.js';
import { parseAndEnrichIntent } from '../../src/services/intentCompilerService.js';
import { getAllowedToolNames } from '../../src/config/gAgentTools.js';

describe('ClaudeServiceWithTools', () => {
  let service: ClaudeServiceWithTools;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClaudeServiceWithTools();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create a mock stream
  function createMockStream(events: any[]) {
    return {
      [Symbol.asyncIterator]: async function* () {
        for (const event of events) {
          yield event;
        }
      },
    };
  }

  // Helper to collect all events from stream
  async function collectEvents(stream: AsyncGenerator<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
    const events: ChatStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }
    return events;
  }

  describe('constructor', () => {
    it('should create service instance', () => {
      expect(service).toBeInstanceOf(ClaudeServiceWithTools);
    });
  });

  describe('generateChatStream', () => {
    describe('basic streaming', () => {
      it('should yield text events from stream', async () => {
        mockGetStream.mockReturnValue(
          createMockStream([
            { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } },
            { type: 'content_block_delta', delta: { type: 'text_delta', text: 'world!' } },
          ])
        );

        const messages = [{ role: 'user' as const, content: 'Say hello' }];
        const events = await collectEvents(service.generateChatStream(messages));

        const textEvents = events.filter((e) => e.type === 'text');
        expect(textEvents).toHaveLength(2);
        expect(textEvents[0]).toEqual({ type: 'text', text: 'Hello ' });
        expect(textEvents[1]).toEqual({ type: 'text', text: 'world!' });
      });

      it('should emit context event at start', async () => {
        mockGetStream.mockReturnValue(createMockStream([]));

        const messages = [{ role: 'user' as const, content: 'Test' }];
        const events = await collectEvents(service.generateChatStream(messages));

        const contextEvent = events.find((e) => e.type === 'context');
        expect(contextEvent).toBeDefined();
        expect(contextEvent).toMatchObject({
          type: 'context',
          value: expect.objectContaining({
            mode: expect.any(String),
            toolCount: expect.any(Number),
          }),
        });
      });

      it('should emit done event at end', async () => {
        mockGetStream.mockReturnValue(createMockStream([]));

        const messages = [{ role: 'user' as const, content: 'Test' }];
        const events = await collectEvents(service.generateChatStream(messages));

        const doneEvent = events.find((e) => e.type === 'done');
        expect(doneEvent).toEqual({ type: 'done' });
      });

      it('should emit autonomous event when autonomous mode enabled', async () => {
        mockGetStream.mockReturnValue(createMockStream([]));

        const messages = [{ role: 'user' as const, content: 'Test' }];
        const events = await collectEvents(
          service.generateChatStream(
            messages,
            undefined,
            undefined,
            'normal',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            true // autonomous
          )
        );

        const autonomousEvent = events.find((e) => e.type === 'autonomous');
        expect(autonomousEvent).toEqual({ type: 'autonomous', value: true });
      });
    });

    describe('abort handling', () => {
      it('should handle abort signal', async () => {
        const abortController = new AbortController();
        let yieldCount = 0;

        mockGetStream.mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'First' } };
            yieldCount++;
            abortController.abort();
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Second' } };
            yieldCount++;
          },
        });

        const messages = [{ role: 'user' as const, content: 'Test' }];
        const events = await collectEvents(
          service.generateChatStream(messages, abortController.signal)
        );

        // Should have stopped after abort
        const errorEvent = events.find((e) => e.type === 'error' && e.message === 'Stream aborted');
        expect(errorEvent).toBeDefined();
      });
    });

    describe('execute mode', () => {
      it('should handle execute mode with valid plan', async () => {
        const mockPlan = {
          id: 'plan_123',
          title: 'Test Plan',
          description: 'A test plan',
          status: 'approved',
          steps: [
            { id: 'step_1', order: 1, title: 'Step 1', description: 'Do something', fileChanges: [], dependencies: [], estimatedTime: '10m', status: 'pending', agentType: 'backend' },
          ],
          phases: [],
          totalEstimatedTime: '1h',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any;

        (getPlan as MockedFunction<typeof getPlan>).mockResolvedValue(mockPlan);
        mockGetStream.mockReturnValue(createMockStream([]));

        const messages = [{ role: 'user' as const, content: 'Execute the plan' }];
        const events = await collectEvents(
          service.generateChatStream(
            messages,
            undefined,
            undefined,
            'execute',
            undefined,
            'plan_123'
          )
        );

        expect(getPlan).toHaveBeenCalledWith('plan_123');
        expect(startPlanExecution).toHaveBeenCalledWith('plan_123');
        expect(events.find((e) => e.type === 'done')).toBeDefined();
      });

      it('should emit error for non-existent plan', async () => {
        (getPlan as MockedFunction<typeof getPlan>).mockResolvedValue(null);

        const messages = [{ role: 'user' as const, content: 'Execute' }];
        const events = await collectEvents(
          service.generateChatStream(
            messages,
            undefined,
            undefined,
            'execute',
            undefined,
            'invalid_plan'
          )
        );

        const errorEvent = events.find((e) => e.type === 'error');
        expect(errorEvent).toBeDefined();
        expect((errorEvent as any).message).toContain('not found');
      });

      it('should emit error for non-approved plan', async () => {
        (getPlan as MockedFunction<typeof getPlan>).mockResolvedValue({
          id: 'plan_123',
          status: 'draft',
          title: 'Draft Plan',
          description: 'Not approved',
          steps: [],
          phases: [],
          totalEstimatedTime: '1h',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);

        const messages = [{ role: 'user' as const, content: 'Execute' }];
        const events = await collectEvents(
          service.generateChatStream(
            messages,
            undefined,
            undefined,
            'execute',
            undefined,
            'plan_123'
          )
        );

        const errorEvent = events.find((e) => e.type === 'error');
        expect(errorEvent).toBeDefined();
        expect((errorEvent as any).message).toContain('not approved');
      });
    });

    describe('spec mode', () => {
      it('should handle spec mode with valid session', async () => {
        const mockSession = {
          id: 'spec_123',
          status: 'complete',
          originalRequest: 'Build a todo app',
          questions: [],
          answers: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          specification: {
            title: 'Test Spec',
            description: 'A test specification',
            sections: {
              requirements: [
                { title: 'Req 1', description: 'First requirement' },
              ],
            },
          },
        } as any;

        (getSpecSession as MockedFunction<typeof getSpecSession>).mockResolvedValue(mockSession);
        mockGetStream.mockReturnValue(createMockStream([]));

        const messages = [{ role: 'user' as const, content: 'Generate from spec' }];
        await collectEvents(
          service.generateChatStream(
            messages,
            undefined,
            undefined,
            'spec',
            undefined,
            undefined,
            'spec_123'
          )
        );

        expect(getSpecSession).toHaveBeenCalledWith('spec_123');
      });
    });

    describe('design mode', () => {
      it('should parse intent and emit intent event in design mode', async () => {
        const mockEnrichedIntent = {
          actors: ['user'],
          features: ['auth'],
          data_flows: [],
          tech_stack_hints: ['typescript'],
        };

        (parseAndEnrichIntent as MockedFunction<typeof parseAndEnrichIntent>).mockResolvedValue(
          mockEnrichedIntent as any
        );
        mockGetStream.mockReturnValue(createMockStream([]));

        const messages = [
          { role: 'user' as const, content: 'Build a todo app with user authentication' },
        ];
        const events = await collectEvents(
          service.generateChatStream(messages, undefined, undefined, 'design')
        );

        expect(parseAndEnrichIntent).toHaveBeenCalled();
        const intentEvent = events.find((e) => e.type === 'intent');
        expect(intentEvent).toBeDefined();
      });

      it('should handle intent parse failure gracefully', async () => {
        (parseAndEnrichIntent as MockedFunction<typeof parseAndEnrichIntent>).mockRejectedValue(
          new Error('Parse failed')
        );
        mockGetStream.mockReturnValue(createMockStream([]));

        const messages = [{ role: 'user' as const, content: 'Build something complex' }];
        const events = await collectEvents(
          service.generateChatStream(messages, undefined, undefined, 'design')
        );

        // Should continue without error
        expect(events.find((e) => e.type === 'done')).toBeDefined();
      });
    });

    describe('tool execution', () => {
      it('should emit tool_call and tool_result events', async () => {
        mockGetStream.mockReturnValue(
          createMockStream([
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_1',
                name: 'bash_execute',
                input: { command: 'ls' },
              },
            },
          ])
        );

        mockToolExecutionService.executeBash.mockResolvedValue({
          success: true,
          output: 'file1.txt\nfile2.txt',
          toolName: 'bash_execute',
          executionTime: 100,
        });

        const messages = [{ role: 'user' as const, content: 'List files' }];
        const events = await collectEvents(service.generateChatStream(messages));

        const toolCallEvent = events.find((e) => e.type === 'tool_call');
        expect(toolCallEvent).toMatchObject({
          type: 'tool_call',
          id: 'tool_1',
          name: 'bash_execute',
          input: { command: 'ls' },
        });

        const toolResultEvent = events.find((e) => e.type === 'tool_result');
        expect(toolResultEvent).toMatchObject({
          type: 'tool_result',
          id: 'tool_1',
          toolName: 'bash_execute',
          success: true,
          output: 'file1.txt\nfile2.txt',
        });
      });

      it('should handle tool execution error', async () => {
        mockGetStream.mockReturnValue(
          createMockStream([
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_1',
                name: 'file_read',
                input: { path: '/nonexistent' },
              },
            },
          ])
        );

        mockToolExecutionService.readFile.mockResolvedValue({
          success: false,
          error: 'File not found',
          toolName: 'file_read',
          executionTime: 10,
        });

        const messages = [{ role: 'user' as const, content: 'Read file' }];
        const events = await collectEvents(service.generateChatStream(messages));

        const toolResultEvent = events.find((e) => e.type === 'tool_result');
        expect(toolResultEvent).toMatchObject({
          type: 'tool_result',
          success: false,
        });
      });

      it('should handle unknown tool', async () => {
        mockGetStream.mockReturnValue(
          createMockStream([
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_1',
                name: 'unknown_tool',
                input: {},
              },
            },
          ])
        );

        const messages = [{ role: 'user' as const, content: 'Use unknown tool' }];
        const events = await collectEvents(service.generateChatStream(messages));

        const toolResultEvent = events.find((e) => e.type === 'tool_result');
        expect(toolResultEvent).toMatchObject({
          success: false,
          output: expect.stringContaining('Unknown tool'),
        });
      });
    });

    describe('Free Agent mode', () => {
      it('should apply guardrails in Free Agent mode', async () => {
        mockGetStream.mockReturnValue(
          createMockStream([
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_1',
                name: 'bash_execute',
                input: { command: 'echo test' },
              },
            },
          ])
        );

        mockToolExecutionService.executeBash.mockResolvedValue({
          success: true,
          output: 'test',
          toolName: 'bash_execute',
          executionTime: 50,
        });

        const messages = [{ role: 'user' as const, content: 'Run command' }];
        await collectEvents(
          service.generateChatStream(
            messages,
            undefined,
            '/workspace',
            'normal',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            'freeAgent'
          )
        );

        expect(checkInput).toHaveBeenCalled();
        expect(checkOutput).toHaveBeenCalled();
      });

      it('should block tool when guardrails fail', async () => {
        (checkInput as MockedFunction<typeof checkInput>).mockResolvedValue({
          passed: false,
          triggeredPolicies: [{ reason: 'Blocked command' }],
        } as any);

        mockGetStream.mockReturnValue(
          createMockStream([
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_1',
                name: 'bash_execute',
                input: { command: 'rm -rf /' },
              },
            },
          ])
        );

        const messages = [{ role: 'user' as const, content: 'Delete everything' }];
        const events = await collectEvents(
          service.generateChatStream(
            messages,
            undefined,
            '/workspace',
            'normal',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            'freeAgent'
          )
        );

        const toolResultEvent = events.find((e) => e.type === 'tool_result');
        expect(toolResultEvent).toMatchObject({
          success: false,
          output: expect.stringContaining('Guardrails blocked'),
        });
      });

      it('should filter tools by capabilities', async () => {
        (getAllowedToolNames as MockedFunction<typeof getAllowedToolNames>).mockReturnValue(
          new Set(['bash_execute', 'file_read'])
        );

        mockGetStream.mockReturnValue(createMockStream([]));

        const messages = [{ role: 'user' as const, content: 'Test' }];
        await collectEvents(
          service.generateChatStream(
            messages,
            undefined,
            '/workspace',
            'normal',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            'freeAgent',
            ['file_read', 'code_execute'] as any
          )
        );

        expect(getAllowedToolNames).toHaveBeenCalledWith(['file_read', 'code_execute']);
      });
    });

    describe('error handling', () => {
      it('should emit error event with auth error details', async () => {
        mockGetStream.mockImplementation(() => {
          throw Object.assign(new Error('Unauthorized'), { status: 401 });
        });

        const messages = [{ role: 'user' as const, content: 'Test' }];
        const events = await collectEvents(service.generateChatStream(messages));

        const errorEvent = events.find((e) => e.type === 'error') as any;
        expect(errorEvent).toBeDefined();
        expect(errorEvent.errorType).toBe('auth_error');
        expect(errorEvent.retryable).toBe(false);
      });

      it('should emit error event with rate limit details', async () => {
        mockGetStream.mockImplementation(() => {
          throw Object.assign(new Error('Rate limited'), {
            status: 429,
            headers: { 'retry-after': '60' },
          });
        });

        const messages = [{ role: 'user' as const, content: 'Test' }];
        const events = await collectEvents(service.generateChatStream(messages));

        const errorEvent = events.find((e) => e.type === 'error') as any;
        expect(errorEvent).toBeDefined();
        expect(errorEvent.errorType).toBe('rate_limit');
        expect(errorEvent.retryable).toBe(true);
        expect(errorEvent.retryAfter).toBe(60);
      });

      it('should emit error event with service error details', async () => {
        mockGetStream.mockImplementation(() => {
          throw Object.assign(new Error('Service unavailable'), { status: 503 });
        });

        const messages = [{ role: 'user' as const, content: 'Test' }];
        const events = await collectEvents(service.generateChatStream(messages));

        const errorEvent = events.find((e) => e.type === 'error') as any;
        expect(errorEvent).toBeDefined();
        expect(errorEvent.errorType).toBe('service_error');
        expect(errorEvent.retryable).toBe(true);
      });

      it('should emit error event with timeout details', async () => {
        mockGetStream.mockImplementation(() => {
          throw Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' });
        });

        const messages = [{ role: 'user' as const, content: 'Test' }];
        const events = await collectEvents(service.generateChatStream(messages));

        const errorEvent = events.find((e) => e.type === 'error') as any;
        expect(errorEvent).toBeDefined();
        expect(errorEvent.errorType).toBe('timeout');
        expect(errorEvent.retryable).toBe(true);
      });

      it('should emit error event with network error details', async () => {
        mockGetStream.mockImplementation(() => {
          throw Object.assign(new Error('Network error'), { code: 'ENOTFOUND' });
        });

        const messages = [{ role: 'user' as const, content: 'Test' }];
        const events = await collectEvents(service.generateChatStream(messages));

        const errorEvent = events.find((e) => e.type === 'error') as any;
        expect(errorEvent).toBeDefined();
        expect(errorEvent.errorType).toBe('network_error');
        expect(errorEvent.retryable).toBe(true);
      });
    });

    describe('multimodal content', () => {
      it('should handle array content with text blocks', async () => {
        mockGetStream.mockReturnValue(createMockStream([]));

        const messages = [
          {
            role: 'user' as const,
            content: [
              { type: 'text', text: 'Describe this image' },
            ] as any,
          },
        ];
        await collectEvents(service.generateChatStream(messages));

        expect(mockGetStream).toHaveBeenCalled();
      });

      it('should handle image content blocks', async () => {
        mockGetStream.mockReturnValue(createMockStream([]));

        const messages = [
          {
            role: 'user' as const,
            content: [
              { type: 'text', text: 'What is this?' },
              { type: 'image', source: { type: 'url', url: 'https://example.com/image.png' } },
            ] as any,
          },
        ];
        await collectEvents(service.generateChatStream(messages));

        expect(mockGetStream).toHaveBeenCalled();
      });
    });
  });

  describe('skill tools', () => {
    it('should execute skill tools', async () => {
      const mockSkillHandler = vi.fn().mockResolvedValue({
        success: true,
        output: 'Skill executed',
      });

      (skillRegistry.getToolHandler as MockedFunction<typeof skillRegistry.getToolHandler>).mockReturnValue({
        skill: { manifest: { id: 'test_skill' } },
        handler: mockSkillHandler,
      } as any);

      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'skill_test',
              input: { param: 'value' },
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'Use skill' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: true,
        output: 'Skill executed',
      });
    });

    it('should handle skill_list tool', async () => {
      // Mock getToolHandler to return a handler that calls listSkills
      const skills = [
        { id: 'skill_1', name: 'Test Skill', version: '1.0.0', isUser: false },
        { id: 'skill_2', name: 'User Skill', version: '1.0.0', isUser: true },
      ];
      (listSkills as MockedFunction<typeof listSkills>).mockResolvedValue(skills);
      
      const mockHandler = vi.fn().mockImplementation(async () => {
        const skillList = await listSkills();
        const lines = skillList.map((s: any) => `- ${s.id}: ${s.name} (${s.version})${s.isUser ? ' [user]' : ''}`);
        return { success: true, output: `Available skills:\n${lines.join('\n')}` };
      });
      
      (skillRegistry.getToolHandler as MockedFunction<typeof skillRegistry.getToolHandler>).mockReturnValue({
        skill: { manifest: { id: 'skill_management' } },
        handler: mockHandler,
      } as any);
      
      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'skill_list',
              input: {},
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'List skills' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: true,
        output: expect.stringContaining('Available skills'),
      });
    });

    it('should handle skill_create tool', async () => {
      // Mock getToolHandler to return a handler for skill_create
      const mockHandler = vi.fn().mockResolvedValue({
        success: true,
        output: 'Skill created: new_skill',
      });
      
      (skillRegistry.getToolHandler as MockedFunction<typeof skillRegistry.getToolHandler>).mockReturnValue({
        skill: { manifest: { id: 'skill_management' } },
        handler: mockHandler,
      } as any);

      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'skill_create',
              input: { name: 'New Skill', description: 'A new skill' },
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'Create skill' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: true,
        output: expect.stringContaining('Skill created'),
      });
    });

    it('should handle skill_edit tool', async () => {
      // Mock getToolHandler to return a handler for skill_edit
      const mockHandler = vi.fn().mockResolvedValue({
        success: true,
        output: 'Skill skill_1 updated',
      });
      
      (skillRegistry.getToolHandler as MockedFunction<typeof skillRegistry.getToolHandler>).mockReturnValue({
        skill: { manifest: { id: 'skill_management' } },
        handler: mockHandler,
      } as any);

      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'skill_edit',
              input: { skillId: 'skill_1', updates: { name: 'Updated' } },
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'Edit skill' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: true,
        output: expect.stringContaining('updated'),
      });
    });

    it('should handle skill_run_test tool', async () => {
      // Mock getToolHandler to return a handler for skill_run_test
      const mockHandler = vi.fn().mockResolvedValue({
        success: true,
        output: 'Test passed (100ms)',
      });
      
      (skillRegistry.getToolHandler as MockedFunction<typeof skillRegistry.getToolHandler>).mockReturnValue({
        skill: { manifest: { id: 'skill_management' } },
        handler: mockHandler,
      } as any);

      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'skill_run_test',
              input: { skillId: 'skill_1', input: {} },
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'Run skill test' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: true,
        output: expect.stringContaining('Test passed'),
      });
    });
  });

  describe('browser tools', () => {
    it('should handle screenshot_url tool', async () => {
      (screenshotUrl as MockedFunction<typeof screenshotUrl>).mockResolvedValue({
        ok: true,
        imageBase64: 'base64encodedimage',
      });

      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'screenshot_url',
              input: { url: 'https://example.com' },
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'Take screenshot' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: true,
        output: expect.stringContaining('Screenshot captured'),
      });
    });

    it('should handle browser_navigate tool', async () => {
      (browserNavigate as MockedFunction<typeof browserNavigate>).mockResolvedValue({
        ok: true,
        result: { url: 'https://example.com', title: 'Example' },
      });

      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'browser_navigate',
              input: { url: 'https://example.com' },
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'Navigate' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: true,
        output: expect.stringContaining('Navigated to'),
      });
    });
  });

  describe('database tools', () => {
    it('should handle generate_db_schema tool', async () => {
      (generateSchemaFromDescription as MockedFunction<typeof generateSchemaFromDescription>).mockResolvedValue({
        ddl: 'CREATE TABLE users (...)',
        tables: ['users'],
      });

      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'generate_db_schema',
              input: { description: 'User table', targetDb: 'postgres', format: 'sql' },
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'Generate schema' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: true,
        output: expect.stringContaining('DDL'),
      });
    });

    it('should handle generate_migrations tool', async () => {
      (generateMigrations as MockedFunction<typeof generateMigrations>).mockResolvedValue({
        migrations: ['ALTER TABLE users ADD COLUMN email VARCHAR(255);'],
        summary: 'Added email column',
      });

      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'generate_migrations',
              input: { schemaDdl: 'CREATE TABLE users (...)', targetDb: 'postgres' },
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'Generate migrations' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: true,
        output: expect.stringContaining('Migration'),
      });
    });
  });

  describe('git tools', () => {
    it('should handle git_status tool', async () => {
      mockToolExecutionService.gitStatus.mockResolvedValue({
        success: true,
        output: 'On branch main\nnothing to commit',
        toolName: 'git_status',
        executionTime: 50,
      });

      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'git_status',
              input: {},
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'Git status' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: true,
        output: expect.stringContaining('On branch main'),
      });
    });

    it('should handle git_commit tool', async () => {
      mockToolExecutionService.gitCommit.mockResolvedValue({
        success: true,
        output: 'Committed: abc123',
        toolName: 'git_commit',
        executionTime: 100,
      });

      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'git_commit',
              input: { message: 'Test commit' },
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'Commit changes' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: true,
      });
    });
  });

  describe('input validation', () => {
    it('should return error for invalid bash_execute input', async () => {
      mockSchemas.bashExecuteInputSchema.safeParse.mockReturnValueOnce({
        success: false,
        data: undefined,
        error: { message: 'Invalid command' },
      });

      mockGetStream.mockReturnValue(
        createMockStream([
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'tool_1',
              name: 'bash_execute',
              input: {},
            },
          },
        ])
      );

      const messages = [{ role: 'user' as const, content: 'Run command' }];
      const events = await collectEvents(service.generateChatStream(messages));

      const toolResultEvent = events.find((e) => e.type === 'tool_result');
      expect(toolResultEvent).toMatchObject({
        success: false,
        output: expect.stringContaining('Invalid input'),
      });
    });
  });
});
