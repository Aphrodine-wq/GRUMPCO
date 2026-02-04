/**
 * License Service unit tests.
 * Run: npm test -- licenseService.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/pricing.js', () => {
  const features: Record<string, string[]> = {
    free: ['basic'],
    pro: ['basic', 'pro'],
    team: ['basic', 'pro', 'team'],
    enterprise: ['basic', 'pro', 'team', 'enterprise'],
  };
  return {
    TIERS: Object.fromEntries(
      Object.entries(features).map(([id, f]) => [id, { features: f }])
    ),
    getTier: vi.fn((id: string) => ({ id, features: features[id] ?? features.free })),
  };
});

vi.mock('../../src/services/featureFlagsService.js', () => ({
  getTierForUser: vi.fn((userId: string) => (userId === 'pro-user' ? 'pro' : 'free')),
}));

const { licenseService } = await import('../../src/services/licenseService.js');

describe('LicenseService', () => {
  beforeEach(() => {
    licenseService._clearActivatedLicenses();
  });

  describe('getLicenseStatus', () => {
    it('returns free tier when userId is undefined', async () => {
      const status = await licenseService.getLicenseStatus(undefined);
      expect(status.active).toBe(true);
      expect(status.tier).toBe('free');
      expect(status.type).toBe('trial');
      expect(status.features).toBeDefined();
    });

    it('returns subscription tier from getTierForUser when no license key', async () => {
      const status = await licenseService.getLicenseStatus('pro-user');
      expect(status.active).toBe(true);
      expect(status.tier).toBe('pro');
      expect(status.type).toBe('subscription');
    });

    it('returns lifetime_license when key activated for user', async () => {
      const key = 'GRUMP-PRO-a1b2c3d4e5f6789012345678';
      await licenseService.activateLicense('user-1', key);
      const status = await licenseService.getLicenseStatus('user-1');
      expect(status.active).toBe(true);
      expect(status.tier).toBe('pro');
      expect(status.type).toBe('lifetime_license');
      expect(status.expiresAt).toBeDefined();
    });
  });

  describe('validateLicenseKey', () => {
    it('rejects invalid format', async () => {
      const result = await licenseService.validateLicenseKey('invalid');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('accepts valid GRUMP-TIER-hex format', async () => {
      const result = await licenseService.validateLicenseKey('GRUMP-PRO-abcdef0123456789');
      expect(result.valid).toBe(true);
      expect(result.tier).toBe('pro');
    });

    it('accepts enterprise tier key', async () => {
      const result = await licenseService.validateLicenseKey('GRUMP-ENTERPRISE-a1b2c3d4e5f6789012345678901234567890123456789012345678901234');
      expect(result.valid).toBe(true);
      expect(result.tier).toBe('enterprise');
    });
  });

  describe('activateLicense', () => {
    it('returns false for invalid key', async () => {
      const ok = await licenseService.activateLicense('user-1', 'bad-key');
      expect(ok).toBe(false);
    });

    it('returns true and persists activation for valid key', async () => {
      const ok = await licenseService.activateLicense('user-1', 'GRUMP-TEAM-1234567890abcdef');
      expect(ok).toBe(true);
      const status = await licenseService.getLicenseStatus('user-1');
      expect(status.tier).toBe('team');
      expect(status.type).toBe('lifetime_license');
    });
  });
});
