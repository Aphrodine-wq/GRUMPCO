/**
 * Ephemeral Sandbox Service
 *
 * Provides isolated execution environments for AI-generated code.
 * Supports three backend strategies:
 *
 *  1. Docker  – spins up a container, runs code, destroys the container
 *  2. E2B     – uses the E2B cloud sandbox API (Firecracker microVMs)
 *  3. Local   – falls back to restricted child_process (existing behavior)
 *
 * Each run is ephemeral: the sandbox is created, code is executed,
 * output is captured, and the sandbox is destroyed immediately.
 *
 * @module services/security/sandboxService
 */

import { spawn, execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export type SandboxBackend = 'docker' | 'e2b' | 'local';

export interface SandboxConfig {
  /** Which sandbox backend to use. @default 'local' */
  backend: SandboxBackend;
  /** Max execution time in ms. @default 30_000 */
  timeout: number;
  /** Max memory in MB (docker only). @default 256 */
  memoryLimitMb: number;
  /** Max CPU count (docker only). @default 1 */
  cpuLimit: number;
  /** Whether to allow network access. @default false */
  networkEnabled: boolean;
  /** Docker image to use. @default 'node:20-slim' */
  dockerImage: string;
  /** E2B API key (from env). */
  e2bApiKey?: string;
  /** E2B template ID. @default 'base' */
  e2bTemplate?: string;
  /** Working directory inside the sandbox. @default '/sandbox' */
  workDir: string;
  /** Environment variables to pass into the sandbox. */
  env?: Record<string, string>;
}

export interface SandboxResult {
  /** Unique execution ID */
  executionId: string;
  /** Whether execution succeeded (exit code 0) */
  success: boolean;
  /** Combined stdout */
  stdout: string;
  /** Combined stderr */
  stderr: string;
  /** Process exit code */
  exitCode: number;
  /** Wall-clock execution time in ms */
  executionTimeMs: number;
  /** Whether the execution was killed due to timeout */
  timedOut: boolean;
  /** Which backend was used */
  backend: SandboxBackend;
}

export interface SandboxFile {
  /** Path relative to the sandbox workDir */
  path: string;
  /** File content */
  content: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: SandboxConfig = {
  backend: (process.env.SANDBOX_BACKEND as SandboxBackend) || 'local',
  timeout: parseInt(process.env.SANDBOX_TIMEOUT || '30000', 10),
  memoryLimitMb: parseInt(process.env.SANDBOX_MEMORY_MB || '256', 10),
  cpuLimit: parseInt(process.env.SANDBOX_CPU_LIMIT || '1', 10),
  networkEnabled: process.env.SANDBOX_NETWORK === 'true',
  dockerImage: process.env.SANDBOX_DOCKER_IMAGE || 'node:20-slim',
  e2bApiKey: process.env.E2B_API_KEY,
  e2bTemplate: process.env.E2B_TEMPLATE || 'base',
  workDir: '/sandbox',
};

// ============================================================================
// Dangerous Command Classifier
// ============================================================================

/** Patterns that should NEVER run outside a sandbox */
const SANDBOX_REQUIRED_PATTERNS = [
  /\b(rm|del|rmdir)\s+-r/i, // Recursive delete
  /\b(curl|wget)\s+.*\|.*sh\b/i, // Piping download to shell
  /\bchmod\s+[0-7]*7[0-7]*/, // World-writable permissions
  /\bnc\b.*-[el]/i, // netcat listening
  /\bsudo\b/i, // Privilege escalation
  /\beval\b.*\$/i, // Dynamic eval with variables
  /\\x[0-9a-f]{2}/i, // Hex-encoded payloads
  /\bbase64\s+-d/i, // Base64 decode (obfuscation)
  /\bpython\b.*-c\b/i, // Python one-liners
  /\bnode\b.*-e\b/i, // Node one-liners
];

/** Commands that are completely blocked even in sandboxes */
const ABSOLUTE_BLOCK_PATTERNS = [
  /\brm\s+-rf\s+\/(?:\s|$)/, // rm -rf /
  /\bdd\s+.*of=\/dev\//, // dd to raw device
  /\bmkfs\b/, // Format filesystem
  /\bfdisk\b/, // Partition management
  /:(){ :|:& };:/, // Fork bomb
];

/**
 * Classify whether a command requires sandbox execution.
 */
export function classifySandboxRequirement(command: string): {
  requiresSandbox: boolean;
  absolutelyBlocked: boolean;
  reason: string;
} {
  // Check absolute blocks first
  for (const pattern of ABSOLUTE_BLOCK_PATTERNS) {
    if (pattern.test(command)) {
      return {
        requiresSandbox: false,
        absolutelyBlocked: true,
        reason: `Absolutely blocked: matches pattern ${pattern.source}`,
      };
    }
  }

  // Check sandbox-required patterns
  for (const pattern of SANDBOX_REQUIRED_PATTERNS) {
    if (pattern.test(command)) {
      return {
        requiresSandbox: true,
        absolutelyBlocked: false,
        reason: `Requires sandbox: matches pattern ${pattern.source}`,
      };
    }
  }

  return {
    requiresSandbox: false,
    absolutelyBlocked: false,
    reason: 'Command appears safe for direct execution',
  };
}

// ============================================================================
// Sandbox Service
// ============================================================================

export class SandboxService {
  private config: SandboxConfig;

  constructor(config?: Partial<SandboxConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a command in an ephemeral sandbox.
   *
   * @param command  Shell command to run
   * @param files    Optional files to inject into the sandbox before execution
   * @returns        Execution result with stdout, stderr, exit code
   */
  async execute(command: string, files?: SandboxFile[]): Promise<SandboxResult> {
    const executionId = randomUUID();
    const startTime = Date.now();

    // Pre-check: absolutely blocked commands
    const classification = classifySandboxRequirement(command);
    if (classification.absolutelyBlocked) {
      return {
        executionId,
        success: false,
        stdout: '',
        stderr: classification.reason,
        exitCode: -1,
        executionTimeMs: Date.now() - startTime,
        timedOut: false,
        backend: this.config.backend,
      };
    }

    logger.info(
      { executionId, backend: this.config.backend, command: command.slice(0, 200) },
      'Sandbox execution starting'
    );

    try {
      switch (this.config.backend) {
        case 'docker':
          return await this.executeDocker(executionId, command, files, startTime);
        case 'e2b':
          return await this.executeE2B(executionId, command, files, startTime);
        case 'local':
        default:
          return await this.executeLocal(executionId, command, startTime);
      }
    } catch (error) {
      logger.error({ error, executionId }, 'Sandbox execution failed');
      return {
        executionId,
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: -1,
        executionTimeMs: Date.now() - startTime,
        timedOut: false,
        backend: this.config.backend,
      };
    }
  }

  /**
   * Check if the configured backend is available.
   */
  async isAvailable(): Promise<boolean> {
    switch (this.config.backend) {
      case 'docker':
        return this.isDockerAvailable();
      case 'e2b':
        return !!this.config.e2bApiKey;
      case 'local':
        return true;
    }
  }

  // --------------------------------------------------------------------------
  // Docker Backend
  // --------------------------------------------------------------------------

  private async executeDocker(
    executionId: string,
    command: string,
    files: SandboxFile[] | undefined,
    startTime: number
  ): Promise<SandboxResult> {
    const containerName = `sandbox-${executionId}`;

    // Build docker run command
    const dockerArgs = [
      'run',
      '--rm', // auto-remove on exit
      '--name',
      containerName,
      '--memory',
      `${this.config.memoryLimitMb}m`,
      '--cpus',
      String(this.config.cpuLimit),
      '--pids-limit',
      '100', // prevent fork bombs
      '--read-only', // read-only root filesystem
      '--tmpfs',
      `${this.config.workDir}:rw,noexec,size=64m`, // writable work dir
      '--no-new-privileges', // prevent privilege escalation
      '--security-opt',
      'no-new-privileges:true',
    ];

    // Network isolation
    if (!this.config.networkEnabled) {
      dockerArgs.push('--network', 'none');
    }

    // Environment variables
    if (this.config.env) {
      for (const [key, value] of Object.entries(this.config.env)) {
        dockerArgs.push('-e', `${key}=${value}`);
      }
    }

    dockerArgs.push('-w', this.config.workDir, this.config.dockerImage);

    // If we need to inject files, create a setup script
    let fullCommand = command;
    if (files && files.length > 0) {
      const fileSetup = files
        .map((f) => {
          const escaped = f.content.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
          const dir = f.path.split('/').slice(0, -1).join('/');
          return `mkdir -p "${dir}" 2>/dev/null; printf '%s' '${escaped}' > "${f.path}"`;
        })
        .join(' && ');
      fullCommand = `${fileSetup} && ${command}`;
    }

    dockerArgs.push('sh', '-c', fullCommand);

    return new Promise<SandboxResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn('docker', dockerArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        // Cap output to prevent memory exhaustion
        if (stdout.length > 1024 * 1024) {
          stdout = stdout.slice(0, 1024 * 1024) + '\n...[output truncated at 1MB]';
          proc.kill('SIGKILL');
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        if (stderr.length > 512 * 1024) {
          stderr = stderr.slice(0, 512 * 1024) + '\n...[stderr truncated at 512KB]';
        }
      });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
        // Force-remove the container in case --rm didn't trigger
        try {
          execSync(`docker rm -f ${containerName}`, { stdio: 'ignore', timeout: 5000 });
        } catch {
          // Container may already be removed
        }
      }, this.config.timeout);

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          executionId,
          success: code === 0 && !timedOut,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? -1,
          executionTimeMs: Date.now() - startTime,
          timedOut,
          backend: 'docker',
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          executionId,
          success: false,
          stdout: '',
          stderr: err.message,
          exitCode: -1,
          executionTimeMs: Date.now() - startTime,
          timedOut: false,
          backend: 'docker',
        });
      });
    });
  }

  private isDockerAvailable(): boolean {
    try {
      execSync('docker info', { stdio: 'ignore', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // E2B Backend (Cloud Sandbox)
  // --------------------------------------------------------------------------

  private async executeE2B(
    executionId: string,
    command: string,
    files: SandboxFile[] | undefined,
    startTime: number
  ): Promise<SandboxResult> {
    // E2B integration — uses @e2b/code-interpreter when available
    try {
      // Dynamic import to avoid hard dependency
      // @ts-expect-error — @e2b/code-interpreter is an optional dependency
      const { Sandbox } = (await import('@e2b/code-interpreter')) as {
        Sandbox: {
          create: (opts: { template?: string; apiKey?: string; timeout?: number }) => Promise<{
            filesystem: {
              write: (path: string, content: string) => Promise<void>;
            };
            process: {
              start: (opts: { cmd: string; timeout?: number }) => Promise<{
                exitCode: number;
                stdout: string;
                stderr: string;
              }>;
            };
            kill: () => Promise<void>;
          }>;
        };
      };

      const sandbox = await Sandbox.create({
        template: this.config.e2bTemplate,
        apiKey: this.config.e2bApiKey,
        timeout: this.config.timeout,
      });

      try {
        // Write files into sandbox
        if (files) {
          for (const file of files) {
            await sandbox.filesystem.write(`${this.config.workDir}/${file.path}`, file.content);
          }
        }

        // Execute command
        const result = await sandbox.process.start({
          cmd: command,
          timeout: this.config.timeout,
        });

        return {
          executionId,
          success: result.exitCode === 0,
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
          exitCode: result.exitCode,
          executionTimeMs: Date.now() - startTime,
          timedOut: false,
          backend: 'e2b',
        };
      } finally {
        await sandbox.kill();
      }
    } catch (error) {
      logger.warn({ error, executionId }, 'E2B execution failed, falling back to local');
      return this.executeLocal(executionId, command, startTime);
    }
  }

  // --------------------------------------------------------------------------
  // Local Backend (Restricted child_process)
  // --------------------------------------------------------------------------

  private executeLocal(
    executionId: string,
    command: string,
    startTime: number
  ): Promise<SandboxResult> {
    return new Promise<SandboxResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn('sh', ['-c', command], {
        cwd: process.env.WORKSPACE_ROOT || process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...this.config.env,
          // Restrict PATH to safe locations
          PATH: '/usr/local/bin:/usr/bin:/bin',
        },
      });

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        if (stdout.length > 1024 * 1024) {
          stdout = stdout.slice(0, 1024 * 1024) + '\n...[output truncated]';
          proc.kill('SIGKILL');
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        if (stderr.length > 512 * 1024) {
          stderr = stderr.slice(0, 512 * 1024) + '\n...[stderr truncated]';
        }
      });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
      }, this.config.timeout);

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          executionId,
          success: code === 0 && !timedOut,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? -1,
          executionTimeMs: Date.now() - startTime,
          timedOut,
          backend: 'local',
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          executionId,
          success: false,
          stdout: '',
          stderr: err.message,
          exitCode: -1,
          executionTimeMs: Date.now() - startTime,
          timedOut: false,
          backend: 'local',
        });
      });
    });
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let _instance: SandboxService | null = null;

/** Get the global sandbox service instance */
export function getSandboxService(config?: Partial<SandboxConfig>): SandboxService {
  if (!_instance || config) {
    _instance = new SandboxService(config);
  }
  return _instance;
}
