/**
 * GitHub service - create repo and push files.
 * Uses Octokit with a user-provided token (repo scope).
 */
import { Octokit } from '@octokit/rest'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

const DEFAULT_BRANCH = 'main'

export interface CreateRepoAndPushResult {
  url?: string
  error?: string
}

/**
 * Create a new repository and push files in a single initial commit.
 * Token must have repo scope. Files: path -> content (UTF-8).
 */
export async function createRepoAndPushFiles(
  repoName: string,
  files: Record<string, string>,
  token: string
): Promise<CreateRepoAndPushResult> {
  const octokit = new Octokit({ auth: token })
  try {
    const {
      data: { login: owner },
    } = await octokit.rest.users.getAuthenticated()
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      private: true,
      auto_init: false,
    })
    const fullName = repo.full_name!
    const tree = await buildTree(octokit, owner, repo.name!, files)
    const {
      data: { sha: commitSha },
    } = await octokit.rest.git.createCommit({
      owner,
      repo: repo.name!,
      message: 'Initial commit',
      tree,
      parents: [],
    })
    await octokit.rest.git.createRef({
      owner,
      repo: repo.name!,
      ref: `refs/heads/${DEFAULT_BRANCH}`,
      sha: commitSha,
    })
    const url = repo.html_url || `https://github.com/${fullName}`
    logger.info({ repo: fullName, fileCount: Object.keys(files).length }, 'Create-and-push completed')
    return { url }
  } catch (e) {
    const err = e as Error & { status?: number }
    logger.error({ err: err.message, repoName }, 'Create-and-push failed')
    const msg = err.status === 422 ? 'Repository may already exist or name invalid' : err.message || 'Create-and-push failed'
    return { error: msg }
  }
}

async function buildTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  files: Record<string, string>
): Promise<string> {
  const entries: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = []
  for (const [path, content] of Object.entries(files)) {
    const {
      data: { sha },
    } = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: Buffer.from(content, 'utf8').toString('base64'),
      encoding: 'base64',
    })
    entries.push({ path, mode: '100644', type: 'blob', sha })
  }
  const {
    data: { sha: treeSha },
  } = await octokit.rest.git.createTree({
    owner,
    repo,
    tree: entries,
  })
  return treeSha
}
