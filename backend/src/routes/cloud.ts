/**
 * Cloud Provisioning Routes
 * API endpoints for infrastructure generation and cloud resource management
 */

import { Router, type Request, type Response } from 'express';
import {
  generateIaC,
  generateWebAppTemplate,
  generateServerlessApiTemplate,
  generateMicroservicesTemplate,
  type CloudProvider,
  type IaCTool,
  type InfrastructureSpec,
} from '../services/cloudProvisioningService.js';
import { getVercelPresetForStack, type VercelPresetStack } from '../services/deployService.js';
import logger from '../middleware/logger.js';

const router = Router();

// ========== IaC Generation ==========

/**
 * Generate Infrastructure as Code from a specification
 * POST /api/cloud/generate
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { spec, tool = 'terraform' } = req.body as {
      spec: InfrastructureSpec;
      tool?: IaCTool;
    };

    if (!spec || !spec.name || !spec.provider || !spec.resources) {
      return res.status(400).json({
        success: false,
        error: 'Invalid specification. Required: name, provider, resources',
      });
    }

    const result = generateIaC(spec, tool);

    logger.info(
      { provider: spec.provider, tool, resources: spec.resources.length },
      'IaC generated via API'
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate IaC');
    return res.status(500).json({
      success: false,
      error: 'Failed to generate infrastructure code',
    });
  }
});

// ========== Vercel One-Click Deploy Preset ==========

/**
 * Get Vercel deploy preset for a generated project stack.
 * POST /api/cloud/vercel-preset
 * Body: { stack: 'react'|'vue'|'svelte'|'nextjs'|'vite'|'express', projectName: string, gitRepo?: { owner, repo, branch? } }
 */
