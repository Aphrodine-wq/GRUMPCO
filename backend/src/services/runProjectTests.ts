/**
 * Run the project's test command (e.g. npm test) in a workspace after codegen.
 * Used to verify generated code passes tests; result is attached to the codegen response.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT_MS = 60_000;

export interface RunProjectTestsResult {
  passed: boolean;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

/**
 * Run the test command in the given workspace (e.g. npm test).
 * Returns passed: true only if exit code is 0. If no package.json or no test script, returns passed: true with exitCode 0 (no-op).
 */
export async function runProjectTests(
  workspaceRoot: string,
  options: { timeoutMs?: number; testScript?: string } = {}
): Promise<RunProjectTestsResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const resolvedRoot = path.resolve(workspaceRoot);

  try {
    if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
      return {
        passed: true,
        exitCode: 0,
        error: 'Workspace root is not a directory; skipping tests',
      };
    }

    const packagePath = path.join(resolvedRoot, 'package.json');
    if (!fs.existsSync(packagePath)) {
      return { passed: true, exitCode: 0, error: 'No package.json; skipping tests' };
    }

    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as {
      scripts?: { test?: string };
    };
    if (!pkg?.scripts?.test && !options.testScript) {
      return { passed: true, exitCode: 0, error: 'No test script in package.json; skipping tests' };
    }

    const command = options.testScript ?? 'npm test';

    const { stdout, stderr } = await execAsync(command, {
      cwd: resolvedRoot,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, CI: 'true' },
    });

    return {
      passed: true,
      exitCode: 0,
      stdout: stdout?.slice(0, 2000),
      stderr: stderr?.slice(0, 1000),
    };
  } catch (err: unknown) {
    const execErr = err as {
      code?: number;
      killed?: boolean;
      signal?: string;
      stdout?: string;
      stderr?: string;
    };
    const exitCode = typeof execErr.code === 'number' ? execErr.code : 1;
    return {
      passed: false,
      exitCode,
      stdout: execErr.stdout?.slice(0, 2000),
      stderr: execErr.stderr?.slice(0, 1000),
      error: execErr.killed ? 'Tests timed out' : (execErr as Error).message,
    };
  }
}
