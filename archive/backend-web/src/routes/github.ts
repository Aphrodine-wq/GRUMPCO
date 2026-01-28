/**
 * GitHub integration routes - OAuth and repo create/push.
 */
import express, { Request, Response, Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { createRepoAndPushFiles } from '../services/githubService.js'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
const router: Router = express.Router()

/** GET /api/github/auth - redirect URL for OAuth */
router.get('/auth', (_req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    res.status(502).json({ error: 'GitHub OAuth not configured' })
    return
  }
  const redirect =
    process.env.GITHUB_CALLBACK_URL ||
    `${process.env.API_URL || 'http://localhost:3000'}/api/github/callback`
  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&scope=repo`
  res.json({ url })
})

/** GET /api/github/callback - OAuth callback (exchange code for token) */
router.get('/callback', (req: Request, res: Response) => {
  const code = req.query.code as string
  if (!code) {
    res.status(400).json({ error: 'Missing code' })
    return
  }
  logger.info({ hasCode: !!code }, 'GitHub OAuth callback')
  res.redirect(
    302,
    (process.env.WEB_APP_URL || 'http://localhost:5178') + '/#/settings?github=connected'
  )
})

/** POST /api/github/create-and-push - create repo and push files. Requires token in body. */
router.post(
  '/create-and-push',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const { repoName, files, token } = req.body as {
      repoName?: string
      files?: Record<string, string>
      token?: string
    }
    if (!repoName || typeof repoName !== 'string' || !repoName.trim()) {
      res.status(400).json({ error: 'repoName required' })
      return
    }
    if (!files || typeof files !== 'object' || !Object.keys(files).length) {
      res.status(400).json({ error: 'files required (non-empty object)' })
      return
    }
    if (!token || typeof token !== 'string' || !token.trim()) {
      res.status(400).json({ error: 'token required (GitHub PAT with repo scope)' })
      return
    }
    const trimName = repoName.trim()
    if (!/^[a-zA-Z0-9._-]+$/.test(trimName)) {
      res.status(400).json({ error: 'repoName must be alphanumeric, dots, hyphens, underscores only' })
      return
    }
    const fileMap: Record<string, string> = {}
    for (const [path, content] of Object.entries(files)) {
      if (typeof path !== 'string' || typeof content !== 'string') continue
      if (path.includes('..') || path.startsWith('/')) continue
      fileMap[path] = content
    }
    if (!Object.keys(fileMap).length) {
      res.status(400).json({ error: 'At least one valid file path required' })
      return
    }
    const result = await createRepoAndPushFiles(trimName, fileMap, token.trim())
    if (result.error) {
      res.status(502).json({ error: result.error })
      return
    }
    res.json({ url: result.url })
  }
)

export default router
