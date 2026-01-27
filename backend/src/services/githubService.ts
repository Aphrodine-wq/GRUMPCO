/**
 * GitHub service: OAuth, create repo, push generated code.
 * Uses fetch + child_process for git. Env: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { getRequestLogger } from '../middleware/logger.js';
import logger from '../middleware/logger.js';
import { getSession } from './agentOrchestrator.js';

const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/github/callback';
const FRONTEND_REDIRECT = process.env.GITHUB_FRONTEND_REDIRECT || 'http://localhost:5178';
const TOKEN_FILE = join(process.cwd(), '.github-token');

export function getCallbackRedirectSuccess(): string {
  return `${FRONTEND_REDIRECT}/?github=ok`;
}

export function getCallbackRedirectError(message: string): string {
  return `${FRONTEND_REDIRECT}/?github=error&message=${encodeURIComponent(message)}`;
}

function getStoredToken(): string | null {
  try {
    if (existsSync(TOKEN_FILE)) {
      return readFileSync(TOKEN_FILE, 'utf8').trim();
    }
  } catch {
    /* ignore */
  }
  return null;
}

function storeToken(token: string): void {
  writeFileSync(TOKEN_FILE, token, 'utf8');
  logger.info('GitHub token stored');
}

/**
 * Return GitHub OAuth authorize URL.
 */
export function getAuthUrl(): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error('GITHUB_CLIENT_ID not set');
  }
  const scope = 'repo';
  return `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}`;
}

/**
 * Exchange code for access token. Store it. Return token.
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const log = getRequestLogger();
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set');
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token?: string; error?: string };
  if (data.error || !data.access_token) {
    throw new Error(data.error || 'No access_token in response');
  }

  storeToken(data.access_token);
  log.info('GitHub token exchanged and stored');
  return data.access_token;
}

/**
 * Get stored GitHub token, or null.
 */
export function getToken(): string | null {
  return getStoredToken();
}

/**
 * Create a GitHub repo. Returns clone URL.
 */
export async function createRepo(repoName: string, token: string): Promise<string> {
  const log = getRequestLogger();
  const res = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: repoName,
      private: false,
      auto_init: false,
    }),
  });

  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(err.message || `Create repo failed: ${res.status}`);
  }

  const repo = (await res.json()) as { clone_url: string; html_url?: string };
  log.info({ repoName, url: repo.clone_url }, 'GitHub repo created');
  return repo.clone_url;
}

/**
 * Write generated files to dir, git init, add, commit, remote add, push.
 */
function pushToRepo(dir: string, cloneUrl: string, token: string): void {
  const authUrl = cloneUrl.replace('https://', `https://${token}@`);
  execSync('git init', { cwd: dir });
  execSync('git config user.email "grump@local"', { cwd: dir });
  execSync('git config user.name "G-Rump"', { cwd: dir });
  execSync('git add -A', { cwd: dir });
  execSync('git commit -m "Initial commit from G-Rump"', { cwd: dir });
  execSync(`git remote add origin ${authUrl}`, { cwd: dir });
  execSync('git branch -M main', { cwd: dir });
  execSync('git push -u origin main', { cwd: dir });
}

/**
 * Create repo and push session's generated files. Uses stored token or provided token.
 */
export async function createAndPush(
  sessionId: string,
  repoName: string,
  tokenOverride?: string
): Promise<{ repoUrl: string; pushed: boolean }> {
  const log = getRequestLogger();
  const token = tokenOverride ?? getStoredToken();
  if (!token) {
    throw new Error('No GitHub token. Complete OAuth first.');
  }

  const session = getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  if (session.status !== 'completed' || !session.generatedFiles?.length) {
    throw new Error('Code generation not complete or no files');
  }

  const projectName = session.architecture?.projectName ?? session.prdId ?? 'generated-project';
  const cloneUrl = await createRepo(repoName, token);

  const tmp = mkdtempSync(join(tmpdir(), 'grump-'));
  try {
    for (const f of session.generatedFiles) {
      const full = join(tmp, projectName, f.path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, f.content, 'utf8');
    }
    const projectDir = join(tmp, projectName);
    pushToRepo(projectDir, cloneUrl, token);
    log.info({ sessionId, repoName, cloneUrl }, 'Pushed to GitHub');
    return { repoUrl: cloneUrl.replace(/\.git$/, ''), pushed: true };
  } finally {
    try {
      rmSync(tmp, { recursive: true });
    } catch {
      /* ignore */
    }
  }
}
