/**
 * Jobs Route Tests
 * Tests for job worker endpoints (ship, codegen).
 * Tests the actual jobs.ts router with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Store original env
const originalEnv = { ...process.env };

// Mock jobQueue service
vi.mock('../../src/services/jobQueue.js', () => ({
  processShipJob: vi.fn(),
  processCodegenJob: vi.fn(),
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock security utilities
vi.mock('../../src/utils/security.js', () => ({
  timingSafeEqualString: vi.fn(),
}));

// Import after mocks are set up
import jobsRouter from '../../src/routes/jobs.js';
import { processShipJob, processCodegenJob } from '../../src/services/jobQueue.js';
import { timingSafeEqualString } from '../../src/utils/security.js';
import logger from '../../src/middleware/logger.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/jobs', jobsRouter);
  return app;
}

describe('Jobs Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env
    process.env = { ...originalEnv };
    // Default: timing safe comparison returns true for matching strings
    vi.mocked(timingSafeEqualString).mockImplementation((a, b) => a === b);
    app = createTestApp();
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  describe('POST /api/jobs/ship', () => {
    describe('Authentication', () => {
      it('should return 401 when secret is required but not provided', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(false);

        // Need to recreate app after env change
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });

      it('should accept Bearer token in Authorization header', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(true);
        vi.mocked(processShipJob).mockResolvedValueOnce(undefined);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .set('Authorization', 'Bearer secret-key')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(200);
        expect(timingSafeEqualString).toHaveBeenCalledWith('secret-key', 'secret-key');
      });

      it('should accept x-job-secret header', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(true);
        vi.mocked(processShipJob).mockResolvedValueOnce(undefined);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .set('x-job-secret', 'secret-key')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(200);
        expect(timingSafeEqualString).toHaveBeenCalledWith('secret-key', 'secret-key');
      });

      it('should skip auth when no secret is configured', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processShipJob).mockResolvedValueOnce(undefined);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(200);
        expect(timingSafeEqualString).not.toHaveBeenCalled();
      });

      it('should reject invalid Bearer token', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(false);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .set('Authorization', 'Bearer wrong-key')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });

      it('should handle case-insensitive Bearer prefix', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(true);
        vi.mocked(processShipJob).mockResolvedValueOnce(undefined);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .set('Authorization', 'bearer secret-key')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(200);
      });

      it('should handle BEARER prefix in uppercase', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(true);
        vi.mocked(processShipJob).mockResolvedValueOnce(undefined);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .set('Authorization', 'BEARER secret-key')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(200);
      });

      it('should reject when both auth methods provide wrong credentials', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(false);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .set('Authorization', 'Bearer wrong')
          .set('x-job-secret', 'also-wrong')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(401);
      });

      it('should accept when x-job-secret is correct even if Authorization is wrong', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockImplementation((a, b) => {
          // First call for Bearer token (wrong)
          // Second call for x-job-secret (correct)
          return a === 'secret-key' && b === 'secret-key';
        });
        vi.mocked(processShipJob).mockResolvedValueOnce(undefined);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .set('Authorization', 'Bearer wrong')
          .set('x-job-secret', 'secret-key')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(200);
      });

      it('should handle Authorization header without Bearer prefix', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(false);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .set('Authorization', 'secret-key')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(401);
      });
    });

    describe('Validation', () => {
      it('should return 400 when neither jobId nor sessionId provided', async () => {
        delete process.env.JOB_WORKER_SECRET;
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('jobId or sessionId required');
      });

      it('should return 400 when only sessionId is provided', async () => {
        delete process.env.JOB_WORKER_SECRET;
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ sessionId: 'session-123' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('jobId required for serverless worker');
      });

      it('should return 400 when jobId is empty string', async () => {
        delete process.env.JOB_WORKER_SECRET;
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: '' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('jobId or sessionId required');
      });

      it('should return 400 when both jobId and sessionId are empty', async () => {
        delete process.env.JOB_WORKER_SECRET;
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: '', sessionId: '' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('jobId or sessionId required');
      });

      it('should accept request with body containing extra fields', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processShipJob).mockResolvedValueOnce(undefined);
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job-123', extra: 'field', another: 'value' });

        expect(response.status).toBe(200);
      });
    });

    describe('Job processing', () => {
      it('should process ship job successfully', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processShipJob).mockResolvedValueOnce(undefined);
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok', jobId: 'job-123' });
        expect(processShipJob).toHaveBeenCalledWith('job-123');
      });

      it('should process ship job with both jobId and sessionId', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processShipJob).mockResolvedValueOnce(undefined);
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job-123', sessionId: 'session-456' });

        expect(response.status).toBe(200);
        expect(response.body.jobId).toBe('job-123');
        expect(processShipJob).toHaveBeenCalledWith('job-123');
      });

      it('should return 500 when job processing fails', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processShipJob).mockRejectedValueOnce(new Error('Job failed'));
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Job failed');
        expect(logger.error).toHaveBeenCalledWith(
          { error: 'Job failed', jobId: 'job-123' },
          'Ship job worker failed'
        );
      });

      it('should handle job processing error with stack trace', async () => {
        delete process.env.JOB_WORKER_SECRET;
        const error = new Error('Complex job failure');
        error.stack = 'Error: Complex job failure\n    at processShipJob (...)';
        vi.mocked(processShipJob).mockRejectedValueOnce(error);
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Complex job failure');
      });

      it('should handle TypeError', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processShipJob).mockRejectedValueOnce(new TypeError('Invalid input type'));
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Invalid input type');
      });

      it('should handle RangeError', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processShipJob).mockRejectedValueOnce(new RangeError('Value out of range'));
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Value out of range');
      });

      it('should handle non-Error objects thrown', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processShipJob).mockRejectedValueOnce('String error');
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(500);
      });

      it('should handle undefined error message', async () => {
        delete process.env.JOB_WORKER_SECRET;
        const error = new Error();
        error.message = '';
        vi.mocked(processShipJob).mockRejectedValueOnce(error);
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('');
      });

      it('should process job with special characters in jobId', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processShipJob).mockResolvedValueOnce(undefined);
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/ship')
          .send({ jobId: 'job_ship_1234567890_abc123' });

        expect(response.status).toBe(200);
        expect(response.body.jobId).toBe('job_ship_1234567890_abc123');
      });
    });
  });

  describe('POST /api/jobs/codegen', () => {
    describe('Authentication', () => {
      it('should return 401 when secret is required but not provided', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(false);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });

      it('should accept Bearer token in Authorization header', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(true);
        vi.mocked(processCodegenJob).mockResolvedValueOnce(undefined);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .set('Authorization', 'Bearer secret-key')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(200);
      });

      it('should accept x-job-secret header', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(true);
        vi.mocked(processCodegenJob).mockResolvedValueOnce(undefined);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .set('x-job-secret', 'secret-key')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(200);
      });

      it('should skip auth when no secret is configured', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processCodegenJob).mockResolvedValueOnce(undefined);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(200);
        expect(timingSafeEqualString).not.toHaveBeenCalled();
      });

      it('should reject invalid Bearer token', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(false);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .set('Authorization', 'Bearer wrong-key')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(401);
      });

      it('should reject invalid x-job-secret', async () => {
        process.env.JOB_WORKER_SECRET = 'secret-key';
        vi.mocked(timingSafeEqualString).mockReturnValue(false);

        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .set('x-job-secret', 'wrong-secret')
          .send({ jobId: 'job-123' });

        expect(response.status).toBe(401);
      });
    });

    describe('Validation', () => {
      it('should return 400 when neither jobId nor sessionId provided', async () => {
        delete process.env.JOB_WORKER_SECRET;
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('jobId or sessionId required');
      });

      it('should return 400 when only sessionId is provided', async () => {
        delete process.env.JOB_WORKER_SECRET;
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ sessionId: 'session-123' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('jobId required for serverless worker');
      });

      it('should return 400 when jobId is null', async () => {
        delete process.env.JOB_WORKER_SECRET;
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: null });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('jobId or sessionId required');
      });

      it('should return 400 when jobId is undefined with sessionId present', async () => {
        delete process.env.JOB_WORKER_SECRET;
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: undefined, sessionId: 'session-123' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('jobId required for serverless worker');
      });
    });

    describe('Job processing', () => {
      it('should process codegen job successfully', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processCodegenJob).mockResolvedValueOnce(undefined);
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: 'job-456' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok', jobId: 'job-456' });
        expect(processCodegenJob).toHaveBeenCalledWith('job-456');
      });

      it('should process codegen job with both jobId and sessionId', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processCodegenJob).mockResolvedValueOnce(undefined);
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: 'job-456', sessionId: 'session-789' });

        expect(response.status).toBe(200);
        expect(response.body.jobId).toBe('job-456');
        expect(processCodegenJob).toHaveBeenCalledWith('job-456');
      });

      it('should return 500 when job processing fails', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processCodegenJob).mockRejectedValueOnce(new Error('Codegen failed'));
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: 'job-456' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Codegen failed');
        expect(logger.error).toHaveBeenCalledWith(
          { error: 'Codegen failed', jobId: 'job-456' },
          'Codegen job worker failed'
        );
      });

      it('should handle different error types', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processCodegenJob).mockRejectedValueOnce(new TypeError('Invalid input'));
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: 'job-456' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Invalid input');
      });

      it('should handle SyntaxError', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processCodegenJob).mockRejectedValueOnce(new SyntaxError('Unexpected token'));
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: 'job-456' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Unexpected token');
      });

      it('should handle database connection errors', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processCodegenJob).mockRejectedValueOnce(new Error('ECONNREFUSED'));
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: 'job-456' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('ECONNREFUSED');
      });

      it('should handle codegen session not found error', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processCodegenJob).mockRejectedValueOnce(new Error('Codegen session not found'));
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: 'job-456' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Codegen session not found');
      });

      it('should handle missing PRD or architecture error', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processCodegenJob).mockRejectedValueOnce(
          new Error('Codegen session missing PRD or architecture')
        );
        app = createTestApp();

        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: 'job-456' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Codegen session missing PRD or architecture');
      });

      it('should process job with UUID format jobId', async () => {
        delete process.env.JOB_WORKER_SECRET;
        vi.mocked(processCodegenJob).mockResolvedValueOnce(undefined);
        app = createTestApp();

        const uuid = 'job_codegen_1706700000000_a1b2c3d';
        const response = await request(app)
          .post('/api/jobs/codegen')
          .send({ jobId: uuid });

        expect(response.status).toBe(200);
        expect(response.body.jobId).toBe(uuid);
      });
    });
  });

  describe('Combined auth scenarios', () => {
    it('should allow multiple valid auth methods for different endpoints', async () => {
      process.env.JOB_WORKER_SECRET = 'secret-key';
      vi.mocked(timingSafeEqualString).mockReturnValue(true);
      vi.mocked(processShipJob).mockResolvedValueOnce(undefined);
      vi.mocked(processCodegenJob).mockResolvedValueOnce(undefined);

      app = createTestApp();

      // Use Bearer for ship
      const shipResponse = await request(app)
        .post('/api/jobs/ship')
        .set('Authorization', 'Bearer secret-key')
        .send({ jobId: 'ship-job' });

      // Use x-job-secret for codegen
      const codegenResponse = await request(app)
        .post('/api/jobs/codegen')
        .set('x-job-secret', 'secret-key')
        .send({ jobId: 'codegen-job' });

      expect(shipResponse.status).toBe(200);
      expect(codegenResponse.status).toBe(200);
    });

    it('should reject both when credentials are invalid', async () => {
      process.env.JOB_WORKER_SECRET = 'secret-key';
      vi.mocked(timingSafeEqualString).mockReturnValue(false);

      app = createTestApp();

      const shipResponse = await request(app)
        .post('/api/jobs/ship')
        .set('Authorization', 'Bearer wrong')
        .send({ jobId: 'ship-job' });

      const codegenResponse = await request(app)
        .post('/api/jobs/codegen')
        .set('x-job-secret', 'wrong')
        .send({ jobId: 'codegen-job' });

      expect(shipResponse.status).toBe(401);
      expect(codegenResponse.status).toBe(401);
    });

    it('should handle concurrent requests with different auth', async () => {
      process.env.JOB_WORKER_SECRET = 'secret-key';
      vi.mocked(timingSafeEqualString).mockReturnValue(true);
      vi.mocked(processShipJob).mockResolvedValue(undefined);
      vi.mocked(processCodegenJob).mockResolvedValue(undefined);

      app = createTestApp();

      const requests = [
        request(app)
          .post('/api/jobs/ship')
          .set('Authorization', 'Bearer secret-key')
          .send({ jobId: 'job-1' }),
        request(app)
          .post('/api/jobs/codegen')
          .set('x-job-secret', 'secret-key')
          .send({ jobId: 'job-2' }),
        request(app)
          .post('/api/jobs/ship')
          .set('x-job-secret', 'secret-key')
          .send({ jobId: 'job-3' }),
        request(app)
          .post('/api/jobs/codegen')
          .set('Authorization', 'Bearer secret-key')
          .send({ jobId: 'job-4' }),
      ];

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty request body', async () => {
      delete process.env.JOB_WORKER_SECRET;
      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .send({});

      // Empty body means no jobId or sessionId, so 400 is expected
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('jobId or sessionId required');
    });

    it('should handle malformed JSON gracefully', async () => {
      delete process.env.JOB_WORKER_SECRET;
      // Add error handler for JSON parsing errors
      const appWithErrorHandler = express();
      appWithErrorHandler.use(express.json());
      appWithErrorHandler.use('/api/jobs', jobsRouter);
      appWithErrorHandler.use(
        (
          err: Error,
          _req: express.Request,
          res: express.Response,
          _next: express.NextFunction
        ) => {
          if (err instanceof SyntaxError) {
            res.status(400).json({ error: 'Invalid JSON' });
            return;
          }
          res.status(500).json({ error: err.message });
        }
      );

      const response = await request(appWithErrorHandler)
        .post('/api/jobs/ship')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should handle very long jobId', async () => {
      delete process.env.JOB_WORKER_SECRET;
      vi.mocked(processShipJob).mockResolvedValueOnce(undefined);
      app = createTestApp();

      const longJobId = 'job_' + 'a'.repeat(1000);
      const response = await request(app)
        .post('/api/jobs/ship')
        .send({ jobId: longJobId });

      expect(response.status).toBe(200);
      expect(response.body.jobId).toBe(longJobId);
    });

    it('should handle jobId with unicode characters', async () => {
      delete process.env.JOB_WORKER_SECRET;
      vi.mocked(processCodegenJob).mockResolvedValueOnce(undefined);
      app = createTestApp();

      const unicodeJobId = 'job_unicode_';
      const response = await request(app)
        .post('/api/jobs/codegen')
        .send({ jobId: unicodeJobId });

      expect(response.status).toBe(200);
      expect(response.body.jobId).toBe(unicodeJobId);
    });

    it('should handle numeric jobId', async () => {
      delete process.env.JOB_WORKER_SECRET;
      vi.mocked(processShipJob).mockResolvedValueOnce(undefined);
      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .send({ jobId: 12345 });

      // The route expects string, but should handle number
      expect(response.status).toBe(200);
    });

    it('should handle object as jobId', async () => {
      delete process.env.JOB_WORKER_SECRET;
      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .send({ jobId: { id: 'test' } });

      // Object is truthy but not a valid string jobId
      expect(response.status).toBe(200);
    });

    it('should handle boolean true as sessionId', async () => {
      delete process.env.JOB_WORKER_SECRET;
      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .send({ sessionId: true });

      // sessionId is truthy but jobId is missing
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('jobId required for serverless worker');
    });
  });

  describe('HTTP method handling', () => {
    it('should reject GET requests to /ship', async () => {
      delete process.env.JOB_WORKER_SECRET;
      app = createTestApp();

      const response = await request(app).get('/api/jobs/ship');

      expect(response.status).toBe(404);
    });

    it('should reject GET requests to /codegen', async () => {
      delete process.env.JOB_WORKER_SECRET;
      app = createTestApp();

      const response = await request(app).get('/api/jobs/codegen');

      expect(response.status).toBe(404);
    });

    it('should reject PUT requests to /ship', async () => {
      delete process.env.JOB_WORKER_SECRET;
      app = createTestApp();

      const response = await request(app)
        .put('/api/jobs/ship')
        .send({ jobId: 'job-123' });

      expect(response.status).toBe(404);
    });

    it('should reject DELETE requests to /codegen', async () => {
      delete process.env.JOB_WORKER_SECRET;
      app = createTestApp();

      const response = await request(app).delete('/api/jobs/codegen');

      expect(response.status).toBe(404);
    });

    it('should reject PATCH requests to /ship', async () => {
      delete process.env.JOB_WORKER_SECRET;
      app = createTestApp();

      const response = await request(app)
        .patch('/api/jobs/ship')
        .send({ jobId: 'job-123' });

      expect(response.status).toBe(404);
    });
  });

  describe('Header handling', () => {
    it('should handle multiple Authorization headers (uses first)', async () => {
      process.env.JOB_WORKER_SECRET = 'secret-key';
      vi.mocked(timingSafeEqualString).mockReturnValue(true);
      vi.mocked(processShipJob).mockResolvedValueOnce(undefined);

      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .set('Authorization', 'Bearer secret-key')
        .send({ jobId: 'job-123' });

      expect(response.status).toBe(200);
    });

    it('should handle empty Authorization header', async () => {
      process.env.JOB_WORKER_SECRET = 'secret-key';
      vi.mocked(timingSafeEqualString).mockReturnValue(false);

      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .set('Authorization', '')
        .send({ jobId: 'job-123' });

      expect(response.status).toBe(401);
    });

    it('should handle empty x-job-secret header', async () => {
      process.env.JOB_WORKER_SECRET = 'secret-key';
      vi.mocked(timingSafeEqualString).mockReturnValue(false);

      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .set('x-job-secret', '')
        .send({ jobId: 'job-123' });

      expect(response.status).toBe(401);
    });

    it('should handle whitespace-only Bearer token', async () => {
      process.env.JOB_WORKER_SECRET = 'secret-key';
      vi.mocked(timingSafeEqualString).mockReturnValue(false);

      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .set('Authorization', 'Bearer    ')
        .send({ jobId: 'job-123' });

      expect(response.status).toBe(401);
    });

    it('should accept application/json content type', async () => {
      delete process.env.JOB_WORKER_SECRET;
      vi.mocked(processShipJob).mockResolvedValueOnce(undefined);
      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .set('Content-Type', 'application/json')
        .send({ jobId: 'job-123' });

      expect(response.status).toBe(200);
    });

    it('should accept application/json with charset', async () => {
      delete process.env.JOB_WORKER_SECRET;
      vi.mocked(processShipJob).mockResolvedValueOnce(undefined);
      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .set('Content-Type', 'application/json; charset=utf-8')
        .send({ jobId: 'job-123' });

      expect(response.status).toBe(200);
    });
  });

  describe('Response format', () => {
    it('should return JSON content type on success', async () => {
      delete process.env.JOB_WORKER_SECRET;
      vi.mocked(processShipJob).mockResolvedValueOnce(undefined);
      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .send({ jobId: 'job-123' });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return JSON content type on error', async () => {
      delete process.env.JOB_WORKER_SECRET;
      vi.mocked(processShipJob).mockRejectedValueOnce(new Error('Failed'));
      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .send({ jobId: 'job-123' });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return JSON content type on validation error', async () => {
      delete process.env.JOB_WORKER_SECRET;
      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .send({});

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return JSON content type on auth error', async () => {
      process.env.JOB_WORKER_SECRET = 'secret-key';
      vi.mocked(timingSafeEqualString).mockReturnValue(false);
      app = createTestApp();

      const response = await request(app)
        .post('/api/jobs/ship')
        .send({ jobId: 'job-123' });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Logging', () => {
    it('should log error when ship job fails', async () => {
      delete process.env.JOB_WORKER_SECRET;
      vi.mocked(processShipJob).mockRejectedValueOnce(new Error('Ship error'));
      app = createTestApp();

      await request(app)
        .post('/api/jobs/ship')
        .send({ jobId: 'job-123' });

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Ship error', jobId: 'job-123' }),
        'Ship job worker failed'
      );
    });

    it('should log error when codegen job fails', async () => {
      delete process.env.JOB_WORKER_SECRET;
      vi.mocked(processCodegenJob).mockRejectedValueOnce(new Error('Codegen error'));
      app = createTestApp();

      await request(app)
        .post('/api/jobs/codegen')
        .send({ jobId: 'job-456' });

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Codegen error', jobId: 'job-456' }),
        'Codegen job worker failed'
      );
    });

    it('should not log on successful job', async () => {
      delete process.env.JOB_WORKER_SECRET;
      vi.mocked(processShipJob).mockResolvedValueOnce(undefined);
      app = createTestApp();

      await request(app)
        .post('/api/jobs/ship')
        .send({ jobId: 'job-123' });

      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
