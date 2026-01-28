/**
 * G-Rump Design System - Color Tokens
 * Modern iOS Theme (White/Black Minimal)
 */

export const colors = {
  // Background colors
  background: {
    primary: 'var(--color-bg-app)',      // Pure White
    secondary: 'var(--color-bg-subtle)', // iOS Grouped Background
    tertiary: 'var(--color-bg-card-hover)',
    code: 'var(--color-bg-input)',       // Light Gray
    input: 'var(--color-bg-input)',
    sidebar: 'var(--color-bg-subtle)',   // Distinct sidebar
  },

  // Text colors
  text: {
    primary: 'var(--color-text)',           // Pure Black
    secondary: 'var(--color-text-secondary)', // Gray
    muted: 'var(--color-text-muted)',       // Light Gray
    inverse: 'var(--color-text-inverse)',   // White
    code: '#1D1D1F',
  },

  // Accent colors
  accent: {
    primary: 'var(--color-primary)',        // iOS Blue
    primaryHover: 'var(--color-primary-hover)',
    primaryLight: 'rgba(0, 122, 255, 0.1)', // Light blue tint
  },

  // Status colors
  status: {
    success: 'var(--color-success)',
    successLight: 'rgba(52, 199, 89, 0.15)',
    error: 'var(--color-error)',
    errorLight: 'rgba(255, 59, 48, 0.15)',
    warning: 'var(--color-warning)',
    warningLight: 'rgba(255, 149, 0, 0.15)',
    info: 'var(--color-primary)',
    infoLight: 'rgba(0, 122, 255, 0.15)',
  },

  // Code diff colors (Light Theme Optimized)
  diff: {
    added: {
      background: 'rgba(52, 199, 89, 0.15)',
      border: 'var(--color-success)',
      text: '#047857',
    },
    removed: {
      background: 'rgba(255, 59, 48, 0.15)',
      border: 'var(--color-error)',
      text: '#B91C1C',
    },
    unchanged: {
      background: 'transparent',
      text: 'var(--color-text-secondary)',
    },
    lineNumber: {
      background: '#F2F2F7',
      text: 'var(--color-text-muted)',
      border: 'transparent',
    },
  },

  // Syntax highlighting (GitHub Light / Vercel Light inspired)
  syntax: {
    keyword: '#D73A49',      // Red
    string: '#032F62',       // Dark Blue
    number: '#005CC5',       // Blue
    comment: '#6A737D',      // Gray
    function: '#6F42C1',     // Purple
    variable: '#24292E',     // Dark Gray
    operator: '#D73A49',     // Red
    type: '#005CC5',         // Blue
    punctuation: '#24292E',
  },

  // Interactive states
  interactive: {
    hover: 'var(--color-bg-card-hover)',
    active: 'rgba(0, 122, 255, 0.1)',
    selected: 'rgba(0, 122, 255, 0.12)',
    disabled: 'rgba(0, 0, 0, 0.05)',
  },

  // Shadows
  shadow: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    floating: 'var(--shadow-glow)', // iOS Glow
  },
} as const;

export type Colors = typeof colors;
export type ColorKey = keyof Colors;
