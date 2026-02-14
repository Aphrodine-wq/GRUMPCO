/**
 * Drift Detection Routes
 *
 * Endpoints for checking architecture drift in generated or existing code.
 *
 * POST /api/architecture/drift-check  — Check files against an architecture
 * POST /api/architecture/drift-scan   — Scan a workspace against an architecture
 */

import express, { type Request, type Response, type Router } from 'express';
import { getRequestLogger } from '../middleware/logger.js';
import { z } from 'zod';
import { buildRuleset, analyzeDrift, formatDriftReport } from '../services/ship/driftDetector.js';
import type { SystemArchitecture, DriftReport } from '../types/architecture.js';
import type { FileDefinition } from '../types/index.js';

const router: Router = express.Router();

// ============================================================================
// Request Validation Schemas
// ============================================================================

const driftCheckSchema = z.object({
  /** The architecture to check against */
  architecture: z.object({
    id: z.string(),
    projectName: z.string(),
    projectDescription: z.string(),
    projectType: z.string(),
    complexity: z.string(),
    techStack: z.array(z.string()),
    c4Diagrams: z.object({
      context: z.string(),
      container: z.string(),
      component: z.string(),
    }),
    metadata: z.object({
      components: z.array(z.any()),
      integrations: z.array(z.any()),
      dataModels: z.array(z.any()).optional().default([]),
      apiEndpoints: z.array(z.any()).optional().default([]),
      technologies: z.record(z.array(z.string())).optional().default({}),
    }),
    createdAt: z.string().optional().default(''),
    updatedAt: z.string().optional().default(''),
  }),
  /** Files to check */
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    })
  ),
  /** Optional: output format */
  format: z.enum(['json', 'markdown']).optional().default('json'),
});

const driftScanSchema = z.object({
  /** The architecture to check against */
  architecture: z.object({
    id: z.string(),
    projectName: z.string(),
    projectDescription: z.string(),
    projectType: z.string(),
    complexity: z.string(),
    techStack: z.array(z.string()),
    c4Diagrams: z.object({
      context: z.string(),
      container: z.string(),
      component: z.string(),
    }),
    metadata: z.object({
      components: z.array(z.any()),
      integrations: z.array(z.any()),
      dataModels: z.array(z.any()).optional().default([]),
      apiEndpoints: z.array(z.any()).optional().default([]),
      technologies: z.record(z.array(z.string())).optional().default({}),
    }),
    createdAt: z.string().optional().default(''),
    updatedAt: z.string().optional().default(''),
  }),
  /** Workspace path to scan */
  workspacePath: z.string(),
  /** Optional: file extensions to include */
  extensions: z
    .array(z.string())
    .optional()
    .default(['.ts', '.tsx', '.js', '.jsx', '.svelte', '.vue']),
  /** Optional: output format */
  format: z.enum(['json', 'markdown']).optional().default('json'),
});

// ============================================================================
// POST /api/architecture/drift-check
// Check specific files against an architecture
// ============================================================================

router.post('/drift-check', async (req: Request, res: Response): Promise<void> => {
  const log = getRequestLogger();

  try {
    const parsed = driftCheckSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.format(),
      });
      return;
    }

    const { architecture, files, format } = parsed.data;

    log.info({ architectureId: architecture.id, fileCount: files.length }, 'Running drift check');

    const report = analyzeDrift(
      architecture as unknown as SystemArchitecture,
      files as FileDefinition[]
    );

    if (format === 'markdown') {
      const markdown = formatDriftReport(report);
      res.json({ report, markdown });
    } else {
      res.json({ report });
    }
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'Drift check failed');
    res.status(500).json({ error: 'Drift check failed', message: err.message });
  }
});

// ============================================================================
// POST /api/architecture/drift-scan
// Scan a workspace directory against an architecture
// ============================================================================

router.post('/drift-scan', async (req: Request, res: Response): Promise<void> => {
  const log = getRequestLogger();

  try {
    const parsed = driftScanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.format(),
      });
      return;
    }

    const { architecture, workspacePath, extensions, format } = parsed.data;

    log.info({ architectureId: architecture.id, workspacePath }, 'Running drift scan on workspace');

    // Dynamic import for fs scanning
    const fs = await import('fs');
    const path = await import('path');

    // Recursively scan workspace for files
    const files: FileDefinition[] = [];

    function scanRecursive(dir: string, depth: number = 0): void {
      if (depth > 10) return; // Max depth safety
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip common non-source directories
          if (
            entry.isDirectory() &&
            [
              'node_modules',
              'dist',
              '.git',
              'build',
              'coverage',
              '.next',
              '__pycache__',
              'target',
            ].includes(entry.name)
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            scanRecursive(fullPath, depth + 1);
          } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              files.push({
                path: path.relative(workspacePath, fullPath),
                content,
              });
            } catch {
              // Skip unreadable files
            }
          }
        }
      } catch {
        // Skip unreadable directories
      }
    }

    scanRecursive(workspacePath);

    log.info({ fileCount: files.length }, 'Workspace scan complete');

    const report = analyzeDrift(
      architecture as unknown as SystemArchitecture,
      files as FileDefinition[]
    );

    if (format === 'markdown') {
      const markdown = formatDriftReport(report);
      res.json({ report, markdown });
    } else {
      res.json({ report });
    }
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'Drift scan failed');
    res.status(500).json({ error: 'Drift scan failed', message: err.message });
  }
});

// ============================================================================
// GET /api/architecture/drift-rules
// Get the ruleset that would be extracted from an architecture
// ============================================================================

router.post('/drift-rules', async (req: Request, res: Response): Promise<void> => {
  try {
    const architecture = req.body?.architecture;
    if (!architecture) {
      res.status(400).json({ error: 'architecture is required' });
      return;
    }

    const ruleset = buildRuleset(architecture as SystemArchitecture);
    res.json({ ruleset });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: 'Failed to build ruleset', message: err.message });
  }
});

export default router;
