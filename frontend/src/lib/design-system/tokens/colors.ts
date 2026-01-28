/**
 * G-Rump Design System - Color Tokens
 * Premium Dark Theme with Aurora Gradients and Glassmorphism
 */

export const colors = {
  // Background colors
  background: {
    primary: 'var(--color-bg-app)',      // Deep space blue/black
    secondary: 'var(--glass-bg)',        // Glassmorphic panels
    tertiary: 'var(--color-bg-subtle)',  // Subtle sections
    code: 'var(--color-bg-input)',       // Code blocks
    input: 'var(--color-bg-input)',      // Input fields
    sidebar: 'var(--glass-bg)',          // Glass sidebar
  },

  // Text colors
  text: {
    primary: 'var(--color-text)',           // Headings, primary content
    secondary: 'var(--color-text-secondary)', // Body text
    muted: 'var(--color-text-muted)',       // Captions, hints
    inverse: 'var(--color-text-inverse)',   // Text on light backgrounds
    code: 'var(--color-text)',              // Code text
  },

  // Accent colors
  accent: {
    primary: 'var(--color-primary)',        // Electric Blue
    primaryHover: 'var(--color-primary-hover)',
    primaryLight: 'rgba(59, 130, 246, 0.1)', // Light blue tint
  },

  // Status colors
  status: {
    success: 'var(--color-success)',
    successLight: 'rgba(16, 185, 129, 0.2)',
    error: 'var(--color-error)',
    errorLight: 'rgba(239, 68, 68, 0.2)',
    warning: 'var(--color-warning)',
    warningLight: 'rgba(245, 158, 11, 0.2)',
    info: 'var(--color-primary)',
    infoLight: 'rgba(59, 130, 246, 0.2)',
  },

  // Code diff colors
  diff: {
    added: {
      background: 'rgba(16, 185, 129, 0.2)',
      border: 'var(--color-success)',
      text: '#4ADE80',
    },
    removed: {
      background: 'rgba(239, 68, 68, 0.2)',
      border: 'var(--color-error)',
      text: '#F87171',
    },
    unchanged: {
      background: 'transparent',
      text: 'var(--color-text-secondary)',
    },
    lineNumber: {
      background: 'rgba(255, 255, 255, 0.05)',
      text: 'var(--color-text-muted)',
      border: 'transparent',
    },
  },

  // Syntax highlighting
  syntax: {
    keyword: '#C084FC',      // Purple
    string: '#4ADE80',       // Green
    number: '#FBBF24',       // Amber
    comment: '#94A3B8',      // Slate
    function: '#60A5FA',     // Blue
    variable: '#E2E8F0',     // Light
    operator: '#F87171',     // Red
    type: '#2DD4BF',         // Teal
    punctuation: '#94A3B8',  // Slate
  },

  // Interactive states
  interactive: {
    hover: 'var(--color-bg-card-hover)',
    active: 'rgba(59, 130, 246, 0.1)',
    selected: 'rgba(59, 130, 246, 0.15)',
    disabled: 'rgba(255, 255, 255, 0.1)',
  },

  // Shadows
  shadow: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    floating: 'var(--shadow-glow)',
  },
} as const;

export type Colors = typeof colors;
export type ColorKey = keyof Colors;
