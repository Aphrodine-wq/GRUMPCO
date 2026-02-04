/**
 * Grouped Route Modules
 *
 * This module organizes all API routes into logical groups to reduce
 * complexity in index.ts and improve maintainability.
 */

import { Router } from 'express';

// Core AI routes
import diagramRoutes from './diagram.js';
import intentRoutes from './intent.js';

import prdRoutes from './prd.js';
import codegenRoutes from './codegen.js';
import chatRoutes from './chat.js';
import planRoutes from './plan.js';
import specRoutes from './spec.js';
import shipRoutes from './ship.js';
import advancedAiRoutes from './advanced-ai.js';

// Authentication routes
import authRoutes from './auth.js';
import authGoogleRoutes from './authGoogle.js';
import authGithubRoutes from './authGithub.js';
import authDiscordRoutes from './authDiscord.js';

// Integration routes
import githubRoutes from './github.js';
import slackRoutes from './slack.js';
import messagingRoutes from './messaging.js';
import webhookRoutes from './webhooks.js';
import integrationsV2Routes from './integrations-v2.js';

// Infrastructure routes
import dockerRoutes from './docker.js';
import ollamaRoutes from './ollama.js';
import modelsRoutes from './models.js';
import cloudRoutes from './cloud.js';
import healthRoutes from './health.js';

// Business routes
import settingsRoutes from './settings.js';
import costDashboardRoutes from './costDashboard.js';
import analyticsRoutes from './analytics.js';

// Collaboration routes
import collaborationRoutes from './collaboration.js';
import approvalsRoutes from './approvals.js';
import heartbeatsRoutes from './heartbeats.js';
import shareRoutes from './share.js';
import eventsRoutes from './events.js';

// AI enhancement routes
import ragRoutes from './rag.js';
import memoryRoutes from './memory.js';
import visionRoutes from './vision.js';

// Workspace routes
import workspaceRoutes from './workspace.js';
import templatesRoutes from './templates.js';
import skillsApiRoutes from './skillsApi.js';
import jobsRoutes from './jobs.js';
import agentsRoutes from './agents.js';
import demoRoutes from './demo.js';
import expoTestRoutes from './expoTest.js';

// Feature routes
import analyzeRoutes from '../features/codebase-analysis/routes.js';
import securityRoutes from '../features/security-compliance/routes.js';
import infraRoutes from '../features/infrastructure/routes.js';
import testingRoutes from '../features/testing-qa/routes.js';
import intentOptimizerRoutes from '../features/intent-optimizer/routes.js';

/**
 * Core AI Router
 * Handles all AI-related endpoints: chat, codegen, ship, etc.
 */
export function createCoreAiRouter(): Router {
  const router = Router();

  router.use('/', diagramRoutes);
  router.use('/intent', intentOptimizerRoutes); // /optimize, /optimize/batch, etc.
  router.use('/intent', intentRoutes); // /parse
  router.use('/prd', prdRoutes);
  router.use('/codegen', codegenRoutes);
  router.use('/chat', chatRoutes);
  router.use('/plan', planRoutes);
  router.use('/spec', specRoutes);
  router.use('/ship', shipRoutes);
  router.use('/advanced-ai', advancedAiRoutes);
  // Note: intentOptimizerRoutes already mounted above - removed duplicate

  return router;
}

/**
 * Auth Router
 * Handles authentication endpoints
 */
export function createAuthRouter(): Router {
  const router = Router();

  router.use('/', authRoutes);
  router.use('/google', authGoogleRoutes);
  router.use('/github', authGithubRoutes);
  router.use('/discord', authDiscordRoutes);

  return router;
}

/**
 * Integration Router
 * Handles third-party integrations
 */
export function createIntegrationRouter(): Router {
  const router = Router();

  router.use('/github', githubRoutes);
  router.use('/slack', slackRoutes);
  router.use('/messaging', messagingRoutes);
  router.use('/webhooks', webhookRoutes);
  router.use('/integrations-v2', integrationsV2Routes);

  return router;
}

/**
 * Infrastructure Router
 * Handles infrastructure and deployment endpoints
 */
export function createInfraRouter(): Router {
  const router = Router();

  router.use('/docker', dockerRoutes);
  router.use('/ollama', ollamaRoutes);
  router.use('/models', modelsRoutes);
  router.use('/cloud', cloudRoutes);
  router.use('/infra', infraRoutes);

  return router;
}

/**
 * Business Router
 * Handles settings and analytics (billing removed - desktop only)
 */
export function createBusinessRouter(): Router {
  const router = Router();

  router.use('/settings', settingsRoutes);
  router.use('/cost', costDashboardRoutes);
  router.use('/analytics', analyticsRoutes);

  return router;
}

/**
 * Collaboration Router
 * Handles team collaboration features
 */
export function createCollaborationRouter(): Router {
  const router = Router();

  router.use('/collaboration', collaborationRoutes);
  router.use('/approvals', approvalsRoutes);
  router.use('/heartbeats', heartbeatsRoutes);
  router.use('/share', shareRoutes);
  router.use('/events', eventsRoutes);

  return router;
}

/**
 * AI Enhancement Router
 * Handles RAG, memory, vision (voice removed)
 */
export function createAiEnhancementRouter(): Router {
  const router = Router();

  router.use('/rag', ragRoutes);
  router.use('/memory', memoryRoutes);
  router.use('/vision', visionRoutes);

  return router;
}

/**
 * Workspace Router
 * Handles workspace, templates, skills, jobs
 */
export function createWorkspaceRouter(): Router {
  const router = Router();

  router.use('/workspace', workspaceRoutes);
  router.use('/templates', templatesRoutes);
  router.use('/skills-api', skillsApiRoutes);
  router.use('/jobs', jobsRoutes);
  router.use('/agents', agentsRoutes);
  router.use('/demo', demoRoutes);
  router.use('/expo-test', expoTestRoutes);
  router.use('/analyze', analyzeRoutes);
  router.use('/security', securityRoutes);
  router.use('/testing', testingRoutes);

  return router;
}

/**
 * Health Router
 * Exported separately for root-level mounting
 */
export { healthRoutes };

/**
 * Mount all grouped routes on an Express app
 */
export function mountAllRoutes(app: import('express').Express): void {
  // Core AI routes at /api
  app.use('/api', createCoreAiRouter());

  // Integration routes at /api
  app.use('/api', createIntegrationRouter());

  // Infrastructure routes at /api
  app.use('/api', createInfraRouter());

  // Business routes at /api
  app.use('/api', createBusinessRouter());

  // Collaboration routes at /api
  app.use('/api', createCollaborationRouter());

  // AI enhancement routes at /api
  app.use('/api', createAiEnhancementRouter());

  // Workspace routes at /api
  app.use('/api', createWorkspaceRouter());

  // Auth routes at /auth
  app.use('/auth', createAuthRouter());

  // Health routes at /health
  app.use('/health', healthRoutes);
}
