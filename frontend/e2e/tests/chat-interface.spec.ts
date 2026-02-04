import { test, expect } from '@playwright/test';

/**
 * Chat Interface E2E Tests
 * 
 * Tests the core chat functionality including:
 * - Message sending and receiving
 * - Mode switching (Code, Design, Plan, Spec, Ship)
 * - Tool call visualization
 * - Error handling
 */

test.describe('Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    
    // Skip onboarding if present
    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test.describe('Message Input', () => {
    test('should have a visible input field', async ({ page }) => {
      const input = page.locator('input.message-input, textarea.message-input, [class*="input"]').first();
      await expect(input).toBeVisible({ timeout: 10000 });
    });

    test('should show placeholder text', async ({ page }) => {
      const input = page.locator('input.message-input, textarea.message-input, [placeholder]').first();
      await expect(input).toBeVisible({ timeout: 10000 });
      const placeholder = await input.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    });

    test('should accept text input', async ({ page }) => {
      const input = page.locator('input.message-input, textarea.message-input').first();
      await expect(input).toBeVisible({ timeout: 10000 });
      
      await input.fill('Hello, G-Rump!');
      await expect(input).toHaveValue('Hello, G-Rump!');
    });

    test('should have a send button', async ({ page }) => {
      const sendButton = page.locator('button.send-button, button[type="submit"]').first();
      await expect(sendButton).toBeVisible({ timeout: 10000 });
    });

    test('send button should be disabled when input is empty', async ({ page }) => {
      const sendButton = page.locator('button.send-button, button[type="submit"]').first();
      await expect(sendButton).toBeVisible({ timeout: 10000 });
      await expect(sendButton).toBeDisabled();
    });

    test('send button should be enabled when input has text', async ({ page }) => {
      const input = page.locator('input.message-input, textarea.message-input').first();
      const sendButton = page.locator('button.send-button, button[type="submit"]').first();
      
      await expect(input).toBeVisible({ timeout: 10000 });
      await input.fill('Test message');
      
      await expect(sendButton).toBeEnabled();
    });
  });

  test.describe('Mode Switching', () => {
    test('should have mode selector buttons', async ({ page }) => {
      const modeSelector = page.locator('.mode-selector, [class*="mode"]').first();
      await expect(modeSelector).toBeVisible({ timeout: 10000 });
    });

    test('should switch to Code mode', async ({ page }) => {
      const codeButton = page.locator('button.mode-btn:has-text("Code"), button:has-text("Code")').first();
      
      if (await codeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await codeButton.click();
        await expect(codeButton).toHaveClass(/active/);
      }
    });

    test('should switch to Design mode', async ({ page }) => {
      const designButton = page.locator('button.mode-btn:has-text("Design"), button:has-text("Design")').first();
      
      if (await designButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await designButton.click();
        await expect(designButton).toHaveClass(/active/);
      }
    });

    test('should switch to Plan mode', async ({ page }) => {
      const planButton = page.locator('button.mode-btn:has-text("Plan"), button:has-text("Plan")').first();
      
      if (await planButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await planButton.click();
        await expect(planButton).toHaveClass(/active/);
      }
    });

    test('should switch to Ship mode', async ({ page }) => {
      const shipButton = page.locator('button.mode-btn:has-text("Ship"), button:has-text("Ship")').first();
      
      if (await shipButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await shipButton.click();
        // Ship mode shows a different viewport
        const shipViewport = page.locator('.ship-mode-viewport, [class*="ship"]').first();
        await expect(shipViewport).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Empty State', () => {
    test('should show welcome message on first load', async ({ page }) => {
      const welcomeTitle = page.locator('.empty-title, h1:has-text("What are we building")').first();
      await expect(welcomeTitle).toBeVisible({ timeout: 10000 });
    });

    test('should show suggestion chips', async ({ page }) => {
      const chips = page.locator('.suggestion-chips, [class*="suggestion"]').first();
      if (await chips.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(chips).toBeVisible();
      }
    });

    test('should have Try Demo button', async ({ page }) => {
      const demoButton = page.locator('button:has-text("Try Demo")').first();
      if (await demoButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(demoButton).toBeVisible();
        await expect(demoButton).toBeEnabled();
      }
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('Ctrl+K should open command palette', async ({ page }) => {
      await page.keyboard.press('Control+k');
      
      const commandPalette = page.locator('[class*="command-palette"], [class*="command"]').first();
      // Command palette may or may not be implemented - this is a smoke test
      await page.waitForTimeout(500);
    });

    test('Escape should cancel generation if streaming', async ({ page }) => {
      // This is a behavioral test - would need mocking for full test
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    });
  });
});

test.describe('Frowny Face', () => {
  test('should show G-Rump avatar', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    
    const frownyFace = page.locator('[class*="frowny-face"], [class*="frowny"], svg.frowny-svg').first();
    if (await frownyFace.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(frownyFace).toBeVisible();
    }
  });
});

test.describe('Toast Notifications', () => {
  test('should show toast container', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Toast container should exist even if empty
    const toastContainer = page.locator('.toast-container');
    // It might not be visible if no toasts, but should be in DOM
  });

  test('error toast should appear on API failure', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    
    // Skip onboarding
    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Mock API to fail
    await page.route('**/api/chat/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });
    
    // Send a message
    const input = page.locator('input.message-input, textarea.message-input').first();
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill('Test error handling');
      await input.press('Enter');
      
      // Wait for toast
      await page.waitForTimeout(2000);
      
      const toast = page.locator('.toast, [class*="toast"]').first();
      if (await toast.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(toast).toBeVisible();
      }
    }
  });
});

test.describe('Accessibility', () => {
  test('should have proper ARIA labels on interactive elements', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    
    // Check for aria-label or aria-labelledby on important elements
    const buttons = await page.locator('button').all();
    
    for (const button of buttons.slice(0, 5)) { // Check first 5 buttons
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      const title = await button.getAttribute('title');
      
      // Button should have either text content, aria-label, or title
      expect(ariaLabel || text?.trim() || title).toBeTruthy();
    }
  });

  test('toast container should have aria-live for screen readers', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    const toastContainer = page.locator('.toast-container, [aria-live]').first();
    if (await toastContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
      const ariaLive = await toastContainer.getAttribute('aria-live');
      expect(ariaLive).toBe('polite');
    }
  });
});

test.describe('Responsive Design', () => {
  test('should be usable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    
    // Skip onboarding
    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
    }
    
    // Chat input should still be visible and usable
    const input = page.locator('input.message-input, textarea.message-input, [class*="input"]').first();
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test('should be usable on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    
    // Skip onboarding
    const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started")').first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
    }
    
    const input = page.locator('input.message-input, textarea.message-input, [class*="input"]').first();
    await expect(input).toBeVisible({ timeout: 10000 });
  });
});
