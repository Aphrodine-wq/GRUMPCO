/**
 * Lint Skill - Main Logic
 */

import { BaseSkill } from '../base/BaseSkill.js';
import type { SkillContext, ToolExecutionResult, SkillManifest, SkillTools, SkillPrompts } from '../types.js';
import { definitions, handlers } from './tools.js';
import { getLintSystemPrompt } from './prompts.js';
import manifest from './manifest.json' with { type: 'json' };
import { ESLint } from 'eslint';

class LintSkill extends BaseSkill {
  manifest: SkillManifest = manifest as SkillManifest;
  
  tools: SkillTools = {
    definitions,
    handlers: {
      lint_file: this.handleLintFile.bind(this),
    },
  };

  prompts: SkillPrompts = {
    system: getLintSystemPrompt('typescript'), // Default to typescript
  };

  private async handleLintFile(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<ToolExecutionResult> {
    const filePath = input.filePath as string;
    const fix = (input.fix as boolean) ?? false;
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
      logger.error('Error linting file', { error: String(error), skill: this.manifest.id });
      return this.errorResult(error instanceof Error ? error.message : String(error));
    }
  }
}

export default new LintSkill();
