/**
 * Git Operations Skill Tests
 * Tests for the git operations skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, SkillExecutionInput, SkillEvent } from '../../src/skills/types.js';

// Mock dependencies before importing the skill
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/resilience.js', () => ({
  withResilience: vi.fn((fn) => fn),
}));

// Create mock git service
function createMockGitService() {
  return {
    status: vi.fn().mockResolvedValue({
      branch: 'main',
      staged: ['src/index.ts', 'src/utils.ts'],
      unstaged: ['src/other.ts'],
      untracked: ['new-file.ts'],
    }),
    diff: vi.fn().mockResolvedValue(`
diff --git a/src/index.ts b/src/index.ts
index 1234567..abcdefg 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,5 @@
+import { helper } from './helper';
+
 export function main() {
   console.log('Hello');
+  helper();
 }
    `),
    commit: vi.fn().mockResolvedValue('[main abc1234] feat: add helper function'),
    log: vi.fn().mockResolvedValue([
      { hash: 'abc1234567890', message: 'feat: add helper function', author: 'John', date: new Date() },
      { hash: 'def4567890123', message: 'fix: resolve issue', author: 'Jane', date: new Date() },
      { hash: 'ghi7890123456', message: 'chore: update deps', author: 'John', date: new Date() },
    ]),
    branch: vi.fn().mockResolvedValue('feature/add-tests'),
    branches: vi.fn().mockResolvedValue(['main', 'feature/add-tests', 'fix/bug-123']),
  };
}

// Create mock context
function createMockContext(overrides: Partial<SkillContext> = {}): SkillContext {
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
        complete: vi.fn().mockResolvedValue('Generated commit message'),
        stream: vi.fn(),
      },
      fileSystem: {
        readFile: vi.fn().mockResolvedValue('file content'),
        writeFile: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        listDirectory: vi.fn().mockResolvedValue([]),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        isWithinWorkspace: vi.fn().mockReturnValue(true),
      },
      git: createMockGitService(),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    },
    emit: vi.fn(),
    isCancelled: () => false,
    ...overrides,
  };
}

// Mock manifest for testing
const gitOperationsManifest = {
  id: 'git-operations',
  name: 'Git Operations',
  version: '1.0.0',
  description: 'Git workflow automation: intelligent commit messages, branch management, PR descriptions, and conflict resolution',
  author: 'G-Rump Team',
  category: 'git',
  icon: 'git-branch',
  tags: ['git', 'commit', 'branch', 'pr', 'merge', 'version-control'],
  capabilities: {
    providesTools: true,
    providesRoutes: true,
    providesPrompts: true,
    requiresWorkspace: true,
    supportsStreaming: true,
    supportsBackground: false,
  },
  permissions: ['file_read', 'git', 'bash_execute'],
  triggers: {
    keywords: ['commit', 'git', 'branch', 'merge', 'pr', 'pull request', 'push', 'stage', 'diff'],
    patterns: ['(create|make|write)\\s+(a\\s+)?commit', 'commit\\s+message', 'git\\s+\\w+'],
    commands: ['/commit', '/git', '/branch', '/pr'],
  },
};

describe('GitOperationsSkill', () => {
  let gitOperationsSkill: any;
  let context: SkillContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    context = createMockContext();

    // Dynamically import to get fresh module with mocks
    const module = await import('../../src/skills/git-operations/index.js');
    gitOperationsSkill = module.default;
    
    // Inject the manifest (normally done by SkillRegistry)
    gitOperationsSkill.manifest = gitOperationsManifest;
  });

  describe('manifest', () => {
    it('should have proper manifest structure', () => {
      expect(gitOperationsSkill.manifest).toBeDefined();
    });
  });

  describe('prompts', () => {
    it('should have system prompt defined', () => {
      expect(gitOperationsSkill.prompts.system).toBeDefined();
      expect(gitOperationsSkill.prompts.system).toContain('Git');
    });

    it('should have templates for commit, PR, and branch', () => {
      expect(gitOperationsSkill.prompts.templates).toBeDefined();
      expect(gitOperationsSkill.prompts.templates.commitMessage).toBeDefined();
      expect(gitOperationsSkill.prompts.templates.prDescription).toBeDefined();
      expect(gitOperationsSkill.prompts.templates.branchName).toBeDefined();
    });
  });

  describe('tools', () => {
    it('should have tool definitions', () => {
      expect(gitOperationsSkill.tools.definitions).toBeDefined();
      expect(gitOperationsSkill.tools.definitions.length).toBeGreaterThan(0);
    });

    it('should have handlers for all tools', () => {
      const toolNames = gitOperationsSkill.tools.definitions.map((t: any) => t.name);
      expect(toolNames).toContain('generate_commit_message');
      expect(toolNames).toContain('git_status');
      expect(toolNames).toContain('git_diff');
      expect(toolNames).toContain('git_log');
      expect(toolNames).toContain('suggest_branch_name');
      expect(toolNames).toContain('generate_pr_description');
      expect(toolNames).toContain('create_commit');

      expect(gitOperationsSkill.tools.handlers.generate_commit_message).toBeDefined();
      expect(gitOperationsSkill.tools.handlers.git_status).toBeDefined();
      expect(gitOperationsSkill.tools.handlers.git_diff).toBeDefined();
      expect(gitOperationsSkill.tools.handlers.git_log).toBeDefined();
    });
  });

  describe('routes', () => {
    it('should have routes defined', () => {
      expect(gitOperationsSkill.routes).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should yield started event', async () => {
      const input: SkillExecutionInput = {
        message: 'git status',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      expect(events[0].type).toBe('started');
    });

    it('should yield thinking event', async () => {
      const input: SkillExecutionInput = {
        message: 'git status',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const thinkingEvent = events.find((e) => e.type === 'thinking');
      expect(thinkingEvent).toBeDefined();
    });

    it('should detect commit operation', async () => {
      const input: SkillExecutionInput = {
        message: '/commit the changes',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      expect(context.services.git?.status).toHaveBeenCalled();
    });

    it('should detect status operation', async () => {
      const input: SkillExecutionInput = {
        message: 'show me the git status',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      expect(context.services.git?.status).toHaveBeenCalled();
    });

    it('should detect branch operation', async () => {
      const input: SkillExecutionInput = {
        message: '/branch create for adding user authentication',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const outputEvent = events.find((e) => e.type === 'output');
      expect(outputEvent).toBeDefined();
    });

    it('should detect PR operation', async () => {
      const input: SkillExecutionInput = {
        message: 'generate a pull request description',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      expect(context.services.git?.branch).toHaveBeenCalled();
      expect(context.services.git?.log).toHaveBeenCalled();
    });

    it('should handle missing git service', async () => {
      const contextWithoutGit = createMockContext();
      contextWithoutGit.services.git = undefined;

      const input: SkillExecutionInput = {
        message: 'git status',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, contextWithoutGit);

      for await (const event of generator) {
        events.push(event);
      }

      const outputEvent = events.find((e) => e.type === 'output');
      expect(outputEvent).toBeDefined();
      if (outputEvent?.type === 'output') {
        expect(outputEvent.content).toContain('not available');
      }
    });

    it('should yield completed event on success', async () => {
      const input: SkillExecutionInput = {
        message: 'git status',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const completedEvent = events.find((e) => e.type === 'completed');
      expect(completedEvent).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(context.services.git!.status).mockRejectedValue(new Error('Git failed'));

      const input: SkillExecutionInput = {
        message: 'git status',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });
  });

  describe('tool handlers', () => {
    describe('generate_commit_message', () => {
      it('should generate commit message from staged changes', async () => {
        const input = {};

        const result = await gitOperationsSkill.tools.handlers.generate_commit_message(
          input,
          context
        );

        expect(result.success).toBe(true);
        expect(result.output).toBeDefined();
        expect(context.services.git?.status).toHaveBeenCalled();
        expect(context.services.git?.diff).toHaveBeenCalled();
      });

      it('should return error when no staged changes', async () => {
        vi.mocked(context.services.git!.status).mockResolvedValue({
          branch: 'main',
          staged: [],
          unstaged: ['file.ts'],
          untracked: [],
        });

        const input = {};

        const result = await gitOperationsSkill.tools.handlers.generate_commit_message(
          input,
          context
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('No staged');
      });

      it('should return error when git is not available', async () => {
        const contextWithoutGit = createMockContext();
        contextWithoutGit.services.git = undefined;

        const input = {};

        const result = await gitOperationsSkill.tools.handlers.generate_commit_message(
          input,
          contextWithoutGit
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('not available');
      });
    });

    describe('git_status', () => {
      it('should return git status', async () => {
        const input = {};

        const result = await gitOperationsSkill.tools.handlers.git_status(input, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain('Branch');
        expect(result.output).toContain('Staged');
        expect(result.metadata?.status).toBeDefined();
      });

      it('should return error when git is not available', async () => {
        const contextWithoutGit = createMockContext();
        contextWithoutGit.services.git = undefined;

        const input = {};

        const result = await gitOperationsSkill.tools.handlers.git_status(input, contextWithoutGit);

        expect(result.success).toBe(false);
      });
    });

    describe('git_diff', () => {
      it('should return git diff', async () => {
        const input = { staged: true };

        const result = await gitOperationsSkill.tools.handlers.git_diff(input, context);

        expect(result.success).toBe(true);
        expect(context.services.git?.diff).toHaveBeenCalledWith({ staged: true });
      });

      it('should handle unstaged diff', async () => {
        const input = { staged: false };

        const result = await gitOperationsSkill.tools.handlers.git_diff(input, context);

        expect(result.success).toBe(true);
        expect(context.services.git?.diff).toHaveBeenCalledWith({ staged: false });
      });

      it('should return "No changes" when diff is empty', async () => {
        vi.mocked(context.services.git!.diff).mockResolvedValue('');

        const input = {};

        const result = await gitOperationsSkill.tools.handlers.git_diff(input, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain('No changes');
      });
    });

    describe('git_log', () => {
      it('should return git log', async () => {
        const input = { count: 5 };

        const result = await gitOperationsSkill.tools.handlers.git_log(input, context);

        expect(result.success).toBe(true);
        expect(context.services.git?.log).toHaveBeenCalledWith(5);
        expect(result.output).toContain('abc1234');
      });

      it('should use default count of 10', async () => {
        const input = {};

        const result = await gitOperationsSkill.tools.handlers.git_log(input, context);

        expect(result.success).toBe(true);
        expect(context.services.git?.log).toHaveBeenCalledWith(10);
      });
    });

    describe('suggest_branch_name', () => {
      it('should suggest feature branch for feature task', async () => {
        const input = { task: 'add user authentication' };

        const result = await gitOperationsSkill.tools.handlers.suggest_branch_name(input, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain('feature/');
      });

      it('should suggest fix branch for bug fix task', async () => {
        const input = { task: 'fix login bug' };

        const result = await gitOperationsSkill.tools.handlers.suggest_branch_name(input, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain('fix/');
      });

      it('should suggest refactor branch for refactoring task', async () => {
        const input = { task: 'refactor authentication module' };

        const result = await gitOperationsSkill.tools.handlers.suggest_branch_name(input, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain('refactor/');
      });

      it('should suggest docs branch for documentation task', async () => {
        const input = { task: 'document API endpoints' };

        const result = await gitOperationsSkill.tools.handlers.suggest_branch_name(input, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain('docs/');
      });

      it('should suggest test branch for test task', async () => {
        const input = { task: 'add tests for user service' };

        const result = await gitOperationsSkill.tools.handlers.suggest_branch_name(input, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain('test/');
      });

      it('should return error when task is missing', async () => {
        const input = {};

        const result = await gitOperationsSkill.tools.handlers.suggest_branch_name(input, context);

        expect(result.success).toBe(false);
        expect(result.error).toContain('required');
      });
    });

    describe('generate_pr_description', () => {
      it('should generate PR description', async () => {
        const input = {};

        const result = await gitOperationsSkill.tools.handlers.generate_pr_description(
          input,
          context
        );

        expect(result.success).toBe(true);
        expect(result.output).toContain('Summary');
        expect(result.output).toContain('Changes');
        expect(context.services.git?.branch).toHaveBeenCalled();
        expect(context.services.git?.log).toHaveBeenCalled();
      });

      it('should include commit history in PR', async () => {
        const input = {};

        const result = await gitOperationsSkill.tools.handlers.generate_pr_description(
          input,
          context
        );

        expect(result.success).toBe(true);
        expect(result.output).toContain('feat');
      });
    });

    describe('create_commit', () => {
      it('should create a commit with message', async () => {
        const input = {
          message: 'feat: add new feature',
        };

        const result = await gitOperationsSkill.tools.handlers.create_commit(input, context);

        expect(result.success).toBe(true);
        expect(context.services.git?.commit).toHaveBeenCalledWith('feat: add new feature', undefined);
      });

      it('should create a commit with specific files', async () => {
        const input = {
          message: 'fix: resolve bug',
          files: ['src/index.ts', 'src/utils.ts'],
        };

        const result = await gitOperationsSkill.tools.handlers.create_commit(input, context);

        expect(result.success).toBe(true);
        expect(context.services.git?.commit).toHaveBeenCalledWith('fix: resolve bug', [
          'src/index.ts',
          'src/utils.ts',
        ]);
      });

      it('should return error when message is missing', async () => {
        const input = {};

        const result = await gitOperationsSkill.tools.handlers.create_commit(input, context);

        expect(result.success).toBe(false);
        expect(result.error).toContain('required');
      });

      it('should return error when git is not available', async () => {
        const contextWithoutGit = createMockContext();
        contextWithoutGit.services.git = undefined;

        const input = { message: 'test commit' };

        const result = await gitOperationsSkill.tools.handlers.create_commit(
          input,
          contextWithoutGit
        );

        expect(result.success).toBe(false);
      });
    });
  });

  describe('commit type inference', () => {
    it('should infer test type from test files', async () => {
      vi.mocked(context.services.git!.status).mockResolvedValue({
        branch: 'main',
        staged: ['tests/index.test.ts', 'tests/utils.spec.ts'],
        unstaged: [],
        untracked: [],
      });

      const input = {};

      const result = await gitOperationsSkill.tools.handlers.generate_commit_message(
        input,
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('test');
    });

    it('should infer docs type from documentation files', async () => {
      vi.mocked(context.services.git!.status).mockResolvedValue({
        branch: 'main',
        staged: ['README.md', 'docs/api.md'],
        unstaged: [],
        untracked: [],
      });

      const input = {};

      const result = await gitOperationsSkill.tools.handlers.generate_commit_message(
        input,
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('docs');
    });

    it('should infer chore type from config files', async () => {
      vi.mocked(context.services.git!.status).mockResolvedValue({
        branch: 'main',
        staged: ['package.json', 'tsconfig.json'],
        unstaged: [],
        untracked: [],
      });

      const input = {};

      const result = await gitOperationsSkill.tools.handlers.generate_commit_message(
        input,
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('chore');
    });

    it('should infer fix type from diff containing fix/bug', async () => {
      vi.mocked(context.services.git!.status).mockResolvedValue({
        branch: 'main',
        staged: ['src/service.ts'],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(context.services.git!.diff).mockResolvedValue('// fix: resolve null pointer bug');

      const input = {};

      const result = await gitOperationsSkill.tools.handlers.generate_commit_message(
        input,
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('fix');
    });
  });

  describe('scope inference', () => {
    it('should infer scope from common directory', async () => {
      vi.mocked(context.services.git!.status).mockResolvedValue({
        branch: 'main',
        staged: ['frontend/index.ts', 'frontend/utils.ts'],
        unstaged: [],
        untracked: [],
      });

      const input = {};

      const result = await gitOperationsSkill.tools.handlers.generate_commit_message(
        input,
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('frontend');
    });
  });

  describe('status formatting', () => {
    it('should format status with all sections', async () => {
      const input: SkillExecutionInput = {
        message: 'git status',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const outputEvent = events.find((e) => e.type === 'output');
      expect(outputEvent).toBeDefined();
      if (outputEvent?.type === 'output') {
        expect(outputEvent.content).toContain('Branch');
        expect(outputEvent.content).toContain('Staged');
        expect(outputEvent.content).toContain('Unstaged');
        expect(outputEvent.content).toContain('Untracked');
      }
    });

    it('should show clean working tree when no changes', async () => {
      vi.mocked(context.services.git!.status).mockResolvedValue({
        branch: 'main',
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const input: SkillExecutionInput = {
        message: 'git status',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const outputEvent = events.find((e) => e.type === 'output');
      expect(outputEvent).toBeDefined();
      if (outputEvent?.type === 'output') {
        expect(outputEvent.content).toContain('clean');
      }
    });
  });

  describe('commit flow', () => {
    it('should show suggested commit message for staged changes', async () => {
      const input: SkillExecutionInput = {
        message: '/commit',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const outputEvent = events.find((e) => e.type === 'output');
      expect(outputEvent).toBeDefined();
      if (outputEvent?.type === 'output') {
        expect(outputEvent.content).toContain('Suggested Commit');
        expect(outputEvent.content).toContain('git commit');
      }
    });

    it('should show info when no staged changes', async () => {
      vi.mocked(context.services.git!.status).mockResolvedValue({
        branch: 'main',
        staged: [],
        unstaged: ['file.ts'],
        untracked: ['new.ts'],
      });

      const input: SkillExecutionInput = {
        message: '/commit',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const outputEvent = events.find((e) => e.type === 'output');
      expect(outputEvent).toBeDefined();
      if (outputEvent?.type === 'output') {
        expect(outputEvent.content).toContain('No staged');
      }
    });
  });

  describe('branch flow', () => {
    it('should suggest branch name from task description', async () => {
      const input: SkillExecutionInput = {
        message: '/branch add user authentication feature',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const outputEvent = events.find((e) => e.type === 'output');
      expect(outputEvent).toBeDefined();
      if (outputEvent?.type === 'output') {
        expect(outputEvent.content).toContain('Suggested Branch');
        expect(outputEvent.content).toContain('git checkout -b');
      }
    });
  });

  describe('PR flow', () => {
    it('should generate PR description with title and body', async () => {
      const input: SkillExecutionInput = {
        message: '/pr',
      };

      const events: SkillEvent[] = [];
      const generator = gitOperationsSkill.execute(input, context);

      for await (const event of generator) {
        events.push(event);
      }

      const outputEvent = events.find((e) => e.type === 'output');
      expect(outputEvent).toBeDefined();
      if (outputEvent?.type === 'output') {
        expect(outputEvent.content).toContain('Pull Request');
        expect(outputEvent.content).toContain('Title');
        expect(outputEvent.content).toContain('Body');
      }
    });
  });
});
