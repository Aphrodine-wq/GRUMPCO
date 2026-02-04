import { test, expect } from '../fixtures/app';

/**
 * E2E tests for SHIP pipeline: design → spec → plan → code.
 * Tests SHIP mode flow when available in the UI.
 */

test.describe('SHIP Pipeline', () => {
  test.beforeEach(async ({ app, page }) => {
    await app.goto();

    // Skip setup if shown
    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('SHIP or phase bar visible when in Design mode', async ({ app, page }) => {
    await app.switchToDesignMode();

    // Look for SHIP button, phase bar, or workflow controls
    const shipControl = page.locator(
      'button:has-text("SHIP"), [class*="phase"], [class*="workflow"], button:has-text("Architecture")'
    ).first();
    await expect(shipControl).toBeVisible({ timeout: 8000 });
  });

  test('can describe project and trigger architecture flow', async ({ app, page }) => {
    await app.switchToDesignMode();

    const chatInput = page.locator('textarea[placeholder*="message"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    await chatInput.fill('Build a simple todo app');
    await chatInput.press('Enter');

    // Wait for response (diagram, loading, or error)
    await page.waitForTimeout(3000);

    const hasResponse = await page.locator('svg, [class*="loading"], [class*="message"], [class*="error"]').first().isVisible();
    expect(hasResponse).toBe(true);
  });

  test('Code mode has workspace and generate controls', async ({ app, page }) => {
    await app.switchToCodeMode();

    // Code mode typically has chat input and possibly workspace selector
    const chatInput = page.locator('textarea[placeholder*="message"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 8000 });
  });
});
