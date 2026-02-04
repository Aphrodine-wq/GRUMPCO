/**
 * Centralized Guardrails Configuration
 *
 * Defines all guardrail settings, limits, and policies in one place.
 * Environment variables can override defaults for each setting.
 *
 * @module config/guardrailsConfig
 */

// ============================================================================
// TYPES
// ============================================================================

export type StrictMode = "off" | "warn" | "enforce";

export interface CodeValidationConfig {
  /** Enable TypeScript compilation check */
  requireCompilation: boolean;
  /** Enable ESLint validation */
  requireLinting: boolean;
  /** Fail on TypeScript errors (vs just warnings) */
  failOnTsErrors: boolean;
  /** Fail on ESLint errors (vs just warnings) */
  failOnLintErrors: boolean;
  /** TypeScript strict mode */
  tsStrictMode: boolean;
  /** Maximum allowed TypeScript errors before blocking */
  maxTsErrors: number;
  /** Maximum allowed ESLint errors before blocking */
  maxLintErrors: number;
  /** Timeout for compilation check in ms */
  compilationTimeoutMs: number;
}

export interface RuntimeVerificationConfig {
  /** Enable npm install verification */
  verifyNpmInstall: boolean;
  /** Enable test execution */
  runTests: boolean;
  /** Enable app startup verification */
  verifyAppStart: boolean;
  /** Minimum test pass rate (0-1) to pass verification */
  minTestPassRate: number;
  /** Timeout for npm install in ms */
  npmInstallTimeoutMs: number;
  /** Timeout for test execution in ms */
  testTimeoutMs: number;
  /** Timeout for app startup check in ms */
  appStartTimeoutMs: number;
  /** Maximum retries for failed operations */
  maxRetries: number;
  /** Port to use for app startup verification */
  appVerifyPort: number;
}

export interface BudgetLimitsConfig {
  /** Maximum tokens per single request */
  maxTokensPerRequest: number;
  /** Maximum tokens per session */
  maxTokensPerSession: number;
  /** Maximum tokens per user per day */
  maxTokensPerUserDaily: number;
  /** Maximum cost per request in cents */
  maxCostPerRequestCents: number;
  /** Maximum cost per session in cents */
  maxCostPerSessionCents: number;
  /** Maximum cost per user per day in cents */
  maxCostPerUserDailyCents: number;
  /** Enable hard cutoff when limits reached */
  hardCutoffEnabled: boolean;
  /** Warning threshold (percentage of limit) */
  warningThresholdPercent: number;
}

export interface FileSystemConfig {
  /** Maximum file size in bytes */
  maxFileSizeBytes: number;
  /** Maximum directory depth allowed */
  maxDirectoryDepth: number;
  /** Blocked file extensions (will not read/write) */
  blockedExtensions: string[];
  /** Allowed extensions only mode (empty = all allowed except blocked) */
  allowedExtensionsOnly: string[];
  /** Blocked directory patterns */
  blockedDirectories: string[];
  /** Enable strict path validation */
  strictPathValidation: boolean;
  /** Maximum total files that can be written per operation */
  maxFilesPerOperation: number;
  /** Maximum total bytes that can be written per operation */
  maxBytesPerOperation: number;
}

export interface ApprovalGatesConfig {
  /** Require approval for shell/bash commands */
  requireApprovalForShell: boolean;
  /** Require approval for file deletion */
  requireApprovalForDelete: boolean;
  /** Require approval for network requests */
  requireApprovalForNetwork: boolean;
  /** Require approval for git push/force operations */
  requireApprovalForGitPush: boolean;
  /** Require approval for package install */
  requireApprovalForPackageInstall: boolean;
  /** Default timeout for approval requests in seconds */
  approvalTimeoutSeconds: number;
  /** Auto-approve low-risk operations */
  autoApproveLowRisk: boolean;
  /** High-risk commands that always require approval */
  highRiskCommands: string[];
}

