/**
 * Alerting Service
 * Monitors system health and sends alerts for critical issues
 */

import logger from "../middleware/logger.js";
import { getAllServiceStates } from "./bulkheads.js";
import { getDatabase } from "../db/database.js";
import { register } from "../middleware/metrics.js";

// Type for metrics from getMetricsAsJSON()
interface MetricValue {
  value: number;
  labels?: Record<string, string>;
}

interface MetricObject {
  name: string;
  help?: string;
  type?: string;
  values?: MetricValue[];
}

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  component: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface AlertConfig {
  circuitBreakerOpen: boolean;
  highErrorRate: {
    enabled: boolean;
    threshold: number; // percentage
    windowMinutes: number;
  };
  performanceDegradation: {
    enabled: boolean;
    p95ThresholdMs: number;
  };
  databaseFailure: boolean;
  highMemoryUsage: {
    enabled: boolean;
    threshold: number; // percentage
  };
  webhookUrl?: string;
  emailRecipients?: string[];
}

const DEFAULT_CONFIG: AlertConfig = {
  circuitBreakerOpen: true,
  highErrorRate: {
    enabled: true,
    threshold: 5, // 5%
    windowMinutes: 5,
  },
  performanceDegradation: {
    enabled: true,
    p95ThresholdMs: 5000, // 5 seconds
  },
  databaseFailure: true,
  highMemoryUsage: {
    enabled: true,
    threshold: 85, // 85%
  },
};

