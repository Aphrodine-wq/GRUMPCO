/**
 * Lazy Route Registry with API Versioning
 *
 * Instead of eagerly importing all 50+ route modules at startup, this registry
 * defines route metadata and loads each module on first request.  Express
 * sub-routers are created lazily and cached so subsequent requests hit no
 * import overhead.
 *
 * OPTIMIZATION: Routes are now tiered by priority:
 * - HOT: Core AI routes (chat, codegen, ship) - prewarmed in serverless
 * - WARM: Auth, settings, common routes - loaded on demand
 * - COLD: Admin, analytics, rarely-used routes - lazy loaded
 *
 * API Versioning:
 * - All routes are available under /api/v1/... (versioned, recommended)
 * - Routes are also available under /api/... (unversioned, for backwards compatibility)
 * - New breaking changes should be introduced under /api/v2/...
 *
 * @module routes/registry
 */

import { Router, type RequestHandler } from "express";
import logger from "../middleware/logger.js";
import { isServerlessRuntime } from "../config/runtime.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current API version */
export const API_VERSION = "v1";

/** Supported API versions */
export const SUPPORTED_VERSIONS = ["v1"] as const;

/** Whether to enable legacy unversioned routes (/api/...) */
const ENABLE_LEGACY_ROUTES = process.env.API_DISABLE_LEGACY_ROUTES !== "true";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Route priority for loading optimization */
type RoutePriority = "hot" | "warm" | "cold";

interface RouteEntry {
  /** Express mount path (e.g. '/api/chat' or '/api/v1/chat') */
  path: string;
  /** Module specifier relative to this file (e.g. './chat.js') */
  module: string;
  /** Named export – defaults to 'default' */
  exportName?: string;
  /** API versions this route is available in (defaults to all) */
  versions?: (typeof SUPPORTED_VERSIONS)[number][];
  /** Whether this route is deprecated in the current version */
  deprecated?: boolean;
  /** Priority tier for loading optimization */
  priority?: RoutePriority;
  /** Skip this route in serverless environments */
  skipServerless?: boolean;
}

// ---------------------------------------------------------------------------
// Route definitions – grouped by domain for readability
// ---------------------------------------------------------------------------

