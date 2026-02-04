/**
 * LLM Code Service
 * Comprehensive code analysis, refactoring, optimization, security, testing, and documentation
 * Uses LLM Gateway with Kimi K2.5 for all operations
 */

import { getRequestLogger, default as logger } from '../middleware/logger.js';
import { createApiTimer } from '../middleware/metrics.js';
import { withResilience } from './resilience.js';
import { getCompletion, type CompletionResult } from './llmGatewayHelper.js';
import type {
  CodeAnalysis,
  RefactoringSuggestion,
  PerformanceOptimization,
  SecurityIssue,
  TestSuite,
  Documentation,
  CodeContext,
  PerformanceMetrics,
} from '../types/claudeCode.js';

if (!process.env.MOCK_AI_MODE && !process.env.NVIDIA_NIM_API_KEY) {
  logger.error('NVIDIA_NIM_API_KEY is not set (set MOCK_AI_MODE=true for zero-config testing)');
  process.exit(1);
}

const DEFAULT_MODEL = 'moonshotai/kimi-k2.5';
const DEFAULT_PROVIDER = 'nim' as const;

// Type assertion: since we use getCompletion which returns non-streaming response
const resilientLlmCall = withResilience(
  async (params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<CompletionResult> => {
    return await getCompletion(params, DEFAULT_PROVIDER);
  },
  'llm-code'
);

const CODE_ANALYSIS_PROMPT = `You are an expert code analyst specializing in code quality, patterns, and architecture. Analyze the provided code and return a comprehensive analysis.

## Your Task:
Analyze the code and identify:
1. Code patterns (REST, GraphQL, microservices, etc.)
2. Complexity metrics (cyclomatic, cognitive, maintainability)
3. Dependencies (imports, requires, external libraries)
4. Code smells (long methods, duplicate code, magic numbers, etc.)
5. Recommendations for improvement

## Output Format:
Return a JSON object:
\`\`\`json
{
  "patterns": [
    {
      "pattern": "REST API",
      "description": "RESTful endpoint pattern detected",
      "location": "src/routes/users.ts:15",
      "confidence": "high|medium|low"
    }
  ],
  "complexity": {
    "cyclomaticComplexity": 10,
    "cognitiveComplexity": 8,
    "maintainabilityIndex": 75,
    "linesOfCode": 250,
    "functionCount": 12,
    "classCount": 3
  },
  "dependencies": [
    {
      "name": "express",
      "type": "import",
      "version": "4.18.0",
      "location": "src/index.ts:1"
    }
  ],
  "codeSmells": [
    {
      "type": "long_method",
      "severity": "medium",
      "location": "src/services/userService.ts:45",
      "description": "Method exceeds 50 lines",
      "suggestion": "Extract into smaller methods"
    }
  ],
  "recommendations": ["Add error handling", "Extract constants"]
}
\`\`\``;

/**
 * Analyze code for patterns, complexity, dependencies, and code smells
 */
export async function analyzeCode(
  code: string,
  language: string,
  context?: CodeContext
): Promise<CodeAnalysis> {
  const log = getRequestLogger();
  const timer = createApiTimer('llm_code_analyze');

  try {
    const contextInfo = context
      ? `\n\nContext:\n- Project Type: ${context.projectType || 'N/A'}\n- Framework: ${context.framework || 'N/A'}\n- Language: ${context.language || language}`
      : '';

    const response = await resilientLlmCall({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: CODE_ANALYSIS_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Language: ${language}${contextInfo}\n\nCode to analyze:\n\`\`\`${language}\n${code}\n\`\`\`\n\nAnalyze this code comprehensively.`,
        },
      ],
    });

    if (response.error) {
      throw new Error(`LLM error: ${response.error}`);
    }

    let jsonText = response.text;
    jsonText = extractJSON(jsonText);

    const analysis = JSON.parse(jsonText) as CodeAnalysis;
    log.info({ language, patterns: analysis.patterns.length }, 'Code analysis completed');
    timer.success();

    return analysis;
  } catch (error) {
    timer.failure('code_analysis_error');
    const err = error as Error;
    log.error({ error: err.message }, 'Code analysis failed');
    throw error;
  }
}

