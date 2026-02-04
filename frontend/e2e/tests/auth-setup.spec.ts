import { test, expect } from '../fixtures/app';

/**
 * E2E tests for Auth and Setup flows.
 * Tests first-run SetupScreen, API key setup guidance, and settings navigation.
 */

test.describe('Auth & Setup', () => {
  test('SetupScreen appears on first load or when preferences cleared', async ({ app, page }) => {
    await app.goto();

    // SetupScreen shows Welcome/Preferences or Skip/Get Started
    const setupContent = page.locator('text=Welcome, text=Preferences, text=Skip, text=Get Started').first();
    await expect(setupContent).toBeVisible({ timeout: 10000 });
  });

  test('can skip setup and reach main app', async ({ app, page }) => {
    await app.goto();

    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }

    // Main app: chat input or mode tabs
    const chatInput = page.locator('textarea[placeholder*="message"], input[type="text"]').first();
    const designTab = page.locator('button:has-text("Design")');
    await expect(chatInput.or(designTab)).toBeVisible({ timeout: 10000 });
  });

  test('Settings opens and has API key / cost dashboard options', async ({ app, page }) => {
    await app.goto();

    // Skip setup if shown
    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }

    // Open Settings
    await page.locator('button[title="Settings"], button[aria-label="Settings"]').click();
    await page.waitForTimeout(500);

    // Settings screen should show Cost dashboard or API key related content
    const settingsContent = page.locator('button:has-text("Cost dashboard"), text=API, text=Settings').first();
    await expect(settingsContent).toBeVisible({ timeout: 5000 });
  });
});
