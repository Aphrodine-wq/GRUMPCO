/**
 * Shared intent CLI runner for main process and worker threads.
 * Spawns grump-intent, returns structured intent JSON.
 * Also supports plan generation via the `plan` subcommand.
 */

import fs from 'fs';
import { spawn } from 'child_process';
import { resolve } from 'path';
import logger from '../../middleware/logger.js';

export interface StructuredIntent {
  actors: string[];
  features: string[];
  data_flows: string[];
  tech_stack_hints: string[];
  constraints: Record<string, unknown>;
  raw: string;
}

// Task and Plan types matching Rust planner output
export type RiskLevel = 'safe' | 'moderate' | 'risky';
export type PlanStatus =
  | 'awaiting_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type TaskStatus =
  | 'pending'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface Task {
  id: string;
  description: string;
  feature: string;
  action: string;
  tools: string[];
  risk: RiskLevel;
  depends_on: string[];
  blocks: string[];
  estimated_seconds: number;
  priority: number;
  parallelizable: boolean;
  status?: TaskStatus;
}

export interface PlanRiskAssessment {
  level: RiskLevel;
  safe_count: number;
  moderate_count: number;
  risky_count: number;
  risk_factors: string[];
  auto_approvable: boolean;
}

export interface Plan {
  id: string;
  goal: string;
  tasks: Task[];
  execution_order: string[];
  parallel_batches: string[][];
  status: PlanStatus;
  risk: PlanRiskAssessment;
  confidence: number;
  estimated_duration: number;
  project_type: string;
  architecture_pattern: string;
  tech_stack: string[];
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
    const msvcPath = resolve(
      root,
      'intent-compiler',
      'target',
      'x86_64-pc-windows-msvc',
      'release',
      exe
    );
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

/**
 * Generate an execution plan using the Rust intent compiler's `plan` subcommand.
 * Parses natural language goal into a structured plan with tasks, dependencies, and risk assessment.
 */
export function runPlanCli(goal: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Plan> {
  const bin = getIntentCompilerPath();
  // Use the 'plan' subcommand with --input flag
  const args: string[] = ['plan', '--input', goal.trim()];

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
      logger.warn({ timeoutMs }, 'Plan generator timed out, killing process');
      killAndReject(`Plan generator timed out after ${timeoutMs}ms`);
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err: Error) => {
      clearTimeout(timer);
      logger.error({ err, bin }, 'Plan generator spawn failed');
      killAndReject(`Plan generator failed: ${err.message}`);
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      if (settled) return;
      if (code !== 0) {
        logger.warn({ code, stderr }, 'Plan generator non-zero exit');
        killAndReject(`Plan generator exited ${code}: ${stderr || 'see logs'}`);
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as Plan;
        if (!parsed.goal || !Array.isArray(parsed.tasks)) {
          killAndReject('Invalid plan generator output');
          return;
        }
        // Ensure plan has required fields
        parsed.status = parsed.status || 'awaiting_approval';
        parsed.id = parsed.id || `plan-${Date.now()}`;
        settled = true;
        resolvePromise(parsed);
      } catch {
        logger.error({ stdout: stdout.slice(0, 500) }, 'Plan generator invalid JSON');
        killAndReject('Plan generator returned invalid JSON');
      }
    });
  });
}
