/**
 * Lint Skill - Main Logic
 */

import { BaseSkill } from '../base/BaseSkill.js';
import type { SkillContext, ToolExecutionResult } from '../types.js';
import { definitions, handlers } from './tools.js';
import { getLintSystemPrompt } from './prompts.js';
import manifest from './manifest.json';
import { ESLint } from 'eslint';

class LintSkill extends BaseSkill {
  manifest = manifest;
  tools = {
    definitions,
    handlers: {
      lint_file: this.handleLintFile.bind(this),
    },
  };

  prompts = {
    system: getLintSystemPrompt('typescript'), // Default to typescript
  };

  private async handleLintFile(
    input: { filePath: string; fix?: boolean },
    context: SkillContext
  ): Promise<ToolExecutionResult> {
    const { filePath, fix = false } = input;
    const { logger, fileSystem } = context.services;

    try {
      if (!fileSystem.isWithinWorkspace(filePath)) {
        return this.errorResult('File is outside the workspace.');
      }

      const code = await fileSystem.readFile(filePath);
      if (code === null) {
        return this.errorResult('File not found.');
      }

      const eslint = new ESLint({ fix });
      const results = await eslint.lintText(code, { filePath });

      if (fix) {
        await ESLint.outputFixes(results);
        const fixedCode = results[0]?.output;
        if (fixedCode) {
          await fileSystem.writeFile(filePath, fixedCode);
        }
      }

      return this.successResult(JSON.stringify(results, null, 2));
    } catch (error) {
      logger.error({ error, skill: this.manifest.id }, 'Error linting file');
      return this.errorResult(error instanceof Error ? error.message : String(error));
    }
  }
}

export default new LintSkill();
