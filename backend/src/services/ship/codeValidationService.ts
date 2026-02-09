/**
 * Code Validation Service
 *
 * Validates generated code before accepting it:
 * - TypeScript compilation checking
 * - ESLint validation
 * - Import/export verification
 * - Syntax validation
 *
 * @module services/codeValidationService
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import logger from "../../middleware/logger.js";
import { getGuardrailsConfig } from "../../config/guardrailsConfig.js";
import { writeAuditLog } from "../security/auditLogService.js";

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationError {
  /** File path relative to workspace */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Error message */
  message: string;
  /** Error code (e.g., TS2304, no-unused-vars) */
  code: string;
  /** Severity: error, warning, info */
  severity: "error" | "warning" | "info";
  /** Source: typescript, eslint, syntax */
  source: "typescript" | "eslint" | "syntax";
}

export interface ValidationResult {
  /** Whether validation passed */
  passed: boolean;
  /** Total error count */
  errorCount: number;
  /** Total warning count */
  warningCount: number;
  /** List of validation errors */
  errors: ValidationError[];
  /** Summary message */
  summary: string;
  /** Time taken in ms */
  durationMs: number;
  /** Whether validation was skipped */
  skipped: boolean;
  /** Skip reason if skipped */
  skipReason?: string;
}

export interface TypeScriptValidationOptions {
  /** Working directory */
  workspaceRoot: string;
  /** Specific files to check (empty = all) */
  files?: string[];
  /** Use strict mode */
  strict?: boolean;
  /** Custom tsconfig path */
  tsconfigPath?: string;
  /** Timeout in ms */
  timeoutMs?: number;
}

export interface ESLintValidationOptions {
  /** Working directory */
  workspaceRoot: string;
  /** Specific files to check */
  files?: string[];
  /** Fix auto-fixable issues */
  fix?: boolean;
  /** Custom eslint config path */
  configPath?: string;
  /** Timeout in ms */
  timeoutMs?: number;
}

export interface CodeValidationOptions {
  /** Working directory */
  workspaceRoot: string;
  /** Files to validate */
  files?: string[];
  /** Run TypeScript validation */
  typescript?: boolean;
  /** Run ESLint validation */
  eslint?: boolean;
  /** User ID for audit logging */
  userId?: string;
}

// ============================================================================
// TYPESCRIPT VALIDATION
// ============================================================================

/**
 * Run TypeScript compilation check
 */
