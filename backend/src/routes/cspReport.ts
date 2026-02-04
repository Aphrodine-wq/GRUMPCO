/**
 * CSP Reporting Endpoint
 *
 * Collects Content Security Policy violation reports for security monitoring.
 */

import express, { type Request, type Response } from "express";
import logger from "../middleware/logger.js";

const router = express.Router();

interface CSPViolationReport {
  "csp-report"?: {
    "document-uri"?: string;
    referrer?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "original-policy"?: string;
    disposition?: string;
    "blocked-uri"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "source-file"?: string;
    "status-code"?: number;
    "script-sample"?: string;
  };
}

// Track violations for rate limiting (prevent log flooding)
const violationCounts = new Map<
  string,
  { count: number; lastReport: number }
>();
const MAX_REPORTS_PER_MINUTE = 10;
const REPORT_WINDOW_MS = 60000;

function getViolationKey(report: CSPViolationReport["csp-report"]): string {
  if (!report) return "unknown";
  return `${report["document-uri"] || "unknown"}-${report["violated-directive"] || "unknown"}-${report["blocked-uri"] || "unknown"}`;
}

function shouldReportViolation(key: string): boolean {
  const now = Date.now();
  const record = violationCounts.get(key);

  if (!record || now - record.lastReport > REPORT_WINDOW_MS) {
    violationCounts.set(key, { count: 1, lastReport: now });
    return true;
  }

  if (record.count >= MAX_REPORTS_PER_MINUTE) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * POST /api/csp-report
 * Receives CSP violation reports
 */
router.post(
  "/",
  express.json({ type: ["application/json", "application/csp-report"] }),
  (req: Request, res: Response) => {
    try {
      const report = req.body as CSPViolationReport;
      const cspReport = report["csp-report"];

      if (!cspReport) {
        res.status(400).json({ error: "Invalid CSP report format" });
        return;
      }

      const violationKey = getViolationKey(cspReport);

      if (shouldReportViolation(violationKey)) {
        // Log the violation for monitoring
        logger.warn(
          {
            type: "csp_violation",
            documentUri: cspReport["document-uri"],
            violatedDirective: cspReport["violated-directive"],
            effectiveDirective: cspReport["effective-directive"],
            blockedUri: cspReport["blocked-uri"],
            sourceFile: cspReport["source-file"],
            lineNumber: cspReport["line-number"],
            columnNumber: cspReport["column-number"],
            disposition: cspReport["disposition"],
          },
          "CSP violation reported",
        );

        // In production, you might want to:
        // - Send to a security monitoring service (Sentry, DataDog, etc.)
        // - Store in database for analysis
        // - Trigger alerts for repeated violations
      }

      // Always return 204 to acknowledge receipt
      res.status(204).send();
    } catch (error) {
      logger.error(
        { error: (error as Error).message },
        "Error processing CSP report",
      );
      res.status(204).send(); // Still return 204 to prevent retries
    }
  },
);

/**
 * GET /api/csp-report/stats
 * Returns violation statistics (admin only in production)
 */
router.get("/stats", (_req: Request, res: Response) => {
  const stats: Record<string, { count: number; lastReport: string }> = {};

  violationCounts.forEach((value, key) => {
    stats[key] = {
      count: value.count,
      lastReport: new Date(value.lastReport).toISOString(),
    };
  });

  res.json({
    total_unique_violations: violationCounts.size,
    violations: stats,
  });
});

export default router;
