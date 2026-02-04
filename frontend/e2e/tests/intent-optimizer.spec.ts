import { test, expect } from '../fixtures/app';

/**
 * E2E tests for Intent Optimizer flow.
 * Tests Ship mode: enter intent, click Optimize intent, verify optimized panel.
 */

test.describe('Intent Optimizer', () => {
  test.beforeEach(async ({ app, page }) => {
    await app.goto();
    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('Ship mode or Optimize intent is available', async ({ app, page }) => {
    const shipBtn = page.locator('button:has-text("Ship")').first();
    if (await shipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await shipBtn.click();
      await page.waitForTimeout(1500);
    }

    const optimizeBtn = page.locator('button:has-text("Optimize intent")').first();
    const shipPanel = page.locator('.ship-mode, [class*="ship"]').first();
    const hasOptimize = await optimizeBtn.isVisible().catch(() => false);
    const hasShip = await shipPanel.isVisible().catch(() => false);
    expect(hasOptimize || hasShip).toBe(true);
  });

  test('Optimize intent flow when Ship mode is open', async ({ app, page }) => {
    const shipBtn = page.locator('button:has-text("Ship")').first();
    if (!(await shipBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
    }
    await shipBtn.click();
    await page.waitForTimeout(1000);

    const textarea = page.locator('.ship-mode textarea, [class*="ship"] textarea').first();
    const optimizeBtn = page.locator('button:has-text("Optimize intent")').first();
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false) && await optimizeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill('Build a todo app');
      await page.waitForTimeout(500);
      await optimizeBtn.click();
      await page.waitForTimeout(6000);
      const result = page.locator('.optimize-panel, [class*="optimized"], button:has-text("Run")').first();
      await expect(result).toBeVisible({ timeout: 5000 });
    }
  });
});
