import type { Page } from 'playwright';
import logger from '../middleware/logger.js';

let playwrightAvailable = false;
let playwrightChromium: typeof import('playwright').chromium | null = null;

/** Result shape for browserRunScript */
export interface BrowserRunScriptResult {
  ok: boolean;
  error?: string;
  logs?: string[];
  lastUrl?: string;
  screenshotBase64?: string;
}

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

function getChromium(): typeof import('playwright').chromium {
  const chromium = playwrightChromium;
  if (!chromium) throw new Error('Playwright chromium not available');
  return chromium;
}

export interface ScreenshotResult {
  ok: boolean;
  error?: string;
  imageBase64?: string;
}

/**
 * Capture a screenshot of a URL.
 */
export async function screenshotUrl(url: string): Promise<ScreenshotResult> {
  if (!(await ensurePlaywright())) {
    return { ok: false, error: 'Browser not available.' };
  }
  try {
    const browser = await getChromium().launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      const buf = await page.screenshot({ type: 'png', fullPage: false });
      return { ok: true, imageBase64: Buffer.from(buf).toString('base64') };
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (e) {
    logger.warn({ url, err: (e as Error).message }, 'screenshot_url failed');
    return { ok: false, error: (e as Error).message };
  }
}

// ============================================================================
// GRANULAR ACTIONS
// ============================================================================

/**
 * Common wrapper for browser actions
 */
async function runWithPage<T>(
  action: (page: Page) => Promise<T>,
  url?: string,
  timeout?: number
): Promise<{ ok: boolean; error?: string; result?: T }> {
  if (!(await ensurePlaywright())) {
    return { ok: false, error: 'Browser not available.' };
  }
  try {
    const browser = await getChromium().launch({ headless: true });
    try {
      const page = await browser.newPage();
      if (url) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeout ?? 30000 });
      }
      const result = await action(page);
      return { ok: true, result };
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function browserNavigate(url: string, timeout?: number) {
  return runWithPage(
    async (page) => {
      const p = page as { url(): string; title(): Promise<string> };
      return { url: p.url(), title: await p.title() };
    },
    url,
    timeout
  );
}

export async function browserClick(selector: string, url?: string, timeout?: number) {
  return runWithPage(
    async (page) => {
      const p = page as {
        locator(sel: string): { click(opts?: { timeout?: number }): Promise<void> };
      };
      await p.locator(selector).click({ timeout: timeout ?? 10000 });
      return { clicked: selector };
    },
    url,
    timeout
  );
}

export async function browserType(selector: string, text: string, url?: string, timeout?: number) {
  return runWithPage(
    async (page) => {
      const p = page as {
        fill(sel: string, text: string, opts?: { timeout?: number }): Promise<void>;
      };
      await p.fill(selector, text, { timeout: timeout ?? 10000 });
      return { typed: selector, text };
    },
    url,
    timeout
  );
}

export async function browserScreenshot(
  url?: string,
  fullPage: boolean = false
): Promise<ScreenshotResult> {
  const res = await runWithPage(async (page) => {
    const p = page as {
      screenshot(opts: { type: string; fullPage?: boolean }): Promise<Buffer | string>;
    };
    const buf = await p.screenshot({ type: 'png', fullPage });
    return Buffer.from(buf as Buffer).toString('base64');
  }, url);

  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, imageBase64: res.result };
}

export async function browserGetContent(
  url?: string
): Promise<{ ok: boolean; error?: string; html?: string; text?: string }> {
  const res = await runWithPage(async (page) => {
    const p = page as unknown as {
      content(): Promise<string>;
      evaluate(expr: string): Promise<string>;
    };
    const html = await p.content();
    const text = await p.evaluate('document.body?.innerText ?? ""');
    return { html, text };
  }, url);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, ...res.result };
}

// Legacy support
export interface BrowserStep {
  action: 'navigate' | 'click' | 'type' | 'screenshot' | 'wait';
  selector?: string;
  value?: string;
  url?: string;
  timeout?: number;
}

export async function browserRunScript(steps: BrowserStep[]): Promise<BrowserRunScriptResult> {
  if (!(await ensurePlaywright())) {
    return { ok: false, error: 'Browser not available.' };
  }
  const logs: string[] = [];
  try {
    const browser = await getChromium().launch({ headless: true });
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
          await page.waitForTimeout(
            Math.min(to, step.value ? parseInt(step.value, 10) || 1000 : 1000)
          );
          logs.push('Waited');
        }
      } catch (stepErr) {
        await browser.close().catch(() => {});
        return {
          ok: false,
          error: (stepErr as Error).message,
          logs,
          lastUrl: lastUrl || undefined,
        };
      }
    }
    await browser.close().catch(() => {});
    return { ok: true, logs, lastUrl: lastUrl || undefined, screenshotBase64 };
  } catch (e) {
    return { ok: false, error: (e as Error).message, logs };
  }
}
