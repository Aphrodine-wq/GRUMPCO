/**
 * G-Rump Design System - Color Tokens
 * Light mode focused with consistent palette
 */

export const colors = {
  // Background colors
  background: {
    primary: '#F5F5F5',      // Main app background
    secondary: '#FFFFFF',    // Cards, panels
    tertiary: '#EBEBEB',     // Hover states
    code: '#FAFAFA',         // Code blocks
    input: '#F0F0F0',        // Input fields
    sidebar: '#FAFAFA',      // Sidebar background
  },

  // Text colors
  text: {
    primary: '#000000',      // Main text
    secondary: '#4B5563',    // Secondary text
    muted: '#9CA3AF',        // Muted/placeholder text
    inverse: '#FFFFFF',      // Text on dark backgrounds
    code: '#1F2937',         // Code text
  },

  // Accent colors
  accent: {
    primary: '#0066FF',      // Primary blue (brand)
    primaryHover: '#0052CC', // Hover state
    primaryLight: '#E6F0FF', // Light tint for backgrounds
    secondary: '#6366F1',    // Secondary purple
  },

  // Status colors
  status: {
    success: '#059669',      // Green
    successLight: '#D1FAE5', // Light green background
    error: '#DC2626',        // Red
    errorLight: '#FEE2E2',   // Light red background
    warning: '#F59E0B',      // Orange/amber
    warningLight: '#FEF3C7', // Light warning background
    info: '#3B82F6',         // Blue
    infoLight: '#DBEAFE',    // Light blue background
  },

  // Border colors
  border: {
    default: '#E5E7EB',      // Standard border
    light: '#F3F4F6',        // Subtle border
    dark: '#D1D5DB',         // Prominent border
    focus: 'rgba(0, 102, 255, 0.25)', // Focus ring
  },

  // Code diff colors (light theme)
  diff: {
    added: {
      background: '#DCFCE7',   // Light green
      border: '#86EFAC',       // Green border
      text: '#166534',         // Dark green text
    },
    removed: {
      background: '#FEE2E2',   // Light red
      border: '#FCA5A5',       // Red border
      text: '#991B1B',         // Dark red text
    },
    unchanged: {
      background: '#FFFFFF',   // White
      text: '#374151',         // Gray text
    },
    lineNumber: {
      background: '#F9FAFB',   // Very light gray
      text: '#9CA3AF',         // Muted text
      border: '#E5E7EB',       // Border
    },
  },

  // Syntax highlighting (light theme)
  syntax: {
    keyword: '#7C3AED',      // Purple (const, let, function)
    string: '#059669',       // Green
    number: '#0284C7',       // Blue
    comment: '#6B7280',      // Gray
    function: '#2563EB',     // Blue
    variable: '#1F2937',     // Dark gray
    operator: '#DC2626',     // Red
    type: '#0891B2',         // Cyan
    punctuation: '#374151',  // Dark gray
  },

  // Interactive states
  interactive: {
    hover: 'rgba(0, 0, 0, 0.04)',
    active: 'rgba(0, 0, 0, 0.08)',
    selected: 'rgba(0, 102, 255, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.02)',
  },

  // Shadows (for elevation)
  shadow: {
    sm: 'rgba(0, 0, 0, 0.05)',
    md: 'rgba(0, 0, 0, 0.1)',
    lg: 'rgba(0, 0, 0, 0.15)',
  },
} as const;

// Type for accessing colors
export type Colors = typeof colors;
export type ColorKey = keyof Colors;
