/**
 * Architecture Drift Detector
 *
 * Compares generated/modified code against the declared system architecture
 * to identify violations BEFORE code is committed or shipped.
 *
 * Detection categories:
 *   1. Layer Crossing — e.g. frontend code importing a DB driver
 *   2. Reverse Dependency — e.g. backend importing React/Svelte
 *   3. Undeclared Integration — component A calling C when architecture says A→B→C
 *   4. Tech Mismatch — code uses MongoDB but architecture declares PostgreSQL
 *   5. Component Boundary — file cannot be mapped to any declared component
 *
 * @module driftDetector
 */

import logger from '../../middleware/logger.js';
import type {
  SystemArchitecture,
  ArchitectureRuleset,
  DriftViolation,
  DriftReport,
  DriftCategory,
  DriftSeverity,
} from '../../types/architecture.js';
import type { FileDefinition } from '../../types/index.js';

// ============================================================================
// Package → Layer Mapping (what packages belong to which architectural layer)
// ============================================================================

/** Packages that are strictly frontend-only */
const FRONTEND_ONLY_PACKAGES = new Set([
  'react',
  'react-dom',
  'next',
  'svelte',
  'vue',
  'angular',
  '@angular',
  'solid-js',
  'preact',
  'lit',
  'astro',
  'nuxt',
  'styled-components',
  'emotion',
  '@emotion',
  'tailwindcss',
]);

/** Packages that are strictly backend/server-only */
const BACKEND_ONLY_PACKAGES = new Set([
  'express',
  'fastify',
  'koa',
  'hapi',
  'nest',
  '@nestjs',
  'socket.io',
  'bull',
  'bullmq',
  'pino',
  'winston',
  'morgan',
]);

/** Packages that indicate direct database access */
const DATABASE_PACKAGES = new Set([
  'pg',
  'mysql',
  'mysql2',
  'mongodb',
  'mongoose',
  'redis',
  'ioredis',
  '@prisma/client',
  'prisma',
  'typeorm',
  'sequelize',
  'knex',
  'drizzle-orm',
  'better-sqlite3',
  'sqlite3',
  'mssql',
  '@supabase/supabase-js',
]);

/** Map DB package names to their database technology for tech-mismatch checks */
const DB_PACKAGE_TO_TECH: Record<string, string[]> = {
  pg: ['postgresql', 'postgres'],
  mysql: ['mysql'],
  mysql2: ['mysql'],
  mongodb: ['mongodb', 'mongo'],
  mongoose: ['mongodb', 'mongo'],
  redis: ['redis'],
  ioredis: ['redis'],
  'better-sqlite3': ['sqlite'],
  sqlite3: ['sqlite'],
  mssql: ['mssql', 'sql server'],
};

// ============================================================================
// Rule Extraction
// ============================================================================

/**
 * Extract an ArchitectureRuleset from a SystemArchitecture.
 * This is the "compile" step — turning the architecture into enforceable rules.
 */
export function buildRuleset(architecture: SystemArchitecture): ArchitectureRuleset {
  const { metadata } = architecture;

  const components = (metadata.components || []).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    technology: c.technology || [],
  }));

  const allowedIntegrations = (metadata.integrations || []).map((i) => ({
    sourceId: i.source,
    targetId: i.target,
    protocol: i.protocol,
  }));

  const tech = metadata.technologies || {};
  const declaredTech = {
    frontend: (tech.frontend || []).map((t) => t.toLowerCase()),
    backend: (tech.backend || []).map((t) => t.toLowerCase()),
    database: (tech.database || []).map((t) => t.toLowerCase()),
    infrastructure: (tech.infrastructure || []).map((t) => t.toLowerCase()),
  };

  const allTech = [
    ...declaredTech.frontend,
    ...declaredTech.backend,
    ...declaredTech.database,
    ...declaredTech.infrastructure,
    ...(architecture.techStack || []).map((t) => t.toLowerCase()),
  ];

  return {
    components,
    allowedIntegrations,
    declaredTech,
    allTech: [...new Set(allTech)],
  };
}

// ============================================================================
// File Classification
// ============================================================================

type FileLayer = 'frontend' | 'backend' | 'database' | 'service' | 'unknown';

/**
 * Infer which architectural layer a file belongs to based on its path.
 */
function classifyFile(filePath: string): FileLayer {
  const p = filePath.toLowerCase().replace(/\\/g, '/');

  // Frontend directories / file types
  if (
    p.includes('/components/') ||
    p.includes('/pages/') ||
    p.includes('/app/') ||
    p.includes('/views/') ||
    p.includes('/src/ui/') ||
    p.includes('/frontend/') ||
    p.includes('/client/') ||
    p.endsWith('.svelte') ||
    p.endsWith('.vue') ||
    p.endsWith('.jsx') ||
    p.endsWith('.tsx')
  ) {
    return 'frontend';
  }

  // Backend directories
  if (
    p.includes('/routes/') ||
    p.includes('/controllers/') ||
    p.includes('/middleware/') ||
    p.includes('/server/') ||
    p.includes('/backend/') ||
    p.includes('/api/')
  ) {
    return 'backend';
  }

  // Database directories
  if (
    p.includes('/db/') ||
    p.includes('/database/') ||
    p.includes('/migrations/') ||
    p.includes('/models/') ||
    p.includes('/schema/') ||
    p.includes('/prisma/')
  ) {
    return 'database';
  }

  // Services
  if (p.includes('/services/') || p.includes('/workers/')) {
    return 'service';
  }

  return 'unknown';
}

