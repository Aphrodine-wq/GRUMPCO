/**
 * Application Performance Monitoring (APM) Service
 *
 * Provides real-time performance monitoring, tracing, and metrics collection
 * for production environments. Integrates with OpenTelemetry for distributed tracing.
 */

import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";
import logger from "../../middleware/logger.js";
import {
  recordDbOperation,
  recordLlmStreamMetrics,
  recordLlmCost,
  recordTieredCacheAccess,
} from "../../middleware/metrics.js";

const tracer = trace.getTracer("grump-backend", "2.1.0");

export interface APMTrace {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "success" | "error";
  error?: Error;
  metadata?: Record<string, string | number | boolean>;
}

export class APMService {
  private traces: Map<string, APMTrace> = new Map();

  async trace<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    return tracer.startActiveSpan(name, async (span) => {
      try {
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            span.setAttribute(key, value);
          });
        }

        const startTime = Date.now();
        const result = await fn(span);
        const duration = Date.now() - startTime;

        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute("duration_ms", duration);

        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "Unknown error",
        });

        if (error instanceof Error) {
          span.recordException(error);
        }

        throw error;
      } finally {
        span.end();
      }
    });
  }

  startTrace(
    operation: string,
    metadata?: Record<string, string | number | boolean>,
  ): string {
    const traceId = `${operation}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    this.traces.set(traceId, {
      operation,
      startTime: Date.now(),
      status: "success",
      metadata,
    });

    return traceId;
  }

  endTrace(traceId: string, error?: Error): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      logger.warn({ traceId }, "Attempted to end non-existent trace");
      return;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = error ? "error" : "success";
    trace.error = error;

    this.traces.delete(traceId);
  }

  recordDatabaseQuery(
    query: string,
    duration: number,
    result: "success" | "error",
  ): void {
    const queryType = this.inferQueryType(query);
    recordDbOperation(queryType, "unknown", duration, result);

    // Also record as APM metric for tracking
    this.recordMetric("db.query.duration", duration, {
      queryType,
      result,
      sanitized: query.length > 100 ? "truncated" : "full",
    });
  }

  recordLLMCall(params: {
    provider: string;
    model: string;
    duration: number;
    tokensUsed: number;
    cost: number;
    cached: boolean;
  }): void {
    recordLlmStreamMetrics(
      params.provider,
      params.model,
      params.duration,
      0,
      params.tokensUsed,
    );
    recordLlmCost(params.model, params.provider, "chat", params.cost);

    // Record APM metrics
    this.recordMetric("llm.duration", params.duration, {
      provider: params.provider,
      model: params.model,
      cached: String(params.cached),
    });
    this.recordMetric("llm.tokens", params.tokensUsed, {
      provider: params.provider,
      model: params.model,
    });
    this.recordMetric("llm.cost", params.cost, {
      provider: params.provider,
      model: params.model,
      cached: String(params.cached),
    });
  }

  recordCacheAccess(
    tier: "l1" | "l2" | "l3",
    hit: boolean,
    duration?: number,
  ): void {
    recordTieredCacheAccess(tier, hit);

    // Record APM metric
    this.recordMetric("cache.access", 1, {
      tier,
      hit: String(hit),
    });
    if (duration !== undefined) {
      this.recordMetric("cache.duration", duration, { tier });
    }
  }

  getStats(): {
    activeTraces: number;
    uptime: number;
    metricsBuffered: number;
  } {
    return {
      activeTraces: this.traces.size,
      uptime: process.uptime(),
      metricsBuffered: this.metricsBuffer.length,
    };
  }

  private metricsBuffer: Array<{
    name: string;
    value: number;
    tags?: Record<string, string>;
    timestamp: number;
  }> = [];

  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
  ): void {
    this.metricsBuffer.push({ name, value, tags, timestamp: Date.now() });

    // Flush if buffer gets too large
    if (this.metricsBuffer.length > 1000) {
      this.flushMetrics().catch((err) => {
        logger.error({ error: err }, "Failed to flush metrics");
      });
    }
  }

  async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const batch = this.metricsBuffer.splice(0, this.metricsBuffer.length);

    // In production, this would send to metrics service
    // logger.debug is optional, some loggers may not have it
    if (logger.debug) {
      logger.debug({ metricCount: batch.length }, "Metrics flushed");
    }
  }

  async shutdown(): Promise<void> {
    await this.flushMetrics();
    logger.info("APM service shutdown complete");
  }

  private inferQueryType(query: string): string {
    const normalized = query.trim().toLowerCase();
    if (normalized.startsWith("select")) return "select";
    if (normalized.startsWith("insert")) return "insert";
    if (normalized.startsWith("update")) return "update";
    if (normalized.startsWith("delete")) return "delete";
    return "other";
  }
}

export const apm = new APMService();

export default apm;
