/**
 * Testing & QA Service
 *
 * Generates tests, load test plans, and analyzes coverage.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getStream, type StreamParams } from '../../services/llmGateway.js';
import {
  type TestGenerationRequest,
  type TestGenerationResult,
  type GeneratedTest,
  type LoadTestPlanRequest,
  type LoadTestPlanResult,
  type LoadTestScenario,
  type CoverageAnalysisRequest,
  type CoverageAnalysisResult,
  type CoverageGap,
  type MockGenerationRequest,
  type MockGenerationResult,
} from './types.js';

const DEFAULT_MODEL = 'moonshotai/kimi-k2.5';

/**
 * Helper to call LLM via gateway and get complete response text
 */
async function callLLM(params: StreamParams): Promise<string> {
  const stream = getStream(params, { provider: 'nim', modelId: params.model || DEFAULT_MODEL });
  let responseText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      responseText += event.delta.text;
    }
  }
  return responseText;
}

const TESTING_SYSTEM_PROMPT = `You are an expert software testing engineer. You specialize in:
- Writing comprehensive unit tests
- Integration and E2E testing strategies
- Test-driven development (TDD)
- Load and performance testing
- Code coverage analysis
- Mock and stub generation

When generating tests:
1. Follow testing best practices (AAA pattern: Arrange, Act, Assert)
2. Test edge cases and error conditions
3. Use descriptive test names that explain the scenario
4. Keep tests isolated and independent
5. Include both positive and negative test cases
6. Consider boundary conditions
7. Use appropriate assertions

Generate high-quality, maintainable test code with clear documentation.`;

/**
 * Generate tests for source code
 */
