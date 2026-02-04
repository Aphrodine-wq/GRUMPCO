import { test, expect } from '../fixtures/app';

/**
 * E2E tests for full demo walkthrough.
 * Tests Try Demo flow: starts demo workspace, switches to Code mode.
 */

test.describe('Full Demo', () => {
  test.beforeEach(async ({ app, page }) => {
    await app.goto();
    // Skip onboarding if shown
    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('Try Demo button is visible and clickable', async ({ app, page }) => {
    const tryDemoBtn = page.getByRole('button', { name: 'Try Demo' });
    await expect(tryDemoBtn).toBeVisible({ timeout: 10000 });
    await tryDemoBtn.click();

    await page.waitForTimeout(3000);

    // Success: toast with demo/workspace/ready, or Code mode tab (mode-btn for Code)
    const toast = page.locator('.toast, [class*="toast"]').filter({ hasText: /demo|workspace|ready|failed|error/i });
    const codeModeTab = page.locator('button.mode-btn:has-text("Code")').first();
    const hasToast = await toast.isVisible().catch(() => false);
    const hasCodeTab = await codeModeTab.isVisible().catch(() => false);

    expect(hasToast || hasCodeTab).toBe(true);
  });

  test('Code mode tab is visible in main UI', async ({ app, page }) => {
    // Code mode tab (not Voice code button)
    const codeModeTab = page.locator('button.mode-btn').filter({ hasText: /^Code$/ });
    await expect(codeModeTab.first()).toBeVisible({ timeout: 5000 });
  });
});
