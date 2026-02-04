import { test, expect } from '../fixtures/app';

/**
 * E2E tests for Cost Dashboard.
 * Opens app, navigates to cost dashboard, asserts no 404 and meaningful content.
 */

test.describe('Cost Dashboard', () => {
  test('opens cost dashboard and shows content', async ({ app, page }) => {
    await app.goto();

    // Open Settings (sidebar button)
    await page.locator('button[title="Settings"], button[aria-label="Settings"]').click();
    await page.waitForTimeout(500);

    // Open Cost dashboard from Settings
    await page.locator('button:has-text("Cost dashboard")').first().click();
    await page.waitForTimeout(1500);

    // Cost dashboard loads (lazy); expect no error and meaningful content
    const loading = page.locator('text=Loading cost dashboard');
    const error = page.locator('.lazy-cost-dashboard__error');
    const dashboard = page.locator('.cost-dashboard');
    const backBtn = page.locator('button:has-text("Back")');

    await expect(loading.or(error).or(dashboard).or(backBtn)).toBeVisible({ timeout: 10000 });
    await expect(error).toHaveCount(0);

    // Either dashboard visible or we have Back (wrapper loaded)
    const hasBack = await backBtn.isVisible();
    const hasDashboard = await dashboard.isVisible();
    expect(hasBack || hasDashboard).toBe(true);
  });
});