router.post('/vercel-preset', async (req: Request, res: Response) => {
  try {
    const { stack, projectName, gitRepo } = req.body as {
      stack: VercelPresetStack;
      projectName: string;
      gitRepo?: { owner: string; repo: string; branch?: string };
    };

    if (!stack || !projectName) {
      return res.status(400).json({
        success: false,
        error: 'Required: stack, projectName',
      });
    }

    const preset = getVercelPresetForStack(stack, projectName, gitRepo);

    return res.json({
      success: true,
      data: preset,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get Vercel preset');
    return res.status(500).json({
      success: false,
      error: 'Failed to get Vercel deploy preset',
    });
  }
});

// ========== Quick Templates ==========

/**
 * Generate a web app infrastructure template
 * POST /api/cloud/templates/webapp
 */
router.post('/templates/webapp', async (req: Request, res: Response) => {
  try {
    const {
      name,
      provider,
      region,
      tool = 'terraform',
    } = req.body as {
      name: string;
      provider: CloudProvider;
      region: string;
      tool?: IaCTool;
    };

    if (!name || !provider || !region) {
      return res.status(400).json({
        success: false,
        error: 'Required: name, provider, region',
      });
    }

    const spec = generateWebAppTemplate(name, provider, region);
    const result = generateIaC(spec, tool);

    return res.json({
      success: true,
      data: {
        spec,
        iac: result,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate webapp template');
    return res.status(500).json({
      success: false,
      error: 'Failed to generate web app template',
    });
  }
});

/**
 * Generate a serverless API infrastructure template
 * POST /api/cloud/templates/serverless
 */
router.post('/templates/serverless', async (req: Request, res: Response) => {
  try {
    const {
      name,
      provider,
      region,
      tool = 'terraform',
    } = req.body as {
      name: string;
      provider: CloudProvider;
      region: string;
      tool?: IaCTool;
    };

    if (!name || !provider || !region) {
      return res.status(400).json({
        success: false,
        error: 'Required: name, provider, region',
      });
    }

    const spec = generateServerlessApiTemplate(name, provider, region);
    const result = generateIaC(spec, tool);

    return res.json({
      success: true,
      data: {
        spec,
        iac: result,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate serverless template');
    return res.status(500).json({
      success: false,
      error: 'Failed to generate serverless API template',
    });
  }
});

/**
 * Generate a microservices infrastructure template
 * POST /api/cloud/templates/microservices
 */
router.post('/templates/microservices', async (req: Request, res: Response) => {
  try {
    const {
      name,
      provider,
      region,
      services,
      tool = 'terraform',
    } = req.body as {
      name: string;
      provider: CloudProvider;
      region: string;
      services: string[];
      tool?: IaCTool;
    };

    if (!name || !provider || !region || !services?.length) {
      return res.status(400).json({
        success: false,
        error: 'Required: name, provider, region, services[]',
      });
    }

    const spec = generateMicroservicesTemplate(name, provider, region, services);
    const result = generateIaC(spec, tool);

    return res.json({
      success: true,
      data: {
        spec,
        iac: result,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate microservices template');
    return res.status(500).json({
      success: false,
      error: 'Failed to generate microservices template',
    });
  }
});

// ========== Mock Data for Dashboard ==========
// These would normally connect to real cloud provider APIs

interface MockIntegration {
  id: string;
  name: string;
  icon: string;
  category: 'deploy' | 'cloud' | 'baas' | 'vcs' | 'pm';
  connected: boolean;
  lastSync?: string;
  status?: 'healthy' | 'warning' | 'error';
}

interface MockDeployment {
  id: string;
  project: string;
  provider: 'vercel' | 'netlify';
  status: 'ready' | 'building' | 'error' | 'queued';
  url?: string;
  branch: string;
  commit: string;
  createdAt: string;
  duration?: number;
}

interface MockResource {
  id: string;
  name: string;
  provider: 'aws' | 'gcp' | 'azure';
  type: 'compute' | 'database' | 'storage' | 'serverless' | 'container';
  status: 'running' | 'stopped' | 'pending' | 'error';
  region: string;
  cost?: number;
}

interface MockCostSummary {
  provider: string;
  current: number;
  forecast: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

/**
 * Get dashboard overview data
 * GET /api/cloud/dashboard
 */
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    // In a real implementation, these would call actual cloud provider APIs
    const integrations: MockIntegration[] = [
      {
        id: 'vercel',
        name: 'Vercel',
        icon: 'vercel',
        category: 'deploy',
        connected: true,
        lastSync: new Date().toISOString(),
        status: 'healthy',
      },
      {
        id: 'netlify',
        name: 'Netlify',
        icon: 'netlify',
        category: 'deploy',
        connected: true,
        lastSync: new Date().toISOString(),
        status: 'healthy',
      },
      {
        id: 'aws',
        name: 'AWS',
        icon: 'aws',
        category: 'cloud',
        connected: true,
        lastSync: new Date().toISOString(),
        status: 'healthy',
      },
      { id: 'gcp', name: 'Google Cloud', icon: 'gcp', category: 'cloud', connected: false },
      { id: 'azure', name: 'Azure', icon: 'azure', category: 'cloud', connected: false },
      {
        id: 'supabase',
        name: 'Supabase',
        icon: 'supabase',
        category: 'baas',
        connected: true,
        lastSync: new Date().toISOString(),
        status: 'healthy',
      },
      { id: 'firebase', name: 'Firebase', icon: 'firebase', category: 'baas', connected: false },
      {
        id: 'github',
        name: 'GitHub',
        icon: 'github',
        category: 'vcs',
        connected: true,
        lastSync: new Date().toISOString(),
        status: 'healthy',
      },
      {
        id: 'jira',
        name: 'Jira',
        icon: 'jira',
        category: 'pm',
        connected: true,
        lastSync: new Date().toISOString(),
        status: 'warning',
      },
      { id: 'linear', name: 'Linear', icon: 'linear', category: 'pm', connected: false },
    ];

    const deployments: MockDeployment[] = [
      {
        id: 'd1',
        project: 'g-rump-app',
        provider: 'vercel',
        status: 'ready',
        url: 'https://g-rump.vercel.app',
        branch: 'main',
        commit: 'abc123',
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        duration: 45,
      },
      {
        id: 'd2',
        project: 'g-rump-docs',
        provider: 'netlify',
        status: 'building',
        branch: 'main',
        commit: 'def456',
        createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      },
      {
        id: 'd3',
        project: 'g-rump-api',
        provider: 'vercel',
        status: 'ready',
        url: 'https://api.g-rump.dev',
        branch: 'main',
        commit: 'ghi789',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        duration: 62,
      },
      {
        id: 'd4',
        project: 'g-rump-app',
        provider: 'vercel',
        status: 'error',
        branch: 'feature/new-ui',
        commit: 'jkl012',
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
      {
        id: 'd5',
        project: 'landing-page',
        provider: 'netlify',
        status: 'ready',
        url: 'https://grump.io',
        branch: 'main',
        commit: 'mno345',
        createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        duration: 28,
      },
    ];

    const resources: MockResource[] = [
      {
        id: 'r1',
        name: 'prod-api-cluster',
        provider: 'aws',
        type: 'container',
        status: 'running',
        region: 'us-east-1',
        cost: 145.5,
      },
      {
        id: 'r2',
        name: 'main-db',
        provider: 'aws',
        type: 'database',
        status: 'running',
        region: 'us-east-1',
        cost: 89.99,
      },
      {
        id: 'r3',
        name: 'static-assets',
        provider: 'aws',
        type: 'storage',
        status: 'running',
        region: 'us-east-1',
        cost: 12.3,
      },
      {
        id: 'r4',
        name: 'ai-inference',
        provider: 'gcp',
        type: 'compute',
        status: 'running',
        region: 'us-central1',
        cost: 234.0,
      },
      {
        id: 'r5',
        name: 'edge-functions',
        provider: 'aws',
        type: 'serverless',
        status: 'running',
        region: 'global',
        cost: 45.67,
      },
    ];

    const costs: MockCostSummary[] = [
      { provider: 'AWS', current: 293.46, forecast: 320.0, trend: 'up', trendPercent: 8 },
      { provider: 'GCP', current: 234.0, forecast: 250.0, trend: 'up', trendPercent: 5 },
      { provider: 'Vercel', current: 20.0, forecast: 20.0, trend: 'stable', trendPercent: 0 },
      { provider: 'Supabase', current: 25.0, forecast: 25.0, trend: 'stable', trendPercent: 0 },
    ];

    return res.json({
      success: true,
      data: {
        integrations,
        deployments,
        resources,
        costs,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch dashboard data');
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
    });
  }
});

/**
 * Get available cloud regions
 * GET /api/cloud/regions
 */
router.get('/regions', async (req: Request, res: Response) => {
  const { provider } = req.query as { provider?: CloudProvider };

  const regions: Record<CloudProvider, Array<{ id: string; name: string }>> = {
    aws: [
      { id: 'us-east-1', name: 'US East (N. Virginia)' },
      { id: 'us-east-2', name: 'US East (Ohio)' },
      { id: 'us-west-1', name: 'US West (N. California)' },
      { id: 'us-west-2', name: 'US West (Oregon)' },
      { id: 'eu-west-1', name: 'Europe (Ireland)' },
      { id: 'eu-central-1', name: 'Europe (Frankfurt)' },
      { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
      { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
    ],
    gcp: [
      { id: 'us-central1', name: 'Iowa' },
      { id: 'us-east1', name: 'South Carolina' },
      { id: 'us-west1', name: 'Oregon' },
      { id: 'europe-west1', name: 'Belgium' },
      { id: 'europe-west2', name: 'London' },
      { id: 'asia-east1', name: 'Taiwan' },
      { id: 'asia-northeast1', name: 'Tokyo' },
    ],
    azure: [
      { id: 'eastus', name: 'East US' },
      { id: 'eastus2', name: 'East US 2' },
      { id: 'westus', name: 'West US' },
      { id: 'westus2', name: 'West US 2' },
      { id: 'northeurope', name: 'North Europe' },
      { id: 'westeurope', name: 'West Europe' },
      { id: 'southeastasia', name: 'Southeast Asia' },
      { id: 'japaneast', name: 'Japan East' },
    ],
  };

  if (provider && regions[provider]) {
    return res.json({ success: true, data: regions[provider] });
  }

  return res.json({ success: true, data: regions });
});

export default router;
