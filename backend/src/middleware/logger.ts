import pino, { type Logger } from 'pino';
import pinoHttpModule from 'pino-http';
import rTracer from 'cls-rtracer';
import type { Request, Response } from 'express';

// Create the base logger
export const logger: Logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label: string) => ({ level: label }),
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
export function getRequestLogger(): Logger {
  const requestId = rTracer.id();
  return requestId ? logger.child({ requestId }) : logger;
}

// HTTP request logging middleware
// @ts-expect-error - pino-http callback types don't match Express Request/Response; runtime behavior is correct (see docs/KNOWN_ISSUES.md)
export const httpLogger = pinoHttpModule({
  logger,
  genReqId: (req: Request) =>
    (rTracer.id() as string) || (req.headers['x-request-id'] as string) || crypto.randomUUID(),
  customLogLevel: (_req: Request, res: Response, err: Error | undefined): pino.Level => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req: Request, _res: Response) => {
    return `${req.method} ${req.url} completed`;
  },
  customErrorMessage: (req: Request, _res: Response, err: Error) => {
    return `${req.method} ${req.url} failed: ${err.message}`;
  },
  serializers: {
    req: (req: Request) => ({
      method: req.method,
      url: req.url,
      requestId: rTracer.id(),
      correlationId: (req as Request & { correlationId?: string }).correlationId,
    }),
    res: (res: Response) => ({
      statusCode: res.statusCode,
    }),
  },
  // Don't log health check requests
  autoLogging: {
    ignore: (req: Request) => req.url === '/health',
  },
});

// Request ID middleware (must be first in chain)
export const requestIdMiddleware = rTracer.expressMiddleware({
  useHeader: true,
  headerName: 'x-request-id',
});

export default logger;
