/**
 * Browser automation tool definitions
 */

import { z } from 'zod';
import type { Tool } from '../types.js';

// ============================================================================
// SCREENSHOT TOOL
// ============================================================================

export const screenshotUrlInputSchema = z.object({
  url: z.string().url().describe('URL to capture'),
});

export type ScreenshotUrlInput = z.infer<typeof screenshotUrlInputSchema>;

export const screenshotUrlTool: Tool = {
  name: 'screenshot_url',
  description: 'Capture a screenshot of a URL using headless browser.',
  input_schema: {
    type: 'object',
    properties: { url: { type: 'string', description: 'URL to capture' } },
    required: ['url'],
  },
};

// ============================================================================
// BROWSER SCRIPT TOOL
// ============================================================================

export const browserRunScriptInputSchema = z.object({
  steps: z
    .array(
      z.object({
        action: z.enum(['navigate', 'click', 'type', 'screenshot', 'wait']),
        url: z.string().optional(),
        selector: z.string().optional(),
        value: z.string().optional(),
        timeout: z.number().optional(),
      })
    )
    .describe('Ordered steps'),
});

export type BrowserRunScriptInput = z.infer<typeof browserRunScriptInputSchema>;

export const browserRunScriptTool: Tool = {
  name: 'browser_run_script',
  description: 'Run a browser script with multiple steps.',
  input_schema: {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['navigate', 'click', 'type', 'screenshot', 'wait'],
            },
            url: { type: 'string' },
            selector: { type: 'string' },
            value: { type: 'string' },
            timeout: { type: 'number' },
          },
          required: ['action'],
        },
      },
    },
    required: ['steps'],
  },
};

// ============================================================================
// GRANULAR BROWSER TOOLS
// ============================================================================

export const browserNavigateInputSchema = z.object({
  url: z.string().url().describe('URL to navigate to'),
  timeout: z.number().optional().default(30000).describe('Timeout in ms'),
});

export type BrowserNavigateInput = z.infer<typeof browserNavigateInputSchema>;

export const browserNavigateTool: Tool = {
  name: 'browser_navigate',
  description: 'Navigate the browser to a URL.',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
      timeout: { type: 'number', description: 'Timeout in ms' },
    },
    required: ['url'],
  },
};

export const browserClickInputSchema = z.object({
  selector: z.string().describe('CSS selector to click'),
  url: z.string().url().optional().describe('Optional navigation URL'),
  timeout: z.number().optional().default(10000).describe('Timeout in ms'),
});

export type BrowserClickInput = z.infer<typeof browserClickInputSchema>;

export const browserClickTool: Tool = {
  name: 'browser_click',
  description: 'Click an element on the page.',
  input_schema: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector' },
      timeout: { type: 'number', description: 'Timeout in ms' },
    },
    required: ['selector'],
  },
};

export const browserTypeInputSchema = z.object({
  selector: z.string().describe('CSS selector to type into'),
  text: z.string().describe('Text to type'),
  url: z.string().url().optional().describe('Optional navigation URL'),
  timeout: z.number().optional().default(10000).describe('Timeout in ms'),
});

export type BrowserTypeInput = z.infer<typeof browserTypeInputSchema>;

export const browserTypeTool: Tool = {
  name: 'browser_type',
  description: 'Type text into an input field.',
  input_schema: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector' },
      text: { type: 'string', description: 'Text to type' },
      timeout: { type: 'number', description: 'Timeout in ms' },
    },
    required: ['selector', 'text'],
  },
};

export const browserGetContentInputSchema = z.object({
  url: z.string().url().optional().describe('Optional navigation URL'),
});

export type BrowserGetContentInput = z.infer<typeof browserGetContentInputSchema>;

export const browserGetContentTool: Tool = {
  name: 'browser_get_content',
  description: 'Get current page content.',
  input_schema: { type: 'object', properties: {} },
};

export const browserScreenshotInputSchema = z.object({
  url: z.string().url().optional().describe('Optional navigation URL'),
  fullPage: z.boolean().optional().default(false).describe('Capture full page'),
});

export type BrowserScreenshotInput = z.infer<typeof browserScreenshotInputSchema>;

export const browserScreenshotTool: Tool = {
  name: 'browser_screenshot',
  description: 'Capture screenshot of current page.',
  input_schema: {
    type: 'object',
    properties: {
      fullPage: { type: 'boolean', description: 'Capture full page' },
    },
  },
};

export const browserSnapshotTool: Tool = {
  name: 'browser_snapshot',
  description: 'Get DOM/accessibility tree snapshot.',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Optional URL' },
      profile: { type: 'string', description: 'Browser profile' },
    },
  },
};

export const browserUploadTool: Tool = {
  name: 'browser_upload',
  description: 'Upload a file to a file input.',
  input_schema: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'File input selector' },
      filePath: { type: 'string', description: 'Absolute file path' },
      url: { type: 'string', description: 'Optional URL' },
      profile: { type: 'string', description: 'Browser profile' },
    },
    required: ['selector', 'filePath'],
  },
};

export const browserProfilesListTool: Tool = {
  name: 'browser_profiles_list',
  description: 'List available browser profiles.',
  input_schema: { type: 'object', properties: {} },
};

export const browserProfileSwitchTool: Tool = {
  name: 'browser_profile_switch',
  description: 'Switch active browser profile.',
  input_schema: {
    type: 'object',
    properties: {
      profile: { type: 'string', description: 'Profile name' },
    },
    required: ['profile'],
  },
};

// ============================================================================
// EXPORT ALL BROWSER TOOLS
// ============================================================================

export const BROWSER_TOOLS: Tool[] = [
  screenshotUrlTool,
  browserRunScriptTool,
  browserNavigateTool,
  browserClickTool,
  browserTypeTool,
  browserGetContentTool,
  browserScreenshotTool,
  browserSnapshotTool,
  browserUploadTool,
  browserProfilesListTool,
  browserProfileSwitchTool,
];
