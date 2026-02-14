/**
 * Runtime Verification Service
 *
 * Verifies generated code works at runtime:
 * - npm install verification
 * - Test execution and pass rate
 * - App startup verification
 * - Build process verification
 *
 * @module services/runtimeVerificationService
 */

import { spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import http from 'http';
import logger from '../../middleware/logger.js';
import { getGuardrailsConfig } from '../../config/guardrailsConfig.js';
import { writeAuditLog } from './auditLogService.js';

// ============================================================================
// TYPES
// ============================================================================

export interface VerificationResult {
  /** Whether verification passed */
  passed: boolean;
  /** Status message */
  message: string;
  /** Exit code if applicable */
  exitCode?: number;
  /** stdout output (truncated) */
  stdout?: string;
  /** stderr output (truncated) */
  stderr?: string;
  /** Duration in ms */
  durationMs: number;
  /** Whether verification was skipped */
  skipped: boolean;
  /** Skip reason if skipped */
  skipReason?: string;
  /** Detailed results (for tests) */
  details?: Record<string, unknown>;
}

export interface TestResult {
  /** Total tests run */
  total: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Skipped tests */
  skipped: number;
  /** Pass rate (0-1) */
  passRate: number;
  /** Failed test names */
  failedTests: string[];
}

export interface RuntimeVerificationOptions {
  /** Working directory */
  workspaceRoot: string;
  /** User ID for audit logging */
  userId?: string;
  /** Custom npm install timeout */
  npmTimeoutMs?: number;
  /** Custom test timeout */
  testTimeoutMs?: number;
  /** Custom app start timeout */
  appStartTimeoutMs?: number;
  /** Port to check for app startup */
  appPort?: number;
  /** Skip npm install */
  skipNpmInstall?: boolean;
  /** Skip tests */
  skipTests?: boolean;
  /** Skip app startup check */
  skipAppStart?: boolean;
  /** Custom test command (e.g., 'npm test', 'yarn test', 'pnpm test') */
  testCommand?: string;
  /** Custom start command */
  startCommand?: string;
}

export interface FullVerificationResult {
  /** Overall pass/fail */
  passed: boolean;
  /** npm install result */
  npmInstall: VerificationResult;
  /** Test execution result */
  tests: VerificationResult & { testResult?: TestResult };
  /** App startup result */
  appStart: VerificationResult;
  /** Build result */
  build: VerificationResult;
  /** Total duration */
  totalDurationMs: number;
  /** Summary message */
  summary: string;
}

// ============================================================================
// NPM INSTALL VERIFICATION
// ============================================================================

/**
 * Verify npm install succeeds
 */
export async function verifyNpmInstall(
  workspaceRoot: string,
  timeoutMs?: number
): Promise<VerificationResult> {
  const config = getGuardrailsConfig();
  const startTime = Date.now();
  const timeout = timeoutMs ?? config.runtimeVerification.npmInstallTimeoutMs;

  // Check if verification is enabled
  if (!config.runtimeVerification.verifyNpmInstall) {
    return {
      passed: true,
      message: 'npm install verification skipped (disabled in config)',
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: 'Disabled in guardrails config',
    };
  }

  // Check if package.json exists
  const packageJsonPath = path.join(workspaceRoot, 'package.json');
  try {
    await fs.access(packageJsonPath);
  } catch {
    return {
      passed: true,
      message: 'npm install skipped (no package.json found)',
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: 'No package.json found',
    };
  }

  return runCommand('npm', ['install', '--prefer-offline'], workspaceRoot, timeout, 'npm install');
}

/**
 * Verify pnpm install succeeds
 */
export async function verifyPnpmInstall(
  workspaceRoot: string,
  timeoutMs?: number
): Promise<VerificationResult> {
  const config = getGuardrailsConfig();
  const startTime = Date.now();
  const timeout = timeoutMs ?? config.runtimeVerification.npmInstallTimeoutMs;

  // Check if pnpm-lock.yaml exists
  const lockPath = path.join(workspaceRoot, 'pnpm-lock.yaml');
  try {
    await fs.access(lockPath);
  } catch {
    return {
      passed: true,
      message: 'pnpm install skipped (no pnpm-lock.yaml found)',
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: 'No pnpm-lock.yaml found',
    };
  }

  return runCommand(
    'pnpm',
    ['install', '--frozen-lockfile'],
    workspaceRoot,
    timeout,
    'pnpm install'
  );
}

/**
 * Detect package manager and run install
 */
export async function verifyPackageInstall(
  workspaceRoot: string,
  timeoutMs?: number
): Promise<VerificationResult> {
  // Detect package manager by lock file
  const lockFiles = [
    { file: 'pnpm-lock.yaml', cmd: 'pnpm', args: ['install'] },
    { file: 'yarn.lock', cmd: 'yarn', args: ['install', '--frozen-lockfile'] },
    { file: 'package-lock.json', cmd: 'npm', args: ['ci'] },
    { file: 'package.json', cmd: 'npm', args: ['install'] }, // Fallback
  ];

  for (const { file, cmd, args } of lockFiles) {
    try {
      await fs.access(path.join(workspaceRoot, file));
      const config = getGuardrailsConfig();
      const timeout = timeoutMs ?? config.runtimeVerification.npmInstallTimeoutMs;
      return runCommand(cmd, args, workspaceRoot, timeout, `${cmd} install`);
    } catch {
      // Try next lock file
    }
  }

  return {
    passed: true,
    message: 'Package install skipped (no package.json found)',
    durationMs: 0,
    skipped: true,
    skipReason: 'No package.json found',
  };
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

/**
 * Run tests and verify pass rate
 */
export async function verifyTests(
  workspaceRoot: string,
  options?: {
    testCommand?: string;
    timeoutMs?: number;
  }
): Promise<VerificationResult & { testResult?: TestResult }> {
  const config = getGuardrailsConfig();
  const startTime = Date.now();
  const timeout = options?.timeoutMs ?? config.runtimeVerification.testTimeoutMs;

  // Check if test verification is enabled
  if (!config.runtimeVerification.runTests) {
    return {
      passed: true,
      message: 'Test verification skipped (disabled in config)',
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: 'Disabled in guardrails config',
    };
  }

  // Check if package.json exists and has test script
  const packageJsonPath = path.join(workspaceRoot, 'package.json');
  let hasTestScript = false;

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    hasTestScript = !!(
      packageJson.scripts?.test &&
      packageJson.scripts.test !== 'echo "Error: no test specified" && exit 1'
    );
  } catch {
    // No package.json or invalid
  }

  if (!hasTestScript && !options?.testCommand) {
    return {
      passed: true,
      message: 'Test verification skipped (no test script found)',
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: 'No test script in package.json',
    };
  }

  // Run tests
  const testCmd = options?.testCommand ?? 'npm test';
  const [cmd, ...args] = testCmd.split(' ');

  const result = await runCommand(cmd, args, workspaceRoot, timeout, 'test execution');

  // Parse test results from output
  const testResult = parseTestOutput(result.stdout ?? '', result.stderr ?? '');

  // Check pass rate
  const minPassRate = config.runtimeVerification.minTestPassRate;
  const passedByRate = testResult.passRate >= minPassRate;
  const passed = result.exitCode === 0 || passedByRate;

  return {
    ...result,
    passed,
    message: passed
      ? `Tests passed (${testResult.passed}/${testResult.total}, ${(testResult.passRate * 100).toFixed(1)}% pass rate)`
      : `Tests failed (${testResult.passed}/${testResult.total}, ${(testResult.passRate * 100).toFixed(1)}% pass rate, min ${minPassRate * 100}% required)`,
    testResult,
    details: { testResult },
  };
}

/**
 * Parse test output to extract results
 * Supports Jest, Mocha, Vitest output formats
 */
function parseTestOutput(stdout: string, stderr: string): TestResult {
  const output = stdout + '\n' + stderr;

  // Default result
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failedTests: string[] = [];

  // Jest format: Tests: X passed, Y failed, Z total
  const jestMatch = output.match(
    /Tests:\s+(?:(\d+)\s+passed,?\s*)?(?:(\d+)\s+failed,?\s*)?(?:(\d+)\s+skipped,?\s*)?(\d+)\s+total/i
  );
  if (jestMatch) {
    passed = parseInt(jestMatch[1] ?? '0', 10);
    failed = parseInt(jestMatch[2] ?? '0', 10);
    skipped = parseInt(jestMatch[3] ?? '0', 10);
    total = parseInt(jestMatch[4], 10);
  }

  // Vitest format: X passed (Y) | Z failed
  const vitestMatch = output.match(/(\d+)\s+passed.*?(\d+)?\s*failed/i);
  if (vitestMatch && !jestMatch) {
    passed = parseInt(vitestMatch[1], 10);
    failed = parseInt(vitestMatch[2] ?? '0', 10);
    total = passed + failed;
  }

  // Mocha format: X passing, Y failing
  const mochaMatch = output.match(/(\d+)\s+passing.*?(\d+)?\s*failing/is);
  if (mochaMatch && !jestMatch && !vitestMatch) {
    passed = parseInt(mochaMatch[1], 10);
    failed = parseInt(mochaMatch[2] ?? '0', 10);
    total = passed + failed;
  }

  // Extract failed test names
  const failedMatches = output.matchAll(/(?:FAIL|✕|✗|×)\s+(.+?)(?:\n|$)/g);
  for (const match of failedMatches) {
    failedTests.push(match[1].trim());
  }

  // If we couldn't parse, assume based on exit code parsing would happen elsewhere
  if (total === 0 && output.includes('passed') && !output.includes('failed')) {
    passed = 1;
    total = 1;
  }

  const passRate = total > 0 ? passed / total : 1;

  return {
    total,
    passed,
    failed,
    skipped,
    passRate,
    failedTests: failedTests.slice(0, 20), // Limit to 20
  };
}

// ============================================================================
// APP STARTUP VERIFICATION
// ============================================================================

/**
 * Verify app starts and responds on expected port
 */
export async function verifyAppStart(
  workspaceRoot: string,
  options?: {
    startCommand?: string;
    port?: number;
    timeoutMs?: number;
  }
): Promise<VerificationResult> {
  const config = getGuardrailsConfig();
  const startTime = Date.now();
  const timeout = options?.timeoutMs ?? config.runtimeVerification.appStartTimeoutMs;
  const port = options?.port ?? config.runtimeVerification.appVerifyPort;

  // Check if app startup verification is enabled
  if (!config.runtimeVerification.verifyAppStart) {
    return {
      passed: true,
      message: 'App startup verification skipped (disabled in config)',
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: 'Disabled in guardrails config',
    };
  }

  // Check if package.json has start script
  const packageJsonPath = path.join(workspaceRoot, 'package.json');
  let hasStartScript = false;

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    hasStartScript = !!(packageJson.scripts?.start || packageJson.scripts?.dev);
  } catch {
    // No package.json
  }

  if (!hasStartScript && !options?.startCommand) {
    return {
      passed: true,
      message: 'App startup verification skipped (no start script found)',
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: 'No start script in package.json',
    };
  }

  const startCmd = options?.startCommand ?? 'npm start';
  const [cmd, ...args] = startCmd.split(' ');

  let proc: ChildProcess | null = null;
  let stdout = '';
  let stderr = '';

  return new Promise((resolve) => {
    proc = spawn(cmd, args, {
      cwd: workspaceRoot,
      shell: true,
      detached: false,
    });

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Poll for the port to become available
    const pollInterval = 500;
    let elapsed = 0;

    const checkPort = async () => {
      if (elapsed >= timeout) {
        proc?.kill('SIGTERM');
        resolve({
          passed: false,
          message: `App did not start within ${timeout}ms`,
          stdout: stdout.substring(0, 2000),
          stderr: stderr.substring(0, 2000),
          durationMs: Date.now() - startTime,
          skipped: false,
        });
        return;
      }

      try {
        const isListening = await checkPortListening(port);
        if (isListening) {
          // Try to make a request
          const responds = await checkHttpResponse(port);
          proc?.kill('SIGTERM');

          resolve({
            passed: responds,
            message: responds
              ? `App started and responding on port ${port}`
              : `App started on port ${port} but not responding to HTTP`,
            stdout: stdout.substring(0, 2000),
            stderr: stderr.substring(0, 2000),
            durationMs: Date.now() - startTime,
            skipped: false,
          });
          return;
        }
      } catch {
        // Port not ready yet
      }

      elapsed += pollInterval;
      setTimeout(checkPort, pollInterval);
    };

    // Start polling after a brief delay
    setTimeout(checkPort, 1000);

    proc.on('close', (code) => {
      // Process exited before we could verify
      if (code !== 0) {
        resolve({
          passed: false,
          exitCode: code ?? undefined,
          message: `App process exited with code ${code}`,
          stdout: stdout.substring(0, 2000),
          stderr: stderr.substring(0, 2000),
          durationMs: Date.now() - startTime,
          skipped: false,
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        passed: false,
        message: `Failed to start app: ${err.message}`,
        durationMs: Date.now() - startTime,
        skipped: false,
      });
    });
  });
}

/**
 * Check if a port is listening
 */
async function checkPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = require('net').createConnection({ port, host: 'localhost' });

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Check if HTTP server responds
 */
async function checkHttpResponse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port, path: '/', method: 'GET', timeout: 3000 },
      (res) => {
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// ============================================================================
// BUILD VERIFICATION
// ============================================================================

/**
 * Verify build process succeeds
 */
export async function verifyBuild(
  workspaceRoot: string,
  options?: {
    buildCommand?: string;
    timeoutMs?: number;
  }
): Promise<VerificationResult> {
  const config = getGuardrailsConfig();
  const startTime = Date.now();
  const timeout = options?.timeoutMs ?? config.runtimeVerification.testTimeoutMs;

  // Check if package.json has build script
  const packageJsonPath = path.join(workspaceRoot, 'package.json');
  let hasBuildScript = false;

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    hasBuildScript = !!packageJson.scripts?.build;
  } catch {
    // No package.json
  }

  if (!hasBuildScript && !options?.buildCommand) {
    return {
      passed: true,
      message: 'Build verification skipped (no build script found)',
      durationMs: Date.now() - startTime,
      skipped: true,
      skipReason: 'No build script in package.json',
    };
  }

  const buildCmd = options?.buildCommand ?? 'npm run build';
  const [cmd, ...args] = buildCmd.split(' ');

  return runCommand(cmd, args, workspaceRoot, timeout, 'build');
}

