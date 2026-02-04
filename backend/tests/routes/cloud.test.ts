/**
 * Cloud Route Tests
 * Tests cloud provisioning and dashboard endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the cloudProvisioningService
vi.mock('../../src/services/cloudProvisioningService.js', () => ({
  generateIaC: vi.fn(),
  generateWebAppTemplate: vi.fn(),
  generateServerlessApiTemplate: vi.fn(),
  generateMicroservicesTemplate: vi.fn(),
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

import cloudRouter from '../../src/routes/cloud.js';
import {
  generateIaC,
  generateWebAppTemplate,
  generateServerlessApiTemplate,
  generateMicroservicesTemplate,
} from '../../src/services/cloudProvisioningService.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cloud', cloudRouter);
  return app;
}

describe('Cloud Route', () => {
  let app: express.Express;
  const mockGenerateIaC = generateIaC as ReturnType<typeof vi.fn>;
  const mockGenerateWebAppTemplate = generateWebAppTemplate as ReturnType<typeof vi.fn>;
  const mockGenerateServerlessApiTemplate = generateServerlessApiTemplate as ReturnType<typeof vi.fn>;
  const mockGenerateMicroservicesTemplate = generateMicroservicesTemplate as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/cloud/generate', () => {
    const validSpec = {
      name: 'my-infra',
      provider: 'aws',
      region: 'us-east-1',
      resources: [
        { type: 'compute', name: 'web-server', provider: 'aws', config: {} },
      ],
    };

    describe('Validation', () => {
      it('should return 400 when spec is missing', async () => {
        const response = await request(app)
          .post('/api/cloud/generate')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Invalid specification');
      });

      it('should return 400 when spec.name is missing', async () => {
        const response = await request(app)
          .post('/api/cloud/generate')
          .send({
            spec: { provider: 'aws', resources: [] },
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 when spec.provider is missing', async () => {
        const response = await request(app)
          .post('/api/cloud/generate')
          .send({
            spec: { name: 'test', resources: [] },
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 when spec.resources is missing', async () => {
        const response = await request(app)
          .post('/api/cloud/generate')
          .send({
            spec: { name: 'test', provider: 'aws' },
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('Success cases', () => {
      it('should generate IaC with default terraform tool', async () => {
        const mockResult = {
          tool: 'terraform',
          provider: 'aws',
          files: [{ name: 'main.tf', content: 'resource ...' }],
          commands: ['terraform init', 'terraform apply'],
        };
        mockGenerateIaC.mockReturnValueOnce(mockResult);

        const response = await request(app)
          .post('/api/cloud/generate')
          .send({ spec: validSpec });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
        expect(mockGenerateIaC).toHaveBeenCalledWith(validSpec, 'terraform');
      });

      it('should generate IaC with pulumi tool', async () => {
        const mockResult = {
          tool: 'pulumi',
          provider: 'aws',
          files: [{ name: 'index.ts', content: 'import * as pulumi...' }],
          commands: ['pulumi up'],
        };
        mockGenerateIaC.mockReturnValueOnce(mockResult);

        const response = await request(app)
          .post('/api/cloud/generate')
          .send({ spec: validSpec, tool: 'pulumi' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(mockGenerateIaC).toHaveBeenCalledWith(validSpec, 'pulumi');
      });

      it('should generate IaC for GCP provider', async () => {
        const gcpSpec = { ...validSpec, provider: 'gcp' };
        mockGenerateIaC.mockReturnValueOnce({
          tool: 'terraform',
          provider: 'gcp',
          files: [],
          commands: [],
        });

        const response = await request(app)
          .post('/api/cloud/generate')
          .send({ spec: gcpSpec });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should generate IaC for Azure provider', async () => {
        const azureSpec = { ...validSpec, provider: 'azure' };
        mockGenerateIaC.mockReturnValueOnce({
          tool: 'terraform',
          provider: 'azure',
          files: [],
          commands: [],
        });

        const response = await request(app)
          .post('/api/cloud/generate')
          .send({ spec: azureSpec });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('Error handling', () => {
      it('should return 500 when generateIaC throws', async () => {
        mockGenerateIaC.mockImplementationOnce(() => {
          throw new Error('Generation failed');
        });

        const response = await request(app)
          .post('/api/cloud/generate')
          .send({ spec: validSpec });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Failed to generate infrastructure code');
      });
    });
  });

  describe('POST /api/cloud/vercel-preset', () => {
    it('should return 400 when stack or projectName missing', async () => {
      const res = await request(app)
        .post('/api/cloud/vercel-preset')
        .send({ stack: 'react' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('stack');
      expect(res.body.error).toContain('projectName');
    });

    it('should return Vercel preset for react stack', async () => {
      const res = await request(app)
        .post('/api/cloud/vercel-preset')
        .send({ stack: 'react', projectName: 'my-app' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('my-app');
      expect(res.body.data.framework).toBeDefined();
      expect(res.body.data.buildCommand).toBe('npm run build');
    });

    it('should include gitRepo when provided', async () => {
      const res = await request(app)
        .post('/api/cloud/vercel-preset')
        .send({
          stack: 'nextjs',
          projectName: 'my-next-app',
          gitRepo: { owner: 'user', repo: 'my-repo', branch: 'main' },
        });
      expect(res.status).toBe(200);
      expect(res.body.data.gitRepository).toEqual({
        provider: 'github',
        repo: 'user/my-repo',
        branch: 'main',
      });
    });
  });

  describe('POST /api/cloud/templates/webapp', () => {
    describe('Validation', () => {
      it('should return 400 when name is missing', async () => {
        const response = await request(app)
          .post('/api/cloud/templates/webapp')
          .send({ provider: 'aws', region: 'us-east-1' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('name, provider, region');
      });

      it('should return 400 when provider is missing', async () => {
        const response = await request(app)
          .post('/api/cloud/templates/webapp')
          .send({ name: 'my-app', region: 'us-east-1' });

        expect(response.status).toBe(400);
      });

      it('should return 400 when region is missing', async () => {
        const response = await request(app)
          .post('/api/cloud/templates/webapp')
          .send({ name: 'my-app', provider: 'aws' });

        expect(response.status).toBe(400);
      });
    });

    describe('Success cases', () => {
      it('should generate webapp template with terraform', async () => {
        const mockSpec = { name: 'my-app', provider: 'aws', region: 'us-east-1', resources: [] };
        const mockIaC = { tool: 'terraform', files: [], commands: [] };
        
        mockGenerateWebAppTemplate.mockReturnValueOnce(mockSpec);
        mockGenerateIaC.mockReturnValueOnce(mockIaC);

        const response = await request(app)
          .post('/api/cloud/templates/webapp')
          .send({ name: 'my-app', provider: 'aws', region: 'us-east-1' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.spec).toEqual(mockSpec);
        expect(response.body.data.iac).toEqual(mockIaC);
      });

      it('should generate webapp template with pulumi', async () => {
        const mockSpec = { name: 'my-app', provider: 'gcp', region: 'us-central1', resources: [] };
        mockGenerateWebAppTemplate.mockReturnValueOnce(mockSpec);
        mockGenerateIaC.mockReturnValueOnce({ tool: 'pulumi', files: [], commands: [] });

        const response = await request(app)
          .post('/api/cloud/templates/webapp')
          .send({ name: 'my-app', provider: 'gcp', region: 'us-central1', tool: 'pulumi' });

        expect(response.status).toBe(200);
        expect(mockGenerateIaC).toHaveBeenCalledWith(mockSpec, 'pulumi');
      });
    });

    describe('Error handling', () => {
      it('should return 500 when template generation fails', async () => {
        mockGenerateWebAppTemplate.mockImplementationOnce(() => {
          throw new Error('Template error');
        });

        const response = await request(app)
          .post('/api/cloud/templates/webapp')
          .send({ name: 'my-app', provider: 'aws', region: 'us-east-1' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to generate web app template');
      });
    });
  });

  describe('POST /api/cloud/templates/serverless', () => {
    describe('Validation', () => {
      it('should return 400 when required fields are missing', async () => {
        const response = await request(app)
          .post('/api/cloud/templates/serverless')
          .send({ name: 'my-api' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('name, provider, region');
      });
    });

    describe('Success cases', () => {
      it('should generate serverless template', async () => {
        const mockSpec = { name: 'my-api', provider: 'aws', region: 'us-west-2', resources: [] };
        const mockIaC = { tool: 'terraform', files: [], commands: [] };
        
        mockGenerateServerlessApiTemplate.mockReturnValueOnce(mockSpec);
        mockGenerateIaC.mockReturnValueOnce(mockIaC);

        const response = await request(app)
          .post('/api/cloud/templates/serverless')
          .send({ name: 'my-api', provider: 'aws', region: 'us-west-2' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.spec).toEqual(mockSpec);
        expect(mockGenerateServerlessApiTemplate).toHaveBeenCalledWith('my-api', 'aws', 'us-west-2');
      });
    });

    describe('Error handling', () => {
      it('should return 500 when generation fails', async () => {
        mockGenerateServerlessApiTemplate.mockImplementationOnce(() => {
          throw new Error('Serverless error');
        });

        const response = await request(app)
          .post('/api/cloud/templates/serverless')
          .send({ name: 'my-api', provider: 'aws', region: 'us-east-1' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to generate serverless API template');
      });
    });
  });

  describe('POST /api/cloud/templates/microservices', () => {
    describe('Validation', () => {
      it('should return 400 when services array is missing', async () => {
        const response = await request(app)
          .post('/api/cloud/templates/microservices')
          .send({ name: 'my-ms', provider: 'aws', region: 'us-east-1' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('services[]');
      });

      it('should return 400 when services array is empty', async () => {
        const response = await request(app)
          .post('/api/cloud/templates/microservices')
          .send({ name: 'my-ms', provider: 'aws', region: 'us-east-1', services: [] });

        expect(response.status).toBe(400);
      });
    });

    describe('Success cases', () => {
      it('should generate microservices template', async () => {
        const mockSpec = { name: 'my-ms', provider: 'aws', region: 'us-east-1', resources: [] };
        const mockIaC = { tool: 'terraform', files: [], commands: [] };
        
        mockGenerateMicroservicesTemplate.mockReturnValueOnce(mockSpec);
        mockGenerateIaC.mockReturnValueOnce(mockIaC);

        const response = await request(app)
          .post('/api/cloud/templates/microservices')
          .send({
            name: 'my-ms',
            provider: 'aws',
            region: 'us-east-1',
            services: ['auth', 'api', 'worker'],
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(mockGenerateMicroservicesTemplate).toHaveBeenCalledWith(
          'my-ms',
          'aws',
          'us-east-1',
          ['auth', 'api', 'worker']
        );
      });
    });

    describe('Error handling', () => {
      it('should return 500 when generation fails', async () => {
        mockGenerateMicroservicesTemplate.mockImplementationOnce(() => {
          throw new Error('Microservices error');
        });

        const response = await request(app)
          .post('/api/cloud/templates/microservices')
          .send({
            name: 'my-ms',
            provider: 'aws',
            region: 'us-east-1',
            services: ['svc1'],
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to generate microservices template');
      });
    });
  });

  describe('GET /api/cloud/dashboard', () => {
    it('should return dashboard data with all sections', async () => {
      const response = await request(app).get('/api/cloud/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('integrations');
      expect(response.body.data).toHaveProperty('deployments');
      expect(response.body.data).toHaveProperty('resources');
      expect(response.body.data).toHaveProperty('costs');
    });

    it('should return integrations with correct structure', async () => {
      const response = await request(app).get('/api/cloud/dashboard');

      const { integrations } = response.body.data;
      expect(Array.isArray(integrations)).toBe(true);
      expect(integrations.length).toBeGreaterThan(0);

      const integration = integrations[0];
      expect(integration).toHaveProperty('id');
      expect(integration).toHaveProperty('name');
      expect(integration).toHaveProperty('icon');
      expect(integration).toHaveProperty('category');
      expect(integration).toHaveProperty('connected');
    });

    it('should return deployments with correct structure', async () => {
      const response = await request(app).get('/api/cloud/dashboard');

      const { deployments } = response.body.data;
      expect(Array.isArray(deployments)).toBe(true);
      expect(deployments.length).toBeGreaterThan(0);

      const deployment = deployments[0];
      expect(deployment).toHaveProperty('id');
      expect(deployment).toHaveProperty('project');
      expect(deployment).toHaveProperty('provider');
      expect(deployment).toHaveProperty('status');
      expect(deployment).toHaveProperty('branch');
      expect(deployment).toHaveProperty('commit');
      expect(deployment).toHaveProperty('createdAt');
    });

    it('should return resources with correct structure', async () => {
      const response = await request(app).get('/api/cloud/dashboard');

      const { resources } = response.body.data;
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);

      const resource = resources[0];
      expect(resource).toHaveProperty('id');
      expect(resource).toHaveProperty('name');
      expect(resource).toHaveProperty('provider');
      expect(resource).toHaveProperty('type');
      expect(resource).toHaveProperty('status');
      expect(resource).toHaveProperty('region');
    });

    it('should return costs with correct structure', async () => {
      const response = await request(app).get('/api/cloud/dashboard');

      const { costs } = response.body.data;
      expect(Array.isArray(costs)).toBe(true);
      expect(costs.length).toBeGreaterThan(0);

      const cost = costs[0];
      expect(cost).toHaveProperty('provider');
      expect(cost).toHaveProperty('current');
      expect(cost).toHaveProperty('forecast');
      expect(cost).toHaveProperty('trend');
      expect(cost).toHaveProperty('trendPercent');
    });

    it('should include various integration categories', async () => {
      const response = await request(app).get('/api/cloud/dashboard');

      const { integrations } = response.body.data;
      const categories = new Set(integrations.map((i: { category: string }) => i.category));
      
      expect(categories.has('deploy')).toBe(true);
      expect(categories.has('cloud')).toBe(true);
      expect(categories.has('baas')).toBe(true);
      expect(categories.has('vcs')).toBe(true);
      expect(categories.has('pm')).toBe(true);
    });
  });

  describe('GET /api/cloud/regions', () => {
    it('should return all regions when no provider specified', async () => {
      const response = await request(app).get('/api/cloud/regions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('aws');
      expect(response.body.data).toHaveProperty('gcp');
      expect(response.body.data).toHaveProperty('azure');
    });

    it('should return AWS regions when provider=aws', async () => {
      const response = await request(app)
        .get('/api/cloud/regions')
        .query({ provider: 'aws' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      const region = response.body.data[0];
      expect(region).toHaveProperty('id');
      expect(region).toHaveProperty('name');
    });

    it('should return GCP regions when provider=gcp', async () => {
      const response = await request(app)
        .get('/api/cloud/regions')
        .query({ provider: 'gcp' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.some((r: { id: string }) => r.id === 'us-central1')).toBe(true);
    });

    it('should return Azure regions when provider=azure', async () => {
      const response = await request(app)
        .get('/api/cloud/regions')
        .query({ provider: 'azure' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.some((r: { id: string }) => r.id === 'eastus')).toBe(true);
    });

    it('should return all regions for unknown provider', async () => {
      const response = await request(app)
        .get('/api/cloud/regions')
        .query({ provider: 'unknown' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('aws');
      expect(response.body.data).toHaveProperty('gcp');
      expect(response.body.data).toHaveProperty('azure');
    });

    it('should include common AWS regions', async () => {
      const response = await request(app)
        .get('/api/cloud/regions')
        .query({ provider: 'aws' });

      const regionIds = response.body.data.map((r: { id: string }) => r.id);
      expect(regionIds).toContain('us-east-1');
      expect(regionIds).toContain('us-west-2');
      expect(regionIds).toContain('eu-west-1');
    });
  });
});
