import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Test fixtures for G-Rump application
 */

export interface AppFixtures {
  app: AppFixture;
}

export class AppFixture {
  constructor(private page: Page) {}

  /**
   * Navigate to the app and wait for it to be ready
   */
  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait for main content or chat/setup UI so Svelte has mounted
    await this.page.locator('.main-content, .app, body').first().waitFor({ state: 'visible', timeout: 15000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  /**
   * Switch to Design mode
   */
  async switchToDesignMode() {
    await this.page.click('button:has-text("Design")');
    await this.page.waitForTimeout(500);
  }

  /**
   * Switch to Code mode
   */
  async switchToCodeMode() {
    await this.page.click('button:has-text("Code")');
    await this.page.waitForTimeout(500);
  }

  /**
   * Set workspace path
   */
  async setWorkspace(path: string) {
    const input = this.page.locator('input[placeholder*="workspace" i], input[placeholder*="path" i]').first();
    await input.fill(path);
    await input.blur();
    await this.page.waitForTimeout(300);
  }

  /**
   * Send a message in the chat
   */
  async sendMessage(text: string) {
    const input = this.page.locator('input[type="text"]').last();
    await input.fill(text);
    await input.press('Enter');
    await this.page.waitForTimeout(500);
  }

  /**
   * Wait for diagram to render
   */
  async waitForDiagram(timeout = 10000) {
    await this.page.waitForSelector('svg', { timeout });
  }

  /**
   * Get Mermaid code from the last diagram
   */
  async getMermaidCode(): Promise<string | null> {
    // This would need to be implemented based on how diagrams are stored
    // For now, we'll check if a diagram exists
    const diagram = this.page.locator('.diagram-output svg').first();
    if (await diagram.count() > 0) {
      return 'flowchart TD\n  A[Test] --> B[Test]'; // Mock for now
    }
    return null;
  }

  /**
   * Click Generate Code button
   */
  async clickGenerateCode() {
    await this.page.click('button:has-text("Generate Code")');
    await this.page.waitForTimeout(500);
  }

  /**
   * Select framework in MermaidToCodePanel
   */
  async selectFramework(framework: string) {
    const select = this.page.locator('select').first();
    await select.selectOption(framework);
  }

  /**
   * Select language in MermaidToCodePanel
   */
  async selectLanguage(language: string) {
    const selects = this.page.locator('select');
    await selects.nth(1).selectOption(language);
  }

  /**
   * Wait for code generation to start
   */
  async waitForCodeGeneration(timeout = 30000) {
    await this.page.waitForSelector('.tool-call-card, .tool-result-card', { timeout });
  }

  /**
   * Check if diff viewer is visible
   */
  async hasDiffViewer(): Promise<boolean> {
    const diffViewer = this.page.locator('.diff-viewer, .code-diff-viewer');
    return (await diffViewer.count()) > 0;
  }

  /**
   * Mock API responses
   */
  async mockApiResponse(url: string, response: any) {
    await this.page.route(url, (route: any) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * Mock SSE stream response
   */
  async mockSSEResponse(url: string, events: Array<{ type: string; data?: unknown }>) {
    await this.page.route(url, async (route) => {
      const stream = new ReadableStream({
        async start(controller) {
          for (const event of events) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          controller.close();
        },
      });
      
      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
        body: stream,
      });
    });
  }
}

export const test = base.extend<AppFixtures>({
  app: async ({ page }, use) => {
    const app = new AppFixture(page);
    await use(app);
  },
});

export { expect };
