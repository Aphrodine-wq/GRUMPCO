/**
 * @fileoverview Server lifecycle management for graceful startup and shutdown.
 * Handles initialization of services, signal handling, and cleanup.
 *
 * OPTIMIZATION: In serverless mode, heavy initializations are skipped or deferred.
 *
 * @module server/lifecycle
 */

import type { Express } from "express";
import type { Server } from "http";
import logger from "../middleware/logger.js";
import {
  initializeDatabase,
  closeDatabase,
  getDatabase,
  databaseSupportsRawDb,
} from "../db/database.js";
import { initializeCostTracking } from "../services/ai-providers/costAnalytics.js";
import { goalRepository } from "../gAgent/goalRepository.js";
import { initializeAlerting } from "../services/infra/alerting.js";
import { startJobWorker, stopJobWorker } from "../services/infra/jobQueue.js";
import {
  startScheduledAgentsWorker,
  stopScheduledAgentsWorker,
  loadRepeatableJobsFromDb,
} from "../services/agents/scheduledAgentsQueue.js";
import {
  startGmailWorker,
  stopGmailWorker,
} from "../services/integrations/gmailJobQueue.js";
import { shutdownWorkerPool } from "../services/infra/workerPool.js";
import { shutdownTracing } from "../middleware/tracing.js";
import { getTieredCache } from "../services/caching/tieredCache.js";
import { getNIMAccelerator } from "../services/ai-providers/nimAccelerator.js";
import { updateGpuMetrics } from "../middleware/metrics.js";
import { skillRegistry } from "../skills/index.js";
import {
  USER_SKILLS_DIR,
  ensureUserSkillsDir,
} from "../services/workspace/userSkillsService.js";
import { isServerlessRuntime } from "../config/runtime.js";
import { findAvailablePort } from "../utils/portUtils.js";
import {
  initErrorTracking,
  flushErrorTracking,
} from "../services/infra/errorTracking.js";
import { prewarmHotRoutes } from "../routes/registry.js";
import { getConfiguredProviders, refreshProviderCache } from "../services/ai-providers/llmGateway.js";
import { env } from "../config/env.js";

/** Interval handle for GPU metrics collection */
let gpuMetricsInterval: ReturnType<typeof setInterval> | null = null;

/** HTTP server instance */
let server: Server | undefined;

/**
 * Print startup banner with system status
 */
function printStartupBanner(port: number): void {
  const providers = getConfiguredProviders();
  const providerList =
    providers.length > 0 ? providers.join(", ") : "None (MOCK MODE)";

  logger.info(
    {
      providers: providerList,
      nimConfigured: !!env.NVIDIA_NIM_API_KEY,
      mockMode: !!env.MOCK_AI_MODE,
      database: isServerlessRuntime ? "Supabase (Cloud)" : "SQLite (Local)",
      port,
      environment: process.env.NODE_ENV || "development",
    },
    "🚀 G-RUMP AI PLATFORM — Ready to generate architectures, PRDs, and code!",
  );
}

/**
 * Initializes the database and related services.
 * In serverless mode, uses Supabase (cloud) instead of SQLite.
 * @throws If database initialization fails
 */
export async function initializeCore(): Promise<void> {
  // Initialize error tracking first (catches errors during startup)
  await initErrorTracking();

  await initializeDatabase();
  logger.info("Database initialized");

  // G-Agent goal repository requires raw DB (SQLite); skip when using Supabase
  if (databaseSupportsRawDb()) {
    const db = getDatabase().getDb();
    goalRepository.setDatabase(db);
    logger.info("G-Agent goal repository initialized");
  }

  // Cost tracking uses raw DB (SQLite DDL); skip when using Supabase
  if (databaseSupportsRawDb()) {
    await initializeCostTracking();
    logger.info("Cost tracking initialized");
  }

  // Prewarm hot routes in serverless mode
  if (isServerlessRuntime) {
    // Don't await - let it happen in background
    prewarmHotRoutes().catch((err) => {
      logger.warn({ err: (err as Error).message }, "Route prewarming failed");
    });
  }

  // Prime the user-stored provider cache so isProviderConfigured() works
  // for keys stored via the Onboarding Wizard (not just env vars)
  await refreshProviderCache("default");
}