export async function generateTests(request: TestGenerationRequest): Promise<TestGenerationResult> {
  const {
    filePath,
    fileContent,
    testFramework = 'vitest',
    testTypes = ['unit'],
    coverageGoal = 80,
  } = request;

  const ext = path.extname(filePath);
  const language =
    ext === '.py' ? 'python' : ext === '.go' ? 'go' : ext === '.java' ? 'java' : 'typescript';

  const frameworkDocs: Record<string, string> = {
    vitest: 'Vitest with TypeScript. Use describe/it/expect. Import from "vitest".',
    jest: 'Jest with TypeScript. Use describe/it/expect. Import from "@jest/globals" or use globals.',
    pytest: 'pytest with Python. Use def test_* functions, assert statements, and pytest fixtures.',
    'go-test': 'Go testing package. Use func Test*(t *testing.T) with t.Error/t.Fatal.',
    junit: 'JUnit 5 with Java. Use @Test annotations, Assertions class.',
  };

  const prompt = `Generate comprehensive tests for this ${language} code:

## Source File: ${filePath}
\`\`\`${language}
${fileContent}
\`\`\`

## Requirements:
- Framework: ${testFramework} (${frameworkDocs[testFramework]})
- Test types: ${testTypes.join(', ')}
- Target coverage: ${coverageGoal}%

Generate tests that cover:
1. All public functions/methods
2. Edge cases (null, empty, boundary values)
3. Error conditions and exception handling
4. Happy path scenarios
5. ${testTypes.includes('integration') ? 'Integration points with dependencies' : ''}

Respond with the complete test file:
\`\`\`${language}
// Test file for ${path.basename(filePath)}
...
\`\`\`

Also provide a summary:
\`\`\`json
{
  "testCount": number,
  "coverageEstimate": number,
  "imports": ["list of imports"],
  "recommendations": ["suggestions for additional tests"]
}
\`\`\``;

  const responseText = await callLLM({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    system: TESTING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract test code
  const codeMatch = responseText.match(
    /```(?:typescript|javascript|python|go|java)\n?([\s\S]*?)\n?```/
  );
  const testContent = codeMatch ? codeMatch[1].trim() : '';

  // Extract summary
  let summary = { testCount: 0, coverageEstimate: 0, imports: [], recommendations: [] };
  try {
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      summary = JSON.parse(jsonMatch[1]);
    }
  } catch (_err) {
    // Use defaults
  }

  const testFileName = filePath.replace(/\.(ts|js|py|go|java)$/, `.test.$1`);

  const tests: GeneratedTest[] = [
    {
      testFile: testFileName,
      testContent,
      testCount:
        summary.testCount || testContent.split(/it\(|test\(|def test_|func Test/).length - 1,
      coverageEstimate: summary.coverageEstimate || coverageGoal,
      framework: testFramework,
      imports: summary.imports || [],
    },
  ];

  return {
    tests,
    summary: {
      totalTests: tests.reduce((sum, t) => sum + t.testCount, 0),
      unitTests: testTypes.includes('unit') ? tests[0].testCount : 0,
      integrationTests: testTypes.includes('integration')
        ? Math.floor(tests[0].testCount * 0.2)
        : 0,
      estimatedCoverage: summary.coverageEstimate || coverageGoal,
    },
    recommendations: summary.recommendations || [],
  };
}

/**
 * Generate load test plan
 */
export async function generateLoadTestPlan(
  request: LoadTestPlanRequest
): Promise<LoadTestPlanResult> {
  const { projectName, endpoints, tool = 'k6', baseUrl = 'http://localhost:3000' } = request;

  const toolDocs: Record<string, string> = {
    k6: 'k6 JavaScript-based load testing. Use export default function, http module, check(), sleep().',
    locust: 'Locust Python-based. Use @task decorator, HttpUser class, self.client for requests.',
    artillery: 'Artillery YAML config with scenarios, phases, and flow definitions.',
  };

  const prompt = `Generate a comprehensive load test plan for:

## Project: ${projectName}
## Base URL: ${baseUrl}
## Tool: ${tool} (${toolDocs[tool]})

## Endpoints to test:
${endpoints.map((e) => `- ${e.method} ${e.path} (expected ${e.expectedRps || 100} RPS)${e.payload ? ` payload: ${JSON.stringify(e.payload)}` : ''}`).join('\n')}

Generate:
1. A complete ${tool} script with:
   - All endpoints covered
   - Realistic scenarios (smoke, load, stress, spike)
   - Proper thresholds (p95 < 500ms, error rate < 1%)
   - Data parameterization where applicable
   - Think time/sleep between requests

2. Scenario definitions with:
   - Smoke test (1-5 VUs, verify system works)
   - Load test (normal load, sustained)
   - Stress test (beyond normal capacity)
   - Spike test (sudden traffic burst)

Respond with:
\`\`\`${tool === 'artillery' ? 'yaml' : tool === 'locust' ? 'python' : 'javascript'}
// ${tool} load test script
...
\`\`\`

\`\`\`json
{
  "scenarios": [
    {
      "name": "scenario name",
      "description": "what it tests",
      "vus": number,
      "duration": "30s",
      "thresholds": {"http_req_duration": ["p(95)<500"]}
    }
  ],
  "readme": "Instructions for running the tests"
}
\`\`\``;

  const responseText = await callLLM({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    system: TESTING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract script
  const scriptMatch = responseText.match(/```(?:javascript|python|yaml)\n?([\s\S]*?)\n?```/);
  const script = scriptMatch ? scriptMatch[1].trim() : '';

  // Extract metadata
  let scenarios: LoadTestScenario[] = [];
  let readme = '';
  try {
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1]);
      scenarios = data.scenarios || [];
      readme = data.readme || '';
    }
  } catch (_err) {
    // Use defaults
  }

  return {
    tool,
    script,
    scenarios,
    readme:
      readme ||
      `# Load Test Plan for ${projectName}\n\nRun with: ${tool === 'k6' ? 'k6 run script.js' : tool === 'locust' ? 'locust -f script.py' : 'artillery run config.yml'}`,
  };
}

/**
 * Analyze code coverage
 */
export async function analyzeCoverage(
  request: CoverageAnalysisRequest
): Promise<CoverageAnalysisResult> {
  const { workspacePath, language = 'typescript' } = request;

  // Scan for source files
  const sourceFiles: string[] = [];
  const extensions = language === 'python' ? ['.py'] : language === 'go' ? ['.go'] : ['.ts', '.js'];

  function scanDir(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (['node_modules', '.git', 'dist', 'coverage', '__pycache__'].includes(entry.name))
          continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (
          extensions.some((ext) => entry.name.endsWith(ext)) &&
          !entry.name.includes('.test.') &&
          !entry.name.includes('.spec.')
        ) {
          sourceFiles.push(fullPath);
        }
      }
    } catch (_err) {
      // Skip unreadable dirs
    }
  }

  scanDir(workspacePath);

  // Check for test files
  const testFiles: string[] = [];
  function findTests(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findTests(fullPath);
        } else if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
          testFiles.push(fullPath);
        }
      }
    } catch (_err) {
      // Skip
    }
  }

  findTests(workspacePath);

  // Estimate coverage based on test file presence
  const testedFiles = new Set<string>();
  for (const testFile of testFiles) {
    const baseName = path.basename(testFile).replace(/\.(test|spec)\.(ts|js|py|go)$/, '.$2');
    for (const sourceFile of sourceFiles) {
      if (path.basename(sourceFile) === baseName) {
        testedFiles.add(sourceFile);
      }
    }
  }

  const overallCoverage =
    sourceFiles.length > 0 ? Math.round((testedFiles.size / sourceFiles.length) * 100) : 0;

  const gaps: CoverageGap[] = sourceFiles
    .filter((f) => !testedFiles.has(f))
    .slice(0, 10)
    .map((f) => ({
      file: f.replace(workspacePath, ''),
      uncoveredLines: [],
      uncoveredFunctions: [],
      currentCoverage: 0,
      priority:
        f.includes('service') || f.includes('util') ? ('high' as const) : ('medium' as const),
    }));

  const fileCoverage: Record<string, number> = {};
  for (const file of sourceFiles) {
    fileCoverage[file.replace(workspacePath, '')] = testedFiles.has(file) ? 80 : 0;
  }

  return {
    overallCoverage,
    fileCoverage,
    gaps,
    recommendations: [
      `Add tests for ${gaps.length} untested files`,
      'Focus on high-priority service and utility files first',
      'Aim for 80% coverage on critical paths',
      'Consider adding integration tests for API endpoints',
    ],
    suggestedTests: gaps.slice(0, 5).map((g) => ({
      file: g.file,
      testDescription: `Add unit tests for ${path.basename(g.file)}`,
      priority: g.priority,
    })),
  };
}

