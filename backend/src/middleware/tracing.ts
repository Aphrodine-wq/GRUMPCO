/**
 * OpenTelemetry Distributed Tracing
 * Sets up tracing for HTTP requests, Claude API calls, and database operations
 *
 * OPTIMIZATION: Lazy-loads heavy OpenTelemetry modules to reduce cold start time.
 * In serverless environments, tracing is disabled by default unless OTLP_ENDPOINT is set.
 */

// Lazy imports - these are only loaded when tracing is actually enabled
let NodeSDK: typeof import('@opentelemetry/sdk-node').NodeSDK | null = null;
let getNodeAutoInstrumentations:
  | typeof import('@opentelemetry/auto-instrumentations-node').getNodeAutoInstrumentations
  | null = null;
let Resource: typeof import('@opentelemetry/resources').Resource | null = null;
let SemanticResourceAttributes:
  | typeof import('@opentelemetry/semantic-conventions').SemanticResourceAttributes
  | null = null;
let OTLPTraceExporter:
  | typeof import('@opentelemetry/exporter-trace-otlp-http').OTLPTraceExporter
  | null = null;
let ConsoleSpanExporter: typeof import('@opentelemetry/sdk-trace-base').ConsoleSpanExporter | null =
  null;

// These lightweight API imports are always needed for the middleware signature
import { trace, context, type Span, SpanStatusCode } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';
import {
  getCorrelationIdFromHeaders,
  setCorrelationIdHeader,
  generateCorrelationId,
} from '../utils/correlationId.js';
import logger from './logger.js';
import { isServerlessRuntime } from '../config/runtime.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdk: any = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Lazy-load OpenTelemetry modules (heavy dependencies ~2MB)
 */
async function loadOtelModules(): Promise<void> {
  if (NodeSDK) return; // Already loaded

  const [sdkMod, autoInstrMod, resourceMod, semconvMod, otlpMod, traceMod] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/auto-instrumentations-node'),
    import('@opentelemetry/resources'),
    import('@opentelemetry/semantic-conventions'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/sdk-trace-base'),
  ]);

  NodeSDK = sdkMod.NodeSDK;
  getNodeAutoInstrumentations = autoInstrMod.getNodeAutoInstrumentations;
  Resource = resourceMod.Resource;
  SemanticResourceAttributes = semconvMod.SemanticResourceAttributes;
  OTLPTraceExporter = otlpMod.OTLPTraceExporter;
  ConsoleSpanExporter = traceMod.ConsoleSpanExporter;
}

/**
 * Check if tracing should be enabled
 */
function shouldEnableTracing(): boolean {
  // Always skip in test
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return false;
  }

  // In serverless, only enable if OTLP endpoint is explicitly configured
  const otlpEndpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || process.env.OTLP_ENDPOINT?.trim();
  if (isServerlessRuntime) {
    return Boolean(otlpEndpoint);
  }

  // In development without OTLP, skip (console tracing is noisy)
  if (process.env.NODE_ENV === 'development' && !otlpEndpoint) {
    return false;
  }

  return true;
}

/**
 * Initialize OpenTelemetry SDK (lazy-loaded for cold start optimization)
 */
export function initializeTracing(): void {
  if (isInitialized || initPromise) {
    return;
  }

  if (!shouldEnableTracing()) {
    logger.debug('OpenTelemetry tracing disabled (serverless/dev mode without OTLP_ENDPOINT)');
    isInitialized = true;
    return;
  }

  // Start async initialization but don't block
  initPromise = (async () => {
    try {
      await loadOtelModules();

      if (!NodeSDK || !Resource || !SemanticResourceAttributes || !getNodeAutoInstrumentations) {
        throw new Error('Failed to load OpenTelemetry modules');
      }

      const serviceName =
        process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'grump-backend';
      const environment = process.env.NODE_ENV || 'development';
      const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTLP_ENDPOINT;

      // Choose exporter based on environment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let traceExporter: any = undefined;
      if (otlpEndpoint && OTLPTraceExporter) {
        const tracesUrl = otlpEndpoint.endsWith('/v1/traces')
          ? otlpEndpoint
          : `${otlpEndpoint.replace(/\/$/, '')}/v1/traces`;
        traceExporter = new OTLPTraceExporter({ url: tracesUrl });
      } else if (ConsoleSpanExporter) {
        traceExporter = new ConsoleSpanExporter();
      }

      sdk = new NodeSDK({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
          [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
        }),
        traceExporter,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Disable some instrumentations that might conflict
            '@opentelemetry/instrumentation-fs': {
              enabled: false,
            },
          }),
        ],
      });

      sdk.start();
      isInitialized = true;
      logger.info(
        { serviceName, environment, otlpEndpoint: !!otlpEndpoint },
        'OpenTelemetry tracing initialized (lazy)'
      );
    } catch (error) {
      logger.error(
        { error: (error as Error).message },
        'Failed to initialize OpenTelemetry tracing'
      );
      isInitialized = true; // Mark as initialized to prevent retry
    }
  })();
}

