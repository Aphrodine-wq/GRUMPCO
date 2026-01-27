/**
 * Security & Compliance Feature - Claude Prompts
 */

export const SECURITY_ANALYSIS_SYSTEM_PROMPT = `You are an expert security analyst and compliance auditor. Your task is to analyze codebases for security vulnerabilities, compliance issues, and best practices.

You excel at:
- Identifying OWASP Top 10 vulnerabilities
- Detecting hardcoded secrets and sensitive data exposure
- Evaluating authentication and authorization implementations
- Assessing input validation and sanitization
- Reviewing security configurations
- Generating compliance checklists for various standards

When analyzing code:
1. Look for injection vulnerabilities (SQL, XSS, command injection)
2. Check authentication and session management
3. Identify sensitive data handling issues
4. Review access control implementations
5. Detect security misconfigurations
6. Find hardcoded credentials or API keys
7. Assess cryptographic practices

Always provide specific, actionable recommendations with code examples when possible.`;

export const generateSecurityScanPrompt = (codeSnippets: string, packageJson: string | null): string => {
  return `Perform a comprehensive security analysis of this codebase.

## Code to analyze:
${codeSnippets}

${packageJson ? `## Dependencies (package.json):
\`\`\`json
${packageJson}
\`\`\`` : ''}

Analyze for the following security issues:

1. **Injection Vulnerabilities**
   - SQL Injection
   - Cross-Site Scripting (XSS)
   - Command Injection
   - LDAP Injection

2. **Authentication & Authorization**
   - Weak authentication mechanisms
   - Missing authorization checks
   - Session management issues
   - JWT vulnerabilities

3. **Sensitive Data Exposure**
   - Hardcoded secrets
   - Unencrypted sensitive data
   - Logging sensitive information

4. **Security Misconfigurations**
   - Insecure defaults
   - Missing security headers
   - Debug mode in production

5. **Dependency Vulnerabilities**
   - Known vulnerable packages
   - Outdated dependencies

Respond in JSON format:
\`\`\`json
{
  "vulnerabilities": [
    {
      "id": "VULN-001",
      "type": "sql-injection|xss|csrf|auth-bypass|path-traversal|command-injection|sensitive-data-exposure|insecure-deserialization|broken-access-control|security-misconfiguration|dependency-vulnerability|secret-exposure|other",
      "severity": "critical|high|medium|low|info",
      "title": "Brief title",
      "description": "Detailed description",
      "file": "path/to/file",
      "line": number,
      "code": "vulnerable code snippet",
      "recommendation": "How to fix",
      "cwe": "CWE-XXX"
    }
  ],
  "score": 0-100,
  "recommendations": ["string"]
}
\`\`\``;
};

export const generateSecretsAuditPrompt = (fileContents: string): string => {
  return `Scan this code for exposed secrets, credentials, and sensitive data.

${fileContents}

Look for:
1. API keys (AWS, GCP, Azure, Stripe, Twilio, etc.)
2. Database credentials
3. Private keys (RSA, SSH, etc.)
4. OAuth tokens and secrets
5. JWT secrets
6. Connection strings
7. Passwords in code or config
8. Environment variables with sensitive defaults

For each finding, provide:
- Type of secret
- Severity level
- File and line number
- A REDACTED version of the match (replace most chars with *)
- Recommendation for secure handling

Respond in JSON format:
\`\`\`json
{
  "findings": [
    {
      "type": "api-key|password|private-key|token|credential|connection-string|other",
      "severity": "critical|high|medium|low",
      "file": "path",
      "line": number,
      "match": "sk-***...***abc (redacted)",
      "description": "What was found",
      "recommendation": "How to secure it"
    }
  ],
  "recommendations": ["general security recommendations"]
}
\`\`\``;
};

export const generateCompliancePrompt = (
  standard: string,
  projectInfo: string,
  codeSnippets: string
): string => {
  const standardDetails: Record<string, string> = {
    'soc2': `SOC 2 Type II compliance requirements:
- Security: Protection against unauthorized access
- Availability: System availability as committed
- Processing Integrity: System processing is complete and accurate
- Confidentiality: Information designated as confidential is protected
- Privacy: Personal information is collected and used appropriately`,

    'gdpr': `GDPR compliance requirements:
- Lawfulness, fairness, and transparency
- Purpose limitation
- Data minimization
- Accuracy
- Storage limitation
- Integrity and confidentiality
- Accountability
- Data subject rights (access, rectification, erasure, portability)`,

    'hipaa': `HIPAA compliance requirements:
- Administrative safeguards
- Physical safeguards
- Technical safeguards
- Policies and procedures
- Documentation requirements
- Breach notification`,

    'pci-dss': `PCI DSS compliance requirements:
- Build and maintain secure networks
- Protect cardholder data
- Maintain vulnerability management
- Implement strong access control
- Monitor and test networks
- Maintain information security policies`,

    'iso27001': `ISO 27001 compliance requirements:
- Information security policies
- Organization of information security
- Human resource security
- Asset management
- Access control
- Cryptography
- Physical and environmental security
- Operations security
- Communications security
- System acquisition, development, and maintenance
- Supplier relationships
- Information security incident management
- Business continuity management
- Compliance`,

    'owasp-top10': `OWASP Top 10 2021 requirements:
- A01: Broken Access Control
- A02: Cryptographic Failures
- A03: Injection
- A04: Insecure Design
- A05: Security Misconfiguration
- A06: Vulnerable and Outdated Components
- A07: Identification and Authentication Failures
- A08: Software and Data Integrity Failures
- A09: Security Logging and Monitoring Failures
- A10: Server-Side Request Forgery (SSRF)`,
  };

  return `Generate a compliance assessment for ${standard.toUpperCase()}.

## Standard Requirements:
${standardDetails[standard] || 'General security compliance'}

## Project Information:
${projectInfo}

## Code Samples:
${codeSnippets}

Assess compliance status for each requirement. Consider:
- Code implementations
- Security controls
- Documentation needs
- Process requirements

Respond in JSON format:
\`\`\`json
{
  "requirements": [
    {
      "id": "REQ-001",
      "standard": "${standard}",
      "category": "category name",
      "title": "Requirement title",
      "description": "What is required",
      "status": "compliant|non-compliant|partial|not-applicable|needs-review",
      "evidence": "What supports this status",
      "remediation": "What needs to be done (if not compliant)",
      "priority": "critical|high|medium|low"
    }
  ],
  "summary": {
    "compliant": number,
    "nonCompliant": number,
    "partial": number,
    "notApplicable": number
  },
  "recommendations": ["string"],
  "nextSteps": ["string"]
}
\`\`\``;
};

export const generateSBOMPrompt = (dependencies: string, projectInfo: string): string => {
  return `Generate a Software Bill of Materials (SBOM) for this project.

## Project Information:
${projectInfo}

## Dependencies:
${dependencies}

For each component, provide:
- Package name and version
- Type (library, framework, etc.)
- License information (if known)
- Package URL (purl) format

Respond in JSON format:
\`\`\`json
{
  "components": [
    {
      "name": "package-name",
      "version": "1.0.0",
      "type": "library|framework|application",
      "purl": "pkg:npm/package-name@1.0.0",
      "licenses": ["MIT", "Apache-2.0"],
      "supplier": "vendor/author if known"
    }
  ],
  "metadata": {
    "projectName": "name",
    "projectVersion": "version"
  }
}
\`\`\``;
};
