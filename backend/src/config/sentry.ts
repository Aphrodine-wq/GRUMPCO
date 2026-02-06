import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { env } from './env.js';
import type { Express } from 'express';

export function initializeSentry(app?: Express): void {
    if (!env.SENTRY_DSN) {
        console.warn('⚠️  SENTRY_DSN not configured - error tracking disabled');
        return;
    }

    Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.NODE_ENV,
        release: `g-rump@${process.env.npm_package_version || '2.1.0'}`,

        // Performance Monitoring
        tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Profiling
        profilesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,

        integrations: [
            // Express integration
            ...(app ? [
                Sentry.httpIntegration(),
                Sentry.expressIntegration(),
            ] : []),

            // Performance profiling
            nodeProfilingIntegration(),

            // Additional integrations
            Sentry.modulesIntegration(),
            Sentry.contextLinesIntegration(),
            Sentry.consoleIntegration(),
            Sentry.onUncaughtExceptionIntegration(),
            Sentry.onUnhandledRejectionIntegration(),
        ],

        // BeforeSend hook for filtering
        beforeSend(event, hint) {
            // Filter out certain errors
            const error = hint.originalException;

            // Don't send validation errors to Sentry
            if (error && typeof error === 'object' && 'statusCode' in error) {
                const statusCode = (error as any).statusCode;
                if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
                    return null;
                }
            }

            // Add custom context
            if (event.request) {
                event.tags = {
                    ...event.tags,
                    endpoint: event.request.url,
                };
            }

            return event;
        },

        // Ignore certain errors
        ignoreErrors: [
            'ECONNABORTED',
            'ECONNRESET',
            'ETIMEDOUT',
            'AbortError',
            'ERR_CANCELED',
            /^Non-Error promise rejection/,
        ],

        // Performance tracking
        enableTracing: true,
    });

    console.log('✅ Sentry error tracking initialized');
}

export function captureException(error: Error, context?: Record<string, any>): void {
    if (context) {
        Sentry.withScope((scope) => {
            Object.entries(context).forEach(([key, value]) => {
                scope.setContext(key, value);
            });
            Sentry.captureException(error);
        });
    } else {
        Sentry.captureException(error);
    }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): void {
    if (context) {
        Sentry.withScope((scope) => {
            Object.entries(context).forEach(([key, value]) => {
                scope.setContext(key, value);
            });
            Sentry.captureMessage(message, level);
        });
    } else {
        Sentry.captureMessage(message, level);
    }
}

export { Sentry };
