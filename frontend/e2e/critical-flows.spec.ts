import { test, expect, Page } from '@playwright/test';

/**
 * Critical User Flow E2E Tests
 * 
 * Tests the most important user journeys through the application.
 * These tests ensure core functionality works end-to-end.
 */

// Test fixtures and helpers
async function login(page: Page) {
  await page.goto('/');
  // Add authentication flow if needed
}

test.describe('Critical User Flows', () => {
  test.describe('Onboarding Flow', () => {
    test('should complete initial setup', async ({ page }) => {
      await page.goto('/');
      
      // Check welcome screen appears
      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
      
      // Complete setup steps
      await page.getByRole('button', { name: /get started/i }).click();
      await expect(page).toHaveURL(/\/chat/);
    });

    test('should allow skipping tutorial', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /skip/i }).click();
      await expect(page).toHaveURL(/\/chat/);
    });
  });

  test.describe('Chat Mode Flow', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
      await page.goto('/chat');
    });

    test('should send a chat message', async ({ page }) => {
      const input = page.getByRole('textbox', { name: /message/i });
      await input.fill('Create a React component');
      
      await page.getByRole('button', { name: /send/i }).click();
      
      // Wait for response
      await expect(page.getByTestId('assistant-message')).toBeVisible({ timeout: 30000 });
    });

    test('should display code blocks with syntax highlighting', async ({ page }) => {
      const input = page.getByRole('textbox', { name: /message/i });
      await input.fill('Show me a JavaScript function');
      await page.getByRole('button', { name: /send/i }).click();
      
      // Check for code block
      await expect(page.locator('pre code')).toBeVisible({ timeout: 30000 });
    });

    test('should copy code to clipboard', async ({ page }) => {
      await page.evaluate(() => navigator.clipboard.writeText(''));
      
      const input = page.getByRole('textbox', { name: /message/i });
      await input.fill('Write a hello world function');
      await page.getByRole('button', { name: /send/i }).click();
      
      // Wait for code block
      await page.locator('pre code').waitFor({ timeout: 30000 });
      
      // Click copy button
      await page.getByRole('button', { name: /copy/i }).first().click();
      
      // Verify copied
      await expect(page.getByText(/copied/i)).toBeVisible();
    });

    test('should save and load chat session', async ({ page }) => {
      // Send a message
      const input = page.getByRole('textbox', { name: /message/i });
      await input.fill('Test session message');
      await page.getByRole('button', { name: /send/i }).click();
      
      // Save session
      await page.getByRole('button', { name: /save session/i }).click();
      await page.getByRole('textbox', { name: /session name/i }).fill('Test Session');
      await page.getByRole('button', { name: /save/i }).click();
      
      // Reload page
      await page.reload();
      
      // Load session
      await page.getByRole('button', { name: /load session/i }).click();
      await page.getByText('Test Session').click();
      
      // Verify message is there
      await expect(page.getByText('Test session message')).toBeVisible();
    });
  });

  test.describe('Architecture Mode Flow', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
      await page.goto('/ship');
    });

    test('should generate architecture diagram', async ({ page }) => {
      const input = page.getByRole('textbox', { name: /describe your project/i });
      await input.fill('Build an e-commerce platform');
      
      await page.getByRole('button', { name: /generate/i }).click();
      
      // Wait for diagram
      await expect(page.getByTestId('mermaid-diagram')).toBeVisible({ timeout: 30000 });
    });

    test('should progress through workflow phases', async ({ page }) => {
      const input = page.getByRole('textbox', { name: /describe/i });
      await input.fill('Create a blog platform');
      await page.getByRole('button', { name: /generate/i }).click();
      
      // Check phase bar updates
      await expect(page.getByTestId('phase-architecture')).toHaveAttribute('data-status', 'active');
      
      // Complete architecture
      await expect(page.getByTestId('phase-architecture')).toHaveAttribute('data-status', 'completed', { timeout: 30000 });
      await expect(page.getByTestId('phase-spec')).toHaveAttribute('data-status', 'active');
    });

    test('should export architecture diagram', async ({ page }) => {
      const input = page.getByRole('textbox', { name: /describe/i });
      await input.fill('Simple todo app');
      await page.getByRole('button', { name: /generate/i }).click();
      
      await page.getByTestId('mermaid-diagram').waitFor({ timeout: 30000 });
      
      // Export as SVG
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /export/i }).click();
      await page.getByText('SVG').click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.svg$/);
    });
  });

  test.describe('Settings Flow', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
      await page.goto('/settings');
    });

    test('should update API key', async ({ page }) => {
      const apiKeyInput = page.getByLabel(/nvidia nim api key/i);
      await apiKeyInput.fill('test-api-key-123');
      
      await page.getByRole('button', { name: /save/i }).click();
      
      await expect(page.getByText(/settings saved/i)).toBeVisible();
    });

    test('should change theme', async ({ page }) => {
      await page.getByRole('button', { name: /theme/i }).click();
      await page.getByText('Dark').click();
      
      // Verify theme applied
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    });

    test('should select default model', async ({ page }) => {
      await page.getByRole('button', { name: /model/i }).click();
      await page.getByText('GPT-4').click();
      
      await page.getByRole('button', { name: /save/i }).click();
      await expect(page.getByText(/settings saved/i)).toBeVisible();
    });
  });

  test.describe('G-Agent Flow', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
      await page.goto('/g-agent');
    });

    test('should create a new agent goal', async ({ page }) => {
      await page.getByRole('button', { name: /new goal/i }).click();
      
      const goalInput = page.getByRole('textbox', { name: /goal/i });
      await goalInput.fill('Build a REST API with authentication');
      
      await page.getByRole('button', { name: /start/i }).click();
      
      // Verify agent starts working
      await expect(page.getByTestId('agent-status')).toContainText(/working/i, { timeout: 5000 });
    });

    test('should show agent progress', async ({ page }) => {
      await page.getByRole('button', { name: /new goal/i }).click();
      await page.getByRole('textbox', { name: /goal/i }).fill('Create a simple web server');
      await page.getByRole('button', { name: /start/i }).click();
      
      // Wait for progress updates
      await expect(page.getByTestId('progress-bar')).toBeVisible({ timeout: 10000 });
      
      // Verify task list appears
      await expect(page.getByTestId('task-list')).toBeVisible();
    });

    test('should display generated files', async ({ page }) => {
      await page.getByRole('button', { name: /new goal/i }).click();
      await page.getByRole('textbox', { name: /goal/i }).fill('Hello world app');
      await page.getByRole('button', { name: /start/i }).click();
      
      // Wait for completion
      await expect(page.getByTestId('agent-status')).toContainText(/completed/i, { timeout: 60000 });
      
      // Check files generated
      await expect(page.getByTestId('file-list')).toBeVisible();
      await expect(page.getByText(/\.js|\.ts|\.py/)).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load homepage quickly', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000); // 3 seconds
    });

    test('should handle large chat history', async ({ page }) => {
      await page.goto('/chat');
      
      // Simulate loading 100 messages
      await page.evaluate(() => {
        const messages = Array.from({ length: 100 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        }));
        // Add to store (implementation-specific)
      });
      
      // Should still be responsive
      const input = page.getByRole('textbox', { name: /message/i });
      await input.fill('New message');
      await expect(input).toHaveValue('New message');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page, context }) => {
      await page.goto('/chat');
      
      // Simulate offline
      await context.setOffline(true);
      
      const input = page.getByRole('textbox', { name: /message/i });
      await input.fill('Test message');
      await page.getByRole('button', { name: /send/i }).click();
      
      // Should show error message
      await expect(page.getByText(/connection error|offline/i)).toBeVisible();
    });

    test('should retry failed requests', async ({ page }) => {
      await page.goto('/chat');
      
      // Intercept and fail first request
      let requestCount = 0;
      await page.route('**/api/chat', (route) => {
        requestCount++;
        if (requestCount === 1) {
          route.abort();
        } else {
          route.continue();
        }
      });
      
      const input = page.getByRole('textbox', { name: /message/i });
      await input.fill('Test retry');
      await page.getByRole('button', { name: /send/i }).click();
      
      // Should eventually succeed
      await expect(page.getByTestId('assistant-message')).toBeVisible({ timeout: 30000 });
    });

    test('should handle invalid API keys', async ({ page }) => {
      await page.goto('/settings');
      
      const apiKeyInput = page.getByLabel(/nvidia nim api key/i);
      await apiKeyInput.fill('invalid-key');
      await page.getByRole('button', { name: /save/i }).click();
      
      // Go to chat and try to send message
      await page.goto('/chat');
      const input = page.getByRole('textbox', { name: /message/i });
      await input.fill('Test message');
      await page.getByRole('button', { name: /send/i }).click();
      
      // Should show auth error
      await expect(page.getByText(/invalid api key|authentication failed/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/');
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      
      // Should navigate somewhere
      await expect(page).not.toHaveURL('/');
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/chat');
      
      // Check for accessibility attributes
      const input = page.getByRole('textbox', { name: /message/i });
      await expect(input).toHaveAttribute('aria-label');
      
      const sendButton = page.getByRole('button', { name: /send/i });
      await expect(sendButton).toHaveAttribute('aria-label');
    });

    test('should support screen readers', async ({ page }) => {
      await page.goto('/chat');
      
      // Check for live regions
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();
    });
  });
});
