/**
 * Route Index Tests
 *
 * Tests for the grouped route modules that organize all API routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from 'express';
import type { Express } from 'express';

// Mock all Core AI routes
vi.mock('../../src/routes/diagram.js', () => ({ default: Router() }));
vi.mock('../../src/routes/intent.js', () => ({ default: Router() }));
vi.mock('../../src/routes/architecture.js', () => ({ default: Router() }));
vi.mock('../../src/routes/prd.js', () => ({ default: Router() }));
vi.mock('../../src/routes/codegen.js', () => ({ default: Router() }));
vi.mock('../../src/routes/chat.js', () => ({ default: Router() }));
vi.mock('../../src/routes/plan.js', () => ({ default: Router() }));
vi.mock('../../src/routes/spec.js', () => ({ default: Router() }));
vi.mock('../../src/routes/ship.js', () => ({ default: Router() }));
vi.mock('../../src/routes/advanced-ai.js', () => ({ default: Router() }));

// Mock Authentication routes
vi.mock('../../src/routes/auth.js', () => ({ default: Router() }));
vi.mock('../../src/routes/authGoogle.js', () => ({ default: Router() }));
vi.mock('../../src/routes/authGithub.js', () => ({ default: Router() }));
vi.mock('../../src/routes/authDiscord.js', () => ({ default: Router() }));

// Mock Integration routes
vi.mock('../../src/routes/github.js', () => ({ default: Router() }));
vi.mock('../../src/routes/slack.js', () => ({ default: Router() }));
vi.mock('../../src/routes/messaging.js', () => ({ default: Router() }));
vi.mock('../../src/routes/webhooks.js', () => ({ default: Router() }));
vi.mock('../../src/routes/integrations-v2.js', () => ({ default: Router() }));

// Mock Infrastructure routes
vi.mock('../../src/routes/docker.js', () => ({ default: Router() }));
vi.mock('../../src/routes/ollama.js', () => ({ default: Router() }));
vi.mock('../../src/routes/models.js', () => ({ default: Router() }));
vi.mock('../../src/routes/cloud.js', () => ({ default: Router() }));
vi.mock('../../src/routes/health.js', () => ({ default: Router() }));

// Mock Business routes
vi.mock('../../src/routes/settings.js', () => ({ default: Router() }));
vi.mock('../../src/routes/costDashboard.js', () => ({ default: Router() }));
vi.mock('../../src/routes/analytics.js', () => ({ default: Router() }));

// Mock Collaboration routes
vi.mock('../../src/routes/collaboration.js', () => ({ default: Router() }));
vi.mock('../../src/routes/approvals.js', () => ({ default: Router() }));
vi.mock('../../src/routes/heartbeats.js', () => ({ default: Router() }));
vi.mock('../../src/routes/share.js', () => ({ default: Router() }));
vi.mock('../../src/routes/events.js', () => ({ default: Router() }));

// Mock AI Enhancement routes
vi.mock('../../src/routes/rag.js', () => ({ default: Router() }));
vi.mock('../../src/routes/memory.js', () => ({ default: Router() }));
vi.mock('../../src/routes/vision.js', () => ({ default: Router() }));

// Mock Workspace routes
vi.mock('../../src/routes/workspace.js', () => ({ default: Router() }));
vi.mock('../../src/routes/templates.js', () => ({ default: Router() }));
vi.mock('../../src/routes/skillsApi.js', () => ({ default: Router() }));
vi.mock('../../src/routes/jobs.js', () => ({ default: Router() }));
vi.mock('../../src/routes/agents.js', () => ({ default: Router() }));
vi.mock('../../src/routes/demo.js', () => ({ default: Router() }));
vi.mock('../../src/routes/expoTest.js', () => ({ default: Router() }));

// Mock Feature routes
vi.mock('../../src/features/codebase-analysis/routes.js', () => ({
  default: Router(),
}));
vi.mock('../../src/features/security-compliance/routes.js', () => ({
  default: Router(),
}));
vi.mock('../../src/features/infrastructure/routes.js', () => ({
  default: Router(),
}));
vi.mock('../../src/features/testing-qa/routes.js', () => ({
  default: Router(),
}));
vi.mock('../../src/features/integrations/routes.js', () => ({
  default: Router(),
}));
vi.mock('../../src/features/intent-optimizer/routes.js', () => ({
  default: Router(),
}));

// Import the functions under test after mocking
import {
  createCoreAiRouter,
  createAuthRouter,
  createIntegrationRouter,
  createInfraRouter,
  createBusinessRouter,
  createCollaborationRouter,
  createAiEnhancementRouter,
  createWorkspaceRouter,
  mountAllRoutes,
  healthRoutes,
} from '../../src/routes/index.js';

describe('Route Index Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCoreAiRouter', () => {
    it('should return an Express Router', () => {
      const router = createCoreAiRouter();

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      // Router has use, get, post, etc. methods
      expect(typeof router.use).toBe('function');
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
    });

    it('should mount routes on the router', () => {
      const router = createCoreAiRouter();

      // Router.stack contains the mounted middleware/routes
      expect(router.stack).toBeDefined();
      expect(Array.isArray(router.stack)).toBe(true);
      // Should have 10 routes: diagram, intent-optimizer, intent, prd, codegen, chat, plan, spec, ship, advanced-ai
      expect(router.stack.length).toBeGreaterThanOrEqual(9);
    });

    it('should have stack entries with correct layer types', () => {
      const router = createCoreAiRouter();

      router.stack.forEach((layer: { name: string; handle: unknown }) => {
        // Each layer should have a name and handle
        expect(layer).toHaveProperty('name');
        expect(layer).toHaveProperty('handle');
      });
    });
  });

  describe('createAuthRouter', () => {
    it('should return an Express Router', () => {
      const router = createAuthRouter();

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should mount 4 routes (auth, google, github, discord)', () => {
      const router = createAuthRouter();

      expect(router.stack).toBeDefined();
      expect(router.stack.length).toBe(4);
    });
  });

  describe('createIntegrationRouter', () => {
    it('should return an Express Router', () => {
      const router = createIntegrationRouter();

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should mount 5 routes (github, slack, messaging, webhooks, integrations-v2)', () => {
      const router = createIntegrationRouter();

      expect(router.stack).toBeDefined();
      expect(router.stack.length).toBe(5);
    });
  });

  describe('createInfraRouter', () => {
    it('should return an Express Router', () => {
      const router = createInfraRouter();

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should mount 5 routes (docker, ollama, models, cloud, infra)', () => {
      const router = createInfraRouter();

      expect(router.stack).toBeDefined();
      expect(router.stack.length).toBe(5);
    });
  });

  describe('createBusinessRouter', () => {
    it('should return an Express Router', () => {
      const router = createBusinessRouter();

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should mount 3 routes (settings, cost, analytics)', () => {
      const router = createBusinessRouter();

      expect(router.stack).toBeDefined();
      expect(router.stack.length).toBe(3);
    });
  });

  describe('createCollaborationRouter', () => {
    it('should return an Express Router', () => {
      const router = createCollaborationRouter();

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should mount 5 routes (collaboration, approvals, heartbeats, share, events)', () => {
      const router = createCollaborationRouter();

      expect(router.stack).toBeDefined();
      expect(router.stack.length).toBe(5);
    });
  });

  describe('createAiEnhancementRouter', () => {
    it('should return an Express Router', () => {
      const router = createAiEnhancementRouter();

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should mount 3 routes (rag, memory, vision)', () => {
      const router = createAiEnhancementRouter();

      expect(router.stack).toBeDefined();
      expect(router.stack.length).toBe(3);
    });
  });

  describe('createWorkspaceRouter', () => {
    it('should return an Express Router', () => {
      const router = createWorkspaceRouter();

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should mount 11 routes (workspace, templates, skills-api, jobs, agents, demo, expo-test, analyze, security, testing)', () => {
      const router = createWorkspaceRouter();

      expect(router.stack).toBeDefined();
      expect(router.stack.length).toBe(10);
    });
  });

  describe('healthRoutes export', () => {
    it('should export healthRoutes', () => {
      expect(healthRoutes).toBeDefined();
    });

    it('should be a router or middleware', () => {
      // healthRoutes should be a function (middleware/router)
      expect(typeof healthRoutes).toBe('function');
    });
  });

  describe('mountAllRoutes', () => {
    it('should mount all routers on the Express app', () => {
      const mockApp = {
        use: vi.fn(),
      } as unknown as Express;

      mountAllRoutes(mockApp);

      // Should call app.use 9 times (7 at /api, 1 at /auth, 1 at /health)
      expect(mockApp.use).toHaveBeenCalled();
      expect((mockApp.use as ReturnType<typeof vi.fn>).mock.calls.length).toBe(9);
    });

    it('should mount 7 routers at /api path', () => {
      const mockApp = {
        use: vi.fn(),
      } as unknown as Express;

      mountAllRoutes(mockApp);

      const apiCalls = (mockApp.use as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => call[0] === '/api'
      );
      // Core AI, Integration, Infra, Business, Collaboration, AI Enhancement, Workspace
      expect(apiCalls.length).toBe(7);
    });

    it('should mount auth router at /auth path', () => {
      const mockApp = {
        use: vi.fn(),
      } as unknown as Express;

      mountAllRoutes(mockApp);

      const authCall = (mockApp.use as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === '/auth'
      );
      expect(authCall).toBeDefined();
      expect(authCall![0]).toBe('/auth');
      expect(typeof authCall![1]).toBe('function');
    });

    it('should mount health routes at /health path', () => {
      const mockApp = {
        use: vi.fn(),
      } as unknown as Express;

      mountAllRoutes(mockApp);

      const healthCall = (mockApp.use as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === '/health'
      );
      expect(healthCall).toBeDefined();
      expect(healthCall![0]).toBe('/health');
      expect(typeof healthCall![1]).toBe('function');
    });

    it('should mount routers in correct order', () => {
      const mockApp = {
        use: vi.fn(),
      } as unknown as Express;

      mountAllRoutes(mockApp);

      const calls = (mockApp.use as ReturnType<typeof vi.fn>).mock.calls;

      // Verify the order of mount paths
      const paths = calls.map((call: unknown[]) => call[0]);
      expect(paths).toEqual([
        '/api',   // Core AI
        '/api',   // Integration
        '/api',   // Infra
        '/api',   // Business
        '/api',   // Collaboration
        '/api',   // AI Enhancement
        '/api',   // Workspace
        '/auth',  // Auth
        '/health', // Health
      ]);
    });

    it('should pass router functions to app.use', () => {
      const mockApp = {
        use: vi.fn(),
      } as unknown as Express;

      mountAllRoutes(mockApp);

      const calls = (mockApp.use as ReturnType<typeof vi.fn>).mock.calls;

      // Each call should have a path and a router function
      calls.forEach((call: unknown[]) => {
        expect(typeof call[0]).toBe('string');
        expect(typeof call[1]).toBe('function');
      });
    });

    it('should mount each router type correctly', () => {
      const mockApp = {
        use: vi.fn(),
      } as unknown as Express;

      mountAllRoutes(mockApp);

      const calls = (mockApp.use as ReturnType<typeof vi.fn>).mock.calls;

      // Verify each mounted router is a valid router function with proper methods
      calls.forEach((call: unknown[]) => {
        const routerOrMiddleware = call[1] as { use?: unknown; get?: unknown };
        expect(typeof routerOrMiddleware).toBe('function');
      });
    });
  });

  describe('Router creation consistency', () => {
    it('should create new router instances on each call', () => {
      const router1 = createCoreAiRouter();
      const router2 = createCoreAiRouter();

      // Each call should return a new router instance
      expect(router1).not.toBe(router2);
    });

    it('all router creators should return Express routers', () => {
      const routers = [
        createCoreAiRouter(),
        createAuthRouter(),
        createIntegrationRouter(),
        createInfraRouter(),
        createBusinessRouter(),
        createCollaborationRouter(),
        createAiEnhancementRouter(),
        createWorkspaceRouter(),
      ];

      routers.forEach((router) => {
        expect(router).toBeDefined();
        expect(typeof router).toBe('function');
        expect(typeof router.use).toBe('function');
        expect(typeof router.get).toBe('function');
        expect(typeof router.post).toBe('function');
        expect(typeof router.put).toBe('function');
        expect(typeof router.delete).toBe('function');
      });
    });

    it('all routers should have non-empty stacks after creation', () => {
      const routers = [
        { name: 'CoreAi', router: createCoreAiRouter(), expectedCount: 10 },
        { name: 'Auth', router: createAuthRouter(), expectedCount: 4 },
        { name: 'Integration', router: createIntegrationRouter(), expectedCount: 5 },
        { name: 'Infra', router: createInfraRouter(), expectedCount: 5 },
        { name: 'Business', router: createBusinessRouter(), expectedCount: 3 },
        { name: 'Collaboration', router: createCollaborationRouter(), expectedCount: 5 },
        { name: 'AiEnhancement', router: createAiEnhancementRouter(), expectedCount: 3 },
        { name: 'Workspace', router: createWorkspaceRouter(), expectedCount: 10 },
      ];

      routers.forEach(({ name, router, expectedCount }) => {
        expect(router.stack.length).toBe(expectedCount);
      });
    });
  });

  describe('Router stack entries', () => {
    it('each router should have properly configured middleware layers', () => {
      const routers = [
        createCoreAiRouter(),
        createAuthRouter(),
        createIntegrationRouter(),
        createInfraRouter(),
        createBusinessRouter(),
        createCollaborationRouter(),
        createAiEnhancementRouter(),
        createWorkspaceRouter(),
      ];

      routers.forEach((router) => {
        router.stack.forEach((layer: { name: string; handle: unknown }) => {
          // Each layer should have a handle function
          expect(layer).toHaveProperty('handle');
          expect(typeof layer.handle).toBe('function');
        });
      });
    });
  });
});
