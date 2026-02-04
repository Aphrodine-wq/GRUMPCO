/**
 * Testing & QA Service Unit Tests
 *
 * Tests for test generation, load test planning, coverage analysis, and mock generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics
vi.mock('../../src/middleware/metrics.js', () => ({
  recordLlmStreamMetrics: vi.fn(),
}));

// Mock nim config
vi.mock('../../src/config/nim.js', () => ({
  getNimChatUrl: vi.fn(() => 'https://api.nim.nvidia.com/v1/chat/completions'),
}));

// Mock ai-core
vi.mock('@grump/ai-core', () => ({
  getStreamProvider: vi.fn(() => null),
  registerStreamProvider: vi.fn(),
}));

// Mock fs module
vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Helper to create mock Dirent objects
const createMockDirent = (name: string, isDir: boolean) => ({
  name,
  isDirectory: () => isDir,
  isFile: () => !isDir,
  isBlockDevice: () => false,
  isCharacterDevice: () => false,
  isSymbolicLink: () => false,
  isFIFO: () => false,
  isSocket: () => false,
  path: '',
  parentPath: '',
});

describe('Testing & QA Service', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    vi.mocked(fs.readdirSync).mockReset();
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.statSync).mockReset();
    vi.mocked(fs.existsSync).mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateTests', () => {
    const createMockStream = (content: string, jsonSummary?: object) => {
      const encoder = new TextEncoder();
      let responseContent = '```typescript\n' + content + '\n```';
      if (jsonSummary) {
        responseContent += '\n```json\n' + JSON.stringify(jsonSummary) + '\n```';
      }
      return new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: {"choices":[{"delta":{"content":${JSON.stringify(responseContent)}}}]}\n\n`
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
    };

    it('should generate tests for TypeScript files', async () => {
      const mockStream = createMockStream(
        `import { describe, it, expect } from 'vitest';
describe('Calculator', () => {
  it('should add numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
  it('should subtract numbers', () => {
    expect(subtract(5, 3)).toBe(2);
  });
});`,
        {
          testCount: 2,
          coverageEstimate: 85,
          imports: ['vitest'],
          recommendations: ['Add edge case tests for negative numbers'],
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateTests } = await import('../../src/features/testing-qa/service.js');

      const result = await generateTests({
        filePath: 'src/calculator.ts',
        fileContent: 'export function add(a: number, b: number) { return a + b; }',
        testFramework: 'vitest',
        testTypes: ['unit'],
        coverageGoal: 80,
      });

      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].testFile).toBe('src/calculator.test.ts');
      expect(result.tests[0].testContent).toContain('describe');
      expect(result.tests[0].framework).toBe('vitest');
      expect(result.summary.totalTests).toBeGreaterThan(0);
    });

    it('should generate tests for Python files with pytest', async () => {
      const mockStream = createMockStream(
        `import pytest
def test_add():
    assert add(1, 2) == 3

def test_subtract():
    assert subtract(5, 3) == 2`,
        {
          testCount: 2,
          coverageEstimate: 80,
          imports: ['pytest'],
          recommendations: [],
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateTests } = await import('../../src/features/testing-qa/service.js');

      const result = await generateTests({
        filePath: 'calculator.py',
        fileContent: 'def add(a, b):\n    return a + b',
        testFramework: 'pytest',
        testTypes: ['unit'],
      });

      expect(result.tests[0].testFile).toBe('calculator.test.py');
      expect(result.tests[0].testContent).toContain('def test_');
    });

    it('should generate tests for Go files', async () => {
      const mockStream = createMockStream(
        `package calculator

import "testing"

func TestAdd(t *testing.T) {
    result := Add(1, 2)
    if result != 3 {
        t.Errorf("Expected 3, got %d", result)
    }
}`,
        { testCount: 1, coverageEstimate: 70, imports: ['testing'], recommendations: [] }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateTests } = await import('../../src/features/testing-qa/service.js');

      const result = await generateTests({
        filePath: 'calculator.go',
        fileContent: 'func Add(a, b int) int { return a + b }',
        testFramework: 'go-test',
      });

      expect(result.tests[0].testFile).toBe('calculator.test.go');
      expect(result.tests[0].testContent).toContain('func Test');
    });

    it('should generate tests for Java files with JUnit', async () => {
      const mockStream = createMockStream(
        `import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CalculatorTest {
    @Test
    void testAdd() {
        assertEquals(3, Calculator.add(1, 2));
    }
}`,
        { testCount: 1, coverageEstimate: 75, imports: ['junit'], recommendations: [] }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateTests } = await import('../../src/features/testing-qa/service.js');

      const result = await generateTests({
        filePath: 'Calculator.java',
        fileContent: 'public class Calculator { public int add(int a, int b) { return a + b; } }',
        testFramework: 'junit',
      });

      expect(result.tests[0].testFile).toBe('Calculator.test.java');
      expect(result.tests[0].testContent).toContain('@Test');
    });

    it('should handle integration test types', async () => {
      const mockStream = createMockStream(
        `import { describe, it, expect } from 'vitest';
describe('API Integration', () => {
  it('should call external service', async () => {
    const result = await fetchData();
    expect(result).toBeDefined();
  });
  it('should handle errors', async () => {
    await expect(fetchData()).rejects.toThrow();
  });
  it('should return correct data', async () => {
    const result = await fetchData();
    expect(result.data).toBeDefined();
  });
  it('should retry on failure', async () => {
    const result = await fetchData();
    expect(result.retries).toBe(0);
  });
  it('should timeout correctly', async () => {
    const result = await fetchData();
    expect(result.timeout).toBe(5000);
  });
});`,
        { testCount: 5, coverageEstimate: 60, imports: ['vitest'], recommendations: [] }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateTests } = await import('../../src/features/testing-qa/service.js');

      const result = await generateTests({
        filePath: 'api.ts',
        fileContent: 'export async function fetchData() { return await fetch("/api"); }',
        testTypes: ['unit', 'integration'],
      });

      expect(result.summary.integrationTests).toBeGreaterThan(0);
    });

    it('should use default values when options are not provided', async () => {
      const mockStream = createMockStream('// test content', {
        testCount: 1,
        coverageEstimate: 80,
        imports: [],
        recommendations: [],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateTests } = await import('../../src/features/testing-qa/service.js');

      const result = await generateTests({
        filePath: 'test.ts',
        fileContent: 'export const x = 1;',
      });

      expect(result.tests[0].framework).toBe('vitest');
      expect(result.summary.estimatedCoverage).toBeGreaterThanOrEqual(0);
    });

    it('should handle LLM response without JSON summary', async () => {
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"```typescript\\nit(\'test\', () => {});\\n```"}}]}\n\n'
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateTests } = await import('../../src/features/testing-qa/service.js');

      const result = await generateTests({
        filePath: 'test.ts',
        fileContent: 'export const x = 1;',
      });

      expect(result.tests).toHaveLength(1);
      // Should use defaults when no JSON summary
      expect(result.recommendations).toEqual([]);
    });

    it('should handle malformed JSON in LLM response', async () => {
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"```typescript\\ntest code\\n```\\n```json\\n{invalid json}\\n```"}}]}\n\n'
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateTests } = await import('../../src/features/testing-qa/service.js');

      const result = await generateTests({
        filePath: 'test.ts',
        fileContent: 'export const x = 1;',
      });

      // Should not throw, use defaults
      expect(result.tests).toHaveLength(1);
    });
  });

  describe('generateLoadTestPlan', () => {
    const createMockStream = (script: string, scenarios?: object) => {
      const encoder = new TextEncoder();
      let responseContent = '```javascript\n' + script + '\n```';
      if (scenarios) {
        responseContent += '\n```json\n' + JSON.stringify(scenarios) + '\n```';
      }
      return new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: {"choices":[{"delta":{"content":${JSON.stringify(responseContent)}}}]}\n\n`
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
    };

    it('should generate k6 load test plan', async () => {
      const mockStream = createMockStream(
        `import http from 'k6/http';
import { check, sleep } from 'k6';

export default function() {
  const res = http.get('http://localhost:3000/api/users');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}`,
        {
          scenarios: [
            {
              name: 'smoke',
              description: 'Verify system works under minimal load',
              vus: 1,
              duration: '30s',
              thresholds: { http_req_duration: ['p(95)<500'] },
            },
            {
              name: 'load',
              description: 'Normal load test',
              vus: 50,
              duration: '5m',
              thresholds: { http_req_duration: ['p(95)<500'] },
            },
          ],
          readme: 'Run with: k6 run script.js',
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateLoadTestPlan } = await import('../../src/features/testing-qa/service.js');

      const result = await generateLoadTestPlan({
        projectName: 'test-api',
        endpoints: [
          { method: 'GET', path: '/api/users', expectedRps: 100 },
          { method: 'POST', path: '/api/users', expectedRps: 50, payload: { name: 'test' } },
        ],
        tool: 'k6',
        baseUrl: 'http://localhost:3000',
      });

      expect(result.tool).toBe('k6');
      expect(result.script).toContain('k6/http');
      expect(result.scenarios).toHaveLength(2);
      expect(result.readme).toContain('k6 run');
    });

    it('should generate locust load test plan', async () => {
      const mockStream = createMockStream(
        `from locust import HttpUser, task, between

class WebsiteUser(HttpUser):
    wait_time = between(1, 5)
    
    @task
    def get_users(self):
        self.client.get("/api/users")`,
        {
          scenarios: [{ name: 'basic', description: 'Basic load', vus: 10, duration: '1m' }],
          readme: 'Run with: locust -f script.py',
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateLoadTestPlan } = await import('../../src/features/testing-qa/service.js');

      const result = await generateLoadTestPlan({
        projectName: 'test-api',
        endpoints: [{ method: 'GET', path: '/api/users' }],
        tool: 'locust',
      });

      expect(result.tool).toBe('locust');
      expect(result.readme).toContain('locust');
    });

    it('should generate artillery load test plan', async () => {
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"```yaml\\nconfig:\\n  target: http://localhost:3000\\n```\\n```json\\n{\\"scenarios\\": [], \\"readme\\": \\"Run with: artillery run config.yml\\"}\\n```"}}]}\n\n'
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateLoadTestPlan } = await import('../../src/features/testing-qa/service.js');

      const result = await generateLoadTestPlan({
        projectName: 'test-api',
        endpoints: [{ method: 'GET', path: '/api/users' }],
        tool: 'artillery',
      });

      expect(result.tool).toBe('artillery');
      expect(result.readme).toContain('artillery');
    });

    it('should use default values when options are not provided', async () => {
      const mockStream = createMockStream('// script', { scenarios: [], readme: '' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateLoadTestPlan } = await import('../../src/features/testing-qa/service.js');

      const result = await generateLoadTestPlan({
        projectName: 'test-api',
        endpoints: [{ method: 'GET', path: '/api/test' }],
      });

      expect(result.tool).toBe('k6');
      expect(result.readme).toContain('k6 run');
    });

    it('should handle LLM response without JSON metadata', async () => {
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"```javascript\\n// k6 script\\n```"}}]}\n\n'
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateLoadTestPlan } = await import('../../src/features/testing-qa/service.js');

      const result = await generateLoadTestPlan({
        projectName: 'test-api',
        endpoints: [{ method: 'GET', path: '/api/test' }],
      });

      expect(result.scenarios).toEqual([]);
      expect(result.readme).toContain('test-api');
    });
  });

  describe('analyzeCoverage', () => {
    it('should analyze coverage for TypeScript project', async () => {
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.includes('src')) {
          return [
            createMockDirent('service.ts', false),
            createMockDirent('utils.ts', false),
            createMockDirent('index.ts', false),
          ];
        }
        if (dirStr.includes('tests')) {
          return [
            createMockDirent('service.test.ts', false),
          ];
        }
        return [
          createMockDirent('src', true),
          createMockDirent('tests', true),
        ];
      });

      vi.mocked(fs.statSync).mockReturnValue({ size: 1000 } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue('const x = 1;\nconst y = 2;\nconst z = 3;');

      const { analyzeCoverage } = await import('../../src/features/testing-qa/service.js');

      const result = await analyzeCoverage({
        workspacePath: '/test/project',
        language: 'typescript',
      });

      expect(result.overallCoverage).toBeGreaterThanOrEqual(0);
      expect(result.overallCoverage).toBeLessThanOrEqual(100);
      expect(result.fileCoverage).toBeDefined();
      expect(result.gaps).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.suggestedTests).toBeInstanceOf(Array);
    });

    it('should analyze coverage for Python project', async () => {
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [
            createMockDirent('app.py', false),
            createMockDirent('utils.py', false),
          ];
        }
        return [];
      });

      vi.mocked(fs.statSync).mockReturnValue({ size: 500 } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue('def hello():\n    pass\n');

      const { analyzeCoverage } = await import('../../src/features/testing-qa/service.js');

      const result = await analyzeCoverage({
        workspacePath: '/test/project',
        language: 'python',
      });

      expect(result.overallCoverage).toBe(0); // No test files
      expect(result.gaps.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty workspace', async () => {
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const { analyzeCoverage } = await import('../../src/features/testing-qa/service.js');

      const result = await analyzeCoverage({
        workspacePath: '/empty/project',
      });

      expect(result.overallCoverage).toBe(0);
      expect(result.fileCoverage).toEqual({});
      expect(result.gaps).toEqual([]);
    });

    it('should skip node_modules and other ignored directories', async () => {
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [
            createMockDirent('node_modules', true),
            createMockDirent('.git', true),
            createMockDirent('src', true),
          ];
        }
        if (dirStr.includes('src')) {
          return [
            createMockDirent('index.ts', false),
          ];
        }
        return [];
      });

      vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue('const x = 1;');

      const { analyzeCoverage } = await import('../../src/features/testing-qa/service.js');

      const result = await analyzeCoverage({
        workspacePath: '/test/project',
      });

      // Should not include node_modules files
      expect(Object.keys(result.fileCoverage).every(f => !f.includes('node_modules'))).toBe(true);
    });

    it('should prioritize service and utility files', async () => {
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((dir: fs.PathLike) => {
        const dirStr = dir.toString();
        if (dirStr.endsWith('project')) {
          return [
            createMockDirent('service.ts', false),
            createMockDirent('util.ts', false),
            createMockDirent('component.ts', false),
          ];
        }
        return [];
      });

      vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue('const x = 1;');

      const { analyzeCoverage } = await import('../../src/features/testing-qa/service.js');

      const result = await analyzeCoverage({
        workspacePath: '/test/project',
      });

      const highPriorityGaps = result.gaps.filter(g => g.priority === 'high');
      expect(
        highPriorityGaps.some(g => g.file.includes('service') || g.file.includes('util'))
      ).toBe(true);
    });

    it('should handle filesystem errors gracefully', async () => {
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const { analyzeCoverage } = await import('../../src/features/testing-qa/service.js');

      const result = await analyzeCoverage({
        workspacePath: '/restricted/project',
      });

      expect(result.overallCoverage).toBe(0);
      expect(result.fileCoverage).toEqual({});
    });
  });

  describe('generateMocks', () => {
    const createMockStream = (mockCode: string, metadata?: object) => {
      const encoder = new TextEncoder();
      let responseContent = '```typescript\n' + mockCode + '\n```';
      if (metadata) {
        responseContent += '\n```json\n' + JSON.stringify(metadata) + '\n```';
      }
      return new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: {"choices":[{"delta":{"content":${JSON.stringify(responseContent)}}}]}\n\n`
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
    };

    it('should generate mocks for dependencies', async () => {
      const mockStream = createMockStream(
        `export const mockDatabase = {
  query: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockResolvedValue({ id: 1 }),
  update: vi.fn().mockResolvedValue(true),
  delete: vi.fn().mockResolvedValue(true),
};

export const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};`,
        {
          mocks: [
            { name: 'mockDatabase', description: 'Mocks database operations' },
            { name: 'mockLogger', description: 'Mocks logging functions' },
          ],
          setupCode: "vi.mock('./database', () => ({ db: mockDatabase }));",
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateMocks } = await import('../../src/features/testing-qa/service.js');

      const result = await generateMocks({
        filePath: 'src/userService.ts',
        fileContent: `import { db } from './database';
import { logger } from './logger';
export function getUser(id: string) { return db.query('SELECT * FROM users WHERE id = ?', [id]); }`,
        dependencies: ['./database', './logger'],
        framework: 'vitest',
      });

      expect(result.mocks.length).toBeGreaterThan(0);
      expect(result.mocks[0].code).toContain('mock');
      expect(result.setupCode).toBeDefined();
    });

    it('should handle mocks for Jest framework', async () => {
      const mockStream = createMockStream(
        `export const mockFetch = jest.fn().mockResolvedValue({ json: () => ({}) });`,
        {
          mocks: [{ name: 'mockFetch', description: 'Mocks fetch API' }],
          setupCode: 'global.fetch = mockFetch;',
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateMocks } = await import('../../src/features/testing-qa/service.js');

      const result = await generateMocks({
        filePath: 'src/api.ts',
        fileContent: 'export const fetchData = () => fetch("/api/data");',
        dependencies: ['fetch'],
        framework: 'jest',
      });

      expect(result.mocks.length).toBeGreaterThan(0);
    });

    it('should use default framework when not specified', async () => {
      const mockStream = createMockStream('export const mock = vi.fn();', {
        mocks: [{ name: 'mock', description: 'Generic mock' }],
        setupCode: '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateMocks } = await import('../../src/features/testing-qa/service.js');

      const result = await generateMocks({
        filePath: 'src/test.ts',
        fileContent: 'export const x = dep();',
        dependencies: ['dep'],
      });

      expect(result.mocks.length).toBeGreaterThan(0);
    });

    it('should handle LLM response without JSON metadata', async () => {
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"```typescript\\nexport const mock = vi.fn();\\n```"}}]}\n\n'
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateMocks } = await import('../../src/features/testing-qa/service.js');

      const result = await generateMocks({
        filePath: 'src/test.ts',
        fileContent: 'export const x = 1;',
        dependencies: ['dep'],
      });

      expect(result.mocks).toHaveLength(1);
      expect(result.mocks[0].name).toBe('generatedMocks');
    });

    it('should handle malformed JSON in LLM response', async () => {
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"```typescript\\nconst mock = vi.fn();\\n```\\n```json\\n{invalid}\\n```"}}]}\n\n'
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { generateMocks } = await import('../../src/features/testing-qa/service.js');

      const result = await generateMocks({
        filePath: 'src/test.ts',
        fileContent: 'export const x = 1;',
        dependencies: ['dep'],
      });

      // Should not throw, return default mock
      expect(result.mocks).toHaveLength(1);
    });
  });
});
