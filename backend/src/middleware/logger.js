import pino from 'pino';
import pinoHttp from 'pino-http';
import rTracer from 'cls-rtracer';
// Create the base logger
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => ({ level: label }),
    },
    base: {
        service: 'mermaid-ai-backend',
        env: process.env.NODE_ENV || 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Pretty print in development
    ...(process.env.NODE_ENV !== 'production' && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
    }),
});
// Child logger with request context
export function getRequestLogger() {
    const requestId = rTracer.id();
    return requestId ? logger.child({ requestId }) : logger;
}
// HTTP request logging middleware
export const httpLogger = pinoHttp({
    logger,
    genReqId: (req) => rTracer.id() || req.headers['x-request-id'] || crypto.randomUUID(),
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err)
            return 'error';
        if (res.statusCode >= 400)
            return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, _res) => {
        return `${req.method} ${req.url} completed`;
    },
    customErrorMessage: (req, res, err) => {
        return `${req.method} ${req.url} failed: ${err.message}`;
    },
    serializers: {
        req: (req) => ({
            method: req.method,
            url: req.url,
            requestId: rTracer.id(),
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
    },
    // Don't log health check requests
    autoLogging: {
        ignore: (req) => req.url === '/health',
    },
});
// Request ID middleware (must be first in chain)
export const requestIdMiddleware = rTracer.expressMiddleware({
    useHeader: true,
    headerName: 'x-request-id',
});
export default logger;
//# sourceMappingURL=logger.js.map