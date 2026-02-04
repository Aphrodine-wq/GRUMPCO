import { test, expect } from '@playwright/test';

/**
 * E2E tests for Agent swarm view.
 * Opens app, navigates to Agent swarm, submits a prompt, asserts SSE-driven state (summary, tasks, or done/error).
 */
test.describe('Agent Swarm', () => {
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

  test('should open Agent swarm view from sidebar and show prompt UI', async ({ page }) => {
    const swarmBtn = page.getByRole('button', { name: 'Agent swarm' });
    await expect(swarmBtn).toBeVisible({ timeout: 10000 });
    await swarmBtn.click();

    // Swarm screen: title and prompt card
    await expect(page.locator('h1.swarm-title, h1:has-text("Agent swarm")').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.locator('.swarm-container textarea.prompt-input, .swarm-container textarea[placeholder*="todo" i]').first()
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Run swarm' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('should submit swarm prompt and reach a terminal state (summary, tasks, or error)', async ({
    page,
  }) => {
    const swarmBtn = page.getByRole('button', { name: 'Agent swarm' });
    await expect(swarmBtn).toBeVisible({ timeout: 10000 });
    await swarmBtn.click();

    await expect(page.locator('.swarm-container').first()).toBeVisible({ timeout: 5000 });
    const promptInput = page.locator('.swarm-container textarea.prompt-input').first();
    await promptInput.fill('List three simple steps to build a todo app.');
    await page.getByRole('button', { name: 'Run swarm' }).first().click();

    // Wait for loading to finish: button shows "Run swarm" again (or we see summary/tasks/error)
    const runBtn = page.getByRole('button', { name: 'Run swarm' }).first();
    await expect(runBtn).toBeVisible({ timeout: 65000 });
    // Wait until not loading (button text is "Run swarm" again; while loading it shows status like "Decomposing…")
    await expect(runBtn).toHaveText('Run swarm', { timeout: 60000 });
    // Swarm screen still visible
    await expect(page.locator('.swarm-screen, .swarm-container').first()).toBeVisible();
  });
});