// ============================================================================
// Import Extraction
// ============================================================================

interface ImportStatement {
  /** The package or path being imported */
  source: string;
  /** Line number in the file (1-indexed) */
  line: number;
  /** The raw import line */
  raw: string;
}

/**
 * Extract all import/require statements from file content.
 */
function extractImports(content: string): ImportStatement[] {
  const imports: ImportStatement[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // ES import: import ... from "package"
    const esMatch = line.match(/import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/);
    if (esMatch) {
      imports.push({ source: esMatch[1], line: i + 1, raw: line });
      continue;
    }

    // Dynamic import: import("package") or await import("package")
    const dynMatch = line.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (dynMatch) {
      imports.push({ source: dynMatch[1], line: i + 1, raw: line });
      continue;
    }

    // CommonJS require: require("package")
    const cjsMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (cjsMatch) {
      imports.push({ source: cjsMatch[1], line: i + 1, raw: line });
    }
  }

  return imports;
}

/**
 * Get the root package name from an import source.
 * e.g. "@prisma/client" → "@prisma/client", "react-dom/server" → "react-dom"
 */
function rootPackage(source: string): string {
  if (source.startsWith('@')) {
    // Scoped: @scope/package/sub → @scope/package
    const parts = source.split('/');
    return parts.slice(0, 2).join('/');
  }
  // Unscoped: package/sub → package
  return source.split('/')[0];
}

// ============================================================================
// Violation Detectors
// ============================================================================

function detectLayerCrossings(
  file: string,
  fileLayer: FileLayer,
  imports: ImportStatement[]
): DriftViolation[] {
  const violations: DriftViolation[] = [];

  for (const imp of imports) {
    // Skip relative imports — only check package imports
    if (imp.source.startsWith('.') || imp.source.startsWith('/')) continue;
    const pkg = rootPackage(imp.source);

    // Frontend files importing database packages → ERROR
    if (fileLayer === 'frontend' && DATABASE_PACKAGES.has(pkg)) {
      violations.push({
        ruleId: 'DRIFT-001',
        severity: 'error',
        category: 'layer_crossing',
        file,
        line: imp.line,
        offendingCode: imp.raw,
        message: `Frontend file directly imports database package "${pkg}". This bypasses the backend API layer.`,
        suggestion: `Move database access to a backend route/service and call it via API from the frontend.`,
      });
    }

    // Frontend files importing backend-only packages → WARNING
    if (fileLayer === 'frontend' && BACKEND_ONLY_PACKAGES.has(pkg)) {
      violations.push({
        ruleId: 'DRIFT-002',
        severity: 'warning',
        category: 'layer_crossing',
        file,
        line: imp.line,
        offendingCode: imp.raw,
        message: `Frontend file imports server-only package "${pkg}".`,
        suggestion: `If this is a server-side rendered (SSR) file, this may be intentional. Otherwise, move server logic to the backend.`,
      });
    }

    // Backend files importing frontend-only packages → WARNING
    if (fileLayer === 'backend' && FRONTEND_ONLY_PACKAGES.has(pkg)) {
      violations.push({
        ruleId: 'DRIFT-003',
        severity: 'warning',
        category: 'reverse_dependency',
        file,
        line: imp.line,
        offendingCode: imp.raw,
        message: `Backend file imports frontend package "${pkg}". Backend should not depend on UI frameworks.`,
        suggestion: `Remove the frontend dependency. If rendering server-side, use a dedicated SSR module.`,
      });
    }

    // Database layer importing frontend packages → ERROR
    if (fileLayer === 'database' && FRONTEND_ONLY_PACKAGES.has(pkg)) {
      violations.push({
        ruleId: 'DRIFT-004',
        severity: 'error',
        category: 'layer_crossing',
        file,
        line: imp.line,
        offendingCode: imp.raw,
        message: `Database layer file imports frontend package "${pkg}". This is an architectural violation.`,
        suggestion: `Database models/migrations should have zero frontend dependencies.`,
      });
    }
  }

  return violations;
}

function detectTechMismatches(
  file: string,
  imports: ImportStatement[],
  ruleset: ArchitectureRuleset
): DriftViolation[] {
  const violations: DriftViolation[] = [];

  // Only check if the architecture declares specific database technologies
  if (ruleset.declaredTech.database.length === 0) return violations;

  for (const imp of imports) {
    if (imp.source.startsWith('.') || imp.source.startsWith('/')) continue;
    const pkg = rootPackage(imp.source);

    const declaredDbTechs = DB_PACKAGE_TO_TECH[pkg];
    if (!declaredDbTechs) continue;

    // Check if ANY of the package's techs are in the declared database tech
    const isAllowed = declaredDbTechs.some((tech) =>
      ruleset.declaredTech.database.some(
        (declared) => declared.includes(tech) || tech.includes(declared)
      )
    );

    if (!isAllowed) {
      violations.push({
        ruleId: 'DRIFT-005',
        severity: 'error',
        category: 'tech_mismatch',
        file,
        line: imp.line,
        offendingCode: imp.raw,
        message: `Uses "${pkg}" (${declaredDbTechs.join('/')}) but architecture declares database: [${ruleset.declaredTech.database.join(', ')}].`,
        suggestion: `Use the declared database technology, or update the architecture to include ${declaredDbTechs[0]}.`,
      });
    }
  }

  return violations;
}

