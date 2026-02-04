/**
 * @fileoverview G-Rump Backend Application Entry Point
 *
 * This is the main entry point for the G-Rump backend server.
 * It initializes all services, middleware, and starts the HTTP server.
 *
 * @module index
 * @see {@link ./server/app.ts} for Express app configuration
 * @see {@link ./server/lifecycle.ts} for server lifecycle management
 */

// MUST be first import - loads environment variables before other modules
import "./config/env.js";

import logger from "./middleware/logger.js";
import {
  createApp,
  applyAsyncMiddleware,
  applyMetricsEndpoint,
  applyErrorHandlers,
} from "./server/app.js";
import {
  initializeCore,
  initializeWorkers,
  initializeMonitoring,
  initializeSkills,
  startServer,
  registerShutdownHandlers,
} from "./server/lifecycle.js";

/** Preferred port for the HTTP server */
const PREFERRED_PORT = parseInt(process.env.PORT || "3000", 10) || 3000;

/** Promise that resolves when the app is fully initialized */
let resolveAppReady: (() => void) | null = null;
export const appReady = new Promise<void>((resolve) => {
  resolveAppReady = resolve as () => void;
});

/** Express application instance */
const app = createApp();

/**
 * Main application bootstrap function.
 * Initializes all services and starts the server.
 */
async function bootstrap(): Promise<void> {
  try {
    // Phase 1: Initialize core services (database, cost tracking)
    await initializeCore();

    // Phase 2: Initialize background workers (job queue, schedulers)
    await initializeWorkers();

    // Phase 3: Apply async middleware (rate limiting, auth, routes)
    await applyAsyncMiddleware(app);

    // Phase 4: Apply metrics and error handlers
    applyMetricsEndpoint(app);
    applyErrorHandlers(app);

    // Signal that the app is ready for requests
    resolveAppReady?.();

    // Phase 5: Initialize monitoring and alerting
    initializeMonitoring();

    // Phase 6: Initialize skills/plugin system
    await initializeSkills(app);

    // Phase 7: Start HTTP server
    await startServer(app, PREFERRED_PORT);

    // Phase 8: Register shutdown handlers
    registerShutdownHandlers();
  } catch (err) {
    const error = err as Error;
    logger.error(
      { error: error.message, stack: error.stack },
      "Failed to start server",
    );
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
  }
}

// Start the application
bootstrap();

export default app;