const REFACTORING_PROMPT = `You are an expert refactoring specialist. Analyze code and suggest refactoring improvements.

## Your Task:
Identify refactoring opportunities:
- Extract method/function
- Extract class
- Rename for clarity
- Simplify complex logic
- Move code to appropriate location
- Inline unnecessary abstractions
- Split large functions/classes

## Output Format:
Return a JSON array of refactoring suggestions:
\`\`\`json
[
  {
    "type": "extract_method",
    "priority": "high|medium|low",
    "location": "file.ts:45",
    "description": "Extract validation logic into separate method",
    "before": "original code snippet",
    "after": "refactored code snippet",
    "rationale": "Improves readability and testability"
  }
]
\`\`\``;

/**
 * Suggest refactoring improvements for code
 */
export async function suggestRefactoring(
  code: string,
  language: string
): Promise<RefactoringSuggestion[]> {
  const log = getRequestLogger();
  const timer = createApiTimer('llm_code_refactor');

  try {
    const response = await resilientLlmCall({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: REFACTORING_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Language: ${language}\n\nCode to refactor:\n\`\`\`${language}\n${code}\n\`\`\`\n\nSuggest refactoring improvements.`,
        },
      ],
    });

    if (response.error) {
      throw new Error(`LLM error: ${response.error}`);
    }

    let jsonText = response.text;
    jsonText = extractJSON(jsonText);

    const suggestions = JSON.parse(jsonText) as RefactoringSuggestion[];
    log.info({ language, suggestions: suggestions.length }, 'Refactoring suggestions generated');
    timer.success();

    return suggestions;
  } catch (error) {
    timer.failure('refactoring_error');
    const err = error as Error;
    log.warn({ error: err.message }, 'Refactoring suggestion failed');
    return [];
  }
}

const PERFORMANCE_PROMPT = `You are a performance optimization expert. Analyze code for performance bottlenecks and suggest optimizations.

## Your Task:
Identify performance issues:
- Algorithm inefficiencies
- Database query problems
- Network call optimizations
- Memory leaks or excessive usage
- Rendering/UI performance
- Caching opportunities

## Output Format:
Return a JSON array:
\`\`\`json
[
  {
    "type": "caching",
    "priority": "high|medium|low",
    "location": "file.ts:30",
    "issue": "Repeated API calls without caching",
    "suggestion": "Implement Redis caching with 5min TTL",
    "expectedImpact": "Reduce API calls by 80%",
    "code": "optimized code snippet"
  }
]
\`\`\``;

/**
 * Optimize code for performance
 */
export async function optimizePerformance(
  code: string,
  language: string,
  metrics?: PerformanceMetrics
): Promise<PerformanceOptimization[]> {
  const log = getRequestLogger();
  const timer = createApiTimer('llm_code_performance');

  try {
    const metricsInfo = metrics
      ? `\n\nCurrent Metrics:\n- Response Time: ${metrics.responseTime}ms\n- Throughput: ${metrics.throughput} req/s\n- Memory: ${metrics.memoryUsage}MB`
      : '';

    const response = await resilientLlmCall({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: PERFORMANCE_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Language: ${language}${metricsInfo}\n\nCode to optimize:\n\`\`\`${language}\n${code}\n\`\`\`\n\nSuggest performance optimizations.`,
        },
      ],
    });

    if (response.error) {
      throw new Error(`LLM error: ${response.error}`);
    }

    let jsonText = response.text;
    jsonText = extractJSON(jsonText);

    const optimizations = JSON.parse(jsonText) as PerformanceOptimization[];
    log.info(
      { language, optimizations: optimizations.length },
      'Performance optimizations generated'
    );
    timer.success();

    return optimizations;
  } catch (error) {
    timer.failure('performance_error');
    const err = error as Error;
    log.warn({ error: err.message }, 'Performance optimization failed');
    return [];
  }
}

const SECURITY_PROMPT = `You are a security expert specializing in code security analysis. Scan code for vulnerabilities.

## Your Task:
Identify security issues:
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) risks
- CSRF (Cross-Site Request Forgery) vulnerabilities
- Authentication/authorization bypasses
- Sensitive data exposure
- Insecure dependencies
- Weak cryptography

## OWASP Top 10 Focus:
1. Injection
2. Broken Authentication
3. Sensitive Data Exposure
4. XML External Entities (XXE)
5. Broken Access Control
6. Security Misconfiguration
7. XSS
8. Insecure Deserialization
9. Using Components with Known Vulnerabilities
10. Insufficient Logging & Monitoring

## Output Format:
Return a JSON array:
\`\`\`json
[
  {
    "type": "sql_injection",
    "severity": "critical|high|medium|low",
    "location": "file.ts:25",
    "description": "User input directly concatenated into SQL query",
    "vulnerability": "SQL injection possible via user input",
    "fix": "Use parameterized queries or ORM",
    "code": "vulnerable code snippet"
  }
]
\`\`\``;

