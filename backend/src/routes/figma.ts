/**
 * Figma OAuth and API proxy for Design-to-Code (Architecture mode).
 * - GET /api/figma/auth-url – OAuth authorization URL
 * - GET /api/figma/callback – OAuth callback (code → tokens)
 * - GET /api/figma/me – connection status
 * - GET /api/figma/files – list user files (proxy)
 * - GET /api/figma/files/:fileKey – file document/nodes (proxy)
 */
import { Router, type Request, type Response } from 'express';
import { env } from '../config/env.js';
import logger from '../middleware/logger.js';

const router = Router();

const FIGMA_OAUTH_AUTH = 'https://www.figma.com/oauth';
const FIGMA_OAUTH_TOKEN = 'https://api.figma.com/v1/oauth/token';
const FIGMA_API_BASE = 'https://api.figma.com/v1';

// In-memory token store (single user / device). Use DB in production.
const DEFAULT_USER = 'default';
interface FigmaTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}
const tokenStore = new Map<string, FigmaTokens>();

function getStoredToken(userId: string = DEFAULT_USER): FigmaTokens | undefined {
  return tokenStore.get(userId);
}

function setStoredToken(userId: string, tokens: FigmaTokens): void {
  tokenStore.set(userId, tokens);
}

function getFigmaConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.FIGMA_CLIENT_ID ?? env.FIGMA_CLIENT_ID;
  const clientSecret = process.env.FIGMA_CLIENT_SECRET ?? env.FIGMA_CLIENT_SECRET;
  const redirectUri =
    process.env.FIGMA_REDIRECT_URI ?? env.FIGMA_REDIRECT_URI ?? `${env.PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/figma/callback`;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

/**
 * GET /api/figma/auth-url
 * Returns the Figma OAuth authorization URL.
 */
router.get('/auth-url', (_req: Request, res: Response): void => {
  const config = getFigmaConfig();
  if (!config) {
    res.status(503).json({
      error: 'Figma OAuth not configured',
      hint: 'Set FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET in environment',
    });
    return;
  }
  const state = `grump_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'files:read',
    response_type: 'code',
    state,
  });
  const url = `${FIGMA_OAUTH_AUTH}?${params.toString()}`;
  res.json({ url, state });
});

/**
 * GET /api/figma/callback?code=...&state=...
 * Exchanges authorization code for tokens and stores them.
 */
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code) {
    res.status(400).send('<html><body><p>Missing code</p><script>window.close()</script></body></html>');
    return;
  }
  const config = getFigmaConfig();
  if (!config) {
    res.status(503).send('<html><body><p>Figma not configured</p><script>window.close()</script></body></html>');
    return;
  }
  try {
    const tokenRes = await fetch(FIGMA_OAUTH_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      logger.warn({ status: tokenRes.status, body: errText }, 'Figma token exchange failed');
      res.status(400).send(`<html><body><p>Token exchange failed</p><script>window.close()</script></body></html>`);
      return;
    }
    const data = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const expiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined;
    setStoredToken(DEFAULT_USER, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    });
    res.send(
      `<html><body><p>Figma connected. You can close this window.</p><script>window.close(); setTimeout(function(){ window.close(); }, 500);</script></body></html>`
    );
    return;
  } catch (err) {
    logger.error({ err }, 'Figma callback error');
    res.status(500).send('<html><body><p>Error connecting Figma</p><script>window.close()</script></body></html>');
    return;
  }
});

/**
 * GET /api/figma/me
 * Returns whether Figma is connected (has stored token).
 */
router.get('/me', (_req: Request, res: Response): void => {
  const token = getStoredToken();
  res.json({ connected: !!token?.accessToken });
});

/**
 * GET /api/figma/files
 * Proxies to Figma REST API: list files the user can access.
 */
router.get('/files', async (_req: Request, res: Response): Promise<void> => {
  const token = getStoredToken();
  if (!token?.accessToken) {
    res.status(401).json({ error: 'Figma not connected', connected: false });
    return;
  }
  try {
    const apiRes = await fetch(`${FIGMA_API_BASE}/me/files`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      logger.warn({ status: apiRes.status }, 'Figma files list failed');
      res.status(apiRes.status).json({ error: 'Figma API error', details: errText });
      return;
    }
    const data = await apiRes.json();
    res.json(data);
    return;
  } catch (err) {
    logger.error({ err }, 'Figma files proxy error');
    res.status(502).json({ error: 'Failed to fetch Figma files' });
    return;
  }
});

/**
 * GET /api/figma/files/:fileKey
 * Proxies to Figma REST API: get file document (includes nodes for frame picker).
 */
router.get('/files/:fileKey', async (req: Request, res: Response): Promise<void> => {
  const token = getStoredToken();
  if (!token?.accessToken) {
    res.status(401).json({ error: 'Figma not connected', connected: false });
    return;
  }
  const { fileKey } = req.params;
  if (!fileKey) {
    res.status(400).json({ error: 'Missing fileKey' });
    return;
  }
  try {
    const apiRes = await fetch(`${FIGMA_API_BASE}/files/${fileKey}`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      res.status(apiRes.status).json({ error: 'Figma API error', details: errText });
      return;
    }
    const data = await apiRes.json();
    res.json(data);
    return;
  } catch (err) {
    logger.error({ err }, 'Figma file proxy error');
    res.status(502).json({ error: 'Failed to fetch Figma file' });
    return;
  }
});

export default router;
