/**
 * Lint Skill - Main Logic
 */

import { BaseSkill } from '../base/BaseSkill.js';
import type {
  SkillContext,
  ToolExecutionResult,
  SkillManifest,
  SkillTools,
  SkillPrompts,
} from '../types.js';
import { definitions, handlers as _handlers } from './tools.js';
import { getLintSystemPrompt } from './prompts.js';
import { ESLint } from 'eslint';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifest: SkillManifest = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, './manifest.json'), 'utf-8')
);

class LintSkill extends BaseSkill {
  manifest: SkillManifest = manifest as SkillManifest;
  tools: SkillTools;

  constructor() {
    super();
    this.tools = {
      definitions,
      handlers: {
        lint_file: this.handleLintFile.bind(this),
      },
    };
  }

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