function detectComponentBoundaryViolations(
  file: string,
  fileLayer: FileLayer,
  ruleset: ArchitectureRuleset
): DriftViolation[] {
  // If no components are declared, skip this check
  if (ruleset.components.length === 0) return [];

  // If the file's layer doesn't match any declared component type, warn
  if (fileLayer === 'unknown') return [];

  const matchesAnyComponent = ruleset.components.some(
    (c) => c.type === fileLayer || c.type === 'service'
  );

  if (!matchesAnyComponent) {
    return [
      {
        ruleId: 'DRIFT-006',
        severity: 'info',
        category: 'component_boundary',
        file,
        offendingCode: file,
        message: `File classified as "${fileLayer}" but no architecture component of that type is declared.`,
        suggestion: `Either add a ${fileLayer} component to the architecture, or restructure this file.`,
      },
    ];
  }

  return [];
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run drift detection against a set of files using a pre-built ruleset.
 */
export function detectDrift(
  files: FileDefinition[],
  ruleset: ArchitectureRuleset
): DriftViolation[] {
  const allViolations: DriftViolation[] = [];

  for (const file of files) {
    const content = file.content || '';
    if (!content.trim()) continue;

    const fileLayer = classifyFile(file.path);
    const imports = extractImports(content);

    // Run all detectors
    allViolations.push(
      ...detectLayerCrossings(file.path, fileLayer, imports),
      ...detectTechMismatches(file.path, imports, ruleset),
      ...detectComponentBoundaryViolations(file.path, fileLayer, ruleset)
    );
  }

  return allViolations;
}

/**
 * Full drift analysis: build rules from architecture + scan files.
 * Returns a complete DriftReport.
 */
export function analyzeDrift(
  architecture: SystemArchitecture,
  files: FileDefinition[]
): DriftReport {
  const ruleset = buildRuleset(architecture);
  const violations = detectDrift(files, ruleset);

  const errors = violations.filter((v) => v.severity === 'error').length;
  const warnings = violations.filter((v) => v.severity === 'warning').length;
  const info = violations.filter((v) => v.severity === 'info').length;

  const report: DriftReport = {
    architectureId: architecture.id,
    analyzedAt: new Date().toISOString(),
    filesScanned: files.length,
    violations,
    summary: {
      errors,
      warnings,
      info,
      total: violations.length,
    },
    passes: errors === 0,
  };

  if (violations.length > 0) {
    logger.info(
      {
        architectureId: architecture.id,
        filesScanned: files.length,
        errors,
        warnings,
        info,
      },
      'Drift analysis completed with violations'
    );
  } else {
    logger.info(
      { architectureId: architecture.id, filesScanned: files.length },
      'Drift analysis completed — no violations'
    );
  }

  return report;
}

/**
 * Format a DriftReport as a human-readable string (for CLI / chat display).
 */
export function formatDriftReport(report: DriftReport): string {
  if (report.violations.length === 0) {
    return `✅ **Architecture Drift Check Passed**\nScanned ${report.filesScanned} files — no violations detected.`;
  }

  const lines: string[] = [];

  if (report.passes) {
    lines.push(
      `⚠️ **Architecture Drift Check: ${report.summary.warnings} warning(s), ${report.summary.info} info**`
    );
  } else {
    lines.push(`❌ **Architecture Drift Check Failed: ${report.summary.errors} error(s)**`);
  }

  lines.push(
    `Scanned ${report.filesScanned} files against architecture \`${report.architectureId}\`\n`
  );

  // Group by category
  const grouped = new Map<DriftCategory, DriftViolation[]>();
  for (const v of report.violations) {
    if (!grouped.has(v.category)) grouped.set(v.category, []);
    grouped.get(v.category)!.push(v);
  }

  const categoryLabels: Record<DriftCategory, string> = {
    layer_crossing: '🔀 Layer Crossings',
    reverse_dependency: '🔄 Reverse Dependencies',
    undeclared_integration: '🔗 Undeclared Integrations',
    tech_mismatch: '🔧 Technology Mismatches',
    component_boundary: '📦 Component Boundaries',
  };

  for (const [category, violations] of grouped) {
    lines.push(`### ${categoryLabels[category]}`);
    for (const v of violations) {
      const severity = v.severity === 'error' ? '🔴' : v.severity === 'warning' ? '🟡' : '🔵';
      const loc = v.line ? `:${v.line}` : '';
      lines.push(`${severity} **\`${v.file}${loc}\`** — ${v.message}`);
      lines.push(`   💡 ${v.suggestion}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
