/**
 * Refactoring Skill
 * Intelligent code refactoring with extract, rename, and pattern application
 */

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
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
import { REFACTORING_SYSTEM_PROMPT, templates } from './prompts.js';
import { definitions } from './tools.js';
import type {
  RefactoringType,
  RefactoringResult,
  RefactoringSuggestion,
  ExtractFunctionResult,
  CodeChange,
} from './types.js';
import logger from '../../middleware/logger.js';
import { withResilience } from '../../services/resilience.js';

// Load manifest
import manifest from './manifest.json' with { type: 'json' };

// Initialize Anthropic client
const apiKey = process.env.ANTHROPIC_API_KEY;
const client = new Anthropic({
  apiKey: apiKey || 'test-key',
});

class RefactoringSkill extends BaseSkill {
  manifest: SkillManifest = manifest as SkillManifest;

  prompts: SkillPrompts = {
    system: REFACTORING_SYSTEM_PROMPT,
    templates,
  };

  tools: SkillTools = {
    definitions,
    handlers: {
      extract_function: this.handleExtractFunction.bind(this),
      extract_variable: this.handleExtractVariable.bind(this),
      rename_symbol: this.handleRenameSymbol.bind(this),
      simplify_code: this.handleSimplifyCode.bind(this),
      inline_function: this.handleInlineFunction.bind(this),
      apply_pattern: this.handleApplyPattern.bind(this),
      suggest_refactorings: this.handleSuggestRefactorings.bind(this),
    },
  };

  declare routes: Router;

  constructor() {
    super();
    this.routes = this.createRoutes();
  }

