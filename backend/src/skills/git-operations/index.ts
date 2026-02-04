/**
 * Git Operations Skill
 * Git workflow automation: commits, branches, PRs, and more
 */

import { Router } from 'express';
import { BaseSkill } from '../base/BaseSkill.js';
import type {
  SkillManifest,
  SkillTools,
  SkillPrompts,
  SkillContext,
  SkillExecutionInput,
  SkillExecutionResult,
  SkillEvent,
  ToolExecutionResult,
} from '../types.js';
import { GIT_OPERATIONS_SYSTEM_PROMPT, templates } from './prompts.js';
import { definitions } from './tools.js';
import type { CommitMessage, CommitType, BranchSuggestion } from './types.js';

// Load manifest

class GitOperationsSkill extends BaseSkill {
  manifest!: SkillManifest;

  prompts: SkillPrompts = {
    system: GIT_OPERATIONS_SYSTEM_PROMPT,
    templates,
  };

  tools: SkillTools = {
    definitions,
    handlers: {
      generate_commit_message: this.handleGenerateCommitMessage.bind(this),
      git_status: this.handleGitStatus.bind(this),
      git_diff: this.handleGitDiff.bind(this),
      git_log: this.handleGitLog.bind(this),
      suggest_branch_name: this.handleSuggestBranchName.bind(this),
      generate_pr_description: this.handleGeneratePRDescription.bind(this),
      create_commit: this.handleCreateCommit.bind(this),
    },
  };

  declare routes: Router;

  constructor() {
    super();
    this.routes = this.createRoutes();
  }

