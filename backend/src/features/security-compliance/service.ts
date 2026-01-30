/**
 * Security & Compliance Service
 *
 * Provides security scanning, SBOM generation, and compliance assessment.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getStream, type StreamParams } from '../../services/llmGateway.js';
import {
  SecurityScanResult,
  SecurityVulnerability,
  SecurityScanRequest,
  SBOMResult,
  SBOMRequest,
  SBOMComponent,
  ComplianceReport,
  ComplianceRequest,
  ComplianceRequirement,
  SecretsAuditResult,
  SecretsAuditRequest,
  SecretFinding,
  PathValidationResult,
} from './types.js';
import {
  SECURITY_ANALYSIS_SYSTEM_PROMPT,
  generateSecurityScanPrompt,
  generateCompliancePrompt,
  generateSBOMPrompt,
} from './prompts.js';

const DEFAULT_MODEL = 'moonshotai/kimi-k2.5';

/**
 * Helper to call LLM via gateway and get complete response text
 */
async function callLLM(params: StreamParams): Promise<string> {
  const stream = getStream(params, { provider: 'nim', modelId: params.model || DEFAULT_MODEL });
  let responseText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      responseText += event.delta.text;
    }
  }
  return responseText;
}

/** Allowed root for security scans. Resolved path must be under this root to prevent path traversal. */
function getSecurityScanRoot(): string {
  const root = process.env.SECURITY_SCAN_ROOT || process.cwd();
  return path.resolve(root);
}

/**
 * Validate workspacePath: must resolve to a path under the allowed scan root.
 * Prevents path traversal (e.g. ../../etc) and absolute paths outside root.
 */
export function validateWorkspacePath(workspacePath: string): PathValidationResult {
  const root = getSecurityScanRoot();
  const resolved = path.resolve(workspacePath);
  const rootSep = root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootSep)) {
    return {
      ok: false,
      reason: 'workspacePath must be under the allowed scan root (set SECURITY_SCAN_ROOT or use a path under the current working directory)',
    };
  }
  return { ok: true, resolved };
}

// Known secret patterns (regex)
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; type: SecretFinding['type']; severity: SecretFinding['severity'] }> = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, type: 'api-key', severity: 'critical' },
  { name: 'AWS Secret Key', pattern: /[0-9a-zA-Z/+]{40}/g, type: 'api-key', severity: 'critical' },
  { name: 'GitHub Token', pattern: /ghp_[0-9a-zA-Z]{36}/g, type: 'token', severity: 'critical' },
  { name: 'GitHub OAuth', pattern: /gho_[0-9a-zA-Z]{36}/g, type: 'token', severity: 'critical' },
  { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z-]{10,}/g, type: 'token', severity: 'high' },
  { name: 'Stripe API Key', pattern: /sk_live_[0-9a-zA-Z]{24}/g, type: 'api-key', severity: 'critical' },
  { name: 'Stripe Test Key', pattern: /sk_test_[0-9a-zA-Z]{24}/g, type: 'api-key', severity: 'medium' },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g, type: 'private-key', severity: 'critical' },
  { name: 'Generic API Key', pattern: /api[_-]?key[_-]?[=:]["']?[0-9a-zA-Z]{20,}/gi, type: 'api-key', severity: 'high' },
  { name: 'Generic Secret', pattern: /secret[_-]?key[_-]?[=:]["']?[0-9a-zA-Z]{20,}/gi, type: 'credential', severity: 'high' },
  { name: 'Password in Code', pattern: /password[_-]?[=:]["'][^"']{8,}/gi, type: 'password', severity: 'high' },
  { name: 'Connection String', pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s"']+/gi, type: 'connection-string', severity: 'high' },
  { name: 'JWT Secret', pattern: /jwt[_-]?secret[_-]?[=:]["']?[0-9a-zA-Z]{16,}/gi, type: 'credential', severity: 'critical' },
  { name: 'Anthropic API Key', pattern: /sk-ant-[a-zA-Z0-9-_]{20,}/g, type: 'api-key', severity: 'critical' },
  { name: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{48}/g, type: 'api-key', severity: 'critical' },
];

// Files to scan for secrets
const SECRET_SCAN_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rb', '.php',
  '.java', '.kt', '.swift', '.cs', '.env', '.yaml', '.yml',
  '.json', '.xml', '.conf', '.config', '.ini', '.properties',
]);

// Directories to ignore
const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '__pycache__', 'venv', '.venv', 'vendor',
]);

/**
 * Redact a secret for safe display
 */
function redactSecret(secret: string): string {
  if (secret.length <= 8) return '***';
  return secret.substring(0, 4) + '***' + secret.substring(secret.length - 4);
}

/**
 * Scan a single file for secrets
 */
function scanFileForSecrets(filePath: string, content: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = content.split('\n');

  for (const { name, pattern, type, severity } of SECRET_PATTERNS) {
    // Reset regex
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Find line number
      let lineNum = 1;
      let pos = 0;
      for (const line of lines) {
        if (pos + line.length >= match.index) {
          break;
        }
        pos += line.length + 1;
        lineNum++;
      }

      findings.push({
        type,
        severity,
        file: filePath,
        line: lineNum,
        match: redactSecret(match[0]),
        description: `Found ${name}`,
        recommendation: `Move this ${name} to environment variables and use a secrets manager`,
      });
    }
  }

  return findings;
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath: string, extensions: Set<string>, excludePatterns: string[] = []): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (IGNORE_DIRS.has(entry.name)) continue;
      if (excludePatterns.some((p) => fullPath.includes(p))) continue;

      if (entry.isDirectory()) {
        files.push(...scanDirectory(fullPath, extensions, excludePatterns));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.has(ext) || entry.name === '.env' || entry.name.includes('.env.')) {
          files.push(fullPath);
        }
      }
    }
  } catch (_err) {
    // Skip unreadable directories
  }

  return files;
}

