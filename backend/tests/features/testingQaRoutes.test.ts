/**
 * Testing & QA Routes Unit Tests
 *
 * Tests for testing-qa API endpoints.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

// Mock the service module
vi.mock('../../src/features/testing-qa/service.js', () => ({
  generateTests: vi.fn(),
  generateLoadTestPlan: vi.fn(),
  analyzeCoverage: vi.fn(),
  generateMocks: vi.fn(),
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Testing & QA Routes', () => {
  let app: Express;

  beforeEach(async () => {
    vi.resetModules();
    
    // Import router and create app after mocks are set up
    const routerModule = await import('../../src/features/testing-qa/routes.js');
    
    app = express();
    app.use(express.json());
    app.use('/api/testing', routerModule.default);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/testing/generate', () => {
    it('should generate tests successfully', async () => {
      const { generateTests } = await import('../../src/features/testing-qa/service.js');
      vi.mocked(generateTests).mockResolvedValue({
        tests: [
          {
            testFile: 'test.test.ts',
            testContent: 'describe("test", () => {});',
            testCount: 1,
            coverageEstimate: 80,
            framework: 'vitest',
            imports: [],
          },
        ],
        summary: {
          totalTests: 1,
          unitTests: 1,
          integrationTests: 0,
          estimatedCoverage: 80,
        },
        recommendations: [],
      });

      const response = await request(app)
        .post('/api/testing/generate')
        .send({
          filePath: 'src/test.ts',
          fileContent: 'export const x = 1;',
          testFramework: 'vitest',
          testTypes: ['unit'],
          coverageGoal: 80,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tests).toHaveLength(1);
      expect(response.body.data.summary.totalTests).toBe(1);
    });

    it('should return 400 when filePath is missing', async () => {
      const response = await request(app)
        .post('/api/testing/generate')
        .send({
          fileContent: 'export const x = 1;',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('filePath');
      expect(response.body.type).toBe('validation_error');
    });

    it('should return 400 when fileContent is missing', async () => {
      const response = await request(app)
        .post('/api/testing/generate')
        .send({
          filePath: 'src/test.ts',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('fileContent');
      expect(response.body.type).toBe('validation_error');
    });

    it('should return 500 on service error', async () => {
      const { generateTests } = await import('../../src/features/testing-qa/service.js');
      vi.mocked(generateTests).mockRejectedValue(new Error('LLM service unavailable'));

      const response = await request(app)
        .post('/api/testing/generate')
        .send({
          filePath: 'src/test.ts',
          fileContent: 'export const x = 1;',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('LLM service unavailable');
      expect(response.body.type).toBe('generation_error');
    });
  });

  describe('POST /api/testing/load-plan', () => {
    it('should generate load test plan successfully', async () => {
      const { generateLoadTestPlan } = await import('../../src/features/testing-qa/service.js');
      vi.mocked(generateLoadTestPlan).mockResolvedValue({
        tool: 'k6',
        script: 'import http from "k6/http";',
        scenarios: [
          {
            name: 'smoke',
            description: 'Smoke test',
            vus: 1,
            duration: '30s',
          },
        ],
        readme: 'Run with k6 run script.js',
      });

      const response = await request(app)
        .post('/api/testing/load-plan')
        .send({
          projectName: 'test-api',
          endpoints: [
            { method: 'GET', path: '/api/users', expectedRps: 100 },
          ],
          tool: 'k6',
          baseUrl: 'http://localhost:3000',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tool).toBe('k6');
      expect(response.body.data.scenarios).toHaveLength(1);
    });

    it('should return 400 when projectName is missing', async () => {
      const response = await request(app)
        .post('/api/testing/load-plan')
        .send({
          endpoints: [{ method: 'GET', path: '/api/users' }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('projectName');
      expect(response.body.type).toBe('validation_error');
    });

    it('should return 400 when endpoints is empty', async () => {
      const response = await request(app)
        .post('/api/testing/load-plan')
        .send({
          projectName: 'test-api',
          endpoints: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('endpoints');
      expect(response.body.type).toBe('validation_error');
    });

    it('should return 400 when endpoints is missing', async () => {
      const response = await request(app)
        .post('/api/testing/load-plan')
        .send({
          projectName: 'test-api',
        });

      expect(response.status).toBe(400);
      expect(response.body.type).toBe('validation_error');
    });

    it('should return 500 on service error', async () => {
      const { generateLoadTestPlan } = await import('../../src/features/testing-qa/service.js');
      vi.mocked(generateLoadTestPlan).mockRejectedValue(new Error('Failed to generate plan'));

      const response = await request(app)
        .post('/api/testing/load-plan')
        .send({
          projectName: 'test-api',
          endpoints: [{ method: 'GET', path: '/api/users' }],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to generate plan');
      expect(response.body.type).toBe('generation_error');
    });
  });

  describe('POST /api/testing/coverage-analysis', () => {
    it('should analyze coverage successfully', async () => {
      const { analyzeCoverage } = await import('../../src/features/testing-qa/service.js');
      vi.mocked(analyzeCoverage).mockResolvedValue({
        overallCoverage: 75,
        fileCoverage: { '/src/index.ts': 80, '/src/utils.ts': 70 },
        gaps: [
          {
            file: '/src/service.ts',
            uncoveredLines: [10, 15, 20],
            uncoveredFunctions: ['processData'],
            currentCoverage: 50,
            priority: 'high',
          },
        ],
        recommendations: ['Add tests for service.ts'],
        suggestedTests: [
          {
            file: '/src/service.ts',
            testDescription: 'Add unit tests for processData function',
            priority: 'high',
          },
        ],
      });

      const response = await request(app)
        .post('/api/testing/coverage-analysis')
        .send({
          workspacePath: '/test/project',
          language: 'typescript',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overallCoverage).toBe(75);
      expect(response.body.data.gaps).toHaveLength(1);
    });

    it('should return 400 when workspacePath is missing', async () => {
      const response = await request(app)
        .post('/api/testing/coverage-analysis')
        .send({
          language: 'typescript',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('workspacePath');
      expect(response.body.type).toBe('validation_error');
    });

    it('should return 500 on service error', async () => {
      const { analyzeCoverage } = await import('../../src/features/testing-qa/service.js');
      vi.mocked(analyzeCoverage).mockRejectedValue(new Error('Cannot access workspace'));

      const response = await request(app)
        .post('/api/testing/coverage-analysis')
        .send({
          workspacePath: '/restricted/project',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Cannot access workspace');
      expect(response.body.type).toBe('analysis_error');
    });
  });

  describe('POST /api/testing/mocks', () => {
    it('should generate mocks successfully', async () => {
      const { generateMocks } = await import('../../src/features/testing-qa/service.js');
      vi.mocked(generateMocks).mockResolvedValue({
        mocks: [
          {
            name: 'mockDatabase',
            code: 'export const mockDatabase = { query: vi.fn() };',
            description: 'Mocks database operations',
          },
        ],
        setupCode: "vi.mock('./database', () => mockDatabase);",
      });

      const response = await request(app)
        .post('/api/testing/mocks')
        .send({
          filePath: 'src/service.ts',
          fileContent: 'import { db } from "./database";',
          dependencies: ['./database'],
          framework: 'vitest',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.mocks).toHaveLength(1);
      expect(response.body.data.setupCode).toBeDefined();
    });

    it('should return 400 when filePath is missing', async () => {
      const response = await request(app)
        .post('/api/testing/mocks')
        .send({
          fileContent: 'export const x = 1;',
          dependencies: ['dep'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('filePath');
      expect(response.body.type).toBe('validation_error');
    });

    it('should return 400 when fileContent is missing', async () => {
      const response = await request(app)
        .post('/api/testing/mocks')
        .send({
          filePath: 'src/test.ts',
          dependencies: ['dep'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('fileContent');
      expect(response.body.type).toBe('validation_error');
    });

    it('should return 400 when dependencies is empty', async () => {
      const response = await request(app)
        .post('/api/testing/mocks')
        .send({
          filePath: 'src/test.ts',
          fileContent: 'export const x = 1;',
          dependencies: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('dependencies');
      expect(response.body.type).toBe('validation_error');
    });

    it('should return 400 when dependencies is missing', async () => {
      const response = await request(app)
        .post('/api/testing/mocks')
        .send({
          filePath: 'src/test.ts',
          fileContent: 'export const x = 1;',
        });

      expect(response.status).toBe(400);
      expect(response.body.type).toBe('validation_error');
    });

    it('should return 500 on service error', async () => {
      const { generateMocks } = await import('../../src/features/testing-qa/service.js');
      vi.mocked(generateMocks).mockRejectedValue(new Error('Mock generation failed'));

      const response = await request(app)
        .post('/api/testing/mocks')
        .send({
          filePath: 'src/test.ts',
          fileContent: 'export const x = 1;',
          dependencies: ['dep'],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Mock generation failed');
      expect(response.body.type).toBe('generation_error');
    });
  });

  describe('GET /api/testing/frameworks', () => {
    it('should return list of available frameworks', async () => {
      const response = await request(app).get('/api/testing/frameworks');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.unitTest).toBeInstanceOf(Array);
      expect(response.body.data.loadTest).toBeInstanceOf(Array);
      
      // Check for expected unit test frameworks
      const unitFrameworkIds = response.body.data.unitTest.map((f: { id: string }) => f.id);
      expect(unitFrameworkIds).toContain('vitest');
      expect(unitFrameworkIds).toContain('jest');
      expect(unitFrameworkIds).toContain('pytest');
      expect(unitFrameworkIds).toContain('go-test');
      expect(unitFrameworkIds).toContain('junit');

      // Check for expected load test tools
      const loadToolIds = response.body.data.loadTest.map((t: { id: string }) => t.id);
      expect(loadToolIds).toContain('k6');
      expect(loadToolIds).toContain('locust');
      expect(loadToolIds).toContain('artillery');
    });
  });

  describe('GET /api/testing/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/testing/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('testing-qa');
      expect(response.body.version).toBe('1.0.0');
    });
  });
});
