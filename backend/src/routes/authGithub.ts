/**
 * GitHub OAuth Authentication Routes
 *
 * Handles GitHub OAuth flow for user authentication.
 * Supports both web app and CLI authentication flows.
 */

import express, { type Request, type Response, type Router } from 'express';
import { auth } from '../services/supabaseClient.js';
import { getRequestLogger } from '../middleware/logger.js';

const router: Router = express.Router();

interface GithubAuthQuery {
  cli?: string;
  redirect_uri?: string;
  state?: string;
}

interface GithubAuthCallbackQuery {
  code?: string;
  error?: string;
  state?: string;
}

interface OAuthState {
  cli?: boolean;
  redirect_uri?: string;
  original_state?: string;
}

/**
 * GET /auth/github
 * Initiates GitHub OAuth flow
 *
 * Query params:
 * - cli: Set to 'true' for CLI authentication flow
 * - redirect_uri: CLI callback URL (e.g., http://localhost:9876/callback)
 * - state: Optional state parameter to pass through
 */
router.get('/', async (req: Request<unknown, unknown, unknown, GithubAuthQuery>, res: Response) => {
  const log = getRequestLogger();
  const { cli, redirect_uri, state } = req.query;

  try {
    // Determine the redirect URL based on flow type
    const isCli = cli === 'true';

    // Build state object to pass through OAuth flow
    const oauthState: OAuthState = {};
    if (isCli && redirect_uri) {
      oauthState.cli = true;
      oauthState.redirect_uri = redirect_uri;
    }
    if (state) {
      oauthState.original_state = state;
    }

    // Backend callback URL - always comes back to our server first
    const redirectTo =
      process.env.GITHUB_OAUTH_REDIRECT_URL ||
      `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/github/callback`;

    const { data, error } = await auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo,
        scopes: 'read:user user:email',
      },
    });

    if (error) {
      log.error({ error: error.message }, 'GitHub OAuth init failed');

      if (isCli && redirect_uri) {
        res.redirect(`${redirect_uri}?error=${encodeURIComponent(error.message)}`);
        return;
      }

      res.status(500).json({
        error: 'Failed to initiate GitHub authentication',
        type: 'oauth_init_error',
      });
      return;
    }

    if (data.url) {
      // Append our state to the OAuth URL for CLI flow
      if (isCli && redirect_uri) {
        const url = new URL(data.url);
        url.searchParams.set('state', Buffer.from(JSON.stringify(oauthState)).toString('base64'));
        res.redirect(url.toString());
      } else {
        res.redirect(data.url);
      }
    } else {
      res.status(500).json({
        error: 'No OAuth URL returned',
        type: 'oauth_init_error',
      });
    }
  } catch (err) {
    const error = err as Error;
    log.error({ error: error.message }, 'GitHub OAuth error');
    res.status(500).json({
      error: 'GitHub authentication failed',
      type: 'server_error',
    });
  }
});

/**
 * GET /auth/github/callback
 * Handles GitHub OAuth callback
 *
 * For CLI flow: Redirects to CLI's local server with token
 * For Web flow: Sets cookie and redirects to frontend
 */
router.get(
  '/callback',
  async (req: Request<unknown, unknown, unknown, GithubAuthCallbackQuery>, res: Response) => {
    const log = getRequestLogger();
    const { code, error: oauthError, state } = req.query;

    // Parse state to check if this is a CLI flow
    let oauthState: OAuthState = {};
    if (state) {
      try {
        oauthState = JSON.parse(Buffer.from(String(state), 'base64').toString('utf-8'));
      } catch {
        // State parsing failed, continue with web flow
        log.debug('Failed to parse OAuth state, using web flow');
      }
    }

    const isCli = oauthState.cli === true;
    const cliRedirectUri = oauthState.redirect_uri;

    if (oauthError) {
      log.warn({ error: oauthError }, 'GitHub OAuth callback error');

      if (isCli && cliRedirectUri) {
        res.redirect(
          `${cliRedirectUri}?error=${encodeURIComponent(String(oauthError))}&provider=github`
        );
        return;
      }

      res.redirect(
        `${process.env.FRONTEND_URL || '/'}/login?error=${encodeURIComponent(String(oauthError))}`
      );
      return;
    }

    if (!code) {
      log.warn('GitHub OAuth callback missing code');

      if (isCli && cliRedirectUri) {
        res.redirect(`${cliRedirectUri}?error=missing_code&provider=github`);
        return;
      }

      res.redirect(`${process.env.FRONTEND_URL || '/'}/login?error=missing_code`);
      return;
    }

    try {
      // Exchange code for session
      const { data, error } = await auth.exchangeCodeForSession(String(code));

      if (error) {
        log.error({ error: error.message }, 'GitHub OAuth code exchange failed');

        if (isCli && cliRedirectUri) {
          res.redirect(
            `${cliRedirectUri}?error=${encodeURIComponent(error.message)}&provider=github`
          );
          return;
        }

        res.redirect(
          `${process.env.FRONTEND_URL || '/'}/login?error=${encodeURIComponent(error.message)}`
        );
        return;
      }

      log.info(
        { userId: data.user?.id, email: data.user?.email, cli: isCli },
        'GitHub OAuth login successful'
      );

      // CLI flow: redirect to CLI's local server with token
      if (isCli && cliRedirectUri) {
        const session = data.session as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
        } | null;

        const accessToken = session?.access_token || '';
        const refreshToken = session?.refresh_token || '';
        const expiresIn = session?.expires_in || 3600;
        const userEmail = data.user?.email || '';
        const userId = data.user?.id || '';

        const params = new URLSearchParams({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: String(expiresIn),
          email: userEmail,
          user_id: userId,
          provider: 'github',
        });

        if (oauthState.original_state) {
          params.set('state', oauthState.original_state);
        }

        res.redirect(`${cliRedirectUri}?${params.toString()}`);
        return;
      }

      // Web flow: set cookie and redirect to frontend
      const frontendUrl = process.env.FRONTEND_URL || '/';
      const accessToken = data.session?.access_token || '';

      if (data.session) {
        res.cookie('sb-access-token', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: data.session.expires_in ? data.session.expires_in * 1000 : 3600000,
        });
      }

      res.redirect(`${frontendUrl}/dashboard`);
    } catch (err) {
      const error = err as Error;
      log.error({ error: error.message }, 'GitHub OAuth callback error');

      if (isCli && cliRedirectUri) {
        res.redirect(`${cliRedirectUri}?error=server_error&provider=github`);
        return;
      }

      res.redirect(`${process.env.FRONTEND_URL || '/'}/login?error=server_error`);
    }
  }
);

export default router;
