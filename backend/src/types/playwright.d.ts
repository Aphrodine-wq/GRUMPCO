/**
 * Optional type declaration for Playwright when used by browserService.
 * Install playwright for full types and runtime.
 */
declare module 'playwright' {
  export interface Locator {
    click(options?: { timeout?: number }): Promise<void>;
  }
  export interface Browser {
    close(): Promise<void>;
    newPage(): Promise<Page>;
  }
  export interface Page {
    goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
    url(): string;
    title(): Promise<string>;
    click(selector: string, options?: { timeout?: number }): Promise<void>;
    locator(selector: string): Locator;
    fill(selector: string, value: string, options?: { timeout?: number }): Promise<void>;
    screenshot(options?: { type?: string; fullPage?: boolean }): Promise<Buffer>;
    content(): Promise<string>;
    evaluate<T>(pageFunction: () => T): Promise<T>;
    waitForTimeout(ms: number): Promise<void>;
  }
  export const chromium: {
    launch(options?: { headless?: boolean }): Promise<Browser>;
  };
}