/**
 * Initializes background job workers for async processing.
 * Skipped in serverless environments (Vercel, Lambda).
 */
export async function initializeWorkers(): Promise<void> {
  if (isServerlessRuntime) {
    logger.info("Serverless runtime: job workers and schedulers disabled");
    return;
  }

  await startJobWorker();
  logger.info("Job worker started");

  await startGmailWorker();
  logger.info("Gmail worker started");

  // Scheduled agents: Redis = BullMQ repeatable jobs; no Redis = node-cron
  const { useRedis } = await import("../services/infra/redisConnection.js");
  if (useRedis()) {
    await startScheduledAgentsWorker();
    if (databaseSupportsRawDb()) {
      await loadRepeatableJobsFromDb();
    }
    logger.info("Scheduled agents worker started (Redis/BullMQ)");
  } else {
    const { loadAllFromDbAndSchedule: loadCron } =
      await import("../services/agents/scheduledAgentsCron.js");
    await loadCron();
    logger.info("Scheduled agents started (node-cron)");
  }
}

/**
 * Initializes the alerting service for monitoring.
 * @param intervalMs - Check interval in milliseconds
 */
export function initializeMonitoring(intervalMs = 60000): void {
  initializeAlerting(intervalMs);
  logger.info("Alerting service initialized");
}

/**
 * Initializes the skills/plugin system.
 * Discovers and loads both built-in and user-defined skills.
 * @param app - Express application for mounting skill routes
 */
export async function initializeSkills(app: Express): Promise<void> {
  await skillRegistry.discoverSkills();

  try {
    await ensureUserSkillsDir();
    await skillRegistry.discoverSkills(USER_SKILLS_DIR);
  } catch (e) {
    logger.debug(
      { err: (e as Error).message },
      "User skills dir not yet created",
    );
  }

  await skillRegistry.initialize();
  skillRegistry.mountRoutes(app);
  logger.info({ skillCount: skillRegistry.count }, "Skills system initialized");
}

/**
 * Starts optional services like Discord bot and mDNS advertising.
 * @param port - Port number for service advertising
 */
export function startOptionalServices(port: number): void {
  // Bonjour/mDNS advertising (local network discovery)
  if (process.env.BONJOUR_ENABLED === "true") {
    import("../services/platform/bonjourService.js")
      .then(({ startBonjour }) => startBonjour(port))
      .catch((err) =>
        logger.debug({ err: (err as Error).message }, "Bonjour not available"),
      );
  }

  // Discord bot (requires persistent process)
  if (process.env.DISCORD_BOT_TOKEN?.trim()) {
    import("../bots/discordBot.js")
      .then(({ startDiscordBot }) => startDiscordBot())
      .catch((err) =>
        logger.warn(
          { err: (err as Error).message },
          "Discord bot failed to start",
        ),
      );
  }

  // Periodic GPU metrics when NIM is configured
  const nim = getNIMAccelerator();
  if (nim) {
    gpuMetricsInterval = setInterval(async () => {
      try {
        const gpu = await nim.getGpuMetrics();
        if (gpu) {
          updateGpuMetrics("nim-0", gpu.utilization, gpu.memoryUsed);
        } else {
          updateGpuMetrics("nim-0", 0, 0);
        }
      } catch {
        updateGpuMetrics("nim-0", 0, 0);
      }
    }, 45_000);
  }
}

/**
 * Starts the HTTP server on the specified port.
 * Automatically finds an available port if the preferred port is in use.
 * @param app - Express application instance
 * @param preferredPort - Preferred port number
 * @returns The actual port the server is listening on
 */