const ROUTE_DEFINITIONS: RouteEntry[] = [
  // ── Core AI (HOT - most frequently used) ─────────────────────────────────
  { path: "/api/chat", module: "./chat.js", priority: "hot" },
  { path: "/api/codegen", module: "./codegen.js", priority: "hot" },
  { path: "/api/ship", module: "./ship.js", priority: "hot" },
  { path: "/api/models", module: "./models.js", priority: "hot" },
  { path: "/health", module: "./health.js", priority: "hot" },

  // ── Core AI (WARM - commonly used) ───────────────────────────────────────
  { path: "/api", module: "./diagram.js", priority: "warm" },
  { path: "/api/intent", module: "./intent.js", priority: "warm" },
  { path: "/api/architecture", module: "./architecture.js", priority: "warm" },
  { path: "/api/prd", module: "./prd.js", priority: "warm" },
  { path: "/api/plan", module: "./plan.js", priority: "warm" },
  { path: "/api/spec", module: "./spec.js", priority: "warm" },
  { path: "/api/rag", module: "./rag.js", priority: "warm" },
  { path: "/api/canvas", module: "./canvas.js", priority: "warm" },

  // ── Core AI (COLD - less frequently used) ────────────────────────────────
  {
    path: "/api/gagent",
    module: "./gagent.js",
    priority: "cold",
    skipServerless: true,
  },
  { path: "/api/memory", module: "./memory.js", priority: "cold" },
  { path: "/api/vision", module: "./vision.js", priority: "cold" },
  // Voice routes removed (Riva/TTS not used)
  { path: "/api/advanced-ai", module: "./advanced-ai.js", priority: "cold" },

  // ── Auth & Users (WARM) ──────────────────────────────────────────────────
  { path: "/auth", module: "./auth.js", priority: "warm" },
  { path: "/auth/google", module: "./authGoogle.js", priority: "warm" },
  { path: "/auth/github", module: "./authGithub.js", priority: "warm" },
  { path: "/auth/discord", module: "./authDiscord.js", priority: "warm" },
  { path: "/api/settings", module: "./settings.js", priority: "warm" },
  { path: "/api/approvals", module: "./approvals.js", priority: "cold" },

  // ── Agents & Jobs (COLD - require persistent runtime) ───────────────────
  {
    path: "/api/agent",
    module: "./agent.js",
    priority: "cold",
    skipServerless: true,
  },
  {
    path: "/api/agents",
    module: "./agents.js",
    priority: "cold",
    skipServerless: true,
  },
  {
    path: "/api/jobs",
    module: "./jobs.js",
    priority: "cold",
    skipServerless: true,
  },
  {
    path: "/api/cron",
    module: "./cron.js",
    priority: "cold",
    skipServerless: true,
  },

  // ── Collaboration & Workspace (WARM) ─────────────────────────────────────
  {
    path: "/api/collaboration",
    module: "./collaboration.js",
    priority: "warm",
  },
  { path: "/api/workspace", module: "./workspace.js", priority: "warm" },
  { path: "/api/templates", module: "./templates.js", priority: "cold" },
  { path: "/api/share", module: "./share.js", priority: "cold" },

  // ── Integrations (COLD) ──────────────────────────────────────────────────
  { path: "/api/figma", module: "./figma.js", priority: "cold" },
  { path: "/api/github", module: "./github.js", priority: "cold" },
  {
    path: "/api/integrations",
    module: "../features/integrations/routes.js",
    priority: "cold",
  },
  {
    path: "/api/integrations/gmail",
    module: "./gmailWebhook.js",
    priority: "cold",
  },
  {
    path: "/api/integrations-v2",
    module: "./integrations-v2.js",
    priority: "cold",
  },
  {
    path: "/api/integrations-v2/oauth",
    module: "./integrationsOAuth.js",
    priority: "cold",
  },
  { path: "/api/slack", module: "./slack.js", priority: "cold" },
  { path: "/api/webhooks", module: "./webhooks.js", priority: "cold" },

  // ── Cost Analytics & Billing (COLD) ───────────────────────────────────────
  { path: "/api/billing", module: "./billing.js", priority: "cold" },
  { path: "/api/cost", module: "./costDashboard.js", priority: "cold" },

  // ── Skills (COLD) ────────────────────────────────────────────────────────
  // /api/skills is mounted eagerly in server/app.ts so the Skills screen never gets 404
  { path: "/api/skills-api", module: "./skillsApi.js", priority: "cold" },
  { path: "/api/skills-store", module: "./skillsStore.js", priority: "cold" },

  // ── Session attachments (COLD) ───────────────────────────────────────────
  {
    path: "/api/session-attachments",
    module: "./sessionAttachments.js",
    priority: "cold",
  },

  // ── Messaging & Events (COLD) ────────────────────────────────────────────
  { path: "/api/messaging", module: "./messaging.js", priority: "cold" },
  { path: "/api/events", module: "./events.js", priority: "cold" },
  {
    path: "/api/heartbeats",
    module: "./heartbeats.js",
    priority: "cold",
    skipServerless: true,
  },

  // ── Infrastructure & DevOps (COLD - desktop only) ────────────────────────
  { path: "/api/cloud", module: "./cloud.js", priority: "cold" },
  {
    path: "/api/docker",
    module: "./docker.js",
    priority: "cold",
    skipServerless: true,
  },
  {
    path: "/api/ollama",
    module: "./ollama.js",
    priority: "cold",
    skipServerless: true,
  },

  // ── Analytics & Monitoring (COLD) ────────────────────────────────────────
  { path: "/api/analytics", module: "./analytics.js", priority: "cold" },
  { path: "/api/csp-report", module: "./cspReport.js", priority: "cold" },

  // ── Feature modules (COLD) ───────────────────────────────────────────────
  {
    path: "/api/analyze",
    module: "../features/codebase-analysis/routes.js",
    priority: "cold",
  },
  {
    path: "/api/security",
    module: "../features/security-compliance/routes.js",
    priority: "cold",
  },
  {
    path: "/api/infra",
    module: "../features/infrastructure/routes.js",
    priority: "cold",
  },
  {
    path: "/api/testing",
    module: "../features/testing-qa/routes.js",
    priority: "cold",
  },

  // ── Misc (COLD) ──────────────────────────────────────────────────────────
  { path: "/api/expo-test", module: "./expoTest.js", priority: "cold" },
  { path: "/api/demo", module: "./demo.js", priority: "cold" },
  { path: "/api/skills", module: "./skills.js", priority: "warm" },
  { path: "/api/builder", module: "./builder.js", priority: "cold" },
  { path: "/api/auto-deploy", module: "./autoDeploy.js", priority: "cold" },
  { path: "/api/docs", module: "./swagger.js", priority: "cold" },
];

