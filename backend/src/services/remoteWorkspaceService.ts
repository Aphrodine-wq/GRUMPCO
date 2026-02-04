import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import logger from '../middleware/logger.js';

const WORKSPACE_CACHE_DIR = join(tmpdir(), 'grump-workspaces');

// Ensure cache dir exists
if (!existsSync(WORKSPACE_CACHE_DIR)) {
  mkdirSync(WORKSPACE_CACHE_DIR, { recursive: true });
}

export interface RemoteWorkspace {
  url: string;
  localPath: string;
}

export async function loadRemoteWorkspace(repoUrl: string): Promise<RemoteWorkspace> {
  // 1. Sanitize URL to create a folder name
  // simplified: user/repo or just hash it
  const safeName = repoUrl.replace(/[^a-zA-Z0-9-]/g, '_');
  const targetDir = join(WORKSPACE_CACHE_DIR, safeName);

  logger.info(`Requested remote workspace: ${repoUrl} -> ${targetDir}`);

  if (existsSync(targetDir)) {
    // Already cached. Try to pull?
    // For now, let's just assume if it exists we use it, but ideally we'd git pull.
    try {
      logger.info('Updating existing cached workspace...');
      execSync('git pull', { cwd: targetDir, stdio: 'ignore' });
    } catch (_e) {
      logger.warn('Failed to pull latest changes, using cached version.');
    }
    return { url: repoUrl, localPath: targetDir };
  }

  // 2. Clone
  try {
    // Clone depth 1 for speed if we just want to read.
    // But if we want to "work" on it, maybe full clone?
    // Let's do partial clone for now.
    logger.info('Cloning new workspace...');
    execSync(`git clone --depth 1 ${repoUrl} ${targetDir}`);
    return { url: repoUrl, localPath: targetDir };
  } catch (error) {
    logger.error(error, 'Failed to clone remote workspace');
    throw new Error('Failed to clone repository. Check URL and public access.');
  }
}

export function clearWorkspaceCache(): void {
  if (existsSync(WORKSPACE_CACHE_DIR)) {
    rmSync(WORKSPACE_CACHE_DIR, { recursive: true, force: true });
    mkdirSync(WORKSPACE_CACHE_DIR);
  }
}