export interface SecurityPatternsConfig {
  /** Enable jailbreak detection */
  detectJailbreaks: boolean;
  /** Enable prompt injection detection */
  detectPromptInjection: boolean;
  /** Enable credential/secret detection */
  detectCredentials: boolean;
  /** Enable crypto mining pattern detection */
  detectCryptoMining: boolean;
  /** Enable data exfiltration detection */
  detectExfiltration: boolean;
  /** Action on detection: 'block' | 'warn' | 'log' */
  actionOnDetection: "block" | "warn" | "log";
  /** Custom blocked patterns (regex strings) */
  customBlockedPatterns: string[];
  /** Custom allowed patterns (bypass detection) */
  customAllowedPatterns: string[];
}

export interface GuardrailsConfig {
  /** Global strict mode: off, warn, enforce */
  strictMode: StrictMode;
  /** Enable all guardrails (master switch) */
  enabled: boolean;
  /** Code validation settings */
  codeValidation: CodeValidationConfig;
  /** Runtime verification settings */
  runtimeVerification: RuntimeVerificationConfig;
  /** Budget/cost limits */
  budgetLimits: BudgetLimitsConfig;
  /** File system restrictions */
  fileSystem: FileSystemConfig;
  /** Approval gate settings */
  approvalGates: ApprovalGatesConfig;
  /** Security pattern detection */
  securityPatterns: SecurityPatternsConfig;
}

// ============================================================================
// ENVIRONMENT VARIABLE HELPERS
// ============================================================================

function envBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function envInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function envFloat(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function envString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function envArray(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function envStrictMode(key: string, defaultValue: StrictMode): StrictMode {
  const value = process.env[key]?.toLowerCase();
  if (value === "off" || value === "warn" || value === "enforce") return value;
  return defaultValue;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_BLOCKED_EXTENSIONS = [
  ".exe",
  ".dll",
  ".so",
  ".dylib", // Executables
  ".bat",
  ".cmd",
  ".ps1",
  ".sh", // Scripts (can be dangerous)
  ".com",
  ".msi",
  ".app", // Installers
  ".sys",
  ".drv", // System files
  ".pif",
  ".scr", // Windows executables
];

const DEFAULT_BLOCKED_DIRECTORIES = [
  "/etc",
  "/usr",
  "/bin",
  "/sbin",
  "/boot",
  "/root",
  "/sys",
  "/proc",
  "/dev",
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
  "C:\\ProgramData",
  ".git/hooks",
  "node_modules/.bin",
];

const DEFAULT_HIGH_RISK_COMMANDS = [
  "rm -rf",
  "rm -r /",
  "rmdir /s",
  "del /f /s",
  "format ",
  "mkfs.",
  "dd if=",
  "chmod 777",
  "chmod -R 777",
  ":(){:|:&};:", // Fork bomb
  "curl | sh",
  "curl | bash",
  "wget | sh",
  "wget | bash",
  "sudo rm",
  "sudo dd",
  "git push --force",
  "git push -f origin main",
  "git push -f origin master",
  "DROP TABLE",
  "DROP DATABASE",
  "TRUNCATE TABLE",
  "DELETE FROM",
  "shutdown",
  "reboot",
  "halt",
  "init 0",
  "init 6",
];

// ============================================================================
// BUILD CONFIGURATION
// ============================================================================

export function buildGuardrailsConfig(): GuardrailsConfig {
  return {
    strictMode: envStrictMode("GUARDRAILS_STRICT_MODE", "warn"),
    enabled: envBool("GUARDRAILS_ENABLED", true),

    codeValidation: {
      requireCompilation: envBool("GUARDRAILS_REQUIRE_COMPILATION", true),
      requireLinting: envBool("GUARDRAILS_REQUIRE_LINTING", true),
      failOnTsErrors: envBool("GUARDRAILS_FAIL_ON_TS_ERRORS", true),
      failOnLintErrors: envBool("GUARDRAILS_FAIL_ON_LINT_ERRORS", false),
      tsStrictMode: envBool("GUARDRAILS_TS_STRICT", true),
      maxTsErrors: envInt("GUARDRAILS_MAX_TS_ERRORS", 0),
      maxLintErrors: envInt("GUARDRAILS_MAX_LINT_ERRORS", 5),
      compilationTimeoutMs: envInt("GUARDRAILS_COMPILATION_TIMEOUT_MS", 60000),
    },

    runtimeVerification: {
      verifyNpmInstall: envBool("GUARDRAILS_VERIFY_NPM_INSTALL", true),
      runTests: envBool("GUARDRAILS_RUN_TESTS", true),
      verifyAppStart: envBool("GUARDRAILS_VERIFY_APP_START", false),
      minTestPassRate: envFloat("GUARDRAILS_MIN_TEST_PASS_RATE", 0.8),
      npmInstallTimeoutMs: envInt("GUARDRAILS_NPM_INSTALL_TIMEOUT_MS", 120000),
      testTimeoutMs: envInt("GUARDRAILS_TEST_TIMEOUT_MS", 300000),
      appStartTimeoutMs: envInt("GUARDRAILS_APP_START_TIMEOUT_MS", 30000),
      maxRetries: envInt("GUARDRAILS_MAX_RETRIES", 2),
      appVerifyPort: envInt("GUARDRAILS_APP_VERIFY_PORT", 3000),
    },

    budgetLimits: {
      maxTokensPerRequest: envInt("MAX_TOKENS_PER_REQUEST", 100000),
      maxTokensPerSession: envInt("MAX_TOKENS_PER_SESSION", 1000000),
      maxTokensPerUserDaily: envInt("MAX_TOKENS_PER_USER_DAILY", 5000000),
      maxCostPerRequestCents: envInt("MAX_COST_PER_REQUEST_CENTS", 100),
      maxCostPerSessionCents: envInt("MAX_COST_PER_SESSION_CENTS", 1000),
      maxCostPerUserDailyCents: envInt("MAX_COST_PER_USER_DAILY_CENTS", 5000),
      hardCutoffEnabled: envBool("BUDGET_HARD_CUTOFF", true),
      warningThresholdPercent: envFloat("BUDGET_WARNING_THRESHOLD_PERCENT", 80),
    },

    fileSystem: {
      maxFileSizeBytes: envInt("MAX_FILE_SIZE_BYTES", 10 * 1024 * 1024), // 10MB
      maxDirectoryDepth: envInt("MAX_DIRECTORY_DEPTH", 15),
      blockedExtensions: envArray(
        "BLOCKED_FILE_EXTENSIONS",
        DEFAULT_BLOCKED_EXTENSIONS,
      ),
      allowedExtensionsOnly: envArray("ALLOWED_FILE_EXTENSIONS_ONLY", []),
      blockedDirectories: envArray(
        "BLOCKED_DIRECTORIES",
        DEFAULT_BLOCKED_DIRECTORIES,
      ),
      strictPathValidation: envBool("STRICT_PATH_VALIDATION", true),
      maxFilesPerOperation: envInt("MAX_FILES_PER_OPERATION", 100),
      maxBytesPerOperation: envInt("MAX_BYTES_PER_OPERATION", 50 * 1024 * 1024), // 50MB
    },

    approvalGates: {
      requireApprovalForShell: envBool("REQUIRE_APPROVAL_FOR_SHELL", false),
      requireApprovalForDelete: envBool("REQUIRE_APPROVAL_FOR_DELETE", false),
      requireApprovalForNetwork: envBool("REQUIRE_APPROVAL_FOR_NETWORK", false),
      requireApprovalForGitPush: envBool("REQUIRE_APPROVAL_FOR_GIT_PUSH", true),
      requireApprovalForPackageInstall: envBool(
        "REQUIRE_APPROVAL_FOR_PACKAGE_INSTALL",
        false,
      ),
      approvalTimeoutSeconds: envInt("APPROVAL_TIMEOUT_SECONDS", 300),
      autoApproveLowRisk: envBool("AUTO_APPROVE_LOW_RISK", true),
      highRiskCommands: envArray(
        "HIGH_RISK_COMMANDS",
        DEFAULT_HIGH_RISK_COMMANDS,
      ),
    },

    securityPatterns: {
      detectJailbreaks: envBool("DETECT_JAILBREAKS", true),
      detectPromptInjection: envBool("DETECT_PROMPT_INJECTION", true),
      detectCredentials: envBool("DETECT_CREDENTIALS", true),
      detectCryptoMining: envBool("DETECT_CRYPTO_MINING", true),
      detectExfiltration: envBool("DETECT_EXFILTRATION", true),
      actionOnDetection: envString("SECURITY_ACTION_ON_DETECTION", "warn") as
        | "block"
        | "warn"
        | "log",
      customBlockedPatterns: envArray("CUSTOM_BLOCKED_PATTERNS", []),
      customAllowedPatterns: envArray("CUSTOM_ALLOWED_PATTERNS", []),
    },
  };
}

// ============================================================================
// SINGLETON CONFIG INSTANCE
// ============================================================================

let _config: GuardrailsConfig | null = null;

/**
 * Get the current guardrails configuration.
 * Lazily initialized on first access.
 */
export function getGuardrailsConfig(): GuardrailsConfig {
  if (!_config) {
    _config = buildGuardrailsConfig();
  }
  return _config;
}

/**
 * Reload configuration from environment.
 * Useful for testing or runtime config updates.
 */
export function reloadGuardrailsConfig(): GuardrailsConfig {
  _config = buildGuardrailsConfig();
  return _config;
}

/**
 * Override configuration (for testing).
 */
export function setGuardrailsConfig(config: Partial<GuardrailsConfig>): void {
  _config = { ...getGuardrailsConfig(), ...config };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if an extension is blocked
 */
export function isExtensionBlocked(filePath: string): boolean {
  const config = getGuardrailsConfig();
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();

  // If allowedExtensionsOnly is set, only those are allowed
  if (config.fileSystem.allowedExtensionsOnly.length > 0) {
    return !config.fileSystem.allowedExtensionsOnly.includes(ext);
  }

  return config.fileSystem.blockedExtensions.includes(ext);
}

/**
 * Check if a directory is blocked
 */
export function isDirectoryBlocked(dirPath: string): boolean {
  const config = getGuardrailsConfig();
  const normalizedPath = dirPath.replace(/\\/g, "/").toLowerCase();

  return config.fileSystem.blockedDirectories.some((blocked) => {
    const normalizedBlocked = blocked.replace(/\\/g, "/").toLowerCase();
    return (
      normalizedPath.startsWith(normalizedBlocked) ||
      normalizedPath.includes(normalizedBlocked)
    );
  });
}

/**
 * Check if a command is high-risk
 */
export function isHighRiskCommand(command: string): boolean {
  const config = getGuardrailsConfig();
  const lowerCommand = command.toLowerCase();

  return config.approvalGates.highRiskCommands.some((risky) => {
    return lowerCommand.includes(risky.toLowerCase());
  });
}

/**
 * Check if file size is within limits
 */
export function isFileSizeAllowed(sizeBytes: number): boolean {
  const config = getGuardrailsConfig();
  return sizeBytes <= config.fileSystem.maxFileSizeBytes;
}

/**
 * Get directory depth from path
 */
export function getDirectoryDepth(filePath: string): number {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").filter((p) => p.length > 0).length;
}

/**
 * Check if directory depth is within limits
 */
export function isDirectoryDepthAllowed(filePath: string): boolean {
  const config = getGuardrailsConfig();
  return getDirectoryDepth(filePath) <= config.fileSystem.maxDirectoryDepth;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getGuardrailsConfig,
  reloadGuardrailsConfig,
  setGuardrailsConfig,
  buildGuardrailsConfig,
  isExtensionBlocked,
  isDirectoryBlocked,
  isHighRiskCommand,
  isFileSizeAllowed,
  isDirectoryDepthAllowed,
  getDirectoryDepth,
};