// ---------------------------------------------------------------------------
// Lazy-loading wrapper
// ---------------------------------------------------------------------------

const routerCache = new Map<string, Router>();

function createLazyRouter(entry: RouteEntry): Router {
  const proxy = Router();

  const handler: RequestHandler = async (req, res, next) => {
    try {
      let router = routerCache.get(entry.module);
      if (!router) {
        const mod = await import(entry.module);
        router = (
          entry.exportName ? mod[entry.exportName] : mod.default
        ) as Router;
        routerCache.set(entry.module, router);
        logger.debug(
          { path: entry.path, module: entry.module, priority: entry.priority },
          "Lazy-loaded route module",
        );
      }
      // Delegate to the actual router
      router(req, res, next);
    } catch (err) {
      logger.error(
        { err, path: entry.path, module: entry.module },
        "Failed to lazy-load route module",
      );
      next(err);
    }
  };

  proxy.use(handler);
  return proxy;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mount all lazy-loaded routes on the given Express app.
 *
 * Routes are mounted with API versioning:
 * - /api/v1/... (versioned, recommended)
 * - /api/... (legacy, for backwards compatibility)
 *
 * In serverless mode, routes marked with skipServerless are not mounted.
 */
export function mountLazyRoutes(app: {
  use: (path: string, router: Router) => void;
}): void {
  let mountedCount = 0;
  let legacyCount = 0;
  let skippedCount = 0;
  const priorityCounts = { hot: 0, warm: 0, cold: 0 };

  for (const entry of ROUTE_DEFINITIONS) {
    // Skip routes that don't work in serverless
    if (isServerlessRuntime && entry.skipServerless) {
      skippedCount++;
      continue;
    }

    const lazyRouter = createLazyRouter(entry);
    const priority = entry.priority || "cold";
    priorityCounts[priority]++;

    // Mount versioned route (/api/v1/...)
    if (entry.path.startsWith("/api/")) {
      const versionedPath = entry.path.replace("/api/", `/api/${API_VERSION}/`);
      app.use(versionedPath, lazyRouter);
      mountedCount++;

      // Also mount legacy unversioned route for backwards compatibility
      if (ENABLE_LEGACY_ROUTES) {
        app.use(entry.path, createLazyRouter(entry));
        legacyCount++;
      }
    } else {
      // Non-API routes (e.g., /auth, /health) are mounted directly
      app.use(entry.path, lazyRouter);
      mountedCount++;
    }
  }

  logger.info(
    {
      versioned: mountedCount,
      legacy: legacyCount,
      skipped: skippedCount,
      version: API_VERSION,
      legacyEnabled: ENABLE_LEGACY_ROUTES,
      serverless: isServerlessRuntime,
      priorities: priorityCounts,
    },
    "Lazy route registry mounted",
  );
}

/**
 * Prewarm hot routes to reduce cold start latency.
 * Call this after server startup for serverless environments.
 */
export async function prewarmHotRoutes(): Promise<void> {
  if (!isServerlessRuntime) {
    logger.debug("Skipping route prewarming (not serverless)");
    return;
  }

  const hotRoutes = ROUTE_DEFINITIONS.filter(
    (r) => r.priority === "hot" && !r.skipServerless,
  );

  logger.info({ count: hotRoutes.length }, "Prewarming hot routes");

  // Import hot route modules in parallel
  await Promise.all(
    hotRoutes.map(async (entry) => {
      try {
        const mod = await import(entry.module);
        const router = (
          entry.exportName ? mod[entry.exportName] : mod.default
        ) as Router;
        routerCache.set(entry.module, router);
      } catch (err) {
        logger.warn({ path: entry.path, err }, "Failed to prewarm route");
      }
    }),
  );

  logger.info({ cached: routerCache.size }, "Hot routes prewarmed");
}

/**
 * Get route statistics for monitoring
 */
export function getRouteStats(): {
  total: number;
  cached: number;
  byPriority: Record<RoutePriority, number>;
} {
  const byPriority = { hot: 0, warm: 0, cold: 0 };
  for (const entry of ROUTE_DEFINITIONS) {
    byPriority[entry.priority || "cold"]++;
  }

  return {
    total: ROUTE_DEFINITIONS.length,
    cached: routerCache.size,
    byPriority,
  };
}
