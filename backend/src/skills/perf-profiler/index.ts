/**
 * Performance Profiler Skill
 * Analyzes code for performance bottlenecks and optimization opportunities
 */
import type { SkillModule } from '../types.js';

const perfProfilerSkill: SkillModule = {
  id: 'perf-profiler',
  name: 'Performance Profiler',
  description: 'Analyze code for performance bottlenecks and optimizations',

  tools: [
    {
      name: 'analyze_performance',
      description:
        'Analyze code for performance bottlenecks, expensive operations, and optimization opportunities',
      input_schema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Source code to analyze' },
          language: {
            type: 'string',
            enum: ['typescript', 'javascript', 'python', 'go'],
            description: 'Programming language',
          },
          focus: {
            type: 'string',
            enum: ['cpu', 'memory', 'rendering', 'all'],
            description: 'Analysis focus area',
          },
        },
        required: ['code'],
      },
    },
    {
      name: 'check_bundle_size',
      description: 'Analyze import statements and dependencies for bundle size impact',
      input_schema: {
        type: 'object',
        properties: {
          imports: {
            type: 'string',
            description: 'Import statements or package.json dependencies',
          },
          threshold: { type: 'number', description: 'Max acceptable bundle size in KB' },
        },
        required: ['imports'],
      },
    },
    {
      name: 'suggest_optimizations',
      description:
        'Generate actionable optimization recommendations with before/after code examples',
      input_schema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code to optimize' },
          target: {
            type: 'string',
            enum: ['speed', 'memory', 'both'],
            description: 'Optimization target',
          },
        },
        required: ['code'],
      },
    },
  ] as import('../types.js').ToolDefinition[],

  systemPrompt: `You are a performance optimization expert. When using the Performance Profiler skill:

1. **Bottleneck Detection**: Identify common performance anti-patterns:
   - O(n²) or worse algorithm complexity
   - Unnecessary re-renders in reactive frameworks
   - Synchronous blocking operations
   - Excessive DOM manipulation
   - Memory leaks from unclosed listeners/subscriptions
   - N+1 query patterns

2. **Bundle Analysis**: Flag oversized dependencies and suggest lighter alternatives:
   - moment.js → date-fns or dayjs
   - lodash → native methods or lodash-es
   - Large icon libraries → tree-shakeable alternatives

3. **Optimization Recommendations**: Provide concrete before/after examples:
   - Memoization opportunities
   - Lazy loading candidates
   - Web Worker offloading
   - Virtual scrolling for large lists
   - Image optimization strategies

Rate each finding by severity: 🔴 Critical, 🟡 Warning, 🟢 Suggestion.
Always explain WHY something is slow and the expected performance improvement.`,

  async execute(toolName: string, input: Record<string, unknown>): Promise<string> {
    switch (toolName) {
      case 'analyze_performance': {
        const { code, language, focus } = input as {
          code: string;
          language?: string;
          focus?: string;
        };
        const lines = code.split('\n').length;
        return (
          `Performance analysis (${language || 'auto-detected'}, focus: ${focus || 'all'}):\n` +
          `- Lines analyzed: ${lines}\n` +
          `- Potential issues identified. See AI response for detailed findings.\n` +
          `Code preview:\n${code.substring(0, 300)}...`
        );
      }
      case 'check_bundle_size': {
        const { imports, threshold } = input as { imports: string; threshold?: number };
        return (
          `Bundle analysis (threshold: ${threshold || 250}KB):\n` +
          `Imports analyzed:\n${imports}\n\n` +
          `See AI response for size estimates and recommendations.`
        );
      }
      case 'suggest_optimizations': {
        const { code, target } = input as { code: string; target?: string };
        return (
          `Optimization suggestions (target: ${target || 'both'}):\n` +
          `Code analyzed:\n${code.substring(0, 300)}...\n\n` +
          `See AI response for before/after examples.`
        );
      }
      default:
        return `Unknown tool: ${toolName}`;
    }
  },
};

export default perfProfilerSkill;