// ============================================================================
// FULL VERIFICATION
// ============================================================================

/**
 * Run full runtime verification pipeline
 */
export async function runFullVerification(
  options: RuntimeVerificationOptions
): Promise<FullVerificationResult> {
  const startTime = Date.now();
  // Config is available via getGuardrailsConfig() in child functions

  logger.info({ workspaceRoot: options.workspaceRoot }, 'Starting runtime verification');

  // Step 1: npm install
  const npmResult = options.skipNpmInstall
    ? {
        passed: true,
        message: 'npm install skipped by option',
        durationMs: 0,
        skipped: true,
        skipReason: 'Skipped by caller',
      }
    : await verifyPackageInstall(options.workspaceRoot, options.npmTimeoutMs);

  // Step 2: Build (if npm install passed)
  const buildResult = npmResult.passed
    ? await verifyBuild(options.workspaceRoot, {
        timeoutMs: options.testTimeoutMs,
      })
    : {
        passed: false,
        message: 'Build skipped (npm install failed)',
        durationMs: 0,
        skipped: true,
        skipReason: 'npm install failed',
      };

  // Step 3: Tests (if build passed or skipped successfully)
  const testResult =
    (buildResult.passed || buildResult.skipped) && !options.skipTests
      ? await verifyTests(options.workspaceRoot, {
          testCommand: options.testCommand,
          timeoutMs: options.testTimeoutMs,
        })
      : {
          passed: buildResult.passed || buildResult.skipped,
          message: options.skipTests ? 'Tests skipped by option' : 'Tests skipped (build failed)',
          durationMs: 0,
          skipped: true,
          skipReason: options.skipTests ? 'Skipped by caller' : 'Build failed',
        };

  // Step 4: App startup (if requested and previous steps passed)
  const appResult =
    !options.skipAppStart && testResult.passed
      ? await verifyAppStart(options.workspaceRoot, {
          startCommand: options.startCommand,
          port: options.appPort,
          timeoutMs: options.appStartTimeoutMs,
        })
      : {
          passed: testResult.passed,
          message: options.skipAppStart ? 'App startup skipped by option' : 'App startup skipped',
          durationMs: 0,
          skipped: true,
          skipReason: options.skipAppStart
            ? 'Skipped by caller'
            : 'Previous step failed or skipped',
        };

  const totalDurationMs = Date.now() - startTime;
  const passed = npmResult.passed && buildResult.passed && testResult.passed && appResult.passed;

  const summary = [
    `npm: ${npmResult.passed ? 'PASS' : 'FAIL'}`,
    `build: ${buildResult.passed ? 'PASS' : buildResult.skipped ? 'SKIP' : 'FAIL'}`,
    `tests: ${testResult.passed ? 'PASS' : testResult.skipped ? 'SKIP' : 'FAIL'}`,
    `app: ${appResult.passed ? 'PASS' : appResult.skipped ? 'SKIP' : 'FAIL'}`,
  ].join(', ');

  // Audit log
  if (options.userId) {
    await writeAuditLog({
      userId: options.userId,
      action: passed
        ? 'guardrails.runtime_verification_passed'
        : 'guardrails.runtime_verification_failed',
      category: 'security',
      target: options.workspaceRoot,
      metadata: {
        passed,
        summary,
        durationMs: totalDurationMs,
        npm: npmResult.passed,
        build: buildResult.passed,
        tests: testResult.passed,
        app: appResult.passed,
      },
    });
  }

  logger.info(
    {
      passed,
      summary,
      durationMs: totalDurationMs,
    },
    'Runtime verification complete'
  );

  return {
    passed,
    npmInstall: npmResult,
    tests: testResult,
    appStart: appResult,
    build: buildResult,
    totalDurationMs,
    summary: `Runtime verification ${passed ? 'PASSED' : 'FAILED'}: ${summary}`,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Run a command and return result
 */
async function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  description: string
): Promise<VerificationResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn(cmd, args, {
      cwd,
      shell: true,
      timeout: timeoutMs,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      if (timedOut) {
        resolve({
          passed: false,
          message: `${description} timed out after ${timeoutMs}ms`,
          stdout: stdout.substring(0, 2000),
          stderr: stderr.substring(0, 2000),
          durationMs,
          skipped: false,
        });
        return;
      }

      const passed = code === 0;
      resolve({
        passed,
        exitCode: code ?? undefined,
        message: passed
          ? `${description} succeeded`
          : `${description} failed with exit code ${code}`,
        stdout: stdout.substring(0, 2000),
        stderr: stderr.substring(0, 2000),
        durationMs,
        skipped: false,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        passed: false,
        message: `${description} error: ${err.message}`,
        durationMs: Date.now() - startTime,
        skipped: false,
      });
    });
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  verifyNpmInstall,
  verifyPnpmInstall,
  verifyPackageInstall,
  verifyTests,
  verifyAppStart,
  verifyBuild,
  runFullVerification,
};