/**
 * Scan code for security vulnerabilities
 */
export async function scanSecurity(code: string, language: string): Promise<SecurityIssue[]> {
  const log = getRequestLogger();
  const timer = createApiTimer('llm_code_security');

  try {
    const response = await resilientLlmCall({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: SECURITY_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Language: ${language}\n\nCode to scan:\n\`\`\`${language}\n${code}\n\`\`\`\n\nScan for security vulnerabilities.`,
        },
      ],
    });

    if (response.error) {
      throw new Error(`LLM error: ${response.error}`);
    }

    let jsonText = response.text;
    jsonText = extractJSON(jsonText);

    const issues = JSON.parse(jsonText) as SecurityIssue[];
    log.info({ language, issues: issues.length }, 'Security scan completed');
    timer.success();

    return issues;
  } catch (error) {
    timer.failure('security_error');
    const err = error as Error;
    log.warn({ error: err.message }, 'Security scan failed');
    return [];
  }
}

const TEST_GENERATION_PROMPT = `You are a test generation expert. Generate comprehensive test suites for code.

## Your Task:
Generate:
- Unit tests for functions/methods
- Integration tests for components
- E2E tests for critical flows
- Test coverage analysis
- Mock/stub definitions

## Testing Best Practices:
- Test happy paths and error cases
- Include edge cases and boundary conditions
- Use descriptive test names
- Keep tests isolated and independent
- Mock external dependencies
- Aim for high coverage (80%+)

## Output Format:
Return a JSON object:
\`\`\`json
{
  "unitTests": [
    {
      "name": "testFunctionName_shouldReturnExpectedResult",
      "type": "unit",
      "description": "Tests function with valid input",
      "code": "test code",
      "expectedBehavior": "Should return expected value",
      "edgeCases": ["null input", "empty string"]
    }
  ],
  "integrationTests": [...],
  "e2eTests": [...],
  "coverage": {
    "statements": 85,
    "branches": 80,
    "functions": 90,
    "lines": 85,
    "uncovered": ["file.ts:45-50"]
  },
  "mocks": [
    {
      "name": "mockApiClient",
      "type": "module",
      "implementation": "mock implementation",
      "usage": "how to use"
    }
  ]
}
\`\`\``;

/**
 * Generate test suite for code
 */
export async function generateTests(
  code: string,
  language: string,
  testFramework?: string
): Promise<TestSuite> {
  const log = getRequestLogger();
  const timer = createApiTimer('llm_code_tests');

  try {
    const frameworkInfo = testFramework ? `\n\nTest Framework: ${testFramework}` : '';

    const response = await resilientLlmCall({
      model: DEFAULT_MODEL,
      max_tokens: 6000,
      system: TEST_GENERATION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Language: ${language}${frameworkInfo}\n\nCode to test:\n\`\`\`${language}\n${code}\n\`\`\`\n\nGenerate comprehensive test suite.`,
        },
      ],
    });

    if (response.error) {
      throw new Error(`LLM error: ${response.error}`);
    }

    let jsonText = response.text;
    jsonText = extractJSON(jsonText);

    const testSuite = JSON.parse(jsonText) as TestSuite;
    log.info({ language, unitTests: testSuite.unitTests.length }, 'Test suite generated');
    timer.success();

    return testSuite;
  } catch (error) {
    timer.failure('test_generation_error');
    const err = error as Error;
    log.error({ error: err.message }, 'Test generation failed');
    throw error;
  }
}

