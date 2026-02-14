/**
 * GitHub integration – repo events, webhook triggers.
 * User links repo; backend subscribes to events; G-Rump can react (e.g. ship from PR description).
 */

import crypto from 'crypto';
import _logger from '../../middleware/logger.js';

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

/**
 * Verify GitHub webhook signature.
 */
export function verifyGitHubWebhook(payload: string | Buffer, signature: string): boolean {
  if (!GITHUB_WEBHOOK_SECRET) return false;
  const expected =
    'sha256=' +
    crypto
      .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
      .update(typeof payload === 'string' ? payload : payload.toString())
      .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Parse GitHub webhook event and extract actionable intent.
 */
export function parseGitHubEvent(
  event: string,
  payload: {
    action?: string;
    pull_request?: { body?: string };
    issue?: { body?: string };
  }
): { intent?: 'ship' | 'chat'; description?: string } | null {
  if (event === 'pull_request' && payload.action === 'opened') {
    const body = payload.pull_request?.body ?? '';
    if (body.includes('ship:') || body.toLowerCase().includes('ship ')) {
      const match = body.match(/ship:\s*(.+)/i) ?? body.match(/ship\s+(.+)/i);
      return {
        intent: 'ship',
        description: match?.[1]?.trim() ?? body.slice(0, 500),
      };
    }
  }
  if (event === 'issues' && payload.action === 'opened') {
    const body = payload.issue?.body ?? '';
    if (body.toLowerCase().includes('ship') || body.toLowerCase().includes('build')) {
      return { intent: 'ship', description: body.slice(0, 500) };
    }
  }
  return null;
}
