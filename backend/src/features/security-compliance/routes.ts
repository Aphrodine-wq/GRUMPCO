/**
 * Security & Compliance Routes
 *
 * API endpoints for security scanning, SBOM generation, and compliance assessment.
 */

import { Router, type Request, type Response } from 'express';
import logger from '../../middleware/logger.js';
import {
  performSecurityScan,
  generateSBOM,
  generateComplianceReport,
  auditSecrets,
  validateWorkspacePath,
} from './service.js';
import {
  type SecurityScanRequest,
  type SBOMRequest,
  type ComplianceRequest,
  type SecretsAuditRequest,
} from './types.js';

const router = Router();

/**
 * POST /api/security/scan
 * Perform comprehensive security scan
 */
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { workspacePath, scanTypes, severity, excludePatterns } = req.body as SecurityScanRequest;

    if (!workspacePath) {
      res.status(400).json({
        error: 'Missing workspacePath',
        type: 'validation_error',
      });
      return;
    }

    const pathValidation = validateWorkspacePath(workspacePath);
    if (!pathValidation.ok) {
      res.status(400).json({
        error: pathValidation.reason,
        type: 'validation_error',
      });
      return;
    }

    const result = await performSecurityScan({
      workspacePath: pathValidation.resolved,
      scanTypes,
      severity,
      excludePatterns,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Security scan error');
    res.status(500).json({
      error: err.message,
      type: 'scan_error',
    });
  }
});

/**
 * POST /api/security/sbom
 * Generate Software Bill of Materials
 */
router.post('/sbom', async (req: Request, res: Response) => {
  try {
    const { workspacePath, format, includeDevDeps } = req.body as SBOMRequest;

    if (!workspacePath) {
      res.status(400).json({
        error: 'Missing workspacePath',
        type: 'validation_error',
      });
      return;
    }

    const pathValidation = validateWorkspacePath(workspacePath);
    if (!pathValidation.ok) {
      res.status(400).json({
        error: pathValidation.reason,
        type: 'validation_error',
      });
      return;
    }

    const result = await generateSBOM({
      workspacePath: pathValidation.resolved,
      format,
      includeDevDeps,
    });

    // If format specified, can return raw SBOM in that format
    if (format === 'cyclonedx' && req.query.raw === 'true') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=sbom.cyclonedx.json');
      res.json(result);
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'SBOM generation error');
    res.status(500).json({
      error: err.message,
      type: 'sbom_error',
    });
  }
});

/**
 * POST /api/security/compliance
 * Generate compliance report for a specific standard
 */
router.post('/compliance', async (req: Request, res: Response) => {
  try {
    const { workspacePath, standard, projectType } = req.body as ComplianceRequest;

    if (!workspacePath) {
      res.status(400).json({
        error: 'Missing workspacePath',
        type: 'validation_error',
      });
      return;
    }

    const pathValidation = validateWorkspacePath(workspacePath);
    if (!pathValidation.ok) {
      res.status(400).json({
        error: pathValidation.reason,
        type: 'validation_error',
      });
      return;
    }

    if (!standard) {
      res.status(400).json({
        error: 'Missing standard (soc2, gdpr, hipaa, pci-dss, iso27001, owasp-top10)',
        type: 'validation_error',
      });
      return;
    }

    const validStandards = ['soc2', 'gdpr', 'hipaa', 'pci-dss', 'iso27001', 'owasp-top10'];
    if (!validStandards.includes(standard)) {
      res.status(400).json({
        error: `Invalid standard. Must be one of: ${validStandards.join(', ')}`,
        type: 'validation_error',
      });
      return;
    }

    const result = await generateComplianceReport({
      workspacePath: pathValidation.resolved,
      standard,
      projectType,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Compliance report error');
    res.status(500).json({
      error: err.message,
      type: 'compliance_error',
    });
  }
});

/**
 * POST /api/security/secrets-audit
 * Scan for exposed secrets and credentials
 */
router.post('/secrets-audit', async (req: Request, res: Response) => {
  try {
    const { workspacePath, excludePatterns, customPatterns } = req.body as SecretsAuditRequest;

    if (!workspacePath) {
      res.status(400).json({
        error: 'Missing workspacePath',
        type: 'validation_error',
      });
      return;
    }

    const pathValidation = validateWorkspacePath(workspacePath);
    if (!pathValidation.ok) {
      res.status(400).json({
        error: pathValidation.reason,
        type: 'validation_error',
      });
      return;
    }

    const result = await auditSecrets({
      workspacePath: pathValidation.resolved,
      excludePatterns,
      customPatterns,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Secrets audit error');
    res.status(500).json({
      error: err.message,
      type: 'secrets_audit_error',
    });
  }
});

/**
 * GET /api/security/standards
 * List available compliance standards
 */
router.get('/standards', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      standards: [
        {
          id: 'soc2',
          name: 'SOC 2 Type II',
          description: 'Service Organization Control 2',
        },
        {
          id: 'gdpr',
          name: 'GDPR',
          description: 'General Data Protection Regulation',
        },
        {
          id: 'hipaa',
          name: 'HIPAA',
          description: 'Health Insurance Portability and Accountability Act',
        },
        {
          id: 'pci-dss',
          name: 'PCI DSS',
          description: 'Payment Card Industry Data Security Standard',
        },
        {
          id: 'iso27001',
          name: 'ISO 27001',
          description: 'Information Security Management',
        },
        {
          id: 'owasp-top10',
          name: 'OWASP Top 10',
          description: 'Open Web Application Security Project',
        },
      ],
    },
  });
});

/**
 * GET /api/security/health
 * Health check for security service
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'security-compliance',
    version: '1.0.0',
  });
});

export default router;