const DOCUMENTATION_PROMPT = `You are a documentation expert. Generate comprehensive documentation for code.

## Your Task:
Generate:
- Function documentation (JSDoc/TSDoc)
- Class documentation
- Module documentation
- API documentation
- Architecture documentation

## Documentation Standards:
- Clear, concise descriptions
- Parameter and return type documentation
- Usage examples
- Code snippets
- Architecture diagrams (Mermaid)

## Output Format:
Return a JSON object:
\`\`\`json
{
  "functions": [
    {
      "name": "functionName",
      "signature": "functionName(param: Type): ReturnType",
      "description": "What the function does",
      "parameters": [
        {
          "name": "param",
          "type": "Type",
          "description": "Parameter description",
          "required": true
        }
      ],
      "returns": {
        "type": "ReturnType",
        "description": "What is returned"
      },
      "examples": ["code example"],
      "throws": ["Error conditions"]
    }
  ],
  "classes": [...],
  "modules": [...],
  "api": [...],
  "architecture": {
    "overview": "System overview",
    "components": [...],
    "dataFlow": "How data flows",
    "diagrams": ["mermaid diagram code"]
  }
}
\`\`\``;

/**
 * Generate documentation for code
 */
export async function generateDocumentation(
  code: string,
  language: string
): Promise<Documentation> {
  const log = getRequestLogger();
  const timer = createApiTimer('llm_code_docs');

  try {
    const response = await resilientLlmCall({
      model: DEFAULT_MODEL,
      max_tokens: 6000,
      system: DOCUMENTATION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Language: ${language}\n\nCode to document:\n\`\`\`${language}\n${code}\n\`\`\`\n\nGenerate comprehensive documentation.`,
        },
      ],
    });

    if (response.error) {
      throw new Error(`LLM error: ${response.error}`);
    }

    let jsonText = response.text;
    jsonText = extractJSON(jsonText);

    const documentation = JSON.parse(jsonText) as Documentation;
    log.info({ language, functions: documentation.functions.length }, 'Documentation generated');
    timer.success();

    return documentation;
  } catch (error) {
    timer.failure('documentation_error');
    const err = error as Error;
    log.error({ error: err.message }, 'Documentation generation failed');
    throw error;
  }
}

/** Return type for diagram-to-code generation */
export interface GenerateCodeFromDiagramResult {
  files: { path: string; content: string }[];
  warnings?: string[];
}

const GENERATE_CODE_FROM_DIAGRAM_PROMPT = `You are an expert full-stack developer. Generate production-ready code from a Mermaid diagram.

## Your Task:
Given a Mermaid diagram and tech stack, output a JSON object with a "files" array. Each file has "path" (relative, e.g. src/index.js) and "content" (full file contents).
Optionally include a "warnings" array of strings for caveats or follow-up items.

## Output Format (JSON only, no markdown):
\`\`\`json
{
  "files": [
    { "path": "src/example.js", "content": "// full file content" }
  ],
  "warnings": ["optional warning"]
}
\`\`\`

Generate only the JSON. Use the exact tech stack and diagram type. Produce runnable, minimal-but-complete code.`;

/**
 * Generate code files from a Mermaid diagram using LLM
 */
export async function generateCodeFromDiagram(
  diagramType: string,
  mermaidCode: string,
  techStack: string
): Promise<GenerateCodeFromDiagramResult> {
  const log = getRequestLogger();
  const timer = createApiTimer('llm_code_from_diagram');

  try {
    const response = await resilientLlmCall({
      model: DEFAULT_MODEL,
      max_tokens: 8192,
      system: GENERATE_CODE_FROM_DIAGRAM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Diagram type: ${diagramType}\nTech stack: ${techStack}\n\nMermaid diagram:\n\`\`\`mermaid\n${mermaidCode}\n\`\`\`\n\nGenerate the code as JSON with "files" and optional "warnings".`,
        },
      ],
    });

    if (response.error) {
      throw new Error(`LLM error: ${response.error}`);
    }

    const jsonText = extractJSON(response.text);
    const parsed = JSON.parse(jsonText) as {
      files?: { path: string; content: string }[];
      warnings?: string[];
    };
    const files = Array.isArray(parsed.files) ? parsed.files : [];
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];

    log.info({ diagramType, techStack, fileCount: files.length }, 'Code from diagram generated');
    timer.success();

    return { files, warnings };
  } catch (error) {
    timer.failure('code_from_diagram_error');
    const err = error as Error;
    log.error({ error: err.message, diagramType, techStack }, 'Generate code from diagram failed');
    throw error;
  }
}

/**
 * Helper function to extract JSON from LLM response
 */
function extractJSON(text: string): string {
  if (text.includes('```json')) {
    const match = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (match) return match[1];
  } else if (text.includes('```')) {
    const match = text.match(/```\n?([\s\S]*?)\n?```/);
    if (match) return match[1];
  } else {
    const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) return jsonMatch[0];
  }
  return text;
}
