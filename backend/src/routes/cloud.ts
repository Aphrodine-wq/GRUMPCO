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
} from '../services/workspace/cloudProvisioningService.js';
import {
  getVercelPresetForStack,
  type VercelPresetStack,
} from '../services/workspace/deployService.js';
import { getIntegrations } from '../services/integrations/integrationService.js';
import type { IntegrationProviderId } from '../types/integrations.js';
import logger from '../middleware/logger.js';

const router = Router();

/** Map provider to dashboard category for GET /dashboard */
function providerToCategory(
  provider: IntegrationProviderId
): 'deploy' | 'cloud' | 'baas' | 'vcs' | 'pm' {
  const deploy = ['vercel', 'netlify'];
  const cloud = ['aws', 'gcp', 'azure'];
  const baas = ['supabase', 'firebase'];
  const vcs = ['github', 'gitlab', 'bitbucket'];
  const pm = ['jira', 'linear', 'atlassian'];
  if (deploy.includes(provider)) return 'deploy';
  if (cloud.includes(provider)) return 'cloud';
  if (baas.includes(provider)) return 'baas';
  if (vcs.includes(provider)) return 'vcs';
  if (pm.includes(provider)) return 'pm';
  return 'deploy'; // fallback
}

/** Human-readable name for provider */
function providerDisplayName(provider: string): string {
  const names: Record<string, string> = {
    vercel: 'Vercel',
    netlify: 'Netlify',
    aws: 'AWS',
    gcp: 'Google Cloud',
    azure: 'Azure',
    supabase: 'Supabase',
    firebase: 'Firebase',
    github: 'GitHub',
    gitlab: 'GitLab',
    bitbucket: 'Bitbucket',
    jira: 'Jira',
    linear: 'Linear',
    atlassian: 'Atlassian',
    figma: 'Figma',
    slack: 'Slack',
    discord: 'Discord',
    stripe: 'Stripe',
  };
  return names[provider] ?? provider;
}

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
 * Integrations are sourced from the integrations API/DB; deployments, resources, and costs
 * are empty until deploy/cost backends are configured (see docs/RENDER_BACKEND_ENV.md).
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId =
      (req.headers['x-user-id'] as string)?.trim() ||
      (req as Request & { userId?: string }).userId ||
      'default';

    let integrations: MockIntegration[] = [];
    try {
      const list = await getIntegrations(userId);
      integrations = list.map((int) => ({
        id: int.provider,
        name: int.display_name?.trim() || providerDisplayName(int.provider),
        icon: int.provider,
        category: providerToCategory(int.provider),
        connected: int.status === 'active',
        lastSync: int.status === 'active' ? int.updated_at : undefined,
        status:
          int.status === 'active'
            ? ('healthy' as const)
            : int.status === 'error'
              ? ('error' as const)
              : ('warning' as const),
      }));
    } catch (e) {
      logger.debug(
        { error: (e as Error).message },
        'Cloud dashboard: integrations unavailable, returning empty'
      );
    }

    // Deployments, resources, costs: populated when deploy/cost backends are configured
    const deployments: MockDeployment[] = [];
    const resources: MockResource[] = [];
    const costs: MockCostSummary[] = [];

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