/**
 * Read code files for analysis
 */
function readCodeFiles(workspacePath: string, maxFiles: number = 20): string {
  const codeExtensions = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.php', '.rb']);
  const files = scanDirectory(workspacePath, codeExtensions);

  const snippets: string[] = [];
  let totalSize = 0;
  const maxSize = 50000; // 50KB limit

  for (const file of files.slice(0, maxFiles)) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      if (totalSize + content.length > maxSize) break;

      const relativePath = file.replace(workspacePath, '');
      snippets.push(`## ${relativePath}\n\`\`\`\n${content.substring(0, 5000)}\n\`\`\``);
      totalSize += content.length;
    } catch (_err) {
      // Skip unreadable files
    }
  }

  return snippets.join('\n\n');
}

/**
 * Read package.json
 */
function readPackageJson(workspacePath: string): string | null {
  const pkgPath = path.join(workspacePath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      return fs.readFileSync(pkgPath, 'utf-8');
    } catch (_err) {
      return null;
    }
  }
  return null;
}

/**
 * Calculate security score and grade
 */
function calculateSecurityScore(vulnerabilities: SecurityVulnerability[]): { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F' } {
  let score = 100;

  for (const vuln of vulnerabilities) {
    switch (vuln.severity) {
      case 'critical': score -= 25; break;
      case 'high': score -= 15; break;
      case 'medium': score -= 10; break;
      case 'low': score -= 5; break;
      case 'info': score -= 1; break;
    }
  }

  score = Math.max(0, Math.min(100, score));

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  return { score, grade };
}

/**
 * Perform security scan
 */
export async function performSecurityScan(request: SecurityScanRequest): Promise<SecurityScanResult> {
  const { workspacePath, scanTypes = ['sast', 'deps', 'secrets', 'config'], excludePatterns = [] } = request;
  const startTime = Date.now();
  const scanId = crypto.randomUUID();

  const vulnerabilities: SecurityVulnerability[] = [];

  // 1. Secrets scan (local, fast)
  if (scanTypes.includes('secrets')) {
    const files = scanDirectory(workspacePath, SECRET_SCAN_EXTENSIONS, excludePatterns);
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const findings = scanFileForSecrets(file, content);
        for (const finding of findings) {
          vulnerabilities.push({
            id: `SEC-${crypto.randomUUID().substring(0, 8)}`,
            type: 'secret-exposure',
            severity: finding.severity,
            title: `Exposed ${finding.type}`,
            description: finding.description,
            file: finding.file.replace(workspacePath, ''),
            line: finding.line,
            recommendation: finding.recommendation,
          });
        }
      } catch (_err) {
        // Skip unreadable files
      }
    }
  }

  // 2. SAST scan (using LLM)
  if (scanTypes.includes('sast') || scanTypes.includes('config')) {
    const codeSnippets = readCodeFiles(workspacePath);
    const packageJson = readPackageJson(workspacePath);

    if (codeSnippets) {
      const prompt = generateSecurityScanPrompt(codeSnippets, packageJson);

      const responseText = await callLLM({
        model: DEFAULT_MODEL,
        max_tokens: 4096,
        system: SECURITY_ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      try {
        const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[1]);
          if (data.vulnerabilities) {
            vulnerabilities.push(...data.vulnerabilities);
          }
        }
      } catch (_err) {
        // Continue with existing findings
      }
    }
  }

  // Calculate metrics
  const { score, grade } = calculateSecurityScore(vulnerabilities);

  const result: SecurityScanResult = {
    scanId,
    workspacePath,
    scannedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
    summary: {
      totalVulnerabilities: vulnerabilities.length,
      critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
      high: vulnerabilities.filter((v) => v.severity === 'high').length,
      medium: vulnerabilities.filter((v) => v.severity === 'medium').length,
      low: vulnerabilities.filter((v) => v.severity === 'low').length,
      info: vulnerabilities.filter((v) => v.severity === 'info').length,
      score,
      grade,
    },
    vulnerabilities,
    categories: {
      injection: vulnerabilities.filter((v) => ['sql-injection', 'xss', 'command-injection'].includes(v.type)).length,
      authentication: vulnerabilities.filter((v) => ['auth-bypass', 'broken-access-control'].includes(v.type)).length,
      dataExposure: vulnerabilities.filter((v) => ['sensitive-data-exposure', 'secret-exposure'].includes(v.type)).length,
      configuration: vulnerabilities.filter((v) => v.type === 'security-misconfiguration').length,
      dependencies: vulnerabilities.filter((v) => v.type === 'dependency-vulnerability').length,
    },
    recommendations: [
      'Review and fix all critical and high severity vulnerabilities',
      'Move all secrets to environment variables or a secrets manager',
      'Implement input validation for all user inputs',
      'Keep dependencies up to date and monitor for vulnerabilities',
    ],
  };

  return result;
}

