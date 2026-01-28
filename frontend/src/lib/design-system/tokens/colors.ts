/**
 * G-Rump Design System - Color Tokens
 * Dark terminal/Claude Code focused palette
 */

export const colors = {
  // Background colors
  background: {
    primary: '#0D0D0D',      // Deep black (terminal bg)
    secondary: '#1A1A1A',    // Slightly lighter (cards, sidebars)
    tertiary: '#262626',     // Hover states
    code: '#000000',         // True black for code blocks
    input: '#121212',        // Input fields
    sidebar: '#141414',      // Sidebar background
  },

  // Text colors
  text: {
    primary: '#D4D4D4',      // Standard white/gray
    secondary: '#A3A3A3',    // Secondary text
    muted: '#525252',        // Muted/placeholder text
    inverse: '#000000',      // Text on light backgrounds (if any)
    code: '#E5E5E5',         // Code text
    accent: '#00FF41',       // Terminal green
  },

  // Accent colors (Terminal ANSI style)
  accent: {
    primary: '#00FF41',      // Matrix/Terminal Green
    primaryHover: '#00CC33', // Darker green
    primaryLight: 'rgba(0, 255, 65, 0.1)', // Green tint
    secondary: '#00E5FF',    // Cyan (for tools/actions)
    tertiary: '#BB86FC',     // Soft purple (for rare accents)
  },

  // Status colors (ANSI palette)
  status: {
    success: '#00FF41',      // Green
    successLight: 'rgba(0, 255, 65, 0.1)',
    error: '#FF3131',        // Red
    errorLight: 'rgba(255, 49, 49, 0.1)',
    warning: '#FFD700',      // Gold/Yellow
    warningLight: 'rgba(255, 215, 0, 0.1)',
    info: '#00E5FF',         // Cyan
    infoLight: 'rgba(0, 229, 255, 0.1)',
  },

  // Border colors (Rigid/Sharp)
  border: {
    default: '#333333',      // Standard border
    light: '#262626',        // Subtle border
    dark: '#404040',         // Prominent border
    focus: '#00FF41',        // Green focus
  },

  // Code diff colors (Dark theme)
  diff: {
    added: {
      background: 'rgba(0, 255, 65, 0.1)',
      border: '#00FF41',
      text: '#00FF41',
    },
    removed: {
      background: 'rgba(255, 49, 49, 0.1)',
      border: '#FF3131',
      text: '#FF3131',
    },
    unchanged: {
      background: 'transparent',
      text: '#D4D4D4',
    },
    lineNumber: {
      background: '#0D0D0D',
      text: '#404040',
      border: '#262626',
    },
  },

  // Syntax highlighting (Dark terminal theme)
  syntax: {
    keyword: '#BB86FC',      // Purple
    string: '#00FF41',       // Green
    number: '#FFD700',       // Gold
    comment: '#6B7280',      // Gray
    function: '#00E5FF',     // Cyan
    variable: '#E5E5E5',     // White
    operator: '#FF3131',     // Red
    type: '#00E5FF',         // Cyan
    punctuation: '#A3A3A3',  // Gray
  },

  // Interactive states
  interactive: {
    hover: 'rgba(255, 255, 255, 0.05)',
    active: 'rgba(255, 255, 255, 0.1)',
    selected: 'rgba(0, 255, 65, 0.15)',
    disabled: 'rgba(255, 255, 255, 0.02)',
  },

  // Shadows (Minimal elevation for terminal)
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
    md: '0 4px 6px rgba(0, 0, 0, 0.5)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
  },
} as const;

export type Colors = typeof colors;
export type ColorKey = keyof Colors;
