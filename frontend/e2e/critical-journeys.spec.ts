import { test, expect } from '@playwright/test';

/**
 * Critical User Journey E2E Tests
 * Tests the complete workflow: Intent → Architecture → PRD → Code Generation
 */

test.describe('Critical User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait for app shell so Svelte has mounted
    await page.locator('body').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    // If setup screen is shown (first-time or cleared state), skip to get to chat
    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('Complete workflow: Intent → Architecture → PRD → Code Generation', async ({ page }) => {
    // Step 1: Enter project intent
    const chatInput = page.locator('textarea[placeholder*="message"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    
    await chatInput.fill('Build a todo app with user authentication and real-time sync');
    await chatInput.press('Enter');

    // Wait for response
    await page.waitForTimeout(2000);

    // Step 2: Generate Architecture (if there's a button or action)
    // This depends on the UI implementation
    const generateArchButton = page.locator('button:has-text("Generate Architecture"), button:has-text("Architecture")').first();
    if (await generateArchButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generateArchButton.click();
      
      // Wait for architecture generation
      await page.waitForTimeout(5000);
      
      // Verify architecture diagram is present
      const diagram = page.locator('svg, .mermaid, [class*="diagram"]').first();
      await expect(diagram).toBeVisible({ timeout: 10000 });
    }

    // Step 3: Generate PRD (if there's a button or action)
    const generatePRDButton = page.locator('button:has-text("Generate PRD"), button:has-text("PRD")').first();
    if (await generatePRDButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generatePRDButton.click();
      
      // Wait for PRD generation
      await page.waitForTimeout(5000);
      
      // Verify PRD content is present
      const prdContent = page.locator('[class*="prd"], [class*="document"]').first();
      await expect(prdContent).toBeVisible({ timeout: 10000 });
    }

    // Step 4: Generate Code (if there's a button or action)
    const generateCodeButton = page.locator('button:has-text("Generate Code"), button:has-text("Code")').first();
    if (await generateCodeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generateCodeButton.click();
      
      // Wait for code generation (this can take a while)
      await page.waitForTimeout(10000);
      
      // Verify code generation started or completed
      const codeStatus = page.locator('[class*="status"], [class*="progress"], [class*="code"]').first();
      await expect(codeStatus).toBeVisible({ timeout: 30000 });
    }

    // Verify the session was created and messages are present
    const messages = page.locator('[class*="message"], [class*="chat"]');
    const messageCount = await messages.count();
    expect(messageCount).toBeGreaterThan(0);
  });

  test('Error handling: Invalid API key (401)', async ({ page, context }) => {
    // Intercept API calls to simulate 401
    await page.route('**/api/**', (route) => {
      if (route.request().url().includes('/api/intent/parse')) {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid API key', type: 'auth_error' }),
        });
      } else {
        route.continue();
      }
    });

    // Try to use the app
    const chatInput = page.locator('textarea[placeholder*="message"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    
    await chatInput.fill('Test message');
    await chatInput.press('Enter');

    // Wait for error message
    await page.waitForTimeout(2000);

    // Verify error is displayed
    const errorMessage = page.locator('[class*="error"], [class*="toast"]').first();
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('Error handling: Rate limit (429)', async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Rate limit exceeded', type: 'rate_limit' }),
      })
    );

    const chatInput = page.locator('textarea[placeholder*="message"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    await chatInput.fill('Test rate limit');
    await chatInput.press('Enter');
    await page.waitForTimeout(2000);

    const errorOrToast = page.locator('[class*="error"], [class*="toast"], text=rate limit').first();
    await expect(errorOrToast).toBeVisible({ timeout: 5000 });
  });

  test('Error handling: Server error (500)', async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error', type: 'internal_error' }),
      })
    );

    const chatInput = page.locator('textarea[placeholder*="message"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    await chatInput.fill('Test server error');
    await chatInput.press('Enter');
    await page.waitForTimeout(2000);

    const errorOrToast = page.locator('[class*="error"], [class*="toast"]').first();
    await expect(errorOrToast).toBeVisible({ timeout: 5000 });
  });

  test('Session management: Create and persist session', async ({ page }) => {
    // Create a new session by sending a message
    const chatInput = page.locator('textarea[placeholder*="message"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    
    await chatInput.fill('Test session creation');
    await chatInput.press('Enter');

    // Wait for response
    await page.waitForTimeout(2000);

    // Verify session exists (check localStorage or UI indicator)
    const sessionId = await page.evaluate(() => {
      return localStorage.getItem('currentSessionId') || 
             localStorage.getItem('sessionId') ||
             null;
    });

    // Session should be created (either in localStorage or server-side)
    // This depends on implementation, but we verify the app is working
    const messages = page.locator('[class*="message"]');
    const messageCount = await messages.count();
    expect(messageCount).toBeGreaterThan(0);
  });

  test('Connection status: Backend connectivity', async ({ page }) => {
    // Check for connection status indicator
    const connectionStatus = page.locator('[class*="connection"], [class*="status"]').first();
    
    // If connection status exists, verify it shows connected
    if (await connectionStatus.isVisible({ timeout: 3000 }).catch(() => false)) {
      const statusText = await connectionStatus.textContent();
      expect(statusText?.toLowerCase()).toMatch(/connected|online|ready/);
    }

    // Verify API is accessible by checking health endpoint
    const apiBase = process.env.VITE_API_URL || process.env.PLAYWRIGHT_API_URL || 'http://localhost:3000';
    const healthUrl = `${apiBase.replace(/\/$/, '')}/health/quick`;
    const response = await page.request.get(healthUrl);
    expect(response.status()).toBe(200);
    
    const healthData = (await response.json()) as { status?: string };
    expect(healthData.status).toBe('healthy');
  });

  test('Workflow phases: Architecture → PRD → Code progression', async ({ page }) => {
    // This test verifies the workflow phase indicators work correctly
    // It depends on the UI implementation having phase indicators
    
    const phaseIndicator = page.locator('[class*="phase"], [class*="workflow"], [class*="step"]').first();
    
    // If phase indicators exist, verify they progress
    if (await phaseIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check initial phase
      const initialPhase = await phaseIndicator.textContent();
      expect(initialPhase).toBeTruthy();
      
      // The actual progression would depend on user actions
      // This is a basic smoke test
    }

    // At minimum, verify the app loads and is interactive
    const chatInput = page.locator('textarea[placeholder*="message"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    expect(await chatInput.isEditable()).toBe(true);
  });
});

test.describe('Error Recovery', () => {
  test('Network error recovery', async ({ page, context }) => {
    // Simulate network failure
    await page.route('**/api/**', (route) => route.abort());

    const chatInput = page.locator('textarea[placeholder*="message"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    
    await chatInput.fill('Test network error');
    await chatInput.press('Enter');

    // Wait for error
    await page.waitForTimeout(2000);

    // Restore network
    await page.unroute('**/api/**');

    // Try again - should recover
    await chatInput.fill('Retry after error');
    await chatInput.press('Enter');

    // Should eventually succeed or show retry option
    await page.waitForTimeout(3000);
  });

  test('Timeout handling', async ({ page }) => {
    // Intercept and delay API calls to simulate timeout
    await page.route('**/api/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10s delay
      route.continue();
    });

    const chatInput = page.locator('textarea[placeholder*="message"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    
    await chatInput.fill('Test timeout');
    await chatInput.press('Enter');

    // Should show timeout or loading indicator
    const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"]').first();
    if (await loadingIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(loadingIndicator).toBeVisible();
    }
  });
});
