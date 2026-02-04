/**
 * Browser Service Unit Tests
 * Tests browser automation functionality using Playwright.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock page methods
const mockPage = {
  goto: vi.fn(),
  screenshot: vi.fn(),
  click: vi.fn(),
  fill: vi.fn(),
  locator: vi.fn(),
  url: vi.fn(),
  title: vi.fn(),
  content: vi.fn(),
  evaluate: vi.fn(),
  waitForTimeout: vi.fn(),
};

// Mock browser methods
const mockBrowser = {
  newPage: vi.fn(),
  close: vi.fn(),
};

// Mock chromium
const mockChromium = {
  launch: vi.fn(),
};

// Mock playwright module
vi.mock('playwright', () => ({
  chromium: mockChromium,
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('browserService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock implementations to default success behavior
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.screenshot.mockResolvedValue(Buffer.from('fake-screenshot-data'));
    mockPage.click.mockResolvedValue(undefined);
    mockPage.fill.mockResolvedValue(undefined);
    mockPage.url.mockReturnValue('https://example.com');
    mockPage.title.mockResolvedValue('Example Page');
    mockPage.content.mockResolvedValue('<html><body>Hello</body></html>');
    mockPage.evaluate.mockResolvedValue('Hello');
    mockPage.waitForTimeout.mockResolvedValue(undefined);
    mockPage.locator.mockReturnValue({
      click: vi.fn().mockResolvedValue(undefined),
    });
    
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockBrowser.close.mockResolvedValue(undefined);
    
    mockChromium.launch.mockResolvedValue(mockBrowser);
  });

  describe('screenshotUrl', () => {
    it('should capture screenshot of a URL', async () => {
      // Reset module to ensure fresh playwright state
      vi.resetModules();
      
      const { screenshotUrl } = await import('../../src/services/browserService.js');

      const result = await screenshotUrl('https://example.com');

      expect(result.ok).toBe(true);
      expect(result.imageBase64).toBeDefined();
      expect(mockChromium.launch).toHaveBeenCalledWith({ headless: true });
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle',
        timeout: 15000,
      });
      expect(mockPage.screenshot).toHaveBeenCalledWith({ type: 'png', fullPage: false });
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle navigation errors', async () => {
      vi.resetModules();
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      const { screenshotUrl } = await import('../../src/services/browserService.js');

      const result = await screenshotUrl('https://example.com');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Navigation failed');
    });

    it('should handle screenshot errors', async () => {
      vi.resetModules();
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot failed'));

      const { screenshotUrl } = await import('../../src/services/browserService.js');

      const result = await screenshotUrl('https://example.com');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Screenshot failed');
    });

    it('should close browser even on error', async () => {
      vi.resetModules();
      mockPage.goto.mockRejectedValue(new Error('Error'));

      const { screenshotUrl } = await import('../../src/services/browserService.js');

      await screenshotUrl('https://example.com');

      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('browserNavigate', () => {
    it('should navigate to URL and return page info', async () => {
      vi.resetModules();
      mockPage.url.mockReturnValue('https://example.com/page');
      mockPage.title.mockResolvedValue('Page Title');

      const { browserNavigate } = await import('../../src/services/browserService.js');

      const result = await browserNavigate('https://example.com/page');

      expect(result.ok).toBe(true);
      expect(result.result).toEqual({
        url: 'https://example.com/page',
        title: 'Page Title',
      });
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/page', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    });

    it('should use custom timeout', async () => {
      vi.resetModules();

      const { browserNavigate } = await import('../../src/services/browserService.js');

      await browserNavigate('https://example.com', 5000);

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'domcontentloaded',
        timeout: 5000,
      });
    });

    it('should return error on navigation failure', async () => {
      vi.resetModules();
      mockPage.goto.mockRejectedValue(new Error('Timeout'));

      const { browserNavigate } = await import('../../src/services/browserService.js');

      const result = await browserNavigate('https://example.com');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Timeout');
    });
  });

  describe('browserClick', () => {
    it('should click on selector', async () => {
      vi.resetModules();
      const mockLocatorClick = vi.fn().mockResolvedValue(undefined);
      mockPage.locator.mockReturnValue({ click: mockLocatorClick });

      const { browserClick } = await import('../../src/services/browserService.js');

      const result = await browserClick('#submit-button');

      expect(result.ok).toBe(true);
      expect(result.result).toEqual({ clicked: '#submit-button' });
    });

    it('should navigate to URL before clicking', async () => {
      vi.resetModules();

      const { browserClick } = await import('../../src/services/browserService.js');

      await browserClick('#button', 'https://example.com');

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });

    it('should use custom timeout for click', async () => {
      vi.resetModules();
      const mockLocatorClick = vi.fn().mockResolvedValue(undefined);
      mockPage.locator.mockReturnValue({ click: mockLocatorClick });

      const { browserClick } = await import('../../src/services/browserService.js');

      await browserClick('#button', undefined, 5000);

      expect(mockLocatorClick).toHaveBeenCalledWith({ timeout: 5000 });
    });

    it('should return error when click fails', async () => {
      vi.resetModules();
      const mockLocatorClick = vi.fn().mockRejectedValue(new Error('Element not found'));
      mockPage.locator.mockReturnValue({ click: mockLocatorClick });

      const { browserClick } = await import('../../src/services/browserService.js');

      const result = await browserClick('#non-existent');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Element not found');
    });
  });

  describe('browserType', () => {
    it('should type text into selector', async () => {
      vi.resetModules();

      const { browserType } = await import('../../src/services/browserService.js');

      const result = await browserType('#input-field', 'Hello World');

      expect(result.ok).toBe(true);
      expect(result.result).toEqual({ typed: '#input-field', text: 'Hello World' });
      expect(mockPage.fill).toHaveBeenCalledWith('#input-field', 'Hello World', { timeout: 10000 });
    });

    it('should navigate to URL before typing', async () => {
      vi.resetModules();

      const { browserType } = await import('../../src/services/browserService.js');

      await browserType('#input', 'text', 'https://example.com');

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });

    it('should use custom timeout', async () => {
      vi.resetModules();

      const { browserType } = await import('../../src/services/browserService.js');

      await browserType('#input', 'text', undefined, 5000);

      expect(mockPage.fill).toHaveBeenCalledWith('#input', 'text', { timeout: 5000 });
    });

    it('should return error when fill fails', async () => {
      vi.resetModules();
      mockPage.fill.mockRejectedValue(new Error('Element not editable'));

      const { browserType } = await import('../../src/services/browserService.js');

      const result = await browserType('#readonly', 'text');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Element not editable');
    });
  });

  describe('browserScreenshot', () => {
    it('should capture screenshot of current page', async () => {
      vi.resetModules();

      const { browserScreenshot } = await import('../../src/services/browserService.js');

      const result = await browserScreenshot();

      expect(result.ok).toBe(true);
      expect(result.imageBase64).toBeDefined();
    });

    it('should navigate to URL before screenshot', async () => {
      vi.resetModules();

      const { browserScreenshot } = await import('../../src/services/browserService.js');

      await browserScreenshot('https://example.com');

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });

    it('should support full page screenshot', async () => {
      vi.resetModules();

      const { browserScreenshot } = await import('../../src/services/browserService.js');

      await browserScreenshot(undefined, true);

      expect(mockPage.screenshot).toHaveBeenCalledWith({ type: 'png', fullPage: true });
    });

    it('should return error on screenshot failure', async () => {
      vi.resetModules();
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot error'));

      const { browserScreenshot } = await import('../../src/services/browserService.js');

      const result = await browserScreenshot();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Screenshot error');
    });
  });

  describe('browserGetContent', () => {
    it('should get HTML and text content', async () => {
      vi.resetModules();
      mockPage.content.mockResolvedValue('<html><body>Test Content</body></html>');
      mockPage.evaluate.mockResolvedValue('Test Content');

      const { browserGetContent } = await import('../../src/services/browserService.js');

      const result = await browserGetContent('https://example.com');

      expect(result.ok).toBe(true);
      expect(result.html).toBe('<html><body>Test Content</body></html>');
      expect(result.text).toBe('Test Content');
    });

    it('should navigate to URL before getting content', async () => {
      vi.resetModules();

      const { browserGetContent } = await import('../../src/services/browserService.js');

      await browserGetContent('https://example.com');

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });

    it('should return error on failure', async () => {
      vi.resetModules();
      mockPage.content.mockRejectedValue(new Error('Content error'));

      const { browserGetContent } = await import('../../src/services/browserService.js');

      const result = await browserGetContent();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Content error');
    });
  });

  describe('browserRunScript', () => {
    it('should run a series of browser steps', async () => {
      vi.resetModules();

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const steps: import('../../src/services/browserService.js').BrowserStep[] = [
        { action: 'navigate', url: 'https://example.com' },
        { action: 'click', selector: '#button' },
        { action: 'type', selector: '#input', value: 'text' },
        { action: 'screenshot' },
      ];

      const result = await browserRunScript(steps);

      expect(result.ok).toBe(true);
      expect(result.logs).toContain('Navigated to https://example.com');
      expect(result.logs).toContain('Clicked #button');
      expect(result.logs).toContain('Typed into #input');
      expect(result.logs).toContain('Screenshot captured');
      expect(result.screenshotBase64).toBeDefined();
    });

    it('should handle navigate step', async () => {
      vi.resetModules();
      mockPage.url.mockReturnValue('https://example.com/page');

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const result = await browserRunScript([
        { action: 'navigate', url: 'https://example.com/page' },
      ]);

      expect(result.ok).toBe(true);
      expect(result.lastUrl).toBe('https://example.com/page');
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/page', expect.any(Object));
    });

    it('should handle click step', async () => {
      vi.resetModules();

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const result = await browserRunScript([
        { action: 'click', selector: '#submit' },
      ]);

      expect(result.ok).toBe(true);
      expect(result.logs).toContain('Clicked #submit');
      expect(mockPage.click).toHaveBeenCalledWith('#submit', { timeout: 10000 });
    });

    it('should handle type step', async () => {
      vi.resetModules();

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const result = await browserRunScript([
        { action: 'type', selector: '#email', value: 'test@example.com' },
      ]);

      expect(result.ok).toBe(true);
      expect(result.logs).toContain('Typed into #email');
      expect(mockPage.fill).toHaveBeenCalledWith('#email', 'test@example.com', { timeout: 10000 });
    });

    it('should handle screenshot step', async () => {
      vi.resetModules();

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const result = await browserRunScript([
        { action: 'screenshot' },
      ]);

      expect(result.ok).toBe(true);
      expect(result.logs).toContain('Screenshot captured');
      expect(result.screenshotBase64).toBeDefined();
    });

    it('should handle wait step', async () => {
      vi.resetModules();

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const result = await browserRunScript([
        { action: 'wait', value: '500' },
      ]);

      expect(result.ok).toBe(true);
      expect(result.logs).toContain('Waited');
      expect(mockPage.waitForTimeout).toHaveBeenCalled();
    });

    it('should use custom timeout for steps', async () => {
      vi.resetModules();

      const { browserRunScript } = await import('../../src/services/browserService.js');

      await browserRunScript([
        { action: 'click', selector: '#button', timeout: 5000 },
      ]);

      expect(mockPage.click).toHaveBeenCalledWith('#button', { timeout: 5000 });
    });

    it('should stop on step error and return partial logs', async () => {
      vi.resetModules();
      mockPage.click.mockRejectedValue(new Error('Click failed'));

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const result = await browserRunScript([
        { action: 'navigate', url: 'https://example.com' },
        { action: 'click', selector: '#broken' },
        { action: 'screenshot' },
      ]);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Click failed');
      expect(result.logs).toContain('Navigated to https://example.com');
      expect(result.logs).not.toContain('Screenshot captured');
    });

    it('should handle browser launch error', async () => {
      vi.resetModules();
      mockChromium.launch.mockRejectedValue(new Error('Launch failed'));

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const result = await browserRunScript([
        { action: 'navigate', url: 'https://example.com' },
      ]);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Launch failed');
    });

    it('should handle empty steps array', async () => {
      vi.resetModules();

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const result = await browserRunScript([]);

      expect(result.ok).toBe(true);
      expect(result.logs).toEqual([]);
    });

    it('should close browser after execution', async () => {
      vi.resetModules();

      const { browserRunScript } = await import('../../src/services/browserService.js');

      await browserRunScript([
        { action: 'navigate', url: 'https://example.com' },
      ]);

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should close browser on step error', async () => {
      vi.resetModules();
      mockPage.click.mockRejectedValue(new Error('Error'));

      const { browserRunScript } = await import('../../src/services/browserService.js');

      await browserRunScript([
        { action: 'click', selector: '#broken' },
      ]);

      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('BrowserStep types', () => {
    it('should accept all valid action types', async () => {
      vi.resetModules();

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const steps: import('../../src/services/browserService.js').BrowserStep[] = [
        { action: 'navigate', url: 'https://example.com' },
        { action: 'click', selector: '#button' },
        { action: 'type', selector: '#input', value: 'text' },
        { action: 'screenshot' },
        { action: 'wait' },
      ];

      const result = await browserRunScript(steps);

      expect(result.ok).toBe(true);
    });
  });

  describe('Result types', () => {
    it('should include all expected fields on success for BrowserRunScriptResult', async () => {
      vi.resetModules();
      mockPage.url.mockReturnValue('https://example.com');

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const result = await browserRunScript([
        { action: 'navigate', url: 'https://example.com' },
        { action: 'screenshot' },
      ]);

      expect(result).toHaveProperty('ok', true);
      expect(result).toHaveProperty('logs');
      expect(result).toHaveProperty('lastUrl');
      expect(result).toHaveProperty('screenshotBase64');
      expect(result.error).toBeUndefined();
    });

    it('should include error field on failure', async () => {
      vi.resetModules();
      mockPage.goto.mockRejectedValue(new Error('Navigation error'));

      const { browserRunScript } = await import('../../src/services/browserService.js');

      const result = await browserRunScript([
        { action: 'navigate', url: 'https://example.com' },
      ]);

      expect(result).toHaveProperty('ok', false);
      expect(result).toHaveProperty('error', 'Navigation error');
    });

    it('should include imageBase64 on screenshot success', async () => {
      vi.resetModules();

      const { screenshotUrl } = await import('../../src/services/browserService.js');

      const result = await screenshotUrl('https://example.com');

      expect(result).toHaveProperty('ok', true);
      expect(result).toHaveProperty('imageBase64');
      expect(result.error).toBeUndefined();
    });

    it('should include error on screenshot failure', async () => {
      vi.resetModules();
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot error'));

      const { screenshotUrl } = await import('../../src/services/browserService.js');

      const result = await screenshotUrl('https://example.com');

      expect(result).toHaveProperty('ok', false);
      expect(result).toHaveProperty('error');
      expect(result.imageBase64).toBeUndefined();
    });
  });
});
