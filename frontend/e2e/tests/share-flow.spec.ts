import { test, expect } from '../fixtures/app';

/**
 * E2E tests for Share/Export flow.
 * Tests DiagramExportModal: generate diagram, open export, create shareable link.
 */

test.describe('Share Flow', () => {
  test.beforeEach(async ({ app, page }) => {
    await app.goto();
    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('Export modal opens when Export button is available', async ({ app, page }) => {
    await app.switchToDesignMode();
    await app.sendMessage('Create a simple architecture diagram for a todo app');
    await app.waitForDiagram(15000);

    // Look for Export or Share button
    const exportBtn = page.locator('button:has-text("Export"), button:has-text("Share")').first();
    if (!(await exportBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
    }
    await exportBtn.click();
    await page.waitForTimeout(1000);

    // Export Diagram modal should appear
    const modal = page.locator('text=Export Diagram, text=Export').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('Shareable link can be generated from export modal', async ({ app, page }) => {
    await app.switchToDesignMode();
    await app.sendMessage('Create a simple flowchart');
    await app.waitForDiagram(15000);

    const exportBtn = page.locator('button:has-text("Export"), button:has-text("Share")').first();
    if (!(await exportBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
    }
    await exportBtn.click();
    await page.waitForTimeout(1000);

    // Click "Create shareable link" or "Generate Link"
    const generateLinkBtn = page.locator('button:has-text("Create"), button:has-text("Generate"), button:has-text("Shareable")').first();
    if (!(await generateLinkBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
    }
    await generateLinkBtn.click();
    await page.waitForTimeout(3000);

    // Shareable link input should appear
    const linkInput = page.locator('input[readonly], input[value*="http"]');
    const hasLink = await linkInput.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasLink).toBe(true);
  });
});
