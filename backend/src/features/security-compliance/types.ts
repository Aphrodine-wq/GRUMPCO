/**
 * Security & Compliance Feature - Type Definitions
 */

export interface SecurityVulnerability {
  id: string;
  type: 'sql-injection' | 'xss' | 'csrf' | 'auth-bypass' | 'path-traversal' | 'command-injection' |
        'sensitive-data-exposure' | 'insecure-deserialization' | 'broken-access-control' |
        'security-misconfiguration' | 'dependency-vulnerability' | 'secret-exposure' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  code?: string;
  recommendation: string;
  references?: string[];
  cvss?: number;
  cwe?: string;
}

export interface SecurityScanResult {
  scanId: string;
  workspacePath: string;
  scannedAt: string;
  duration: number;

  summary: {
    totalVulnerabilities: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    score: number; // 0-100 security score
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };

  vulnerabilities: SecurityVulnerability[];

  categories: {
    injection: number;
    authentication: number;
    dataExposure: number;
    configuration: number;
    dependencies: number;
  };

  recommendations: string[];
}

export interface SBOMComponent {
  name: string;
  version: string;
  type: 'library' | 'framework' | 'application' | 'file' | 'container' | 'operating-system';
  purl?: string; // Package URL
  licenses: string[];
  supplier?: string;
  hashes?: Array<{ algorithm: string; value: string }>;
  externalReferences?: Array<{ type: string; url: string }>;
}

export interface SBOMResult {
  format: 'cyclonedx' | 'spdx';
  version: string;
  metadata: {
    timestamp: string;
    tool: string;
    component: {
      name: string;
      version: string;
      type: string;
    };
  };
  components: SBOMComponent[];
  dependencies?: Array<{
    ref: string;
    dependsOn: string[];
  }>;
  rawOutput?: string;
}

export interface ComplianceRequirement {
  id: string;
  standard: string;
  category: string;
  title: string;
  description: string;
  status: 'compliant' | 'non-compliant' | 'partial' | 'not-applicable' | 'needs-review';
  evidence?: string;
  remediation?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface ComplianceReport {
  standard: 'soc2' | 'gdpr' | 'hipaa' | 'pci-dss' | 'iso27001' | 'owasp-top10';
  generatedAt: string;
  projectName: string;

  summary: {
    totalRequirements: number;
    compliant: number;
    nonCompliant: number;
    partial: number;
    notApplicable: number;
    compliancePercentage: number;
  };

  requirements: ComplianceRequirement[];
  recommendations: string[];
  nextSteps: string[];
}

export interface SecretFinding {
  type: 'api-key' | 'password' | 'private-key' | 'token' | 'credential' | 'connection-string' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line: number;
  match: string; // Redacted version
  description: string;
  recommendation: string;
}

export interface SecretsAuditResult {
  scannedAt: string;
  filesScanned: number;
  secretsFound: number;
  findings: SecretFinding[];
  recommendations: string[];
}

export interface SecurityScanRequest {
  workspacePath: string;
  scanTypes?: ('sast' | 'deps' | 'secrets' | 'config')[];
  severity?: ('critical' | 'high' | 'medium' | 'low' | 'info')[];
  excludePatterns?: string[];
}

export interface SBOMRequest {
  workspacePath: string;
  format?: 'cyclonedx' | 'spdx';
  includeDevDeps?: boolean;
}

export interface ComplianceRequest {
  workspacePath: string;
  standard: 'soc2' | 'gdpr' | 'hipaa' | 'pci-dss' | 'iso27001' | 'owasp-top10';
  projectType?: string;
}

export interface SecretsAuditRequest {
  workspacePath: string;
  excludePatterns?: string[];
  customPatterns?: string[];
}

/** Result of workspace path validation */
export type PathValidationResult = 
  | { ok: true; resolved: string }
  | { ok: false; reason: string };

