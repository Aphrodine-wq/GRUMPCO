/**
 * G-Rump Design System - Color Tokens (Redesigned)
 * Minimal & elegant light theme with electric cyan-blue accent
 */

export const colors = {
  // Background colors - Off-white base
  background: {
    primary: '#FAFAFA',      // Main background (off-white)
    secondary: '#FFFFFF',    // Cards, elevated surfaces
    tertiary: '#F5F5F5',     // Subtle sections
    code: '#F8F8F8',         // Code blocks
    input: '#FFFFFF',        // Input fields
    sidebar: '#FAFAFA',      // Sidebar (same as primary)
  },

  // Text colors - Strong hierarchy
  text: {
    primary: '#18181B',      // Headings, primary content
    secondary: '#3F3F46',    // Body text
    muted: '#71717A',        // Captions, hints
    inverse: '#FFFFFF',      // Text on dark backgrounds
    code: '#18181B',         // Code text
  },

  // Accent colors - Electric cyan-blue ONLY
  accent: {
    primary: '#0EA5E9',      // ⚡ Electric cyan-blue (main accent)
    primaryHover: '#0284C7', // Darker on hover
    primaryLight: '#E0F2FE', // Light background
    // REMOVED: secondary, tertiary (blue only!)
  },

  // Status colors (kept for errors/warnings/success)
  status: {
    success: '#059669',      // Green
    successLight: '#D1FAE5',
    error: '#DC2626',        // Red
    errorLight: '#FEE2E2',
    warning: '#D97706',      // Amber
    warningLight: '#FEF3C7',
    info: '#0EA5E9',         // Cyan (matches primary)
    infoLight: '#E0F2FE',
  },

  // Code diff colors
  diff: {
    added: {
      background: '#D1FAE5',
      border: '#059669',
      text: '#065F46',
    },
    removed: {
      background: '#FEE2E2',
      border: '#DC2626',
      text: '#991B1B',
    },
    unchanged: {
      background: 'transparent',
      text: '#3F3F46',
    },
    lineNumber: {
      background: '#F4F4F5',
      text: '#A1A1AA',
      border: 'transparent', // Removed border (no borders design)
    },
  },

  // Syntax highlighting
  syntax: {
    keyword: '#7C3AED',      // Purple
    string: '#059669',       // Green
    number: '#D97706',       // Amber
    comment: '#A1A1AA',      // Gray
    function: '#0EA5E9',     // Cyan (matches primary accent)
    variable: '#18181B',     // Dark
    operator: '#DC2626',     // Red
    type: '#0EA5E9',         // Cyan
    punctuation: '#71717A',  // Muted
  },

  // Interactive states
  interactive: {
    hover: '#F4F4F5',
    active: '#E0F2FE',       // Light cyan background
    selected: '#E0F2FE',     // Light cyan background
    disabled: '#FAFAFA',
  },

  // Shadows - Soft blurred shadows (NO borders)
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    floating: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
} as const;

export type Colors = typeof colors;
export type ColorKey = keyof Colors;
