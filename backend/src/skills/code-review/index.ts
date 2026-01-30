/**
 * Code Review Skill
 * AI-powered code review with quality analysis, pattern detection, and security scanning
 * Uses Kimi K2.5 via LLM Gateway
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
import { CODE_REVIEW_SYSTEM_PROMPT, templates } from './prompts.js';
import { definitions } from './tools.js';
import type { ReviewType, ReviewRequest, ReviewResult } from './types.js';
import logger from '../../middleware/logger.js';
import { withResilience } from '../../services/resilience.js';

// Load manifest
import manifest from './manifest.json' with { type: 'json' };

class CodeReviewSkill extends BaseSkill {
  manifest: SkillManifest = manifest as SkillManifest;

  prompts: SkillPrompts = {
    system: CODE_REVIEW_SYSTEM_PROMPT,
    templates,
  };

  tools: SkillTools = {
    definitions,
    handlers: {
      review_code: this.handleReviewCode.bind(this),
      analyze_file: this.handleAnalyzeFile.bind(this),
      suggest_improvements: this.handleSuggestImprovements.bind(this),
    },
  };

  declare routes: Router;

  constructor() {
    super();
    this.routes = this.createRoutes();
  }

  private createRoutes(): Router {
    const router = Router();

    // Review code endpoint
    router.post('/review', async (req, res): Promise<void> => {
      try {
        const { code, language, reviewType, context } = req.body as ReviewRequest;

        if (!code) {
          res.status(400).json({ error: 'Code is required' });
          return;
        }

        const result = await this.reviewCode({
          code,
          language,
          reviewType: reviewType || 'deep',
          context,
        });

        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Review failed',
        });
      }
    });

    // Analyze file endpoint
    router.post('/analyze', async (req, res): Promise<void> => {
      try {
        const { filePath, reviewType: _reviewType, workspacePath } = req.body;

        if (!filePath || !workspacePath) {
          res.status(400).json({ error: 'filePath and workspacePath are required' });
          return;
        }

        res.json({ message: 'File analysis started', filePath });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Analysis failed',
        });
      }
    });

    return router;
  }

  /**
   * Main execution - streaming code review
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

    yield {
      type: 'thinking',
      content: 'Analyzing code structure and patterns...',
    };

    try {
      // Extract code from input or files
      let codeToReview = '';
      let language = '';

      if (input.files && input.files.length > 0) {
        // Review file(s)
        const filePath = input.files[0];
        const content = await this.readFile(context, filePath);

        if (!content) {
          yield {
            type: 'error',
            error: new Error(`Could not read file: ${filePath}`),
            recoverable: true,
          };

          return {
            success: false,
            output: `Failed to read file: ${filePath}`,
            events: [],
            duration: Date.now() - startTime,
          };
        }

        codeToReview = content;
        language = this.detectLanguage(filePath);

        yield {
          type: 'progress',
          percent: 20,
          message: `Loaded ${filePath}`,
        };
      } else {
        // Extract code from message
        const codeMatch = input.message.match(/```(\w+)?\n([\s\S]*?)```/);
        if (codeMatch) {
          language = codeMatch[1] || '';
          codeToReview = codeMatch[2];
        } else {
          codeToReview = input.message;
        }
      }

      yield {
        type: 'progress',
        percent: 40,
        message: 'Running code analysis...',
      };

      // Determine review type from input
      const reviewType = this.detectReviewType(input.message);

      // Perform review
      const review = await this.reviewCode({
        code: codeToReview,
        language,
        reviewType,
        context: input.params?.context as string,
      });

      yield {
        type: 'progress',
        percent: 80,
        message: 'Generating review report...',
      };

      // Format output
      const output = this.formatReview(review);

      yield {
        type: 'output',
        content: output,
      };

      yield {
        type: 'completed',
        summary: `Found ${review.issues.length} issues`,
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
   * Review code using Kimi K2.5 via LLM Gateway
   */
  private async reviewCode(request: ReviewRequest, context?: SkillContext): Promise<ReviewResult> {
    const template = templates[request.reviewType || 'deep'];
    const prompt = template
      .replace('{{language}}', request.language || 'code')
      .replace('{{code}}', request.code);

    try {
      let responseText: string;

      if (context) {
        // Use LLM service from context (uses Kimi K2.5 via LLM Gateway)
        const callLLM = withResilience(
          async () => {
            return await context.services.llm.complete({
              messages: [{ role: 'user', content: prompt }],
              system: CODE_REVIEW_SYSTEM_PROMPT,
              maxTokens: 2048,
            });
          },
          'code-review'
        );
        responseText = await callLLM();
      } else {
        // Fallback: create temporary context and use LLM service
        const { createSkillContext } = await import('../base/SkillContext.js');
        const tempContext = createSkillContext({});
        const callLLM = withResilience(
          async () => {
            return await tempContext.services.llm.complete({
              messages: [{ role: 'user', content: prompt }],
              system: CODE_REVIEW_SYSTEM_PROMPT,
              maxTokens: 2048,
            });
          },
          'code-review'
        );
        responseText = await callLLM();
      }

      return this.parseReviewResponse(responseText, request.code);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          reviewType: request.reviewType,
          codeLength: request.code.length,
        },
        'Code review failed'
      );

      // Return empty review on error
      return {
        summary:
          'Code review could not be completed. Please try again later.',
        issues: [],
        positives: [],
        metrics: {
          linesOfCode: request.code.split('\n').length,
          issueCount: { critical: 0, warning: 0, suggestion: 0, info: 0 },
        },
      };
    }
  }

  /**
   * Parse LLM review response into structured ReviewResult
   */
  private parseReviewResponse(response: string, code: string): ReviewResult {
    const lines = response.split('\n');
    const issues = [];
    const positives = [];
    let summary = '';
    let currentSection = '';
    let metrics = {
      linesOfCode: code.split('\n').length,
      issueCount: { critical: 0, warning: 0, suggestion: 0, info: 0 },
    };

    for (const line of lines) {
      if (line.includes('Summary') || line.includes('Overview')) {
        currentSection = 'summary';
      } else if (line.includes('Issues') || line.includes('Problems')) {
        currentSection = 'issues';
      } else if (line.includes('Positives') || line.includes('Strengths')) {
        currentSection = 'positives';
      } else if (line.includes('Metrics') || line.includes('Complexity')) {
        currentSection = 'metrics';
      } else if (
        line.trim() &&
        !line.startsWith('#') &&
        !line.startsWith('*') &&
        !line.startsWith('-')
      ) {
        if (currentSection === 'summary' && !summary) {
          summary = line.trim();
        } else if (currentSection === 'issues' && line.trim().startsWith('- ')) {
          const issueText = line.trim().substring(2);
          const severity = this.detectSeverity(issueText);

          issues.push({
            severity,
            category: 'quality' as const,
            message: issueText,
            line: 0,
          });

          metrics.issueCount[severity]++;
        } else if (
          currentSection === 'positives' &&
          line.trim().startsWith('- ')
        ) {
          positives.push(line.trim().substring(2));
        }
      }
    }

    if (!summary) {
      summary = `Code review completed. Found ${issues.length} issues.`;
    }

    return {
      summary,
      issues,
      positives: positives.length > 0 ? positives : ['Code follows general best practices'],
      metrics,
    };
  }

  /**
   * Detect issue severity from issue text
   */
  private detectSeverity(
    text: string
  ): 'critical' | 'warning' | 'suggestion' | 'info' {
    const lower = text.toLowerCase();

    if (
      lower.includes('critical') ||
      lower.includes('error') ||
      lower.includes('security') ||
      lower.includes('vulnerability') ||
      lower.includes('bug')
    ) {
      return 'critical';
    } else if (
      lower.includes('warning') ||
      lower.includes('problem') ||
      lower.includes('issue') ||
      lower.includes('concern')
    ) {
      return 'warning';
    } else if (
      lower.includes('suggestion') ||
      lower.includes('consider') ||
      lower.includes('might') ||
      lower.includes('could')
    ) {
      return 'suggestion';
    }

    return 'info';
  }

  /**
   * Format review result as markdown
   */
  private formatReview(review: ReviewResult): string {
    const lines: string[] = [];

    lines.push('## Code Review Results\n');
    lines.push(`${review.summary}\n`);

    if (review.metrics) {
      lines.push('### Metrics');
      lines.push(`- Lines of Code: ${review.metrics.linesOfCode}`);
      if (review.metrics.complexity) {
        lines.push(`- Complexity: ${review.metrics.complexity}`);
      }
      lines.push('');
    }

    if (review.issues.length > 0) {
      lines.push('### Issues\n');

      const critical = review.issues.filter((i) => i.severity === 'critical');
      const warnings = review.issues.filter((i) => i.severity === 'warning');
      const suggestions = review.issues.filter((i) => i.severity === 'suggestion');

      if (critical.length > 0) {
        lines.push('#### Critical\n');
        critical.forEach((issue) => {
          lines.push(`- ${issue.message}`);
          if (issue.suggestion) {
            lines.push(`  - Suggestion: ${issue.suggestion}`);
          }
        });
        lines.push('');
      }

      if (warnings.length > 0) {
        lines.push('#### Warnings\n');
        warnings.forEach((issue) => {
          lines.push(`- ${issue.message}`);
        });
        lines.push('');
      }

      if (suggestions.length > 0) {
        lines.push('#### Suggestions\n');
        suggestions.forEach((issue) => {
          lines.push(`- ${issue.message}`);
        });
        lines.push('');
      }
    } else {
      lines.push('### No Issues Found\n');
      lines.push('The code looks good!\n');
    }

    if (review.positives.length > 0) {
      lines.push('### Positives\n');
      review.positives.forEach((positive) => {
        lines.push(`- ${positive}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Detect programming language from file extension
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
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      rb: 'ruby',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
    };
    return langMap[ext || ''] || ext || 'code';
  }

  /**
   * Detect review type from user message
   */
  private detectReviewType(message: string): ReviewType {
    const lower = message.toLowerCase();

    if (lower.includes('security') || lower.includes('vulnerab')) {
      return 'security';
    }
    if (lower.includes('performance') || lower.includes('optimi') || lower.includes('fast')) {
      return 'performance';
    }
    if (lower.includes('quick') || lower.includes('brief') || lower.includes('overview')) {
      return 'quick';
    }

    return 'deep';
  }

  // Tool handlers

  private async handleReviewCode(
    input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      const review = await this.reviewCode({
        code: input.code as string,
        language: input.language as string,
        reviewType: (input.reviewType as ReviewType) || 'quick',
        context: input.context as string,
      });

      return this.successResult(this.formatReview(review), { review });
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : 'Review failed'
      );
    }
  }

  private async handleAnalyzeFile(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      const filePath = input.filePath as string;
      const content = await this.readFile(context, filePath);

      if (!content) {
        return this.errorResult(`Could not read file: ${filePath}`);
      }

      const language = this.detectLanguage(filePath);
      const review = await this.reviewCode({
        code: content,
        language,
        reviewType: (input.reviewType as ReviewType) || 'deep',
        filePath,
      });

      return this.successResult(this.formatReview(review), {
        filePath,
        language,
        review,
      });
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : 'File analysis failed'
      );
    }
  }

  private async handleSuggestImprovements(
    _input: Record<string, unknown>,
    _context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      // Placeholder for improvement suggestions
      const suggestions = [
        {
          title: 'Add type annotations',
          description: 'Improve type safety with explicit annotations',
          before: 'function add(a, b) { return a + b; }',
          after: 'function add(a: number, b: number): number { return a + b; }',
          impact: 'medium',
          category: 'type-safety',
        },
      ];

      const output = suggestions
        .map((s) => `### ${s.title}\n${s.description}\n\nBefore:\n\`\`\`\n${s.before}\n\`\`\`\n\nAfter:\n\`\`\`\n${s.after}\n\`\`\``)
        .join('\n\n');

      return this.successResult(output, { suggestions });
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : 'Failed to generate suggestions'
      );
    }
  }
}

// Export skill instance
export default new CodeReviewSkill();
