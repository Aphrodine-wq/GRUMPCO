/**
 * Logger Utility
 * Simple wrapper around pino logger for standalone use
 */

import { getRequestLogger } from '../middleware/logger.js';

// Create a default logger for use outside of request context
const defaultLogger = {
    debug: (...args: unknown[]) => console.debug('[DEBUG]', ...args),
    info: (...args: unknown[]) => console.info('[INFO]', ...args),
    warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
    error: (...args: unknown[]) => console.error('[ERROR]', ...args),
};

// Export a logger that tries to use request context, falls back to default
export const logger = {
    debug: (obj: Record<string, unknown>, msg?: string) => {
        try {
            const log = getRequestLogger();
            log.debug(obj, msg);
        } catch {
            if (msg) {
                defaultLogger.debug(msg, obj);
            } else {
                defaultLogger.debug(obj);
            }
        }
    },
    info: (obj: Record<string, unknown>, msg?: string) => {
        try {
            const log = getRequestLogger();
            log.info(obj, msg);
        } catch {
            if (msg) {
                defaultLogger.info(msg, obj);
            } else {
                defaultLogger.info(obj);
            }
        }
    },
    warn: (obj: Record<string, unknown>, msg?: string) => {
        try {
            const log = getRequestLogger();
            log.warn(obj, msg);
        } catch {
            if (msg) {
                defaultLogger.warn(msg, obj);
            } else {
                defaultLogger.warn(obj);
            }
        }
    },
    error: (obj: Record<string, unknown>, msg?: string) => {
        try {
            const log = getRequestLogger();
            log.error(obj, msg);
        } catch {
            if (msg) {
                defaultLogger.error(msg, obj);
            } else {
                defaultLogger.error(obj);
            }
        }
    },
};
