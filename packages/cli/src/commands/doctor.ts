/**
 * G-Rump Doctor - System diagnostic (NVIDIA/AMD GPU, Docker, AI providers, integrations).
 */
import { spawnSync } from 'child_process';
import { platform } from 'os';
import chalk from 'chalk';
import { branding } from '../branding.js';
import { config } from '../config.js';

interface DoctorOptions {
  fix?: boolean;
  json?: boolean;
}

function run(cmd: string, args: string[] = []): { ok: boolean; stdout: string; stderr: string } {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 5000 });
    return { ok: r.status === 0, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
  } catch {
    return { ok: false, stdout: '', stderr: '' };
  }
}

async function checkNode(): Promise<{ ok: boolean; version?: string }> {
  const v = process.version;
  const major = parseInt(v.slice(1).split('.')[0], 10);
  return { ok: major >= 18, version: v };
}

async function checkDocker(): Promise<{ installed: boolean; running: boolean; version?: string }> {
  const ver = run('docker', ['--version']);
  if (!ver.ok) return { installed: false, running: false };
  const info = run('docker', ['info']);
  const running = ver.ok && info.ok && !info.stderr.includes('Cannot connect');
  const versionMatch = ver.stdout.match(/Docker version ([^,]+)/);
  return {
    installed: true,
    running,
    version: versionMatch ? versionMatch[1] : ver.stdout,
  };
}

async function checkGpu(): Promise<{ vendor: 'nvidia' | 'amd' | 'none'; name?: string; driver?: string }> {
  const nvidia = run('nvidia-smi', ['--query-gpu=name,driver_version', '--format=csv,noheader']);
  if (nvidia.ok && nvidia.stdout) {
    const [name, driver] = nvidia.stdout.split(',').map((s) => s.trim());
    return { vendor: 'nvidia', name: name || undefined, driver: driver || undefined };
  }
  if (platform() === 'win32') {
    try {
      const r = spawnSync(
        'powershell',
        ['-NoProfile', '-Command', 'Get-WmiObject Win32_VideoController | Select-Object Name | ConvertTo-Json'],
        { encoding: 'utf8', timeout: 5000 }
      );
      if (r.status === 0 && r.stdout) {
        const data = JSON.parse(r.stdout);
        const adapters = Array.isArray(data) ? data : [data];
        const amd = adapters.find((a: { Name?: string }) => a?.Name && String(a.Name).toLowerCase().includes('amd'));
        if (amd) return { vendor: 'amd', name: amd.Name };
      }
    } catch {
      // ignore
    }
  } else {
    const rocm = run('rocm-smi', ['--showproductname']);
    if (rocm.ok && rocm.stdout && rocm.stdout.includes('GPU')) {
      return { vendor: 'amd', name: 'AMD GPU (ROCm)' };
    }
  }
  return { vendor: 'none' };
}

async function checkNvidiaToolkit(): Promise<{ installed: boolean; version?: string }> {
  const r = run('nvidia-ctk', ['--version']);
  return { installed: r.ok, version: r.ok ? r.stdout : undefined };
}

async function checkApi(apiUrl: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/health/quick`, { method: 'GET' });
    const data = (await res.json()) as { status?: string };
    return { ok: data?.status === 'healthy', message: data?.status ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function execute(options: DoctorOptions): Promise<void> {
  console.log(branding.getLogo('compact'));
  console.log(branding.format('G-Rump System Diagnostic', 'subtitle'));
  console.log(branding.getDivider());

  const apiUrl = config.get('apiUrl') ?? process.env.GRUMP_API_URL ?? 'http://localhost:3000';

  const node = await checkNode();
  const docker = await checkDocker();
  const gpu = await checkGpu();
  const nvidiaToolkit = await checkNvidiaToolkit();
  const api = await checkApi(apiUrl);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          environment: { node: node.version, platform: platform(), apiUrl },
          docker: { installed: docker.installed, running: docker.running, version: docker.version },
          gpu: { vendor: gpu.vendor, name: gpu.name, driver: gpu.driver },
          nvidiaToolkit: { installed: nvidiaToolkit.installed, version: nvidiaToolkit.version },
          api: { ok: api.ok, message: api.message },
        },
        null,
        2
      )
    );
    return;
  }

  console.log('\nEnvironment');
  console.log('  Node.js:', node.ok ? chalk.green(node.version) : chalk.red(node.version));
  console.log('  npm:', run('npm', ['--version']).ok ? chalk.green(run('npm', ['--version']).stdout) : chalk.red('not found'));
  console.log('  OS:', platform());

  console.log('\nDocker');
  console.log('  Installed:', docker.installed ? chalk.green('Yes') : chalk.red('No'));
  if (docker.installed) {
    console.log('  Version:', docker.version ?? 'unknown');
    console.log('  Running:', docker.running ? chalk.green('Yes') : chalk.yellow('No'));
  }

  console.log('\nGPU');
  if (gpu.vendor === 'nvidia') {
    console.log('  Vendor:', chalk.green('NVIDIA'));
    console.log('  Name:', gpu.name ?? 'unknown');
    console.log('  Driver:', gpu.driver ?? 'unknown');
    console.log('  nvidia-container-toolkit:', nvidiaToolkit.installed ? chalk.green('Yes') : chalk.yellow('No'));
  } else if (gpu.vendor === 'amd') {
    console.log('  Vendor:', chalk.green('AMD'));
    console.log('  Name:', gpu.name ?? 'AMD GPU');
    console.log('  ROCm/Docker: See deploy/docker-compose.rocm.yml');
  } else {
    console.log('  Vendor:', chalk.dim('None detected (CPU-only or cloud)'));
  }

  console.log('\nAI Providers (API)');
  console.log('  Backend:', apiUrl);
  console.log('  Health:', api.ok ? chalk.green('Connected') : chalk.red(api.message ?? 'Unreachable'));

  console.log('\n' + branding.getDivider());
  if (options.fix) {
    console.log(chalk.dim('Run without --fix to see diagnostics only. Auto-fix not implemented yet.'));
  }
  console.log(chalk.dim("Run 'grump doctor --fix' to attempt automatic fixes."));
}

export const doctorCommand = { execute };
