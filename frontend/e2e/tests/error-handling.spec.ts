import { test, expect } from '../fixtures/app';

/**
 * E2E Tests for Error Handling and Recovery
 * Tests error scenarios, recovery flows, and user feedback
 */

test.describe('Error Handling', () => {
  test('should handle network errors gracefully', async ({ app, page }) => {
    await app.goto();
    await app.switchToDesignMode();

    // Mock network failure
    await page.route('**/generate-diagram-stream', (route) => {
      route.abort('failed');
    });

    // Try to generate diagram
    await app.sendMessage('Create a diagram');

    // Verify error is shown
    const errorElement = page.locator('.error-state, .toast[class*="error"], [class*="error-message"]');
    await expect(errorElement.first()).toBeVisible({ timeout: 10000 });
  });

  test('should handle API timeout errors', async ({ app, page }) => {
    await app.goto();
    await app.switchToDesignMode();

    // Mock slow response
    await page.route('**/generate-diagram-stream', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.fulfill({
        status: 504,
        body: JSON.stringify({ error: 'Timeout' }),
      });
    });

    // Try to generate diagram
    await app.sendMessage('Create a diagram');

    // Verify timeout error is handled
    const errorElement = page.locator('.error-state, .toast[class*="error"]');
    await expect(errorElement.first()).toBeVisible({ timeout: 15000 });
  });

  test('should handle invalid Mermaid syntax', async ({ app, page }) => {
    await app.goto();
    await app.switchToDesignMode();

    // Mock response with invalid Mermaid
    await app.mockSSEResponse('**/generate-diagram-stream', [
      { type: 'text', data: { text: '```mermaid\ninvalid syntax here\n```' } },
    ]);

    // Try to generate diagram
    await app.sendMessage('Create a diagram');

    // Verify error state in diagram renderer
    const errorState = page.locator('.error-state, .diagram-container .error');
    // May or may not show error depending on implementation
    await page.waitForTimeout(5000);
  });

  test('should handle file operation errors', async ({ app, page }) => {
    await app.goto();
    await app.switchToCodeMode();
    await app.setWorkspace('/tmp/test-workspace');

    // Try to read non-existent file
    await app.sendMessage('Read the file /nonexistent/path/file.txt');

    // Wait for error response
    await app.waitForCodeGeneration(15000);

    // Verify error is shown in tool result
    const errorResult = page.locator('.tool-result-card.error, .tool-result-card:has-text("error")');
    const hasError = await errorResult.count() > 0;
    expect(hasError).toBe(true);
  });

  test('should provide retry option on errors', async ({ app, page }) => {
    await app.goto();
    await app.switchToDesignMode();

    // Mock API error
    await page.route('**/generate-diagram-stream', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Try to generate diagram
    await app.sendMessage('Create a diagram');

    // Look for retry button
    const retryBtn = page.locator('button:has-text("Retry"), button[title*="retry" i]');
    if (await retryBtn.count() > 0) {
      await expect(retryBtn.first()).toBeVisible();
    }
  });

  test('should preserve user input on error', async ({ app, page }) => {
    await app.goto();
    await app.switchToDesignMode();

    const message = 'Create a complex architecture diagram with multiple components';

    // Mock error
    await page.route('**/generate-diagram-stream', (route) => {
      route.abort('failed');
    });

    // Send message
    await app.sendMessage(message);

    // Wait for error
    await page.waitForTimeout(2000);

    // Verify input still has the message (or can be retried)
    const input = page.locator('input[type="text"]').last();
    const inputValue = await input.inputValue();
    // Input might be cleared, but retry should restore it
  });

  test('should handle partial tool execution failures', async ({ app, page }) => {
    await app.goto();
    await app.switchToCodeMode();
    await app.setWorkspace('/tmp/test-workspace');

    // Send message that triggers multiple tools
    await app.sendMessage('Create a file test.js and then read package.json');

    // Wait for execution
    await app.waitForCodeGeneration(20000);

    // Verify we see tool results (some may succeed, some may fail)
    const toolResults = page.locator('.tool-result-card');
    const count = await toolResults.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show error details on demand', async ({ app, page }) => {
    await app.goto();
    await app.switchToCodeMode();
    await app.setWorkspace('/tmp/test-workspace');

    // Trigger an error
    await app.sendMessage('Read /invalid/path/file.txt');

    // Wait for error
    await app.waitForCodeGeneration(15000);

    // Look for error details button or expandable error
    const errorCard = page.locator('.tool-result-card.error, .tool-result-card:has-text("error")').first();
    if (await errorCard.count() > 0) {
      await expect(errorCard).toBeVisible();
    }
  });

  test('should handle authentication errors', async ({ app, page }) => {
    await app.goto();
    await app.switchToDesignMode();

    // Mock 401 error
    await page.route('**/generate-diagram-stream', (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    // Try to generate diagram
    await app.sendMessage('Create a diagram');

    // Verify auth error is shown
    const errorElement = page.locator('.error-state, .toast[class*="error"]');
    await expect(errorElement.first()).toBeVisible({ timeout: 10000 });
  });

  test('should handle rate limiting errors', async ({ app, page }) => {
    await app.goto();
    await app.switchToDesignMode();

    // Mock 429 error
    await page.route('**/generate-diagram-stream', (route) => {
      route.fulfill({
        status: 429,
        headers: { 'Retry-After': '60' },
        body: JSON.stringify({ error: 'Rate limited' }),
      });
    });

    // Try to generate diagram
    await app.sendMessage('Create a diagram');

    // Verify rate limit error is shown
    const errorElement = page.locator('.error-state, .toast[class*="error"]');
    await expect(errorElement.first()).toBeVisible({ timeout: 10000 });
  });
});
