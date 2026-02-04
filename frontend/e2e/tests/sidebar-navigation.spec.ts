import { test, expect } from '@playwright/test';

/**
 * Sidebar navigation E2E tests.
 * Verifies that sidebar buttons open the correct screens (Settings, Integrations, Cost).
 */
test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Skip onboarding if present so sidebar is visible
    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('clicking Settings in sidebar opens settings screen', async ({ page }) => {
    const settingsBtn = page.getByRole('button', { name: 'Settings' });
    await expect(settingsBtn).toBeVisible({ timeout: 10000 });
    await settingsBtn.click();

    // Settings screen shows "Settings" heading and/or Back button
    await expect(
      page.locator('h1.settings-title, h1:has-text("Settings"), button:has-text("Back")').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('clicking Integrations in sidebar opens integrations screen', async ({ page }) => {
    const integrationsBtn = page.getByRole('button', { name: 'Integrations' });
    await expect(integrationsBtn).toBeVisible({ timeout: 10000 });
    await integrationsBtn.click();

    // Integrations screen shows Back or Integrations heading
    await expect(
      page.locator('button:has-text("Back"), [class*="integrations"], h1:has-text("Integrations")').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('clicking Audit log in sidebar opens audit log screen', async ({ page }) => {
    const auditLogBtn = page.getByRole('button', { name: 'Audit log' });
    await expect(auditLogBtn).toBeVisible({ timeout: 10000 });
    await auditLogBtn.click();

    await expect(
      page.locator('button:has-text("Back"), [class*="audit"], h1:has-text("Audit")').first()
    ).toBeVisible({ timeout: 5000 });
  });
});
