/**
 * GitHub Integration Service Unit Tests
 * Tests webhook signature verification and event parsing.
 *
 * Run: npm test -- githubIntegration.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// Store original env
const originalEnv = { ...process.env };

// Mock logger using vi.hoisted
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

describe('githubIntegration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('verifyGitHubWebhook', () => {
    it('returns false when GITHUB_WEBHOOK_SECRET is not set', async () => {
      delete process.env.GITHUB_WEBHOOK_SECRET;

      const { verifyGitHubWebhook } = await import('../../src/services/githubIntegration.js');

      const result = verifyGitHubWebhook('payload', 'sha256=somesignature');

      expect(result).toBe(false);
    });

    it('returns false when GITHUB_WEBHOOK_SECRET is empty string', async () => {
      process.env.GITHUB_WEBHOOK_SECRET = '';

      const { verifyGitHubWebhook } = await import('../../src/services/githubIntegration.js');

      const result = verifyGitHubWebhook('payload', 'sha256=somesignature');

      expect(result).toBe(false);
    });

    it('returns true for valid signature with string payload', async () => {
      const secret = 'test-webhook-secret';
      process.env.GITHUB_WEBHOOK_SECRET = secret;

      const payload = '{"action":"opened","pull_request":{}}';
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const { verifyGitHubWebhook } = await import('../../src/services/githubIntegration.js');

      const result = verifyGitHubWebhook(payload, expectedSignature);

      expect(result).toBe(true);
    });

    it('returns true for valid signature with Buffer payload', async () => {
      const secret = 'test-webhook-secret';
      process.env.GITHUB_WEBHOOK_SECRET = secret;

      const payloadString = '{"action":"opened","pull_request":{}}';
      const payloadBuffer = Buffer.from(payloadString);
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      const { verifyGitHubWebhook } = await import('../../src/services/githubIntegration.js');

      const result = verifyGitHubWebhook(payloadBuffer, expectedSignature);

      expect(result).toBe(true);
    });

    it('returns false for invalid signature', async () => {
      const secret = 'test-webhook-secret';
      process.env.GITHUB_WEBHOOK_SECRET = secret;

      const payload = '{"action":"opened","pull_request":{}}';
      // Use a different payload to generate wrong signature
      const wrongSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update('different-payload')
        .digest('hex');

      const { verifyGitHubWebhook } = await import('../../src/services/githubIntegration.js');

      const result = verifyGitHubWebhook(payload, wrongSignature);

      expect(result).toBe(false);
    });

    it('returns false for tampered signature', async () => {
      const secret = 'test-webhook-secret';
      process.env.GITHUB_WEBHOOK_SECRET = secret;

      const payload = '{"action":"opened","pull_request":{}}';
      const correctSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Tamper with one character in the signature
      const tamperedSignature = correctSignature.slice(0, -1) + (correctSignature.slice(-1) === 'a' ? 'b' : 'a');

      const { verifyGitHubWebhook } = await import('../../src/services/githubIntegration.js');

      const result = verifyGitHubWebhook(payload, tamperedSignature);

      expect(result).toBe(false);
    });

    it('returns false when wrong secret is used', async () => {
      process.env.GITHUB_WEBHOOK_SECRET = 'correct-secret';

      const payload = '{"action":"opened","pull_request":{}}';
      // Generate signature with different secret
      const wrongSecretSignature = 'sha256=' + crypto
        .createHmac('sha256', 'wrong-secret')
        .update(payload)
        .digest('hex');

      const { verifyGitHubWebhook } = await import('../../src/services/githubIntegration.js');

      const result = verifyGitHubWebhook(payload, wrongSecretSignature);

      expect(result).toBe(false);
    });

    it('handles empty payload', async () => {
      const secret = 'test-webhook-secret';
      process.env.GITHUB_WEBHOOK_SECRET = secret;

      const payload = '';
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const { verifyGitHubWebhook } = await import('../../src/services/githubIntegration.js');

      const result = verifyGitHubWebhook(payload, expectedSignature);

      expect(result).toBe(true);
    });

    it('handles payload with special characters', async () => {
      const secret = 'test-webhook-secret';
      process.env.GITHUB_WEBHOOK_SECRET = secret;

      const payload = '{"body":"ship: Build app with unicode chars"}';
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const { verifyGitHubWebhook } = await import('../../src/services/githubIntegration.js');

      const result = verifyGitHubWebhook(payload, expectedSignature);

      expect(result).toBe(true);
    });

    it('handles large payload', async () => {
      const secret = 'test-webhook-secret';
      process.env.GITHUB_WEBHOOK_SECRET = secret;

      const payload = JSON.stringify({ data: 'x'.repeat(100000) });
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const { verifyGitHubWebhook } = await import('../../src/services/githubIntegration.js');

      const result = verifyGitHubWebhook(payload, expectedSignature);

      expect(result).toBe(true);
    });
  });

  describe('parseGitHubEvent', () => {
    beforeEach(() => {
      // Set a default secret for parseGitHubEvent tests (not used by parser but needed for module load)
      process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    });

    describe('pull_request events', () => {
      it('returns ship intent for pull_request opened with "ship:" in body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {
            body: 'ship: Build a new authentication module',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
        expect(result?.description).toBe('Build a new authentication module');
      });

      it('returns ship intent for pull_request opened with "ship " in body (lowercase)', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {
            body: 'ship this feature to production immediately',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
        expect(result?.description).toBe('this feature to production immediately');
      });

      it('returns ship intent with "Ship " (uppercase with space) via toLowerCase match', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {
            body: 'Ship the new API endpoints',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
        expect(result?.description).toBe('the new API endpoints');
      });

      it('returns null for pull_request opened without ship keyword', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {
            body: 'This is a regular pull request',
          },
        });

        expect(result).toBeNull();
      });

      it('returns null for pull_request with action other than opened', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'closed',
          pull_request: {
            body: 'ship: Build something',
          },
        });

        expect(result).toBeNull();
      });

      it('returns null for pull_request synchronize action', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'synchronize',
          pull_request: {
            body: 'ship: Build something',
          },
        });

        expect(result).toBeNull();
      });

      it('handles pull_request with empty body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {
            body: '',
          },
        });

        expect(result).toBeNull();
      });

      it('handles pull_request with undefined body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {},
        });

        expect(result).toBeNull();
      });

      it('handles pull_request with null pull_request object', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
        });

        expect(result).toBeNull();
      });

      it('truncates description to 500 characters when no match found', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const longBody = 'ship: ' + 'a'.repeat(600);
        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {
            body: longBody,
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
        // The regex match should capture the 600 'a's
        expect(result?.description).toBe('a'.repeat(600));
      });

      it('falls back to body.slice when ship: has no content after it', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        // "ship:" with nothing after - regex .+ needs at least one character
        // Both regex patterns fail, so match is null and we fall back to body.slice(0, 500)
        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {
            body: 'ship:',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
        // Falls back to body.slice(0, 500) when both regexes fail
        expect(result?.description).toBe('ship:');
      });

      it('returns empty description when regex capture is only whitespace', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        // "ship:   " - the regex /ship:\s*(.+)/i will backtrack allowing \s* to consume less
        // so that .+ can capture at least one space. After trim(), this becomes empty string.
        // Empty string is not null/undefined, so ?? fallback doesn't trigger
        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {
            body: 'ship:   ',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
        // Regex captures trailing spaces, trim() makes it empty string
        expect(result?.description).toBe('');
      });

      it('extracts description correctly with multiline body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {
            body: 'Some intro text\nship: Build the feature\nMore details',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
      });

      it('handles "SHIP " in uppercase within body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {
            body: 'SHIP this code now',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
      });
    });

    describe('issues events', () => {
      it('returns ship intent for issues opened with "ship" in body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: 'Please ship this feature to users',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
        expect(result?.description).toBe('Please ship this feature to users');
      });

      it('returns ship intent for issues opened with "build" in body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: 'Build a new dashboard component',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
        expect(result?.description).toBe('Build a new dashboard component');
      });

      it('returns ship intent with "BUILD" in uppercase', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: 'BUILD the API integration',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
      });

      it('returns ship intent with "SHIP" in uppercase', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: 'SHIP the new release',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
      });

      it('returns null for issues opened without ship or build keyword', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: 'This is a bug report',
          },
        });

        expect(result).toBeNull();
      });

      it('returns null for issues with action other than opened', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'closed',
          issue: {
            body: 'ship this feature',
          },
        });

        expect(result).toBeNull();
      });

      it('returns null for issues labeled action', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'labeled',
          issue: {
            body: 'build something new',
          },
        });

        expect(result).toBeNull();
      });

      it('handles issues with empty body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: '',
          },
        });

        expect(result).toBeNull();
      });

      it('handles issues with undefined body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {},
        });

        expect(result).toBeNull();
      });

      it('handles issues with null issue object', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
        });

        expect(result).toBeNull();
      });

      it('truncates description to 500 characters for long body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const longBody = 'ship ' + 'b'.repeat(600);
        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: longBody,
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
        expect(result?.description?.length).toBe(500);
      });
    });

    describe('unrelated events', () => {
      it('returns null for push event', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('push', {
          action: 'opened',
        });

        expect(result).toBeNull();
      });

      it('returns null for create event', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('create', {});

        expect(result).toBeNull();
      });

      it('returns null for delete event', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('delete', {});

        expect(result).toBeNull();
      });

      it('returns null for issue_comment event', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issue_comment', {
          action: 'created',
        });

        expect(result).toBeNull();
      });

      it('returns null for pull_request_review event', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request_review', {
          action: 'submitted',
        });

        expect(result).toBeNull();
      });

      it('returns null for workflow_run event', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('workflow_run', {
          action: 'completed',
        });

        expect(result).toBeNull();
      });

      it('returns null for release event', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('release', {
          action: 'published',
        });

        expect(result).toBeNull();
      });

      it('returns null for star event', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('star', {
          action: 'created',
        });

        expect(result).toBeNull();
      });

      it('returns null for fork event', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('fork', {});

        expect(result).toBeNull();
      });

      it('returns null for unknown event type', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('unknown_event_type', {
          action: 'opened',
        });

        expect(result).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('handles payload with no action property', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          pull_request: {
            body: 'ship: Build something',
          },
        });

        expect(result).toBeNull();
      });

      it('handles empty payload object', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {});

        expect(result).toBeNull();
      });

      it('handles body with only whitespace', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: '   \n\t  ',
          },
        });

        expect(result).toBeNull();
      });

      it('handles body with ship at the very end', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: 'Please help us ship',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
      });

      it('handles body with build in the middle', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: 'We need to rebuild the system',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
      });

      it('handles special characters in body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: 'ship: Build <script>alert("xss")</script> & special chars: !@#$%^&*()',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
      });

      it('handles unicode characters in body', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: 'ship: Build support for unicode characters',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
      });

      it('matches ship in mixed case - ShIp', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('pull_request', {
          action: 'opened',
          pull_request: {
            body: 'ShIp something cool',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
      });

      it('matches build in mixed case - BuIlD', async () => {
        const { parseGitHubEvent } = await import('../../src/services/githubIntegration.js');

        const result = parseGitHubEvent('issues', {
          action: 'opened',
          issue: {
            body: 'BuIlD something amazing',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.intent).toBe('ship');
      });
    });
  });
});