export async function startServer(
  app: Express,
  preferredPort: number,
): Promise<number> {
  // Skip server start in test/serverless environments
  if (
    process.env.NODE_ENV === "test" ||
    process.env.VITEST ||
    process.env.VERCEL
  ) {
    return preferredPort;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const PORT = await findAvailablePort(preferredPort);
  // Render/Heroku/Railway require binding to 0.0.0.0. Use 0.0.0.0 when PORT is set (PaaS)
  // or in development. Use 127.0.0.1 only when HOST is explicitly set in production.
  const host =
    process.env.HOST ??
    (process.env.PORT ? "0.0.0.0" : isProduction ? "127.0.0.1" : "0.0.0.0");

  return new Promise((resolve) => {
    server = app.listen(PORT, host, () => {
      logger.info(
        { port: PORT, host, env: process.env.NODE_ENV || "development" },
        "Server started",
      );
      printStartupBanner(PORT);
      startOptionalServices(PORT);
      resolve(PORT);
    });
  });
}

/**
 * Performs graceful shutdown of all services.
 * Stops workers, flushes caches, closes connections.
 */
export async function gracefulShutdown(): Promise<void> {
  logger.info("Starting graceful shutdown...");

  // Stop GPU metrics collection
  if (gpuMetricsInterval) {
    clearInterval(gpuMetricsInterval);
    gpuMetricsInterval = null;
  }

  // Stop Bonjour advertising
  try {
    const { stopBonjour } = await import("../services/platform/bonjourService.js");
    stopBonjour();
  } catch {
    // Ignore if not running
  }

  // Stop background workers
  await stopJobWorker();
  await stopGmailWorker();
  await stopScheduledAgentsWorker();
  await shutdownWorkerPool();

  // Flush NIM accelerator
  const nim = getNIMAccelerator();
  if (nim) {
    await nim.flush();
  }

  // Shutdown tiered cache
  try {
    await getTieredCache().shutdown();
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "Tiered cache shutdown warning");
  }

  // Cleanup skills
  await skillRegistry.cleanup();

  // Close database
  await closeDatabase();

  // Shutdown tracing
  await shutdownTracing();

  // Close HTTP server
  if (server) {
    const serverToClose = server;
    await new Promise<void>((resolve) => {
      serverToClose.close(() => {
        logger.info("HTTP server closed");
        resolve();
      });
    });
  }

  // Flush error tracking events
  await flushErrorTracking();

  logger.info("Graceful shutdown complete");
}

/**
 * Registers signal handlers for graceful shutdown.
 * Handles SIGTERM and SIGINT signals.
 */
export function registerShutdownHandlers(): void {
  // Increase max listeners to prevent warning in tests
  // (multiple test files register shutdown handlers)
  process.setMaxListeners(20);

  // Prevent unhandled promise rejections from crashing the process.
  // These commonly occur in async streaming pipelines (e.g. LLM stream
  // generators, SSE writes after client disconnect, abort signal races).
  process.on("unhandledRejection", (reason, promise) => {
    logger.error(
      {
        reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : String(reason),
      },
      "Unhandled promise rejection (server kept alive)",
    );
  });

  // Prevent uncaught exceptions from silently killing the process.
  // Log the error for debugging, but keep the server running for
  // non-fatal exceptions (e.g. write-after-end on SSE streams).
  process.on("uncaughtException", (error, origin) => {
    logger.error(
      {
        error: { message: error.message, stack: error.stack, name: error.name },
        origin,
      },
      "Uncaught exception (server kept alive)",
    );

    // If the error indicates a truly unrecoverable state, shut down gracefully
    const fatal =
      error.message?.includes("out of memory") ||
      error.message?.includes("ENOMEM") ||
      origin === "uncaughtException" && error.name === "RangeError";
    if (fatal) {
      logger.error("Fatal uncaught exception — initiating graceful shutdown");
      gracefulShutdown().finally(() => {
        if (process.env.NODE_ENV !== "test") {
          process.exit(1);
        }
      });
    }
  });

  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received");
    await gracefulShutdown();
    if (process.env.NODE_ENV !== "test") {
      process.exit(0);
    }
  });

  process.on("SIGINT", async () => {
    logger.info("SIGINT received");
    await gracefulShutdown();
    if (process.env.NODE_ENV !== "test") {
      process.exit(0);
    }
  });
}
