/**
 * Vision Route Tests
 * Tests POST /api/vision/design-to-code endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the kimiVisionService
vi.mock('../../src/services/kimiVisionService.js', () => ({
  designToCode: vi.fn(),
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

import visionRouter from '../../src/routes/vision.js';
import { designToCode } from '../../src/services/kimiVisionService.js';

function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/vision', visionRouter);
  return app;
}

describe('Vision Route', () => {
  let app: express.Express;
  const mockDesignToCode = designToCode as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/vision/design-to-code', () => {
    describe('Validation', () => {
      it('should return 400 when neither image nor figmaUrl is provided', async () => {
        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            description: 'A login form',
            targetFramework: 'svelte',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('image (base64) or figmaUrl is required');
      });

      it('should return 400 when description is missing', async () => {
        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            image: 'base64encodedimage',
            targetFramework: 'svelte',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('description is required and must be a non-empty string');
      });

      it('should return 400 when description is empty string', async () => {
        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            image: 'base64encodedimage',
            description: '   ',
            targetFramework: 'svelte',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('description is required and must be a non-empty string');
      });

      it('should return 400 when description is not a string', async () => {
        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            image: 'base64encodedimage',
            description: 123,
            targetFramework: 'svelte',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('description is required and must be a non-empty string');
      });
    });

    describe('Success cases', () => {
      it('should generate code from image with valid request', async () => {
        mockDesignToCode.mockResolvedValueOnce({
          code: '<script>let count = 0;</script>\n<button on:click={() => count++}>{count}</button>',
          explanation: 'A simple counter component',
        });

        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            image: 'base64encodedimage',
            description: 'A counter button',
            targetFramework: 'svelte',
          });

        expect(response.status).toBe(200);
        expect(response.body.code).toBeDefined();
        expect(response.body.explanation).toBe('A simple counter component');
        expect(mockDesignToCode).toHaveBeenCalledWith({
          image: 'base64encodedimage',
          description: 'A counter button',
          targetFramework: 'svelte',
        });
      });

      it('should generate code from figmaUrl', async () => {
        mockDesignToCode.mockResolvedValueOnce({
          code: 'export default function Login() { return <form>...</form>; }',
        });

        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            figmaUrl: 'https://figma.com/file/abc123',
            description: 'A login form',
            targetFramework: 'react',
          });

        expect(response.status).toBe(200);
        expect(response.body.code).toBeDefined();
        expect(mockDesignToCode).toHaveBeenCalledWith({
          figmaUrl: 'https://figma.com/file/abc123',
          description: 'A login form',
          targetFramework: 'react',
        });
      });

      it('should strip data URL prefix from base64 image', async () => {
        mockDesignToCode.mockResolvedValueOnce({
          code: '<template><div>Vue component</div></template>',
        });

        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
            description: 'A card component',
            targetFramework: 'vue',
          });

        expect(response.status).toBe(200);
        expect(mockDesignToCode).toHaveBeenCalledWith({
          image: 'iVBORw0KGgoAAAANSUhEUgAAAAUA',
          description: 'A card component',
          targetFramework: 'vue',
        });
      });

      it('should default to svelte when invalid targetFramework is provided', async () => {
        mockDesignToCode.mockResolvedValueOnce({
          code: '<button>Click me</button>',
        });

        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            image: 'base64encodedimage',
            description: 'A button',
            targetFramework: 'invalid_framework',
          });

        expect(response.status).toBe(200);
        expect(mockDesignToCode).toHaveBeenCalledWith(
          expect.objectContaining({
            targetFramework: 'svelte',
          })
        );
      });

      it('should accept flutter as targetFramework', async () => {
        mockDesignToCode.mockResolvedValueOnce({
          code: 'Widget build(BuildContext context) { return Container(); }',
        });

        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            image: 'base64encodedimage',
            description: 'A container widget',
            targetFramework: 'flutter',
          });

        expect(response.status).toBe(200);
        expect(mockDesignToCode).toHaveBeenCalledWith(
          expect.objectContaining({
            targetFramework: 'flutter',
          })
        );
      });

      it('should handle both image and figmaUrl when both provided', async () => {
        mockDesignToCode.mockResolvedValueOnce({
          code: '<div>Combined input</div>',
        });

        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            image: 'base64encodedimage',
            figmaUrl: 'https://figma.com/file/xyz',
            description: 'A combined input test',
            targetFramework: 'svelte',
          });

        expect(response.status).toBe(200);
        expect(mockDesignToCode).toHaveBeenCalledWith({
          image: 'base64encodedimage',
          figmaUrl: 'https://figma.com/file/xyz',
          description: 'A combined input test',
          targetFramework: 'svelte',
        });
      });
    });

    describe('Error handling', () => {
      it('should return 500 when designToCode throws an error', async () => {
        mockDesignToCode.mockRejectedValueOnce(new Error('Vision API: 503 Service Unavailable'));

        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            image: 'base64encodedimage',
            description: 'A test component',
            targetFramework: 'svelte',
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Vision API: 503 Service Unavailable');
      });

      it('should return 500 when designToCode throws with missing API key', async () => {
        mockDesignToCode.mockRejectedValueOnce(new Error('NVIDIA_NIM_API_KEY is not set'));

        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            image: 'base64encodedimage',
            description: 'A test component',
            targetFramework: 'react',
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('NVIDIA_NIM_API_KEY is not set');
      });
    });

    describe('Input trimming', () => {
      it('should trim description whitespace', async () => {
        mockDesignToCode.mockResolvedValueOnce({
          code: '<div>Trimmed</div>',
        });

        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            image: 'base64encodedimage',
            description: '   A trimmed description   ',
            targetFramework: 'svelte',
          });

        expect(response.status).toBe(200);
        expect(mockDesignToCode).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'A trimmed description',
          })
        );
      });

      it('should trim figmaUrl whitespace', async () => {
        mockDesignToCode.mockResolvedValueOnce({
          code: '<div>From Figma</div>',
        });

        const response = await request(app)
          .post('/api/vision/design-to-code')
          .send({
            figmaUrl: '  https://figma.com/file/123  ',
            description: 'A Figma design',
            targetFramework: 'svelte',
          });

        expect(response.status).toBe(200);
        expect(mockDesignToCode).toHaveBeenCalledWith(
          expect.objectContaining({
            figmaUrl: 'https://figma.com/file/123',
          })
        );
      });
    });
  });
});