/**
 * Generate SBOM
 */
export async function generateSBOM(request: SBOMRequest): Promise<SBOMResult> {
  const { workspacePath, format = 'cyclonedx', includeDevDeps = true } = request;

  const packageJson = readPackageJson(workspacePath);
  if (!packageJson) {
    throw new Error('No package.json found');
  }

  const pkg = JSON.parse(packageJson);
  const components: SBOMComponent[] = [];

  // Extract dependencies
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(includeDevDeps ? pkg.devDependencies || {} : {}),
  };

  for (const [name, version] of Object.entries(allDeps)) {
    const versionStr = String(version).replace(/^[\^~]/, '');
    components.push({
      name,
      version: versionStr,
      type: 'library',
      purl: `pkg:npm/${name}@${versionStr}`,
      licenses: [], // Would need to look up from npm registry
    });
  }

  // Use LLM to enrich with license info
  const depsStr = Object.entries(allDeps)
    .map(([name, version]) => `${name}@${version}`)
    .join('\n');

  const projectInfo = `Name: ${pkg.name || 'unknown'}\nVersion: ${pkg.version || '0.0.0'}`;
  const prompt = generateSBOMPrompt(depsStr, projectInfo);

  try {
    const responseText = await callLLM({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: SECURITY_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1]);
      // Merge license info from LLM
      for (const comp of data.components || []) {
        const existing = components.find((c) => c.name === comp.name);
        if (existing && comp.licenses) {
          existing.licenses = comp.licenses;
        }
      }
    }
  } catch (_err) {
    // Continue with basic SBOM
  }

  return {
    format,
    version: format === 'cyclonedx' ? '1.4' : '2.3',
    metadata: {
      timestamp: new Date().toISOString(),
      tool: 'G-Rump Security Scanner',
      component: {
        name: pkg.name || 'unknown',
        version: pkg.version || '0.0.0',
        type: 'application',
      },
    },
    components,
  };
}

/**
 * Generate compliance report
 */
export async function generateComplianceReport(request: ComplianceRequest): Promise<ComplianceReport> {
  const { workspacePath, standard, projectType } = request;

  const codeSnippets = readCodeFiles(workspacePath, 10);
  const packageJson = readPackageJson(workspacePath);
  const pkg = packageJson ? JSON.parse(packageJson) : {};

  const projectInfo = `
Project: ${pkg.name || path.basename(workspacePath)}
Type: ${projectType || 'Unknown'}
Dependencies: ${Object.keys(pkg.dependencies || {}).length}
Dev Dependencies: ${Object.keys(pkg.devDependencies || {}).length}
`;

  const prompt = generateCompliancePrompt(standard, projectInfo, codeSnippets);

  const responseText = await callLLM({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: SECURITY_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  let requirements: ComplianceRequirement[] = [];
  let recommendations: string[] = [];
  let nextSteps: string[] = [];
  let summary = { compliant: 0, nonCompliant: 0, partial: 0, notApplicable: 0 };

  try {
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1]);
      requirements = data.requirements || [];
      recommendations = data.recommendations || [];
      nextSteps = data.nextSteps || [];
      summary = data.summary || summary;
    }
  } catch (_err) {
    // Use defaults
  }

  return {
    standard,
    generatedAt: new Date().toISOString(),
    projectName: pkg.name || path.basename(workspacePath),
    summary: {
      totalRequirements: requirements.length,
      ...summary,
      compliancePercentage: requirements.length > 0
        ? Math.round((summary.compliant / requirements.length) * 100)
        : 0,
    },
    requirements,
    recommendations,
    nextSteps,
  };
}

/**
 * Audit for secrets
 */
export async function auditSecrets(request: SecretsAuditRequest): Promise<SecretsAuditResult> {
  const { workspacePath, excludePatterns = [] } = request;

  const files = scanDirectory(workspacePath, SECRET_SCAN_EXTENSIONS, excludePatterns);
  const findings: SecretFinding[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const fileFindings = scanFileForSecrets(file.replace(workspacePath, ''), content);
      findings.push(...fileFindings);
    } catch (_err) {
      // Skip unreadable files
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    filesScanned: files.length,
    secretsFound: findings.length,
    findings,
    recommendations: findings.length > 0
      ? [
          'Move all secrets to environment variables',
          'Use a secrets manager like HashiCorp Vault or AWS Secrets Manager',
          'Add secret patterns to .gitignore',
          'Rotate any exposed credentials immediately',
          'Implement pre-commit hooks to prevent secret commits',
        ]
      : ['No secrets detected. Continue following security best practices.'],
  };
}
