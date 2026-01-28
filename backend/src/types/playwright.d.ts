/**
 * Optional type declaration for Playwright when used by browserService.
 * Install playwright for full types and runtime.
 */
declare module 'playwright' {
  export interface Browser {
    close(): Promise<void>;
    newPage(): Promise<Page>;
  }
  export interface Page {
    goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
    url(): string;
    click(selector: string, options?: { timeout?: number }): Promise<void>;
    fill(selector: string, value: string, options?: { timeout?: number }): Promise<void>;
    screenshot(options?: { type?: string; fullPage?: boolean }): Promise<Buffer>;
    waitForTimeout(ms: number): Promise<void>;
  }
  export const chromium: {
    launch(options?: { headless?: boolean }): Promise<Browser>;
  };
}
