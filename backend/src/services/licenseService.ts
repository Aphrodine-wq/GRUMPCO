import { TIERS, type TierId, getTier } from "../config/pricing.js";
import { getTierForUser } from "./featureFlagsService.js";

export interface LicenseStatus {
  active: boolean;
  tier: TierId;
  type: "subscription" | "lifetime_license" | "trial";
  expiresAt?: Date;
  features: string[];
}

/** Format: GRUMP-{TIER}-{hex} */
const LICENSE_KEY_RE = /^GRUMP-(FREE|PRO|TEAM|ENTERPRISE)-[a-f0-9]{16,64}$/i;

function tierFromKey(key: string): TierId | null {
  const match = key.match(LICENSE_KEY_RE);
  if (!match) return null;
  return match[1].toLowerCase() as TierId;
}

// In-memory store (replace with DB in production)
const activatedLicenses = new Map<
  string,
  { key: string; tier: TierId; activatedAt: Date }
>();

/**
 * Service to handle license validation and entitlement checks.
 * Abstracts away the specific source of the license (Stripe subscription, License Key, etc.)
 */
class LicenseService {
  /**
   * Get the current license status for a user.
   */
  async getLicenseStatus(userId?: string): Promise<LicenseStatus> {
    if (!userId) {
      return {
        active: true,
        tier: "free",
        type: "trial",
        features: TIERS.free.features,
      };
    }

    // 1. Check for activated license key
    const activated = activatedLicenses.get(userId);
    if (activated) {
      // Check expiry (lifetime licenses last 100 years from activation)
      const expiresAt = new Date(activated.activatedAt);
      expiresAt.setFullYear(expiresAt.getFullYear() + 100);
      const isExpired = new Date() > expiresAt;

      if (!isExpired) {
        return {
          active: true,
          tier: activated.tier,
          type: "lifetime_license",
          expiresAt,
          features: getTier(activated.tier).features,
        };
      }
      // Expired — fall through to subscription check
    }

    // 2. Check for Stripe Subscription (via feature flags / user tier)
    const tierId = getTierForUser(userId) as TierId;

    return {
      active: true,
      tier: tierId,
      type: "subscription",
      features: getTier(tierId).features,
    };
  }

  /**
   * Validate a license key format and extract tier.
   * Production: implement DB lookup via getDatabase().queryLicenses(key) or
   * JWT verification. Set LICENSE_VERIFY_ENABLED=true when backend validation is available.
   */
  async validateLicenseKey(
    key: string,
  ): Promise<{ valid: boolean; tier?: TierId; message?: string }> {
    const tier = tierFromKey(key);
    if (!tier) {
      return { valid: false, message: "Invalid license key format" };
    }

    // Format valid. When LICENSE_VERIFY_ENABLED=true, add DB lookup or JWT verify here.
    return { valid: true, tier };
  }

  /**
   * Activate a license key for a user, persisting the tier change.
   */
  async activateLicense(userId: string, key: string): Promise<boolean> {
    const validation = await this.validateLicenseKey(key);
    if (!validation.valid || !validation.tier) return false;

    // Persist activation (in-memory; replace with DB write)
    activatedLicenses.set(userId, {
      key,
      tier: validation.tier,
      activatedAt: new Date(),
    });

    return true;
  }

  /** Exposed for testing */
  _clearActivatedLicenses() {
    activatedLicenses.clear();
  }
}

export const licenseService = new LicenseService();
