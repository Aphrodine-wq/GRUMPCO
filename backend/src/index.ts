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
import './config/env.js';

import logger from './middleware/logger.js';
import {
  createApp,
  applyAsyncMiddleware,
  applyMetricsEndpoint,
  applyErrorHandlers,
} from './server/app.js';
import {
  initializeCore,
  initializeWorkers,
  initializeMonitoring,
  initializeSkills,
  startServer,
  registerShutdownHandlers,
} from './server/lifecycle.js';

/** Preferred port for the HTTP server */
const PREFERRED_PORT = parseInt(process.env.PORT || '3000', 10) || 3000;

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
    // Phase 0: Register shutdown & error handlers FIRST so unhandledRejection /
    // uncaughtException handlers protect every subsequent phase.
    registerShutdownHandlers();

    // Phase 1: Initialize core services (database, cost tracking) — must be first
    await initializeCore();

    // Phase 2+3: Workers and middleware are INDEPENDENT — run in parallel
    await Promise.all([initializeWorkers(), applyAsyncMiddleware(app)]);

    // Phase 4: Apply metrics and error handlers (sync, fast)
    applyMetricsEndpoint(app);
    applyErrorHandlers(app);

    // Signal that the app is ready for requests
    resolveAppReady?.();

    // Phase 5: Start HTTP server BEFORE optional services
    await startServer(app, PREFERRED_PORT);

    // Phase 6: Shutdown handlers already registered in Phase 0

    // Phase 7+8: Non-critical — run in background AFTER server is listening
    // This means the server starts accepting requests ~1s sooner
    initializeMonitoring();
    initializeSkills(app).catch((err) => {
      logger.warn({ err: (err as Error).message }, 'Skills init failed (non-fatal)');
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ error: error.message, stack: error.stack }, 'Failed to start server');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}

// Start the application
bootstrap();

export default app;
