import { describe, it, expect, beforeEach } from "vitest";
import { licenseService } from "../services/licenseService.js";

describe("LicenseService", () => {
  beforeEach(() => {
    licenseService._clearActivatedLicenses();
  });

  describe("validateLicenseKey", () => {
    it("accepts valid PRO key", async () => {
      const result = await licenseService.validateLicenseKey(
        "GRUMP-PRO-abcdef1234567890",
      );
      expect(result).toEqual({ valid: true, tier: "pro" });
    });

    it("accepts valid TEAM key (case-insensitive)", async () => {
      const result = await licenseService.validateLicenseKey(
        "GRUMP-TEAM-abcdef1234567890",
      );
      expect(result).toEqual({ valid: true, tier: "team" });
    });

    it("accepts valid ENTERPRISE key", async () => {
      const result = await licenseService.validateLicenseKey(
        "GRUMP-ENTERPRISE-abcdef1234567890",
      );
      expect(result).toEqual({ valid: true, tier: "enterprise" });
    });

    it("rejects key with wrong prefix", async () => {
      const result = await licenseService.validateLicenseKey(
        "INVALID-PRO-abcdef1234567890",
      );
      expect(result.valid).toBe(false);
    });

    it("rejects key with short hash", async () => {
      const result = await licenseService.validateLicenseKey("GRUMP-PRO-abc");
      expect(result.valid).toBe(false);
    });

    it("rejects empty string", async () => {
      const result = await licenseService.validateLicenseKey("");
      expect(result.valid).toBe(false);
    });

    it("rejects key with non-hex characters in hash", async () => {
      const result = await licenseService.validateLicenseKey(
        "GRUMP-PRO-zzzzzzzzzzzzzzzz",
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("activateLicense", () => {
    it("activates a valid key", async () => {
      const ok = await licenseService.activateLicense(
        "user-1",
        "GRUMP-PRO-abcdef1234567890",
      );
      expect(ok).toBe(true);
    });

    it("rejects an invalid key", async () => {
      const ok = await licenseService.activateLicense("user-1", "BAD-KEY");
      expect(ok).toBe(false);
    });

    it("activated license is reflected in status", async () => {
      await licenseService.activateLicense(
        "user-1",
        "GRUMP-TEAM-abcdef1234567890",
      );
      const status = await licenseService.getLicenseStatus("user-1");
      expect(status.tier).toBe("team");
      expect(status.type).toBe("lifetime_license");
      expect(status.active).toBe(true);
    });
  });

  describe("getLicenseStatus", () => {
    it("returns free trial for no userId", async () => {
      const status = await licenseService.getLicenseStatus();
      expect(status.tier).toBe("free");
      expect(status.type).toBe("trial");
    });

    it("returns subscription tier for user without activated key", async () => {
      const status = await licenseService.getLicenseStatus("some-user");
      expect(status.type).toBe("subscription");
      expect(status.active).toBe(true);
    });
  });
});
