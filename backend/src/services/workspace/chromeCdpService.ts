/**
 * Chrome CDP Service – managed browser with persistent context and profiles.
 * Uses Playwright with persistent userDataDir for profile support.
 *
 * Note: Playwright is an optional dependency. This service gracefully degrades
 * when Playwright is not installed.
 */

import path from 'path';
import fs from 'fs/promises';
import logger from '../../middleware/logger.js';

const CHROME_USER_DATA_BASE =
  process.env.CHROME_USER_DATA_DIR || path.join(process.cwd(), 'data', 'browser-profiles');
const PROFILES_ENABLED = process.env.BROWSER_PROFILES_ENABLED !== 'false';

// Use 'any' types since Playwright is optional and types may not be available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserInstance: any = null;
let currentProfile: string = 'default';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const profileContexts = new Map<string, any>();

async function ensureProfilesDir(): Promise<string> {
  await fs.mkdir(CHROME_USER_DATA_BASE, { recursive: true });
  return CHROME_USER_DATA_BASE;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPlaywright(): Promise<any> {
  try {
    return await import('playwright');
  } catch {
    return null;
  }
}

/**
 * Get or create a persistent browser context for a profile.
 */
export async function getBrowserContext(
  profile: string = 'default'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ page: any; context: any } | null> {
  try {
    const pw = await getPlaywright();
    if (!pw) {
      logger.warn({}, 'Playwright not available - browser features disabled');
      return null;
    }
    const profileDir = path.join(CHROME_USER_DATA_BASE, profile);
    await fs.mkdir(profileDir, { recursive: true });

    let context = profileContexts.get(profile);
    if (!context) {
      context = await pw.chromium.launchPersistentContext(profileDir, {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      profileContexts.set(profile, context);
      logger.debug({ profile }, 'Browser profile context created');
    }

    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();
    return { page, context };
  } catch (e) {
    logger.warn({ profile, err: (e as Error).message }, 'Browser context failed');
    return null;
  }
}

/**
 * browser_snapshot: DOM snapshot / accessibility tree
 */
export async function browserSnapshot(
  url?: string,
  profile?: string
): Promise<{ ok: boolean; snapshot?: string; error?: string }> {
  const ctx = await getBrowserContext(profile ?? currentProfile);
  if (!ctx) return { ok: false, error: 'Browser not available' };

  try {
    const { page } = ctx;
    if (url) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    // Simplified DOM structure (tag, role, name, children) for agent consumption
    // Note: The function passed to evaluate runs in browser context where DOM types exist
    const tree = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function nodeToObj(node: any): unknown {
        if (node.nodeType !== 1) return null; // Node.ELEMENT_NODE = 1
        const el = node;
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || el.type || '';
        const name = el.value ?? el.textContent?.slice(0, 100) ?? '';
        const children = Array.from(el.children).map(nodeToObj).filter(Boolean);
        return {
          tag,
          role: role || undefined,
          name: name.slice(0, 80) || undefined,
          children,
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return nodeToObj((globalThis as any).document.body) ?? {};
    });
    return { ok: true, snapshot: JSON.stringify(tree, null, 2) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * browser_upload: Set file on file input via CDP/Playwright
 */
export async function browserUpload(
  selector: string,
  filePath: string,
  options?: { url?: string; profile?: string }
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getBrowserContext(options?.profile ?? currentProfile);
  if (!ctx) return { ok: false, error: 'Browser not available' };

  try {
    const { page } = ctx;
    if (options?.url) {
      await page.goto(options.url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }
    const locator = page.locator(selector);
    const first = await locator.first();
    await first.setInputFiles(filePath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * List available profiles (directories in user data base)
 */
export async function listProfiles(): Promise<string[]> {
  if (!PROFILES_ENABLED) return ['default'];
  try {
    await ensureProfilesDir();
    const entries = await fs.readdir(CHROME_USER_DATA_BASE, {
      withFileTypes: true,
    });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return ['default'];
  }
}

/**
 * Switch active profile (affects subsequent calls)
 */
export function switchProfile(profile: string): void {
  currentProfile = profile;
}

/**
 * Shutdown all browser contexts (call on app exit)
 */
export async function shutdown(): Promise<void> {
  for (const [name, ctx] of profileContexts) {
    try {
      await ctx.close();
    } catch (e) {
      logger.warn({ profile: name, err: (e as Error).message }, 'Profile close error');
    }
  }
  profileContexts.clear();
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}
