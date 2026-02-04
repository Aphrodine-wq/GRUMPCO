/**
 * Demo Route Tests
 * Tests POST /api/demo/start endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import os from 'os';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    mkdtemp: vi.fn(),
    cp: vi.fn(),
  },
}));

// Mock fs (sync)
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

// Mock the logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import demoRouter, { DEMO_STEPS } from '../../src/routes/demo.js';
import fsPromises from 'fs/promises';
import fsSync from 'fs';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/demo', demoRouter);
  return app;
}

describe('Demo Route', () => {
  let app: express.Express;
  const mockExistsSync = fsSync.existsSync as ReturnType<typeof vi.fn>;
  const mockMkdtemp = fsPromises.mkdtemp as ReturnType<typeof vi.fn>;
  const mockCp = fsPromises.cp as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('DEMO_STEPS export', () => {
    it('should export DEMO_STEPS array with correct structure', () => {
      expect(DEMO_STEPS).toBeDefined();
      expect(Array.isArray(DEMO_STEPS)).toBe(true);
      expect(DEMO_STEPS.length).toBe(3);

      // Check first step
      expect(DEMO_STEPS[0]).toEqual({
        target: '.chat-input',
        title: 'Demo workspace ready',
        content: expect.stringContaining('demo project'),
        position: 'top',
      });

      // Check each step has required properties
      DEMO_STEPS.forEach((step) => {
        expect(step).toHaveProperty('target');
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('content');
        expect(step).toHaveProperty('position');
        expect(['top', 'bottom', 'left', 'right']).toContain(step.position);
      });
    });
  });

  describe('POST /api/demo/start', () => {
    describe('Success cases', () => {
      it('should create demo workspace and return path with steps', async () => {
        const tempPath = path.join(os.tmpdir(), 'grump-demo-abc123');
        
        mockExistsSync.mockImplementation((p: string) => {
          return p.includes('demo-project');
        });
        mockMkdtemp.mockResolvedValueOnce(tempPath);
        mockCp.mockResolvedValueOnce(undefined);

        const response = await request(app).post('/api/demo/start');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('workspacePath');
        expect(response.body.workspacePath).toBe(tempPath);
        expect(response.body).toHaveProperty('steps');
        expect(response.body.steps).toEqual(DEMO_STEPS);
      });

      it('should use recursive copy for template', async () => {
        const tempPath = path.join(os.tmpdir(), 'grump-demo-xyz789');
        
        mockExistsSync.mockReturnValue(true);
        mockMkdtemp.mockResolvedValueOnce(tempPath);
        mockCp.mockResolvedValueOnce(undefined);

        await request(app).post('/api/demo/start');

        expect(mockCp).toHaveBeenCalledWith(
          expect.any(String),
          tempPath,
          { recursive: true }
        );
      });

      it('should create temp directory with grump-demo prefix', async () => {
        const tempPath = path.join(os.tmpdir(), 'grump-demo-test');
        
        mockExistsSync.mockReturnValue(true);
        mockMkdtemp.mockResolvedValueOnce(tempPath);
        mockCp.mockResolvedValueOnce(undefined);

        await request(app).post('/api/demo/start');

        expect(mockMkdtemp).toHaveBeenCalledWith(
          expect.stringContaining('grump-demo-')
        );
      });
    });

    describe('Template not found', () => {
      it('should return 503 when template directory does not exist', async () => {
        mockExistsSync.mockReturnValue(false);

        const response = await request(app).post('/api/demo/start');

        expect(response.status).toBe(503);
        expect(response.body.error).toContain('Demo template not available');
        expect(response.body.error).toContain('templates/demo-project');
      });

      it('should check multiple candidate paths for template', async () => {
        mockExistsSync.mockReturnValue(false);

        await request(app).post('/api/demo/start');

        // Should have checked at least 3 candidate paths
        expect(mockExistsSync).toHaveBeenCalledTimes(3);
      });
    });

    describe('Error handling', () => {
      it('should return 500 when mkdtemp fails', async () => {
        mockExistsSync.mockReturnValue(true);
        mockMkdtemp.mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

        const response = await request(app).post('/api/demo/start');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('ENOSPC: no space left on device');
      });

      it('should return 500 when cp fails', async () => {
        const tempPath = path.join(os.tmpdir(), 'grump-demo-fail');
        
        mockExistsSync.mockReturnValue(true);
        mockMkdtemp.mockResolvedValueOnce(tempPath);
        mockCp.mockRejectedValueOnce(new Error('EACCES: permission denied'));

        const response = await request(app).post('/api/demo/start');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('EACCES: permission denied');
      });

      it('should return generic error message for non-Error exceptions', async () => {
        mockExistsSync.mockReturnValue(true);
        mockMkdtemp.mockRejectedValueOnce('Unknown error string');

        const response = await request(app).post('/api/demo/start');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to create demo workspace');
      });
    });

    describe('Template path resolution', () => {
      it('should find template in first candidate path (cwd/templates)', async () => {
        const tempPath = path.join(os.tmpdir(), 'grump-demo-first');
        
        mockExistsSync.mockImplementation((p: string) => {
          return p === path.join(process.cwd(), 'templates', 'demo-project');
        });
        mockMkdtemp.mockResolvedValueOnce(tempPath);
        mockCp.mockResolvedValueOnce(undefined);

        const response = await request(app).post('/api/demo/start');

        expect(response.status).toBe(200);
        expect(mockCp).toHaveBeenCalledWith(
          path.join(process.cwd(), 'templates', 'demo-project'),
          tempPath,
          { recursive: true }
        );
      });

      it('should find template in second candidate path (../templates)', async () => {
        const tempPath = path.join(os.tmpdir(), 'grump-demo-second');
        
        let callCount = 0;
        mockExistsSync.mockImplementation(() => {
          callCount++;
          return callCount === 2; // Second path matches
        });
        mockMkdtemp.mockResolvedValueOnce(tempPath);
        mockCp.mockResolvedValueOnce(undefined);

        const response = await request(app).post('/api/demo/start');

        expect(response.status).toBe(200);
      });
    });
  });
});