  private createRoutes(): Router {
    const router = Router();

    // Refactor endpoint
    router.post('/refactor', async (req, res) => {
      try {
        const { code, type, options: _options, language: _language } = req.body;

        if (!code) {
          return res.status(400).json({ error: 'Code is required' });
        }

        res.json({ message: 'Refactoring started', type });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Refactoring failed',
        });
      }
    });

    // Suggest refactorings endpoint
    router.post('/suggest', async (req, res) => {
      try {
        const { code, language } = req.body;

        if (!code) {
          return res.status(400).json({ error: 'Code is required' });
        }

        const suggestions = this.analyzeForRefactorings(code, language);
        res.json({ suggestions });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Analysis failed',
        });
      }
    });

    return router;
  }

  /**
   * Main execution - handle refactoring requests
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
      // Detect refactoring type from input
      const refactoringType = this.detectRefactoringType(input.message);

      yield {
        type: 'thinking',
        content: `Analyzing code for ${refactoringType} refactoring...`,
      };

      // Extract code from input
      let codeToRefactor = '';
      let language = '';

      if (input.files && input.files.length > 0) {
        const filePath = input.files[0];
        const content = await this.readFile(context, filePath);

        if (!content) {
          return {
            success: false,
            output: `Failed to read file: ${filePath}`,
            events: [],
            duration: Date.now() - startTime,
          };
        }

        codeToRefactor = content;
        language = this.detectLanguage(filePath);
      } else {
        const codeMatch = input.message.match(/```(\w+)?\n([\s\S]*?)```/);
        if (codeMatch) {
          language = codeMatch[1] || '';
          codeToRefactor = codeMatch[2];
        }
      }

      if (!codeToRefactor) {
        yield {
          type: 'output',
          content: 'Please provide code to refactor, either in a code block or by specifying a file.',
        };

        return {
          success: false,
          output: 'No code provided',
          events: [],
          duration: Date.now() - startTime,
        };
      }

      yield {
        type: 'progress',
        percent: 40,
        message: 'Applying refactoring...',
      };

      // Perform refactoring
      const result = await this.performRefactoring(
        codeToRefactor,
        refactoringType,
        input.params || {},
        language
      );

      yield {
        type: 'progress',
        percent: 80,
        message: 'Generating output...',
      };

      const output = this.formatResult(result);

      yield {
        type: 'output',
        content: output,
      };

      yield {
        type: 'completed',
        summary: `Applied ${refactoringType} refactoring`,
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
   * Detect refactoring type from user input
   */
  private detectRefactoringType(message: string): RefactoringType {
    const lower = message.toLowerCase();

    if (lower.includes('extract function') || lower.includes('extract method')) {
      return 'extract-function';
    }
    if (lower.includes('extract variable') || lower.includes('extract const')) {
      return 'extract-variable';
    }
    if (lower.includes('extract class')) {
      return 'extract-class';
    }
    if (lower.includes('rename')) {
      return 'rename';
    }
    if (lower.includes('inline')) {
      return 'inline';
    }
    if (lower.includes('move')) {
      return 'move';
    }
    if (lower.includes('pattern') || lower.includes('strategy') || lower.includes('factory')) {
      return 'apply-pattern';
    }

    return 'simplify';
  }

  /**
   * Perform the refactoring
   */
  private async performRefactoring(
    code: string,
    type: RefactoringType,
    options: Record<string, unknown>,
    language: string
  ): Promise<RefactoringResult> {
    try {
      const templateKey = (type === 'extract-function' ? 'extractFunction' : type === 'rename' ? 'renameSymbol' : type === 'apply-pattern' ? 'applyPattern' : 'simplifyCode') as keyof typeof templates;
      const template = templates[templateKey] ?? templates.simplifyCode;
      const prompt = template
        .replace('{{language}}', language || 'code')
        .replace('{{code}}', code);

      // Call Claude API with resilience wrapper
      const callClaude = withResilience(
        async () => {
          return await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: REFACTORING_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: prompt }],
          });
        },
        'refactoring'
      );

      const response = await callClaude();

      // Parse Claude's response
      const firstBlock = response.content[0];
      const responseText =
        firstBlock?.type === 'text' ? firstBlock.text : '';

      return this.parseRefactoringResponse(responseText, code);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          type,
          codeLength: code.length,
        },
        'Refactoring failed'
      );

      // Return error result
      return {
        success: false,
        original: code,
        refactored: code,
        changes: [],
        explanation: 'Refactoring could not be completed. Please try again later.',
        warnings: [
          'The refactoring service encountered an error. Your original code is unchanged.',
        ],
      };
    }
  }

  /**
   * Parse Claude's refactoring response into structured RefactoringResult
   */
  private parseRefactoringResponse(
    response: string,
    originalCode: string
  ): RefactoringResult {
    const changes: CodeChange[] = [];
    let refactoredCode = originalCode;
    let explanation = '';

    // Extract code blocks from response
    const codeBlocks = response.match(/```(\w+)?\n([\s\S]*?)```/g) || [];

    if (codeBlocks.length > 0) {
      // Get the refactored code (usually the first code block)
      const firstBlock = codeBlocks[0];
      const match = firstBlock?.match(/```(\w+)?\n([\s\S]*?)```/);
      if (match && match[2] !== undefined) {
        refactoredCode = match[2].trim();
      }
    }

    // Extract explanation (text before first code block)
    const firstCodeBlockIndex = response.indexOf('```');
    if (firstCodeBlockIndex > 0) {
      explanation = response.substring(0, firstCodeBlockIndex).trim();
    } else {
      explanation = response;
    }

    // Detect changes between original and refactored
    if (refactoredCode !== originalCode) {
      const originalLines = originalCode.split('\n');
      const refactoredLines = refactoredCode.split('\n');

      for (let i = 0; i < Math.min(originalLines.length, refactoredLines.length); i++) {
        if (originalLines[i] !== refactoredLines[i]) {
          changes.push({
            type: 'replace' as const,
            startLine: i + 1,
            endLine: i + 1,
            description: `Modified line ${i + 1}`,
            newText: refactoredLines[i] ?? '',
          });
        }
      }

      if (refactoredLines.length !== originalLines.length) {
        changes.push({
          type: 'replace' as const,
          startLine: Math.min(originalLines.length, refactoredLines.length),
          endLine: Math.max(originalLines.length, refactoredLines.length),
          description:
            refactoredLines.length > originalLines.length
              ? `Added ${refactoredLines.length - originalLines.length} lines`
              : `Removed ${originalLines.length - refactoredLines.length} lines`,
          newText: refactoredLines.slice(originalLines.length).join('\n') || originalLines.slice(refactoredLines.length).join('\n'),
        });
      }
    }

    return {
      success: refactoredCode !== originalCode,
      original: originalCode,
      refactored: refactoredCode,
      changes,
      explanation:
        explanation ||
        'Code has been refactored according to best practices.',
    };
  }

  /**
   * Analyze code for potential refactorings
   */
  private analyzeForRefactorings(code: string, _language?: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    const lines = code.split('\n');

    // Simple heuristics - in production, use Claude

    // Check for long functions
    let functionStart = -1;
    let braceCount = 0;

    lines.forEach((line, index) => {
      if (line.includes('function') || line.match(/^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*{/)) {
        functionStart = index;
        braceCount = 0;
      }

      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (functionStart !== -1 && braceCount === 0) {
        const functionLength = index - functionStart + 1;
        if (functionLength > 30) {
          suggestions.push({
            type: 'extract-function',
            location: { startLine: functionStart + 1, endLine: index + 1 },
            description: `Function is ${functionLength} lines long. Consider extracting parts into smaller functions.`,
            impact: 'medium',
          });
        }
        functionStart = -1;
      }
    });

    // Check for duplicate code patterns
    // (simplified - real implementation would use AST)

    // Check for complex conditionals
    lines.forEach((line, index) => {
      if ((line.match(/&&/g) || []).length + (line.match(/\|\|/g) || []).length >= 3) {
        suggestions.push({
          type: 'extract-variable',
          location: { startLine: index + 1, endLine: index + 1 },
          description: 'Complex conditional expression. Consider extracting to a named variable.',
          impact: 'low',
        });
      }
    });

    return suggestions;
  }

  /**
   * Format refactoring result as markdown
   */
  private formatResult(result: RefactoringResult): string {
    const lines: string[] = [];

    lines.push('## Refactoring Result\n');

    if (result.success) {
      lines.push('### Explanation');
      lines.push(result.explanation);
      lines.push('');

      if (result.changes.length > 0) {
        lines.push('### Changes');
        result.changes.forEach((change) => {
          lines.push(`- **Line ${change.startLine}**: ${change.description}`);
        });
        lines.push('');
      }

      lines.push('### Before');
      lines.push('```');
      lines.push(result.original.slice(0, 500) + (result.original.length > 500 ? '\n...' : ''));
      lines.push('```');
      lines.push('');

      lines.push('### After');
      lines.push('```');
      lines.push(result.refactored.slice(0, 500) + (result.refactored.length > 500 ? '\n...' : ''));
      lines.push('```');
    } else {
      lines.push('Refactoring could not be completed.');
      if (result.warnings) {
        lines.push('');
        lines.push('### Warnings');
        result.warnings.forEach((w) => lines.push(`- ${w}`));
      }
    }

    return lines.join('\n');
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
    };
    return langMap[ext || ''] || 'code';
  }

  // Tool handlers

  private async handleExtractFunction(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      const code = input.code as string;
      const startLine = input.startLine as number;
      const endLine = input.endLine as number;
      const functionName = input.functionName as string;

      const lines = code.split('\n');
      const extracted = lines.slice(startLine - 1, endLine).join('\n');

      // Simple extraction - production would analyze variables
      const result: ExtractFunctionResult = {
        extractedFunction: `function ${functionName}() {\n  ${extracted}\n}`,
        callSite: `${functionName}();`,
        parameters: [],
      };

      const output = `Extracted function:\n\`\`\`\n${result.extractedFunction}\n\`\`\`\n\nReplace lines ${startLine}-${endLine} with:\n\`\`\`\n${result.callSite}\n\`\`\``;

      return this.successResult(output, { result });
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Extraction failed');
    }
  }

  private async handleExtractVariable(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      const code = input.code as string;
      const expression = input.expression as string;
      const variableName = input.variableName as string;

      const declaration = `const ${variableName} = ${expression};`;
      const refactored = code.replace(expression, variableName);

      const output = `Add this declaration:\n\`\`\`\n${declaration}\n\`\`\`\n\nRefactored code:\n\`\`\`\n${refactored}\n\`\`\``;

      return this.successResult(output);
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Extraction failed');
    }
  }

  private async handleRenameSymbol(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      const code = input.code as string;
      const oldName = input.oldName as string;
      const newName = input.newName as string;

      // Simple word-boundary rename
      const regex = new RegExp(`\\b${oldName}\\b`, 'g');
      const refactored = code.replace(regex, newName);
      const count = (code.match(regex) || []).length;

      const output = `Renamed ${count} occurrences of "${oldName}" to "${newName}".\n\n\`\`\`\n${refactored}\n\`\`\``;

      return this.successResult(output, { occurrences: count });
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Rename failed');
    }
  }

  private async handleSimplifyCode(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      const code = input.code as string;
      const suggestions = this.analyzeForRefactorings(code, input.language as string);

      if (suggestions.length === 0) {
        return this.successResult('No simplification opportunities found. The code looks clean!');
      }

      const output = suggestions
        .map((s) => `- **Line ${s.location.startLine}**: ${s.description} (${s.impact} impact)`)
        .join('\n');

      return this.successResult(`## Simplification Suggestions\n\n${output}`, { suggestions });
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Analysis failed');
    }
  }

  private async handleInlineFunction(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      const _code = input.code as string;
      const functionName = input.functionName as string;

      // Find the function definition and calls
      // This is a simplified implementation
      const output = `Inline refactoring for "${functionName}" would replace all calls with the function body. Full implementation would analyze the function definition and substitute parameters.`;

      return this.successResult(output);
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Inline failed');
    }
  }

  private async handleApplyPattern(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      const pattern = input.pattern as string;

      const patternDescriptions: Record<string, string> = {
        strategy: 'Define a family of algorithms, encapsulate each one, and make them interchangeable.',
        factory: 'Define an interface for creating objects, letting subclasses decide which class to instantiate.',
        decorator: 'Attach additional responsibilities to an object dynamically.',
        observer: 'Define a one-to-many dependency so that when one object changes, all dependents are notified.',
        builder: 'Separate the construction of a complex object from its representation.',
        singleton: 'Ensure a class has only one instance and provide global access to it.',
      };

      const description = patternDescriptions[pattern] || 'Apply the specified design pattern.';

      const output = `## ${pattern.charAt(0).toUpperCase() + pattern.slice(1)} Pattern\n\n${description}\n\nTo apply this pattern, I would restructure the code to:\n1. Identify the varying behavior\n2. Create the pattern structure\n3. Migrate existing code to use the pattern`;

      return this.successResult(output);
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Pattern application failed');
    }
  }

  private async handleSuggestRefactorings(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      const code = input.code as string;
      const suggestions = this.analyzeForRefactorings(code, input.language as string);

      if (suggestions.length === 0) {
        return this.successResult('No refactoring suggestions. The code structure looks good!');
      }

      const output = suggestions
        .map((s, i) => `${i + 1}. **${s.type}** (Line ${s.location.startLine}): ${s.description}`)
        .join('\n\n');

      return this.successResult(`## Refactoring Suggestions\n\n${output}`, { suggestions });
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Analysis failed');
    }
  }
}

// Export skill instance
export default new RefactoringSkill();