class AlertingService {
  private config: AlertConfig;
  private alerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private maxHistorySize = 1000;

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update alerting configuration
   */
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, "Alerting configuration updated");
  }

  /**
   * Check circuit breaker states and alert if any are open
   */
  async checkCircuitBreakers(): Promise<void> {
    if (!this.config.circuitBreakerOpen) {
      return;
    }

    const serviceStates = getAllServiceStates();
    const openCircuits: string[] = [];

    for (const [serviceName, state] of Object.entries(serviceStates)) {
      if (state.state === "open") {
        openCircuits.push(serviceName);
      }
    }

    if (openCircuits.length > 0) {
      for (const serviceName of openCircuits) {
        await this.sendAlert({
          severity: "critical",
          title: "Circuit Breaker Open",
          message: `Circuit breaker for ${serviceName} is open. Service is unavailable.`,
          component: serviceName,
          metadata: {
            service: serviceName,
            state:
              serviceStates[serviceName as keyof typeof serviceStates].state,
          },
        });
      }
    }
  }

  /**
   * Check error rates from Prometheus metrics
   */
  async checkErrorRates(): Promise<void> {
    if (!this.config.highErrorRate.enabled) {
      return;
    }

    try {
      const metrics =
        (await register.getMetricsAsJSON()) as unknown as MetricObject[];
      const httpRequestsMetric = metrics.find(
        (m) => m.name === "http_requests_total",
      );

      if (!httpRequestsMetric || !httpRequestsMetric.values) {
        return;
      }

      // Calculate error rate from metrics
      // This is a simplified version - in production, you'd query Prometheus
      const totalRequests = httpRequestsMetric.values.reduce(
        (sum, v) => sum + (v.value || 0),
        0,
      );

      const errorRequests = httpRequestsMetric.values
        .filter((v) => {
          const status = parseInt(v.labels?.status_code || "200", 10);
          return status >= 400;
        })
        .reduce((sum, v) => sum + (v.value || 0), 0);

      if (totalRequests > 0) {
        const errorRate = (errorRequests / totalRequests) * 100;

        if (errorRate > this.config.highErrorRate.threshold) {
          await this.sendAlert({
            severity: "warning",
            title: "High Error Rate Detected",
            message: `Error rate is ${errorRate.toFixed(2)}%, exceeding threshold of ${this.config.highErrorRate.threshold}%`,
            component: "http",
            metadata: {
              errorRate,
              threshold: this.config.highErrorRate.threshold,
              totalRequests,
              errorRequests,
            },
          });
        }
      }
    } catch (error) {
      logger.error(
        { error: (error as Error).message },
        "Failed to check error rates",
      );
    }
  }

  /**
   * Check performance degradation
   */
  async checkPerformance(): Promise<void> {
    if (!this.config.performanceDegradation.enabled) {
      return;
    }

    try {
      const metrics =
        (await register.getMetricsAsJSON()) as unknown as MetricObject[];
      const httpDurationMetric = metrics.find(
        (m) => m.name === "http_request_duration_seconds",
      );

      if (!httpDurationMetric || !httpDurationMetric.values) {
        return;
      }

      // Calculate p95 latency
      // Simplified - in production, query Prometheus for actual p95
      const durations = httpDurationMetric.values.map((v) => v.value || 0);
      if (durations.length > 0) {
        const sorted = durations.sort((a, b) => b - a);
        const p95Index = Math.floor(sorted.length * 0.05);
        const p95Ms = sorted[p95Index] * 1000; // Convert to milliseconds

        if (p95Ms > this.config.performanceDegradation.p95ThresholdMs) {
          await this.sendAlert({
            severity: "warning",
            title: "Performance Degradation",
            message: `P95 latency is ${p95Ms.toFixed(0)}ms, exceeding threshold of ${this.config.performanceDegradation.p95ThresholdMs}ms`,
            component: "http",
            metadata: {
              p95LatencyMs: p95Ms,
              threshold: this.config.performanceDegradation.p95ThresholdMs,
            },
          });
        }
      }
    } catch (error) {
      logger.error(
        { error: (error as Error).message },
        "Failed to check performance",
      );
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabase(): Promise<void> {
    if (!this.config.databaseFailure) {
      return;
    }

    try {
      const db = getDatabase();
      const dbInstance = db.getDb();

      // Simple query to test connectivity
      dbInstance.prepare("SELECT 1").get();
    } catch (error) {
      await this.sendAlert({
        severity: "critical",
        title: "Database Connection Failure",
        message: `Database is unreachable: ${(error as Error).message}`,
        component: "database",
        metadata: {
          error: (error as Error).message,
        },
      });
    }
  }

  /**
   * Check memory usage
   */
  async checkMemory(): Promise<void> {
    if (!this.config.highMemoryUsage.enabled) {
      return;
    }

    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const heapPercentage = (heapUsedMB / heapTotalMB) * 100;

    if (heapPercentage > this.config.highMemoryUsage.threshold) {
      await this.sendAlert({
        severity: "warning",
        title: "High Memory Usage",
        message: `Memory usage is ${heapPercentage.toFixed(1)}%, exceeding threshold of ${this.config.highMemoryUsage.threshold}%`,
        component: "system",
        metadata: {
          heapUsedMB: Math.round(heapUsedMB),
          heapTotalMB: Math.round(heapTotalMB),
          heapPercentage: Math.round(heapPercentage),
        },
      });
    }
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<void> {
    await Promise.all([
      this.checkCircuitBreakers(),
      this.checkErrorRates(),
      this.checkPerformance(),
      this.checkDatabase(),
      this.checkMemory(),
    ]);
  }

  /**
   * Send an alert
   */
  async sendAlert(alert: Omit<Alert, "id" | "timestamp">): Promise<void> {
    const alertId = `${alert.component}_${alert.severity}_${Date.now()}`;
    const fullAlert: Alert = {
      ...alert,
      id: alertId,
      timestamp: new Date().toISOString(),
    };

    // Check if we've already sent this alert recently (deduplication)
    const recentAlert = this.alertHistory.find(
      (a) =>
        a.component === alert.component &&
        a.title === alert.title &&
        Date.now() - new Date(a.timestamp).getTime() < 60000, // 1 minute
    );

    if (recentAlert) {
      logger.debug({ alertId }, "Skipping duplicate alert");
      return;
    }

    // Store alert
    this.alerts.set(alertId, fullAlert);
    this.alertHistory.push(fullAlert);

    // Keep history size manageable
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(-this.maxHistorySize);
    }

    // Log alert
    const logLevel = alert.severity === "critical" ? "error" : "warn";
    logger[logLevel](fullAlert, "Alert triggered");

    // Send to webhook if configured
    if (this.config.webhookUrl) {
      await this.sendWebhookAlert(fullAlert);
    }

    // Send email if configured
    if (this.config.emailRecipients && this.config.emailRecipients.length > 0) {
      await this.sendEmailAlert(fullAlert);
    }
  }

  /**
   * Send alert to webhook
   */
  private async sendWebhookAlert(alert: Alert): Promise<void> {
    const url = this.config.webhookUrl;
    if (!url) {
      logger.warn("Webhook URL not configured, skipping alert");
      return;
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alert),
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, "Webhook alert failed");
      }
    } catch (error) {
      logger.error(
        { error: (error as Error).message },
        "Failed to send webhook alert",
      );
    }
  }

  /**
   * Send alert via email. Deferred: integrate SendGrid, Resend, or SES to enable.
   */
  private async sendEmailAlert(alert: Alert): Promise<void> {
    logger.debug(
      { alertId: alert.id, recipients: this.config.emailRecipients },
      "Email alerting deferred; configure email service to enable",
    );
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 50): Alert[] {
    return this.alertHistory.slice(-limit).reverse();
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Clear alert
   */
  clearAlert(alertId: string): void {
    this.alerts.delete(alertId);
  }
}

// Singleton instance
let alertingService: AlertingService | null = null;

/**
 * Get or create alerting service instance
 */
export function getAlertingService(): AlertingService {
  if (!alertingService) {
    alertingService = new AlertingService();
  }
  return alertingService;
}

/**
 * Initialize alerting service with periodic health checks
 */
export function initializeAlerting(intervalMs = 60000): void {
  const service = getAlertingService();

  // Run health checks periodically
  setInterval(() => {
    service.runHealthChecks().catch((error) => {
      logger.error({ error: (error as Error).message }, "Health check failed");
    });
  }, intervalMs);

  logger.info({ intervalMs }, "Alerting service initialized");
}

export { AlertingService, type Alert, type AlertConfig };
