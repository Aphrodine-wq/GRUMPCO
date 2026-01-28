/**
 * GitHub routes: OAuth, create-and-push
 */

import { Router, Request, Response } from 'express';
import {
  getAuthUrl,
  exchangeCodeForToken,
  getToken,
  createAndPush,
  getCallbackRedirectSuccess,
  getCallbackRedirectError,
} from '../services/githubService.js';
import { getRequestLogger } from '../middleware/logger.js';
import { sendServerError, getClientErrorMessage } from '../utils/errorResponse.js';

const router = Router();

/**
 * GET /api/github/auth-url
 * Return OAuth authorize URL for frontend to open in browser.
 */
router.get('/auth-url', (_req: Request, res: Response) => {
  try {
    const url = getAuthUrl();
    res.json({ url });
  } catch (e) {
    const err = e as Error;
    sendServerError(res, err);
  }
});

/**
 * GET /api/github/callback?code=...
 * OAuth callback. Exchange code, store token, redirect to frontend.
 */
router.get('/callback', async (req: Request<{}, {}, {}, { code?: string }>, res: Response) => {
  const log = getRequestLogger();
  const code = req.query.code;
  if (!code) {
    res.redirect(getCallbackRedirectError('missing_code'));
    return;
  }
  try {
    await exchangeCodeForToken(code);
    log.info('GitHub OAuth callback success');
    res.redirect(getCallbackRedirectSuccess());
  } catch (e) {
    const err = e as Error;
    log.error({ error: err.message }, 'GitHub OAuth callback failed');
    res.redirect(getCallbackRedirectError(getClientErrorMessage(err)));
  }
});

/**
 * GET /api/github/token
 * Check if token is stored (without revealing it).
 */
router.get('/token', (_req: Request, res: Response) => {
  const hasToken = !!getToken();
  res.json({ hasToken });
});

/**
 * POST /api/github/create-and-push
 * Body: { sessionId: string; repoName: string; token?: string }
 * Create repo and push generated code. Uses stored token unless token provided.
 */
router.post(
  '/create-and-push',
  async (
    req: Request<{}, {}, { sessionId: string; repoName: string; token?: string }>,
    res: Response
  ) => {
    const log = getRequestLogger();
    const { sessionId, repoName, token } = req.body;
    if (!sessionId || !repoName) {
      res.status(400).json({
        error: 'Missing sessionId or repoName',
        type: 'validation_error',
      });
      return;
    }
    try {
      log.info({ sessionId, repoName }, 'Create-and-push requested');
      const result = await createAndPush(sessionId, repoName, token);
      res.json(result);
    } catch (e) {
      const err = e as Error;
      log.error({ error: err.message, sessionId, repoName }, 'Create-and-push failed');
      sendServerError(res, err);
    }
  }
);

export default router;