export async function validateTypeScript(
  options: TypeScriptValidationOptions,
): Promise<ValidationResult> {
  const config = getGuardrailsConfig();
  const startTime = Date.now();

  // Check if TypeScript validation is enabled
  if (!config.codeValidation.requireCompilation) {
    return {
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      summary: "TypeScript validation skipped (disabled in config)",
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: "Disabled in guardrails config",
    };
  }

  const {
    workspaceRoot,
    files = [],
    tsconfigPath,
    timeoutMs = config.codeValidation.compilationTimeoutMs,
  } = options;

  // Check if tsconfig exists
  const tsconfigFile =
    tsconfigPath ?? path.join(workspaceRoot, "tsconfig.json");
  let hasTsConfig = false;
  try {
    await fs.access(tsconfigFile);
    hasTsConfig = true;
  } catch {
    // No tsconfig, might be a JS project
  }

  if (!hasTsConfig && files.length === 0) {
    return {
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      summary: "TypeScript validation skipped (no tsconfig.json found)",
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: "No tsconfig.json found",
    };
  }

  return new Promise((resolve) => {
    const args = ["--noEmit", "--pretty", "false"];

    if (tsconfigPath) {
      args.push("--project", tsconfigPath);
    } else if (hasTsConfig) {
      args.push("--project", tsconfigFile);
    }

    if (files.length > 0) {
      args.push(...files);
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn("npx", ["tsc", ...args], {
      cwd: workspaceRoot,
      shell: true,
      timeout: timeoutMs,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (_code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      if (timedOut) {
        resolve({
          passed: false,
          errorCount: 1,
          warningCount: 0,
          errors: [
            {
              file: "tsc",
              line: 0,
              column: 0,
              message: `TypeScript compilation timed out after ${timeoutMs}ms`,
              code: "TIMEOUT",
              severity: "error",
              source: "typescript",
            },
          ],
          summary: `TypeScript compilation timed out after ${timeoutMs}ms`,
          durationMs,
          skipped: false,
        });
        return;
      }

      const errors = parseTypeScriptOutput(stdout + stderr, workspaceRoot);
      const errorCount = errors.filter((e) => e.severity === "error").length;
      const warningCount = errors.filter(
        (e) => e.severity === "warning",
      ).length;

      const passed = config.codeValidation.failOnTsErrors
        ? errorCount <= config.codeValidation.maxTsErrors
        : true;

      resolve({
        passed,
        errorCount,
        warningCount,
        errors,
        summary: passed
          ? `TypeScript: ${errorCount} errors, ${warningCount} warnings (passed)`
          : `TypeScript: ${errorCount} errors, ${warningCount} warnings (failed)`,
        durationMs,
        skipped: false,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        passed: true, // Don't block if tsc not available
        errorCount: 0,
        warningCount: 1,
        errors: [
          {
            file: "tsc",
            line: 0,
            column: 0,
            message: `TypeScript not available: ${err.message}`,
            code: "NOT_AVAILABLE",
            severity: "warning",
            source: "typescript",
          },
        ],
        summary: "TypeScript not available - skipped",
        durationMs: Date.now() - startTime,
        skipped: true,
        skipReason: `TypeScript not available: ${err.message}`,
      });
    });
  });
}

/**
 * Parse TypeScript compiler output
 */
function parseTypeScriptOutput(
  output: string,
  workspaceRoot: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = output.split("\n");

  // TypeScript output format: path(line,col): severity TSXXXX: message
  const errorRegex =
    /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(errorRegex);
    if (match) {
      const [, filePath, lineNum, colNum, severity, code, message] = match;
      errors.push({
        file: path.relative(workspaceRoot, filePath),
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
        message: message.trim(),
        code,
        severity: severity === "error" ? "error" : "warning",
        source: "typescript",
      });
    }
  }

  return errors;
}

// ============================================================================
// ESLINT VALIDATION
// ============================================================================

/**
 * Run ESLint validation
 */
export async function validateESLint(
  options: ESLintValidationOptions,
): Promise<ValidationResult> {
  const config = getGuardrailsConfig();
  const startTime = Date.now();

  // Check if ESLint validation is enabled
  if (!config.codeValidation.requireLinting) {
    return {
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      summary: "ESLint validation skipped (disabled in config)",
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: "Disabled in guardrails config",
    };
  }

  const {
    workspaceRoot,
    files = ["."],
    fix = false,
    configPath,
    timeoutMs = config.codeValidation.compilationTimeoutMs,
  } = options;

  // Check if ESLint config exists
  const eslintConfigs = [
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc.yml",
    ".eslintrc.yaml",
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
  ];

  let hasEslintConfig = false;
  for (const configFile of eslintConfigs) {
    try {
      await fs.access(path.join(workspaceRoot, configFile));
      hasEslintConfig = true;
      break;
    } catch {
      // Continue checking
    }
  }

  if (!hasEslintConfig && !configPath) {
    return {
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      summary: "ESLint validation skipped (no config found)",
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: "No ESLint config found",
    };
  }

  return new Promise((resolve) => {
    const args = ["eslint", "--format", "json"];

    if (fix) {
      args.push("--fix");
    }

    if (configPath) {
      args.push("--config", configPath);
    }

    args.push(...files);

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn("npx", args, {
      cwd: workspaceRoot,
      shell: true,
      timeout: timeoutMs,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (_code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      if (timedOut) {
        resolve({
          passed: false,
          errorCount: 1,
          warningCount: 0,
          errors: [
            {
              file: "eslint",
              line: 0,
              column: 0,
              message: `ESLint timed out after ${timeoutMs}ms`,
              code: "TIMEOUT",
              severity: "error",
              source: "eslint",
            },
          ],
          summary: `ESLint timed out after ${timeoutMs}ms`,
          durationMs,
          skipped: false,
        });
        return;
      }

      const errors = parseESLintOutput(stdout, workspaceRoot);
      const errorCount = errors.filter((e) => e.severity === "error").length;
      const warningCount = errors.filter(
        (e) => e.severity === "warning",
      ).length;

      const passed = config.codeValidation.failOnLintErrors
        ? errorCount <= config.codeValidation.maxLintErrors
        : true;

      resolve({
        passed,
        errorCount,
        warningCount,
        errors,
        summary: passed
          ? `ESLint: ${errorCount} errors, ${warningCount} warnings (passed)`
          : `ESLint: ${errorCount} errors, ${warningCount} warnings (failed)`,
        durationMs,
        skipped: false,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        passed: true, // Don't block if ESLint not available
        errorCount: 0,
        warningCount: 1,
        errors: [
          {
            file: "eslint",
            line: 0,
            column: 0,
            message: `ESLint not available: ${err.message}`,
            code: "NOT_AVAILABLE",
            severity: "warning",
            source: "eslint",
          },
        ],
        summary: "ESLint not available - skipped",
        durationMs: Date.now() - startTime,
        skipped: true,
        skipReason: `ESLint not available: ${err.message}`,
      });
    });
  });
}

/**
 * Parse ESLint JSON output
 */
function parseESLintOutput(
  output: string,
  workspaceRoot: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    const results = JSON.parse(output);

    for (const result of results) {
      for (const message of result.messages || []) {
        errors.push({
          file: path.relative(workspaceRoot, result.filePath),
          line: message.line || 0,
          column: message.column || 0,
          message: message.message,
          code: message.ruleId || "unknown",
          severity: message.severity === 2 ? "error" : "warning",
          source: "eslint",
        });
      }
    }
  } catch {
    // Could not parse JSON, might be an error message
    if (output.trim()) {
      errors.push({
        file: "eslint",
        line: 0,
        column: 0,
        message: `ESLint output: ${output.substring(0, 500)}`,
        code: "PARSE_ERROR",
        severity: "warning",
        source: "eslint",
      });
    }
  }

  return errors;
}

// ============================================================================
// SYNTAX VALIDATION
// ============================================================================

/**
 * Quick syntax validation for a single file
 * Uses Node.js built-in parser for JS/TS
 */
export async function validateSyntax(
  filePath: string,
  content: string,
): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];

  const ext = path.extname(filePath).toLowerCase();

  // For JavaScript/TypeScript, try to parse
  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
    try {
      // Use dynamic import to attempt parsing
      // This is a basic syntax check
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `syntax-check-${Date.now()}${ext}`);

      await fs.writeFile(tempFile, content);

      try {
        // Try to load as a module to check syntax
        const { spawn } = await import("child_process");

        await new Promise<void>((resolve) => {
          const proc = spawn("node", ["--check", tempFile], { timeout: 5000 });
          let stderr = "";

          proc.stderr.on("data", (data) => {
            stderr += data.toString();
          });

          proc.on("close", (exitCode) => {
            if (exitCode !== 0 && stderr) {
              // Parse the error
              const match = stderr.match(/:(\d+)\n(.+)/);
              if (match) {
                errors.push({
                  file: filePath,
                  line: parseInt(match[1], 10),
                  column: 0,
                  message: match[2].trim(),
                  code: "SYNTAX_ERROR",
                  severity: "error",
                  source: "syntax",
                });
              } else {
                errors.push({
                  file: filePath,
                  line: 0,
                  column: 0,
                  message: stderr.substring(0, 500),
                  code: "SYNTAX_ERROR",
                  severity: "error",
                  source: "syntax",
                });
              }
            }
            resolve();
          });

          proc.on("error", () => resolve()); // Ignore process errors
        });
      } finally {
        // Clean up temp file
        try {
          await fs.unlink(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (err) {
      errors.push({
        file: filePath,
        line: 0,
        column: 0,
        message: err instanceof Error ? err.message : "Unknown syntax error",
        code: "SYNTAX_ERROR",
        severity: "error",
        source: "syntax",
      });
    }
  }

  // For JSON files
  if (ext === ".json") {
    try {
      JSON.parse(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      // Try to extract line number from error message
      const match = message.match(/position (\d+)/);
      let line = 0;
      if (match) {
        // Approximate line number from position
        const position = parseInt(match[1], 10);
        line = content.substring(0, position).split("\n").length;
      }

      errors.push({
        file: filePath,
        line,
        column: 0,
        message,
        code: "JSON_SYNTAX_ERROR",
        severity: "error",
        source: "syntax",
      });
    }
  }

  const passed = errors.length === 0;

  return {
    passed,
    errorCount: errors.filter((e) => e.severity === "error").length,
    warningCount: errors.filter((e) => e.severity === "warning").length,
    errors,
    summary: passed
      ? "Syntax validation passed"
      : `Syntax validation failed: ${errors.length} errors`,
    durationMs: Date.now() - startTime,
    skipped: false,
  };
}

// ============================================================================
// COMBINED VALIDATION
// ============================================================================

/**
 * Run all configured code validations
 */
export async function validateCode(options: CodeValidationOptions): Promise<{
  passed: boolean;
  typescript: ValidationResult;
  eslint: ValidationResult;
  combined: ValidationResult;
}> {
  const config = getGuardrailsConfig();
  const startTime = Date.now();

  const runTypeScript =
    options.typescript ?? config.codeValidation.requireCompilation;
  const runESLint = options.eslint ?? config.codeValidation.requireLinting;

  // Run validations in parallel
  const [tsResult, lintResult] = await Promise.all([
    runTypeScript
      ? validateTypeScript({
          workspaceRoot: options.workspaceRoot,
          files: options.files,
        })
      : ({
          passed: true,
          errorCount: 0,
          warningCount: 0,
          errors: [],
          summary: "TypeScript validation not requested",
          durationMs: 0,
          skipped: true,
          skipReason: "Not requested",
        } as ValidationResult),
    runESLint
      ? validateESLint({
          workspaceRoot: options.workspaceRoot,
          files: options.files,
        })
      : ({
          passed: true,
          errorCount: 0,
          warningCount: 0,
          errors: [],
          summary: "ESLint validation not requested",
          durationMs: 0,
          skipped: true,
          skipReason: "Not requested",
        } as ValidationResult),
  ]);

  const allErrors = [...tsResult.errors, ...lintResult.errors];
  const totalErrors = tsResult.errorCount + lintResult.errorCount;
  const totalWarnings = tsResult.warningCount + lintResult.warningCount;
  const passed = tsResult.passed && lintResult.passed;
  const durationMs = Date.now() - startTime;

  // Audit log if validation failed
  if (!passed && options.userId) {
    await writeAuditLog({
      userId: options.userId,
      action: "guardrails.code_validation_failed",
      category: "security",
      target: options.workspaceRoot,
      metadata: {
        errorCount: totalErrors,
        warningCount: totalWarnings,
        typescript: tsResult.summary,
        eslint: lintResult.summary,
      },
    });
  }

  logger.info(
    {
      passed,
      errorCount: totalErrors,
      warningCount: totalWarnings,
      durationMs,
      typescript: { passed: tsResult.passed, errors: tsResult.errorCount },
      eslint: { passed: lintResult.passed, errors: lintResult.errorCount },
    },
    "Code validation complete",
  );

  return {
    passed,
    typescript: tsResult,
    eslint: lintResult,
    combined: {
      passed,
      errorCount: totalErrors,
      warningCount: totalWarnings,
      errors: allErrors,
      summary: passed
        ? `Code validation passed (${totalErrors} errors, ${totalWarnings} warnings)`
        : `Code validation failed (${totalErrors} errors, ${totalWarnings} warnings)`,
      durationMs,
      skipped: tsResult.skipped && lintResult.skipped,
      skipReason:
        tsResult.skipped && lintResult.skipped
          ? "All validations skipped"
          : undefined,
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  validateTypeScript,
  validateESLint,
  validateSyntax,
  validateCode,
};