  private createRoutes(): Router {
    const router = Router();

    // Generate commit message
    router.post('/commit-message', async (req, res): Promise<void> => {
      try {
        const { workspacePath } = req.body;

        if (!workspacePath) {
          res.status(400).json({ error: 'workspacePath is required' });
          return;
        }

        res.json({ message: 'Commit message generation started' });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to generate commit message',
        });
      }
    });

    // Get status
    router.get('/status', async (req, res) => {
      try {
        res.json({ message: 'Git status endpoint' });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to get status',
        });
      }
    });

    return router;
  }

  /**
   * Main execution - handle git operations
   */
  async *execute(
    input: SkillExecutionInput,
    context: SkillContext
  ): AsyncGenerator<SkillEvent, SkillExecutionResult, undefined> {
    const startTime = Date.now();

    yield {
      type: 'started',
      skillId: this.manifest.id,
      timestamp: new Date(),
    };

    try {
      const operation = this.detectOperation(input.message);

      yield {
        type: 'thinking',
        content: `Detected operation: ${operation}`,
      };

      let output = '';

      switch (operation) {
        case 'commit':
          output = await this.handleCommitFlow(context);
          break;
        case 'status':
          output = await this.handleStatusFlow(context);
          break;
        case 'branch':
          output = await this.handleBranchFlow(input.message, context);
          break;
        case 'pr':
          output = await this.handlePRFlow(context);
          break;
        default:
          output = await this.handleStatusFlow(context);
      }

      yield {
        type: 'output',
        content: output,
      };

      yield {
        type: 'completed',
        summary: `Completed ${operation} operation`,
        duration: Date.now() - startTime,
      };

      return {
        success: true,
        output,
        events: [],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      yield {
        type: 'error',
        error: err,
        recoverable: false,
      };

      return {
        success: false,
        output: '',
        events: [],
        duration: Date.now() - startTime,
        error: err,
      };
    }
  }

  /**
   * Detect which git operation the user wants
   */
  private detectOperation(message: string): 'commit' | 'status' | 'branch' | 'pr' | 'diff' | 'log' {
    const lower = message.toLowerCase();

    if (lower.includes('commit') || lower.includes('/commit')) {
      return 'commit';
    }
    if (lower.includes('branch') || lower.includes('/branch')) {
      return 'branch';
    }
    if (lower.includes('pr') || lower.includes('pull request') || lower.includes('/pr')) {
      return 'pr';
    }
    if (lower.includes('diff')) {
      return 'diff';
    }
    if (lower.includes('log') || lower.includes('history')) {
      return 'log';
    }

    return 'status';
  }

  /**
   * Handle commit flow
   */
  private async handleCommitFlow(context: SkillContext): Promise<string> {
    if (!context.services.git) {
      return 'Git is not available in the current workspace.';
    }

    const status = await context.services.git.status();
    const diff = await context.services.git.diff({ staged: true });

    if (status.staged.length === 0) {
      return `No staged changes to commit.\n\nUnstaged files:\n${status.unstaged.join('\n') || 'None'}\n\nUntracked files:\n${status.untracked.join('\n') || 'None'}`;
    }

    const commitMessage = this.generateCommitMessage(status.staged, diff);

    return `## Suggested Commit Message\n\n\`\`\`\n${commitMessage.full}\n\`\`\`\n\n### Staged Changes\n${status.staged.join('\n')}\n\nTo commit, use:\n\`\`\`bash\ngit commit -m "${commitMessage.full.replace(/"/g, '\\"')}"\n\`\`\``;
  }

  /**
   * Handle status flow
   */
  private async handleStatusFlow(context: SkillContext): Promise<string> {
    if (!context.services.git) {
      return 'Git is not available in the current workspace.';
    }

    const status = await context.services.git.status();
    const lines: string[] = [];

    lines.push(`## Git Status\n`);
    lines.push(`**Branch:** ${status.branch}\n`);

    if (status.staged.length > 0) {
      lines.push(`### Staged Changes (${status.staged.length})`);
      status.staged.forEach((f) => lines.push(`- ${f}`));
      lines.push('');
    }

    if (status.unstaged.length > 0) {
      lines.push(`### Unstaged Changes (${status.unstaged.length})`);
      status.unstaged.forEach((f) => lines.push(`- ${f}`));
      lines.push('');
    }

    if (status.untracked.length > 0) {
      lines.push(`### Untracked Files (${status.untracked.length})`);
      status.untracked.forEach((f) => lines.push(`- ${f}`));
      lines.push('');
    }

    if (
      status.staged.length === 0 &&
      status.unstaged.length === 0 &&
      status.untracked.length === 0
    ) {
      lines.push('Working tree is clean.');
    }

    return lines.join('\n');
  }

  /**
   * Handle branch flow
   */
  private async handleBranchFlow(message: string, _context: SkillContext): Promise<string> {
    // Extract task description from message
    const task = message.replace(/\/branch\s*/i, '').replace(/create\s+branch\s+(for\s+)?/i, '');

    const suggestion = this.suggestBranchName(task);

    return `## Suggested Branch Name\n\n\`${suggestion.name}\`\n\n**Type:** ${suggestion.type}\n**Description:** ${suggestion.description}\n\nTo create:\n\`\`\`bash\ngit checkout -b ${suggestion.name}\n\`\`\``;
  }

  /**
   * Handle PR flow
   */
  private async handlePRFlow(context: SkillContext): Promise<string> {
    if (!context.services.git) {
      return 'Git is not available in the current workspace.';
    }

    const branch = await context.services.git.branch();
    const log = await context.services.git.log(10);

    const prDescription = this.generatePRDescription(branch, log);

    return `## Pull Request Description\n\n### Title\n${prDescription.title}\n\n### Body\n${prDescription.body}`;
  }

  /**
   * Generate a commit message from staged changes
   */
  private generateCommitMessage(stagedFiles: string[], diff: string): CommitMessage {
    const type = this.inferCommitType(stagedFiles, diff);
    const scope = this.inferScope(stagedFiles);
    const subject = this.generateSubject(stagedFiles, diff, type);

    const full = scope ? `${type}(${scope}): ${subject}` : `${type}: ${subject}`;

    return {
      type,
      scope,
      subject,
      breaking: false,
      full,
    };
  }

  /**
   * Infer commit type from changes
   */
  private inferCommitType(files: string[], diff: string): CommitType {
    const fileNames = files.map((f) => f.toLowerCase());

    if (fileNames.some((f) => f.includes('test') || f.includes('spec'))) {
      return 'test';
    }
    if (fileNames.some((f) => f.includes('readme') || f.includes('.md'))) {
      return 'docs';
    }
    if (fileNames.some((f) => f.includes('package.json') || f.includes('config'))) {
      return 'chore';
    }
    if (diff.includes('fix') || diff.includes('bug')) {
      return 'fix';
    }

    return 'feat';
  }

  /**
   * Infer scope from file paths
   */
  private inferScope(files: string[]): string | undefined {
    if (files.length === 0) return undefined;

    // Find common directory
    const parts = files[0].split('/');
    if (parts.length > 1) {
      return parts[0];
    }

    return undefined;
  }

  /**
   * Generate commit subject
   */
  private generateSubject(files: string[], _diff: string, _type: CommitType): string {
    // Simple heuristic - in production, use Claude
    if (files.length === 1) {
      const fileName = files[0].split('/').pop() || files[0];
      return `update ${fileName}`;
    }

    return `update ${files.length} files`;
  }

  /**
   * Suggest a branch name
   */
  private suggestBranchName(task: string): BranchSuggestion {
    const lower = task.toLowerCase();

    let type: BranchSuggestion['type'] = 'feature';
    if (lower.includes('fix') || lower.includes('bug')) {
      type = 'fix';
    } else if (lower.includes('refactor')) {
      type = 'refactor';
    } else if (lower.includes('doc')) {
      type = 'docs';
    } else if (lower.includes('test')) {
      type = 'test';
    }

    // Create slug from task
    const slug = task
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 40);

    return {
      name: `${type}/${slug}`,
      type,
      description: task,
    };
  }

  /**
   * Generate PR description
   */
  private generatePRDescription(
    branch: string,
    log: Array<{ message: string }>
  ): { title: string; body: string } {
    const title = branch
      .replace(/^(feature|fix|refactor|docs|test|chore)\//, '')
      .replace(/-/g, ' ');

    const commits = log
      .slice(0, 5)
      .map((c) => `- ${c.message}`)
      .join('\n');

    const body = `## Summary

This PR introduces changes from the \`${branch}\` branch.

## Changes

${commits}

## Testing

- [ ] Unit tests pass
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project conventions
- [ ] Documentation updated if needed
- [ ] No breaking changes`;

    return { title, body };
  }

  // Tool handlers

  private async handleGenerateCommitMessage(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      if (!context.services.git) {
        return this.errorResult('Git is not available');
      }

      const status = await context.services.git.status();
      const diff = await context.services.git.diff({ staged: true });

      if (status.staged.length === 0) {
        return this.errorResult('No staged changes');
      }

      const message = this.generateCommitMessage(status.staged, diff);

      return this.successResult(message.full, { message });
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Failed');
    }
  }

  private async handleGitStatus(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      if (!context.services.git) {
        return this.errorResult('Git is not available');
      }

      const status = await context.services.git.status();
      const output = `Branch: ${status.branch}\nStaged: ${status.staged.length}\nUnstaged: ${status.unstaged.length}\nUntracked: ${status.untracked.length}`;

      return this.successResult(output, { status });
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Failed');
    }
  }

  private async handleGitDiff(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      if (!context.services.git) {
        return this.errorResult('Git is not available');
      }

      const diff = await context.services.git.diff({
        staged: input.staged as boolean,
      });

      return this.successResult(diff || 'No changes');
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Failed');
    }
  }

  private async handleGitLog(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      if (!context.services.git) {
        return this.errorResult('Git is not available');
      }

      const count = (input.count as number) || 10;
      const log = await context.services.git.log(count);

      const output = log.map((e) => `${e.hash.slice(0, 7)} ${e.message}`).join('\n');

      return this.successResult(output, { log });
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Failed');
    }
  }

  private async handleSuggestBranchName(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      const task = input.task as string;
      if (!task) {
        return this.errorResult('Task description is required');
      }

      const suggestion = this.suggestBranchName(task);

      return this.successResult(suggestion.name, { suggestion });
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Failed');
    }
  }

  private async handleGeneratePRDescription(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      if (!context.services.git) {
        return this.errorResult('Git is not available');
      }

      const branch = await context.services.git.branch();
      const log = await context.services.git.log(10);

      const pr = this.generatePRDescription(branch, log);

      return this.successResult(`${pr.title}\n\n${pr.body}`, { pr });
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Failed');
    }
  }

  private async handleCreateCommit(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      if (!context.services.git) {
        return this.errorResult('Git is not available');
      }

      const message = input.message as string;
      if (!message) {
        return this.errorResult('Commit message is required');
      }

      const files = input.files as string[] | undefined;
      const result = await context.services.git.commit(message, files);

      return this.successResult(result);
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Failed');
    }
  }
}

// Export skill instance
export default new GitOperationsSkill();
