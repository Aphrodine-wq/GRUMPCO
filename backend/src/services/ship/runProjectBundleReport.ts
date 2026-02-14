/**
 * Run build in a frontend workspace and report bundle size.
 * Used after codegen to surface main chunk size (and optionally LCP / Core Web Vitals).
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT_MS = 120_000;

export interface BundleReportResult {
  success: boolean;
  /** Human-readable summary, e.g. "main 420 KB" or "Build failed" */
  summary: string;
  /** Total size in bytes of dist/ (or build/) if available */
  totalBytes?: number;
  /** Path to built output directory */
  outputDir?: string;
  error?: string;
}

/**
 * Detect if workspace looks like a frontend project (has package.json with build script and typical deps).
 */
function isFrontendProject(resolvedRoot: string): boolean {
  const pkgPath = path.join(resolvedRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const scripts = pkg?.scripts ?? {};
    const hasBuild = 'build' in scripts;
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
    const hasFrontendTool =
      deps['vite'] || deps['webpack'] || deps['@vitejs/plugin-react'] || deps['react-scripts'];
    return Boolean(
      hasBuild &&
      (hasFrontendTool || scripts.build?.includes('vite') || scripts.build?.includes('webpack'))
    );
  } catch {
    return false;
  }
}

function dirSize(dir: string): number {
  let total = 0;
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) total += dirSize(full);
    else total += stat.size;
  }
  return total;
}

/**
 * Run npm run build in the workspace and report bundle size from dist/ or build/.
 */
export async function runProjectBundleReport(
  workspaceRoot: string,
  options: { timeoutMs?: number } = {}
): Promise<BundleReportResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const resolvedRoot = path.resolve(workspaceRoot);

  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    return {
      success: false,
      summary: 'Not a directory',
      error: 'Workspace root is not a directory',
    };
  }

  if (!isFrontendProject(resolvedRoot)) {
    return {
      success: false,
      summary: 'Not a frontend project',
      error: 'No frontend build detected; skipping',
    };
  }

  try {
    await execAsync('npm run build', {
      cwd: resolvedRoot,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, CI: 'true', NODE_ENV: 'production' },
    });
  } catch (err: unknown) {
    const execErr = err as {
      killed?: boolean;
      stderr?: string;
      message?: string;
    };
    return {
      success: false,
      summary: 'Build failed',
      error: execErr.killed
        ? 'Build timed out'
        : (execErr.message ?? execErr.stderr ?? 'Build failed'),
    };
  }

  const distPath = path.join(resolvedRoot, 'dist');
  const buildPath = path.join(resolvedRoot, 'build');
  const outDir = fs.existsSync(distPath)
    ? distPath
    : fs.existsSync(buildPath)
      ? buildPath
      : undefined;
  if (!outDir) {
    return {
      success: true,
      summary: 'Build succeeded; no dist/build folder found',
      outputDir: undefined,
    };
  }

  const totalBytes = dirSize(outDir);
  const kb = (totalBytes / 1024).toFixed(1);
  return {
    success: true,
    summary: `total ${kb} KB`,
    totalBytes,
    outputDir: outDir,
  };
}
