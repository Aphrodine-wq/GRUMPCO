/**
 * Run the project's lint command (e.g. npm run lint) in a workspace after codegen.
 * Result is attached to the codegen response for top-tier output quality.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT_MS = 30_000;

export interface RunProjectLintResult {
  passed: boolean;
  exitCode: number;
  output?: string;
  error?: string;
}

/**
 * Run the lint command in the given workspace (e.g. npm run lint).
 * If no lint script in package.json, returns passed: true (skip).
 */
export async function runProjectLint(
  workspaceRoot: string,
  options: { timeoutMs?: number } = {}
): Promise<RunProjectLintResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const resolvedRoot = path.resolve(workspaceRoot);

  try {
    if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
      return {
        passed: true,
        exitCode: 0,
        error: 'Workspace root is not a directory; skipping lint',
      };
    }

    const packagePath = path.join(resolvedRoot, 'package.json');
    if (!fs.existsSync(packagePath)) {
      return {
        passed: true,
        exitCode: 0,
        error: 'No package.json; skipping lint',
      };
    }

    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as {
      scripts?: { lint?: string };
    };
    if (!pkg?.scripts?.lint) {
      return {
        passed: true,
        exitCode: 0,
        error: 'No lint script in package.json; skipping lint',
      };
    }

    const { stdout, stderr } = await execAsync('npm run lint', {
      cwd: resolvedRoot,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });

    const output = [stdout, stderr].filter(Boolean).join('\n').slice(0, 2000);
    return { passed: true, exitCode: 0, output: output || undefined };
  } catch (err: unknown) {
    const execErr = err as { code?: number; stdout?: string; stderr?: string };
    const exitCode = typeof execErr.code === 'number' ? execErr.code : 1;
    const output = [execErr.stdout, execErr.stderr].filter(Boolean).join('\n').slice(0, 2000);
    return {
      passed: false,
      exitCode,
      output: output || undefined,
      error: (err as Error).message,
    };
  }
}