/**
 * Shutdown tracing SDK
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    isInitialized = false;
    logger.info('OpenTelemetry tracing shutdown');
  }
}

/**
 * Express middleware for tracing HTTP requests
 */
export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tracer = trace.getTracer('grump-http');
  const correlationId = getCorrelationIdFromHeaders(req.headers) || generateCorrelationId();

  // Set correlation ID in response
  const headerTarget: Record<string, string | string[]> = {};
  const existing = res.getHeaders();
  for (const [key, value] of Object.entries(existing)) {
    if (typeof value === 'string') headerTarget[key] = value;
    else if (Array.isArray(value)) headerTarget[key] = value.map(String);
    else if (typeof value === 'number') headerTarget[key] = String(value);
  }
  setCorrelationIdHeader(headerTarget, correlationId);
  res.setHeader('x-correlation-id', correlationId);

  // Create span for HTTP request with enhanced attributes
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.route?.path || req.path,
      'http.target': req.path,
      'http.scheme': req.protocol,
      'http.host': req.get('host'),
      'http.user_agent': req.get('user-agent') || '',
      'correlation.id': correlationId,
      'service.name': process.env.SERVICE_NAME || 'grump-backend',
    },
  });

  // Store span and correlation ID in request for later use
  (req as Request & { span?: Span; correlationId?: string }).span = span;
  (req as Request & { span?: Span; correlationId?: string }).correlationId = correlationId;

  // Run the request handler within the span context
  context.with(trace.setSpan(context.active(), span), () => {
    // End span when response finishes
    res.on('finish', () => {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.status_text': res.statusMessage,
        'http.response_size': res.get('content-length') || 0,
      });

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
        span.addEvent('http.error', {
          'error.type': 'http_error',
          'error.message': res.statusMessage || 'Unknown error',
          'http.path': req.path,
          'http.status_code': res.statusCode,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
    });

    next();
  });
}

/**
 * Create a span for a named operation
 */
export function createSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>
): Span {
  const tracer = trace.getTracer('grump-service');
  const span = tracer.startSpan(name, { attributes });
  return span;
}

/**
 * Execute a function within a span with context propagation
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = trace.getTracer('grump-service');
  const parentSpan = trace.getActiveSpan();
  const span = tracer.startSpan(name, {
    attributes: {
      ...attributes,
      'service.name': process.env.SERVICE_NAME || 'grump-backend',
    },
  });

  // Add parent span context if available
  if (parentSpan) {
    span.setAttributes({
      'parent.span_id': parentSpan.spanContext().spanId,
      'parent.trace_id': parentSpan.spanContext().traceId,
    });
  }

  try {
    const result = await context.with(trace.setSpan(context.active(), span), async () => {
      return await fn(span);
    });
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    span.recordException(error as Error);
    span.addEvent('error.occurred', {
      'error.type': (error as Error).constructor.name,
      'error.message': (error as Error).message,
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Create a span for agent operations with enhanced attributes
 */
export function createAgentSpan(
  agentType: string,
  operation: string,
  sessionId?: string,
  attributes?: Record<string, string | number | boolean>
): Span {
  const tracer = trace.getTracer('grump-agent');
  const span = tracer.startSpan(`agent.${agentType}.${operation}`, {
    attributes: {
      'agent.type': agentType,
      'agent.operation': operation,
      'service.name': process.env.SERVICE_NAME || 'grump-backend',
      ...(sessionId && { 'session.id': sessionId }),
      ...attributes,
    },
  });
  return span;
}

/**
 * Get current span from context
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan() || undefined;
}

/**
 * Add event to current span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const span = getCurrentSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set span attribute
 */
export function setSpanAttribute(key: string, value: string | number | boolean): void {
  const span = getCurrentSpan();
  if (span) {
    span.setAttribute(key, value);
  }
}

/**
 * Add NVIDIA NIM attributes to the current span for LLM operations.
 * Aligns with NVIDIA NIM observability schema.
 */
export function addNimSpanAttributes(
  provider: string,
  model: string,
  extra?: Record<string, string | number | boolean | undefined>
): void {
  const span = getCurrentSpan();
  if (span) {
    span.setAttribute('nvidia.nim.provider', provider);
    span.setAttribute('nvidia.nim.model', model);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        if (value === undefined) continue;
        span.setAttribute(`nvidia.nim.${key}`, value);
      }
    }
  }
}
