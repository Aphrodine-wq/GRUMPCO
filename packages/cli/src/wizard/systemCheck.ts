/**
 * System Requirements Check for G-Rump CLI
 */

import chalk from 'chalk';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import os from 'os';
import { branding } from '../branding.js';

export interface SystemCheckResult {
  passed: boolean;
  nodeVersion: { version: string; ok: boolean };
  npmVersion: { version: string; ok: boolean };
  diskSpace: { available: string; ok: boolean };
  network: { ok: boolean };
  git: { version: string; ok: boolean };
  docker?: { version: string; ok: boolean };
}

interface CheckItem {
  name: string;
  check: () => Promise<{ ok: boolean; value: string }>;
  required: boolean;
}

const MIN_NODE_VERSION = 18;
const MIN_DISK_SPACE_MB = 500;

/**
 * Parse version string to major number
 */
function getMajorVersion(version: string): number {
  const match = version.match(/^v?(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get available disk space in MB
 */
function getDiskSpace(): number {
  try {
    const platform = os.platform();
    if (platform === 'win32') {
      // Windows: use wmic
      const output = execSync('wmic logicaldisk get freespace', { encoding: 'utf-8' });
      const lines = output.trim().split('\n').slice(1);
      const freeBytes = parseInt(lines[0]?.trim() || '0', 10);
      return Math.round(freeBytes / (1024 * 1024));
    } else {
      // Unix: use df
      const output = execSync('df -m . | tail -1', { encoding: 'utf-8' });
      const parts = output.trim().split(/\s+/);
      return parseInt(parts[3] || '0', 10);
    }
  } catch {
    return -1;
  }
}

/**
 * Check if network is available
 */
async function checkNetwork(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://api.github.com', {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get command version safely
 */
function getCommandVersion(command: string): string {
  try {
    return execSync(`${command} --version`, { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Run all system checks
 */
export async function runSystemCheck(): Promise<SystemCheckResult> {
  const checks: CheckItem[] = [
    {
      name: 'Node.js',
      required: true,
      check: async () => {
        const version = process.version;
        const major = getMajorVersion(version);
        return { 
          ok: major >= MIN_NODE_VERSION, 
          value: version 
        };
      }
    },
    {
      name: 'npm',
      required: true,
      check: async () => {
        const version = getCommandVersion('npm');
        return { 
          ok: !!version, 
          value: version || 'Not found' 
        };
      }
    },
    {
      name: 'Disk Space',
      required: true,
      check: async () => {
        const spaceMB = getDiskSpace();
        const ok = spaceMB === -1 || spaceMB >= MIN_DISK_SPACE_MB;
        const value = spaceMB === -1 ? 'Unknown' : `${spaceMB} MB`;
        return { ok, value };
      }
    },
    {
      name: 'Network',
      required: true,
      check: async () => {
        const ok = await checkNetwork();
        return { ok, value: ok ? 'Connected' : 'Offline' };
      }
    },
    {
      name: 'Git',
      required: false,
      check: async () => {
        const version = getCommandVersion('git');
        return { 
          ok: !!version, 
          value: version || 'Not found' 
        };
      }
    },
    {
      name: 'Docker',
      required: false,
      check: async () => {
        const version = getCommandVersion('docker');
        return { 
          ok: !!version, 
          value: version || 'Not found' 
        };
      }
    }
  ];

  const results: SystemCheckResult = {
    passed: true,
    nodeVersion: { version: '', ok: false },
    npmVersion: { version: '', ok: false },
    diskSpace: { available: '', ok: false },
    network: { ok: false },
    git: { version: '', ok: false }
  };

  console.log(chalk.dim('  Checking system requirements...\n'));

  for (const check of checks) {
    const { ok, value } = await check.check();
    const statusIcon = ok 
      ? chalk.green('✓') 
      : check.required 
        ? chalk.red('✗') 
        : chalk.yellow('○');
    
    const statusText = ok
      ? chalk.white(value)
      : check.required
        ? chalk.red(value)
        : chalk.yellow(value);

    console.log(`  ${statusIcon} ${chalk.white(check.name)}: ${statusText}`);

    // Store results
    switch (check.name) {
      case 'Node.js':
        results.nodeVersion = { version: value, ok };
        break;
      case 'npm':
        results.npmVersion = { version: value, ok };
        break;
      case 'Disk Space':
        results.diskSpace = { available: value, ok };
        break;
      case 'Network':
        results.network = { ok };
        break;
      case 'Git':
        results.git = { version: value, ok };
        break;
      case 'Docker':
        results.docker = { version: value, ok };
        break;
    }

    // Check if required item failed
    if (check.required && !ok) {
      results.passed = false;
    }
  }

  console.log();

  if (results.passed) {
    console.log(branding.status('All requirements met!', 'success'));
  } else {
    console.log(branding.status('Some requirements are not met', 'warning'));
    
    if (!results.nodeVersion.ok) {
      console.log(chalk.yellow(`\n  Node.js ${MIN_NODE_VERSION}+ is required. Current: ${results.nodeVersion.version}`));
      console.log(chalk.dim('  Visit https://nodejs.org to install/upgrade.'));
    }
    if (!results.network.ok) {
      console.log(chalk.yellow('\n  Network connection required for API calls.'));
    }
  }

  return results;
}
