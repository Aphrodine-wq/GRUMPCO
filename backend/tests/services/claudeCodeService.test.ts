/**
 * Claude Code Service Tests - Comprehensive
 *
 * Tests for LLM-based code analysis, refactoring, performance optimization,
 * security scanning, test generation, and documentation generation.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

// Use vi.hoisted to ensure mocks are available before vi.mock runs
const { mockGetCompletion } = vi.hoisted(() => ({
  mockGetCompletion: vi.fn(),
}));

// Mock all external dependencies before importing the module
vi.mock('../../src/middleware/logger.js', () => ({
  getRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/middleware/metrics.js', () => ({
  createApiTimer: vi.fn(() => ({
    success: vi.fn(),
    failure: vi.fn(),
  })),
}));

vi.mock('../../src/services/resilience.js', () => ({
  withResilience: vi.fn((fn) => fn),
}));

// Mock getCompletion from llmGatewayHelper
vi.mock('../../src/services/llmGatewayHelper.js', () => ({
  getCompletion: mockGetCompletion,
}));

// Need to set the env var before importing the module
process.env.NVIDIA_NIM_API_KEY = 'test-api-key';

import {
  analyzeCode,
  suggestRefactoring,
  optimizePerformance,
  scanSecurity,
  generateTests,
  generateDocumentation,
  generateCodeFromDiagram,
} from '../../src/services/claudeCodeService.js';

describe('Claude Code Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleCode = `
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}

function validateEmail(email) {
  return email.includes('@');
}

class UserService {
  constructor(db) {
    this.db = db;
  }

  async getUser(id) {
    const query = "SELECT * FROM users WHERE id = " + id;
    return this.db.query(query);
  }
}
`;

  describe('analyzeCode', () => {
    it('should analyze code and return comprehensive analysis', async () => {
      const mockAnalysis = {
        patterns: [
          { pattern: 'Procedural', description: 'Traditional loop-based iteration', location: 'line:3', confidence: 'high' },
          { pattern: 'Class-based OOP', description: 'Class with methods', location: 'line:14', confidence: 'high' },
        ],
        complexity: {
          cyclomaticComplexity: 5,
          cognitiveComplexity: 3,
          maintainabilityIndex: 70,
          linesOfCode: 25,
          functionCount: 3,
          classCount: 1,
        },
        dependencies: [],
        codeSmells: [
          { type: 'sql_concatenation', severity: 'high', location: 'line:20', description: 'SQL concatenation', suggestion: 'Use parameterized queries' },
        ],
        recommendations: ['Use reduce for calculateTotal', 'Add email regex validation'],
      };

      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify(mockAnalysis),
      });

      const result = await analyzeCode(sampleCode, 'javascript');

      expect(result).toBeDefined();
      expect(result.patterns).toHaveLength(2);
      expect(result.complexity).toBeDefined();
      expect(result.complexity.cyclomaticComplexity).toBe(5);
      expect(result.codeSmells).toHaveLength(1);
      expect(result.recommendations).toHaveLength(2);
    });

    it('should handle code with context', async () => {
      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify({
          patterns: [],
          complexity: { cyclomaticComplexity: 1 },
          dependencies: [],
          codeSmells: [],
          recommendations: [],
        }),
      });

      const context = {
        projectType: 'web',
        framework: 'express',
        language: 'typescript',
      };

      const result = await analyzeCode(sampleCode, 'typescript', context);

      expect(result).toBeDefined();
      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Project Type: web'),
            }),
          ]),
        }),
        'nim'
      );
    });

    it('should handle JSON wrapped in code blocks', async () => {
      const mockAnalysis = {
        patterns: [],
        complexity: { cyclomaticComplexity: 1 },
        dependencies: [],
        codeSmells: [],
        recommendations: [],
      };

      mockGetCompletion.mockResolvedValue({
        text: '```json\n' + JSON.stringify(mockAnalysis) + '\n```',
      });

      const result = await analyzeCode(sampleCode, 'javascript');

      expect(result).toBeDefined();
      expect(result.complexity.cyclomaticComplexity).toBe(1);
    });

    it('should throw on LLM error', async () => {
      mockGetCompletion.mockResolvedValue({
        error: 'API rate limit exceeded',
        text: '',
      });

      await expect(analyzeCode(sampleCode, 'javascript')).rejects.toThrow('LLM error: API rate limit exceeded');
    });

    it('should throw on JSON parse error', async () => {
      mockGetCompletion.mockResolvedValue({
        text: 'This is not valid JSON',
      });

      await expect(analyzeCode(sampleCode, 'javascript')).rejects.toThrow();
    });
  });

  describe('suggestRefactoring', () => {
    it('should suggest refactoring improvements', async () => {
      const mockSuggestions = [
        {
          type: 'extract_method',
          priority: 'high',
          location: 'line:3',
          description: 'Extract loop to use reduce',
          before: 'for (let i = 0; i < items.length; i++)',
          after: 'items.reduce((total, item) => total + item.price * item.quantity, 0)',
          rationale: 'More functional and readable',
        },
        {
          type: 'extract_method',
          priority: 'medium',
          location: 'line:10',
          description: 'Use regex for email validation',
          before: 'email.includes("@")',
          after: '/^[^@]+@[^@]+\\.[^@]+$/.test(email)',
          rationale: 'More robust validation',
        },
      ];

      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify(mockSuggestions),
      });

      const result = await suggestRefactoring(sampleCode, 'javascript');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('extract_method');
      expect(result[0].priority).toBe('high');
      expect(result[0].rationale).toBeDefined();
    });

    it('should return empty array on LLM error', async () => {
      mockGetCompletion.mockResolvedValue({
        error: 'API error',
        text: '',
      });

      const result = await suggestRefactoring(sampleCode, 'javascript');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return empty array on parse error', async () => {
      mockGetCompletion.mockResolvedValue({
        text: 'Invalid response',
      });

      const result = await suggestRefactoring(sampleCode, 'javascript');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should handle generic code blocks', async () => {
      mockGetCompletion.mockResolvedValue({
        text: '```\n' + JSON.stringify([]) + '\n```',
      });

      const result = await suggestRefactoring(sampleCode, 'javascript');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('optimizePerformance', () => {
    it('should suggest performance optimizations', async () => {
      const mockOptimizations = [
        {
          type: 'algorithm',
          priority: 'medium',
          location: 'line:3',
          issue: 'Manual loop iteration',
          suggestion: 'Use Array.reduce for better performance',
          expectedImpact: '10% improvement for large arrays',
          code: 'items.reduce((t, i) => t + i.price * i.quantity, 0)',
        },
      ];

      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify(mockOptimizations),
      });

      const result = await optimizePerformance(sampleCode, 'javascript');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('algorithm');
      expect(result[0].expectedImpact).toBeDefined();
    });

    it('should include performance metrics when provided', async () => {
      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify([]),
      });

      const metrics = {
        responseTime: 500,
        throughput: 100,
        memoryUsage: 256,
      };

      await optimizePerformance(sampleCode, 'javascript', metrics);

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Response Time: 500ms'),
            }),
          ]),
        }),
        'nim'
      );
    });

    it('should return empty array on error', async () => {
      mockGetCompletion.mockResolvedValue({
        error: 'API error',
        text: '',
      });

      const result = await optimizePerformance(sampleCode, 'javascript');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('scanSecurity', () => {
    it('should detect security vulnerabilities', async () => {
      const mockIssues = [
        {
          type: 'sql_injection',
          severity: 'critical',
          location: 'line:20',
          description: 'SQL injection vulnerability',
          vulnerability: 'User input directly concatenated into SQL query',
          fix: 'Use parameterized queries',
          code: 'const query = "SELECT * FROM users WHERE id = " + id',
        },
      ];

      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify(mockIssues),
      });

      const result = await scanSecurity(sampleCode, 'javascript');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('sql_injection');
      expect(result[0].severity).toBe('critical');
      expect(result[0].fix).toBeDefined();
    });

    it('should return empty array for secure code', async () => {
      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify([]),
      });

      const secureCode = `
function greet(name) {
  return 'Hello, ' + name;
}
`;

      const result = await scanSecurity(secureCode, 'javascript');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return empty array on LLM error', async () => {
      mockGetCompletion.mockResolvedValue({
        error: 'API error',
        text: '',
      });

      const result = await scanSecurity(sampleCode, 'javascript');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should handle multiple vulnerabilities', async () => {
      const mockIssues = [
        { type: 'sql_injection', severity: 'critical', location: 'line:20', description: 'SQL injection', vulnerability: 'test', fix: 'test', code: 'test' },
        { type: 'xss', severity: 'high', location: 'line:25', description: 'XSS vulnerability', vulnerability: 'test', fix: 'test', code: 'test' },
        { type: 'weak_validation', severity: 'medium', location: 'line:10', description: 'Weak email validation', vulnerability: 'test', fix: 'test', code: 'test' },
      ];

      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify(mockIssues),
      });

      const result = await scanSecurity(sampleCode, 'javascript');

      expect(result).toHaveLength(3);
      expect(result.some((i) => i.severity === 'critical')).toBe(true);
      expect(result.some((i) => i.severity === 'high')).toBe(true);
      expect(result.some((i) => i.severity === 'medium')).toBe(true);
    });
  });

  describe('generateTests', () => {
    it('should generate comprehensive test suite', async () => {
      const mockTestSuite = {
        unitTests: [
          {
            name: 'calculateTotal_shouldReturnCorrectTotal',
            type: 'unit',
            description: 'Tests calculateTotal with valid items',
            code: `
describe('calculateTotal', () => {
  it('should return correct total', () => {
    const items = [{ price: 10, quantity: 2 }, { price: 5, quantity: 3 }];
    expect(calculateTotal(items)).toBe(35);
  });
});`,
            expectedBehavior: 'Returns sum of price * quantity for all items',
            edgeCases: ['empty array', 'negative values', 'zero quantity'],
          },
          {
            name: 'validateEmail_shouldValidateCorrectly',
            type: 'unit',
            description: 'Tests email validation',
            code: 'expect(validateEmail("test@example.com")).toBe(true);',
            expectedBehavior: 'Returns true for valid emails',
            edgeCases: ['no @', 'multiple @', 'empty string'],
          },
        ],
        integrationTests: [],
        e2eTests: [],
        coverage: {
          statements: 85,
          branches: 80,
          functions: 100,
          lines: 85,
          uncovered: ['line:20-22'],
        },
        mocks: [
          {
            name: 'mockDb',
            type: 'module',
            implementation: 'vi.fn(() => ({ query: vi.fn() }))',
            usage: 'Pass to UserService constructor',
          },
        ],
      };

      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify(mockTestSuite),
      });

      const result = await generateTests(sampleCode, 'javascript', 'vitest');

      expect(result).toBeDefined();
      expect(result.unitTests).toHaveLength(2);
      expect(result.coverage).toBeDefined();
      expect(result.coverage.statements).toBe(85);
      expect(result.mocks).toHaveLength(1);
    });

    it('should include test framework in prompt when provided', async () => {
      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify({
          unitTests: [],
          integrationTests: [],
          e2eTests: [],
          coverage: {},
          mocks: [],
        }),
      });

      await generateTests(sampleCode, 'javascript', 'jest');

      expect(mockGetCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Test Framework: jest'),
            }),
          ]),
        }),
        'nim'
      );
    });

    it('should throw on LLM error', async () => {
      mockGetCompletion.mockResolvedValue({
        error: 'API error',
        text: '',
      });

      await expect(generateTests(sampleCode, 'javascript')).rejects.toThrow('LLM error: API error');
    });

    it('should throw on JSON parse error', async () => {
      mockGetCompletion.mockResolvedValue({
        text: 'Invalid JSON',
      });

      await expect(generateTests(sampleCode, 'javascript')).rejects.toThrow();
    });
  });

  describe('generateDocumentation', () => {
    it('should generate comprehensive documentation', async () => {
      const mockDocs = {
        functions: [
          {
            name: 'calculateTotal',
            signature: 'calculateTotal(items: Item[]): number',
            description: 'Calculates the total price of all items',
            parameters: [
              { name: 'items', type: 'Item[]', description: 'Array of items with price and quantity', required: true },
            ],
            returns: { type: 'number', description: 'Total price' },
            examples: ['calculateTotal([{ price: 10, quantity: 2 }]) // returns 20'],
            throws: [],
          },
          {
            name: 'validateEmail',
            signature: 'validateEmail(email: string): boolean',
            description: 'Validates an email address',
            parameters: [
              { name: 'email', type: 'string', description: 'Email to validate', required: true },
            ],
            returns: { type: 'boolean', description: 'True if valid' },
            examples: [],
            throws: [],
          },
        ],
        classes: [
          {
            name: 'UserService',
            description: 'Service for user operations',
            constructor: { parameters: [{ name: 'db', type: 'Database', description: 'Database connection' }] },
            methods: [],
            properties: [],
          },
        ],
        modules: [],
        api: [],
        architecture: {
          overview: 'Simple utility functions and user service',
          components: ['calculateTotal', 'validateEmail', 'UserService'],
          dataFlow: 'Input -> Processing -> Output',
          diagrams: ['graph TD; A[Input] --> B[Process]; B --> C[Output];'],
        },
      };

      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify(mockDocs),
      });

      const result = await generateDocumentation(sampleCode, 'javascript');

      expect(result).toBeDefined();
      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('calculateTotal');
      expect(result.functions[0].parameters).toHaveLength(1);
      expect(result.classes).toHaveLength(1);
      expect(result.architecture).toBeDefined();
    });

    it('should throw on LLM error', async () => {
      mockGetCompletion.mockResolvedValue({
        error: 'API error',
        text: '',
      });

      await expect(generateDocumentation(sampleCode, 'javascript')).rejects.toThrow('LLM error: API error');
    });

    it('should throw on JSON parse error', async () => {
      mockGetCompletion.mockResolvedValue({
        text: 'Not JSON',
      });

      await expect(generateDocumentation(sampleCode, 'javascript')).rejects.toThrow();
    });
  });

  describe('generateCodeFromDiagram', () => {
    it('should generate code files from Mermaid diagram', async () => {
      const mockResult = {
        files: [
          { path: 'src/UserService.ts', content: 'export class UserService { }' },
          { path: 'src/AuthService.ts', content: 'export class AuthService { }' },
        ],
        warnings: ['Consider adding error handling'],
      };

      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify(mockResult),
      });

      const mermaidCode = `
classDiagram
    class UserService {
        +getUser(id)
    }
    class AuthService {
        +login(email, password)
    }
`;

      const result = await generateCodeFromDiagram('classDiagram', mermaidCode, 'TypeScript + Express');

      expect(result).toBeDefined();
      expect(result.files).toHaveLength(2);
      expect(result.files[0].path).toBe('src/UserService.ts');
      expect(result.warnings).toHaveLength(1);
    });

    it('should handle diagram without warnings', async () => {
      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify({
          files: [{ path: 'src/index.ts', content: 'console.log("Hello");' }],
        }),
      });

      const result = await generateCodeFromDiagram('flowchart', 'graph TD; A-->B', 'Node.js');

      expect(result.files).toHaveLength(1);
      expect(result.warnings).toEqual([]);
    });

    it('should handle empty files array', async () => {
      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify({}),
      });

      const result = await generateCodeFromDiagram('flowchart', 'graph TD; A-->B', 'Node.js');

      expect(result.files).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should throw on LLM error', async () => {
      mockGetCompletion.mockResolvedValue({
        error: 'API error',
        text: '',
      });

      await expect(
        generateCodeFromDiagram('classDiagram', 'class A { }', 'TypeScript')
      ).rejects.toThrow('LLM error: API error');
    });

    it('should throw on JSON parse error', async () => {
      mockGetCompletion.mockResolvedValue({
        text: 'Not valid JSON',
      });

      await expect(
        generateCodeFromDiagram('classDiagram', 'class A { }', 'TypeScript')
      ).rejects.toThrow();
    });
  });

  describe('JSON extraction', () => {
    it('should extract JSON from json code block', async () => {
      mockGetCompletion.mockResolvedValue({
        text: '```json\n{"patterns":[],"complexity":{},"dependencies":[],"codeSmells":[],"recommendations":[]}\n```',
      });

      const result = await analyzeCode('const x = 1;', 'javascript');
      expect(result).toBeDefined();
      expect(result.patterns).toEqual([]);
    });

    it('should extract JSON from generic code block', async () => {
      mockGetCompletion.mockResolvedValue({
        text: '```\n{"patterns":[],"complexity":{},"dependencies":[],"codeSmells":[],"recommendations":[]}\n```',
      });

      const result = await analyzeCode('const x = 1;', 'javascript');
      expect(result).toBeDefined();
    });

    it('should extract raw JSON object', async () => {
      mockGetCompletion.mockResolvedValue({
        text: 'Here is the analysis: {"patterns":[],"complexity":{},"dependencies":[],"codeSmells":[],"recommendations":[]}',
      });

      const result = await analyzeCode('const x = 1;', 'javascript');
      expect(result).toBeDefined();
    });

    it('should extract raw JSON array', async () => {
      mockGetCompletion.mockResolvedValue({
        text: 'Here are the suggestions: []',
      });

      const result = await suggestRefactoring('const x = 1;', 'javascript');
      expect(result).toEqual([]);
    });
  });

  describe('different language support', () => {
    const languages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c', 'cpp'];

    languages.forEach((lang) => {
      it(`should handle ${lang} code`, async () => {
        mockGetCompletion.mockResolvedValue({
          text: JSON.stringify({
            patterns: [{ pattern: 'test', description: 'test', location: 'line:1', confidence: 'high' }],
            complexity: { cyclomaticComplexity: 1 },
            dependencies: [],
            codeSmells: [],
            recommendations: [],
          }),
        });

        const result = await analyzeCode('// sample code', lang);

        expect(result).toBeDefined();
        expect(mockGetCompletion).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                content: expect.stringContaining(`Language: ${lang}`),
              }),
            ]),
          }),
          'nim'
        );
      });
    });
  });
});
