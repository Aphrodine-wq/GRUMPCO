/**
 * Browser Service
 * Headless browser for screenshots and E2E-style scripts. Uses Playwright when available.
 * When Playwright is not installed, tools that use this return a clear "browser not available" message.
 */

import logger from '../middleware/logger.js';

let playwrightAvailable = false;
let playwrightChromium: typeof import('playwright').chromium | null = null;

async function ensurePlaywright(): Promise<boolean> {
  if (playwrightChromium != null) return true;
  if (!playwrightAvailable) {
    try {
      const pw = await import('playwright');
      playwrightChromium = pw.chromium;
      playwrightAvailable = true;
      logger.info('Browser service: Playwright loaded');
    } catch (e) {
      logger.debug({ err: (e as Error).message }, 'Browser service: Playwright not available');
      return false;
    }
  }
  return !!playwrightChromium;
}

export interface ScreenshotResult {
  ok: boolean;
  error?: string;
  imageBase64?: string;
}

/**
 * Capture a screenshot of a URL. Returns base64 PNG when Playwright is available.
 */
export async function screenshotUrl(url: string): Promise<ScreenshotResult> {
  if (!(await ensurePlaywright())) {
    return { ok: false, error: 'Browser not available. Install playwright to enable screenshot_url.' };
  }
  try {
    const browser = await playwrightChromium!.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      const buf = await page.screenshot({ type: 'png', fullPage: false });
      await browser.close();
      return { ok: true, imageBase64: Buffer.from(buf).toString('base64') };
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (e) {
    const msg = (e as Error).message;
    logger.warn({ url, err: msg }, 'screenshot_url failed');
    return { ok: false, error: msg };
  }
}

export interface BrowserStep {
  action: 'navigate' | 'click' | 'type' | 'screenshot' | 'wait';
  selector?: string;
  value?: string;
  url?: string;
  timeout?: number;
}

export interface BrowserRunResult {
  ok: boolean;
  error?: string;
  screenshotBase64?: string;
  lastUrl?: string;
  logs?: string[];
}

/**
 * Run a short browser script (navigate, click, type, screenshot). Used for E2E-style checks.
 */
export async function browserRunScript(steps: BrowserStep[]): Promise<BrowserRunResult> {
  if (!(await ensurePlaywright())) {
    return { ok: false, error: 'Browser not available. Install playwright to enable browser_run_script.' };
  }
  const logs: string[] = [];
  try {
    const browser = await playwrightChromium!.launch({ headless: true });
    const page = await browser.newPage();
    let lastUrl = '';
    let screenshotBase64: string | undefined;
    for (const step of steps) {
      const to = step.timeout ?? 10000;
      try {
        if (step.action === 'navigate' && step.url) {
          await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: to });
          lastUrl = page.url();
          logs.push(`Navigated to ${lastUrl}`);
        } else if (step.action === 'click' && step.selector) {
          await page.click(step.selector, { timeout: to });
          logs.push(`Clicked ${step.selector}`);
        } else if (step.action === 'type' && step.selector && step.value != null) {
          await page.fill(step.selector, step.value, { timeout: to });
          logs.push(`Typed into ${step.selector}`);
        } else if (step.action === 'screenshot') {
          const buf = await page.screenshot({ type: 'png', fullPage: false });
          screenshotBase64 = Buffer.from(buf).toString('base64');
          logs.push('Screenshot captured');
        } else if (step.action === 'wait') {
          await page.waitForTimeout(Math.min(to, step.value ? parseInt(step.value, 10) || 1000 : 1000));
          logs.push('Waited');
        }
      } catch (stepErr) {
        await browser.close().catch(() => {});
        return { ok: false, error: (stepErr as Error).message, logs, lastUrl: lastUrl || undefined };
      }
    }
    await browser.close().catch(() => {});
    return { ok: true, logs, lastUrl: lastUrl || undefined, screenshotBase64 };
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'browser_run_script failed');
    return { ok: false, error: (e as Error).message, logs };
  }
}
