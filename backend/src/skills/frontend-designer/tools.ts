/**
 * Frontend Designer Skill - Tool Definitions
 */

import type { ToolDefinition } from '../types.js';

export const designComponentTool: ToolDefinition = {
  name: 'design_component',
  description:
    'Design a high-end Svelte 5 component using the G-Rump design system. Generates production-ready code with proper theming, accessibility, animations, and responsive layout.',
  input_schema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description:
          'What to design (e.g., "a pricing card with 3 tiers", "a user profile sidebar")',
      },
      designType: {
        type: 'string',
        enum: [
          'component',
          'page',
          'layout',
          'section',
          'form',
          'modal',
          'card',
          'dashboard',
          'navigation',
        ],
        description: 'Type of UI element to design',
        default: 'component',
      },
      tier: {
        type: 'string',
        enum: ['minimal', 'polished', 'premium'],
        description:
          'Design quality tier. minimal=clean and simple, polished=refined with transitions, premium=glassmorphism, glow effects, and rich animations',
        default: 'premium',
      },
      responsive: {
        type: 'boolean',
        description: 'Include responsive breakpoints (default: true)',
        default: true,
      },
      animated: {
        type: 'boolean',
        description: 'Include animations and transitions (default: true)',
        default: true,
      },
    },
    required: ['description'],
  },
};

export const reviewDesignTool: ToolDefinition = {
  name: 'review_design',
  description:
    'Review an existing Svelte component for G-Rump design system compliance. Checks token usage, theme support, accessibility, responsiveness, and animation quality.',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Svelte component code to review',
      },
      filePath: {
        type: 'string',
        description: 'Path to a .svelte file to review (alternative to providing code directly)',
      },
    },
  },
};

export const enhanceDesignTool: ToolDefinition = {
  name: 'enhance_design',
  description:
    'Upgrade an existing Svelte component to match the G-Rump design system premium tier. Replaces hard-coded values with tokens, adds glassmorphism, transitions, accessibility, and responsive layout.',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Svelte component code to enhance',
      },
      filePath: {
        type: 'string',
        description: 'Path to a .svelte file to enhance (alternative to providing code directly)',
      },
      focusAreas: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['tokens', 'accessibility', 'responsive', 'animation', 'theme', 'glassmorphism'],
        },
        description: 'Specific areas to focus the enhancement on (default: all)',
      },
    },
  },
};

export const definitions: ToolDefinition[] = [
  designComponentTool,
  reviewDesignTool,
  enhanceDesignTool,
];
