/**
 * G-Rump Design System - Color Tokens
 * Clean, professional light theme
 */

export const colors = {
  // Background colors - Light, warm whites
  background: {
    primary: '#FAFAFA',      // Main background
    secondary: '#FFFFFF',    // Cards, elevated surfaces
    tertiary: '#F4F4F5',     // Subtle sections
    code: '#F8F8F8',         // Code blocks
    input: '#FFFFFF',        // Input fields
    sidebar: '#FFFFFF',      // Sidebar
  },

  // Text colors - Strong hierarchy
  text: {
    primary: '#18181B',      // Headings, primary content
    secondary: '#3F3F46',    // Body text
    muted: '#71717A',        // Captions, hints
    inverse: '#FFFFFF',      // Text on dark backgrounds
    code: '#18181B',         // Code text
    accent: '#2563EB',       // Links, emphasis
  },

  // Accent colors - Professional blue palette
  accent: {
    primary: '#2563EB',      // Primary action blue
    primaryHover: '#1D4ED8', // Darker on hover
    primaryLight: '#EFF6FF', // Light blue background
    secondary: '#0EA5E9',    // Secondary cyan
    tertiary: '#8B5CF6',     // Accent purple
  },

  // Status colors
  status: {
    success: '#059669',      // Green
    successLight: '#D1FAE5',
    error: '#DC2626',        // Red
    errorLight: '#FEE2E2',
    warning: '#D97706',      // Amber
    warningLight: '#FEF3C7',
    info: '#0EA5E9',         // Cyan
    infoLight: '#E0F2FE',
  },

  // Border colors
  border: {
    default: '#E4E4E7',      // Standard border
    light: '#F4F4F5',        // Subtle border
    dark: '#D4D4D8',         // Prominent border
    focus: '#2563EB',        // Focus ring
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
      border: '#E4E4E7',
    },
  },

  // Syntax highlighting
  syntax: {
    keyword: '#7C3AED',      // Purple
    string: '#059669',       // Green
    number: '#D97706',       // Amber
    comment: '#A1A1AA',      // Gray
    function: '#2563EB',     // Blue
    variable: '#18181B',     // Dark
    operator: '#DC2626',     // Red
    type: '#0EA5E9',         // Cyan
    punctuation: '#71717A',  // Muted
  },

  // Interactive states
  interactive: {
    hover: '#F4F4F5',
    active: '#E4E4E7',
    selected: '#EFF6FF',
    disabled: '#FAFAFA',
  },

  // Shadows
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.07)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  },
} as const;

export type Colors = typeof colors;
export type ColorKey = keyof Colors;
