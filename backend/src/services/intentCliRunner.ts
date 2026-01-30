/**
 * Shared intent CLI runner for main process and worker threads.
 * Spawns grump-intent, returns structured intent JSON.
 */

import fs from 'fs';
import { spawn } from 'child_process';
import { resolve } from 'path';
import logger from '../middleware/logger.js';

export interface StructuredIntent {
  actors: string[];
  features: string[];
  data_flows: string[];
  tech_stack_hints: string[];
  constraints: Record<string, unknown>;
  raw: string;
}

export function getIntentCompilerPath(): string {
  const override = process.env.GRUMP_INTENT_PATH;
  if (override) return override;

  if (process.env.NODE_ENV === 'production') {
    const appDataDir = process.env.APPDATA || process.env.LOCALAPPDATA || process.cwd();
    const bundledPath = resolve(appDataDir, 'grump-intent.exe');
    if (fs.existsSync(bundledPath)) return bundledPath;
  }

  const root = resolve(process.cwd(), '..');
  const exe = process.platform === 'win32' ? 'grump-intent.exe' : 'grump-intent';
  const devPath = resolve(root, 'intent-compiler', 'target', 'release', exe);

  if (process.platform === 'win32' && !fs.existsSync(devPath)) {
    const msvcPath = resolve(root, 'intent-compiler', 'target', 'x86_64-pc-windows-msvc', 'release', exe);
    if (fs.existsSync(msvcPath)) return msvcPath;
  }

  return devPath;
}

const DEFAULT_TIMEOUT_MS = 20_000;

export function runIntentCli(
  raw: string,
  constraints?: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<StructuredIntent> {
  const bin = getIntentCompilerPath();
  const args: string[] = ['--input', raw.trim()];
  if (constraints && Object.keys(constraints).length > 0) {
    args.push('--constraints', JSON.stringify(constraints));
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const killAndReject = (reason: string) => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      rejectPromise(new Error(reason));
    };

    const timer = setTimeout(() => {
      logger.warn({ timeoutMs }, 'Intent compiler timed out, killing process');
      killAndReject(`Intent compiler timed out after ${timeoutMs}ms`);
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err: Error) => {
      clearTimeout(timer);
      logger.error({ err, bin }, 'Intent compiler spawn failed');
      killAndReject(`Intent compiler failed: ${err.message}`);
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      if (settled) return;
      if (code !== 0) {
        logger.warn({ code, stderr }, 'Intent compiler non-zero exit');
        killAndReject(`Intent compiler exited ${code}: ${stderr || 'see logs'}`);
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as StructuredIntent;
        if (!parsed.raw || !Array.isArray(parsed.actors)) {
          killAndReject('Invalid intent compiler output');
          return;
        }
        settled = true;
        resolvePromise(parsed);
      } catch {
        logger.error({ stdout: stdout.slice(0, 500) }, 'Intent compiler invalid JSON');
        killAndReject('Intent compiler returned invalid JSON');
      }
    });
  });
}
