/**
 * Testing & QA Routes
 *
 * API endpoints for test generation, load testing, and coverage analysis.
 */

import { Router, type Request, type Response } from 'express';
import logger from '../../middleware/logger.js';
import { generateTests, generateLoadTestPlan, analyzeCoverage, generateMocks } from './service.js';
import {
  type TestGenerationRequest,
  type LoadTestPlanRequest,
  type CoverageAnalysisRequest,
  type MockGenerationRequest,
} from './types.js';

const router = Router();

/**
 * POST /api/testing/generate
 * Generate tests for source code
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const request = req.body as TestGenerationRequest;

    if (!request.filePath || !request.fileContent) {
      res.status(400).json({
        error: 'Missing filePath or fileContent',
        type: 'validation_error',
      });
      return;
    }

    const result = await generateTests(request);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Test generation error');
    res.status(500).json({
      error: err.message,
      type: 'generation_error',
    });
  }
});

/**
 * POST /api/testing/load-plan
 * Generate load test plan
 */
router.post('/load-plan', async (req: Request, res: Response) => {
  try {
    const request = req.body as LoadTestPlanRequest;

    if (!request.projectName || !request.endpoints?.length) {
      res.status(400).json({
        error: 'Missing projectName or endpoints',
        type: 'validation_error',
      });
      return;
    }

    const result = await generateLoadTestPlan(request);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Load test plan error');
    res.status(500).json({
      error: err.message,
      type: 'generation_error',
    });
  }
});

/**
 * POST /api/testing/coverage-analysis
 * Analyze code coverage
 */
router.post('/coverage-analysis', async (req: Request, res: Response) => {
  try {
    const request = req.body as CoverageAnalysisRequest;

    if (!request.workspacePath) {
      res.status(400).json({
        error: 'Missing workspacePath',
        type: 'validation_error',
      });
      return;
    }

    const result = await analyzeCoverage(request);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Coverage analysis error');
    res.status(500).json({
      error: err.message,
      type: 'analysis_error',
    });
  }
});

/**
 * POST /api/testing/mocks
 * Generate mock implementations
 */
router.post('/mocks', async (req: Request, res: Response) => {
  try {
    const request = req.body as MockGenerationRequest;

    if (!request.filePath || !request.fileContent || !request.dependencies?.length) {
      res.status(400).json({
        error: 'Missing filePath, fileContent, or dependencies',
        type: 'validation_error',
      });
      return;
    }

    const result = await generateMocks(request);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Mock generation error');
    res.status(500).json({
      error: err.message,
      type: 'generation_error',
    });
  }
});

/**
 * GET /api/testing/frameworks
 * List available testing frameworks
 */
router.get('/frameworks', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      unitTest: [
        { id: 'vitest', name: 'Vitest', language: 'TypeScript/JavaScript' },
        { id: 'jest', name: 'Jest', language: 'TypeScript/JavaScript' },
        { id: 'pytest', name: 'pytest', language: 'Python' },
        { id: 'go-test', name: 'Go Testing', language: 'Go' },
        { id: 'junit', name: 'JUnit', language: 'Java' },
      ],
      loadTest: [
        { id: 'k6', name: 'k6', description: 'Modern load testing tool' },
        { id: 'locust', name: 'Locust', description: 'Python-based load testing' },
        { id: 'artillery', name: 'Artillery', description: 'YAML-based load testing' },
      ],
    },
  });
});

/**
 * GET /api/testing/health
 * Health check for testing service
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'testing-qa',
    version: '1.0.0',
  });
});

export default router;