/**
 * Generate mocks for dependencies
 */
export async function generateMocks(request: MockGenerationRequest): Promise<MockGenerationResult> {
  const { filePath, fileContent, dependencies, framework = 'vitest' } = request;

  const prompt = `Generate mock implementations for testing:

## Source File: ${filePath}
\`\`\`
${fileContent}
\`\`\`

## Dependencies to mock:
${dependencies.map((d) => `- ${d}`).join('\n')}

## Framework: ${framework}

Generate:
1. Mock implementations for each dependency
2. Setup code for using the mocks in tests
3. Type-safe mocks where applicable

Respond with:
\`\`\`typescript
// Mocks
...
\`\`\`

\`\`\`json
{
  "mocks": [
    {"name": "mockName", "description": "what it mocks"}
  ],
  "setupCode": "code to set up mocks in tests"
}
\`\`\``;

  const responseText = await callLLM({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: TESTING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const codeMatch = responseText.match(/```typescript\n?([\s\S]*?)\n?```/);
  const mockCode = codeMatch ? codeMatch[1].trim() : '';

  let mocks: Array<{ name: string; code: string; description: string }> = [];
  let setupCode = '';

  try {
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1]);
      mocks = (
        (data.mocks as Array<{ name?: string; description?: string }> | undefined) || []
      ).map((m) => ({
        name: m.name ?? 'mock',
        code: mockCode,
        description: m.description ?? '',
      }));
      setupCode = data.setupCode || '';
    }
  } catch (_err) {
    // Use defaults
  }

  return {
    mocks:
      mocks.length > 0
        ? mocks
        : [{ name: 'generatedMocks', code: mockCode, description: 'Generated mocks' }],
    setupCode,
  };
}
