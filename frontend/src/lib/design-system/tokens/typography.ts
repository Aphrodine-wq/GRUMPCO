/**
 * G-Rump Design System - Typography Tokens
 * JetBrains Mono focused for code-centric UI
 */

export const typography = {
  // Font families
  fontFamily: {
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },

  // Font sizes (rem based)
  fontSize: {
    xs: '0.7rem',      // 11.2px - tiny labels
    sm: '0.8rem',      // 12.8px - small text, captions
    base: '0.875rem',  // 14px - body text
    md: '0.95rem',     // 15.2px - slightly larger
    lg: '1.1rem',      // 17.6px - headings
    xl: '1.25rem',     // 20px - large headings
    '2xl': '1.5rem',   // 24px - hero text
  },

  // Font weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Line heights
  lineHeight: {
    tight: '1.25',     // Compact text
    snug: '1.375',     // Slightly compact
    normal: '1.5',     // Standard
    relaxed: '1.625',  // Comfortable reading
    loose: '2',        // Very spacious
    code: '1.6',       // Optimized for code
  },

  // Letter spacing
  letterSpacing: {
    tighter: '-0.02em',
    tight: '-0.01em',
    normal: '0',
    wide: '0.01em',
    wider: '0.02em',
  },
} as const;

// Pre-composed text styles
export const textStyles = {
  // Headings
  h1: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight.tight,
    letterSpacing: typography.letterSpacing.tight,
  },
  h2: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.tight,
    letterSpacing: typography.letterSpacing.tight,
  },
  h3: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.snug,
  },

  // Body text
  body: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },
  bodySmall: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },

  // Code
  code: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.code,
  },
  codeBlock: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.code,
  },

  // UI elements
  label: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.lineHeight.tight,
    letterSpacing: typography.letterSpacing.wide,
  },
  caption: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },
  button: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.lineHeight.tight,
  },
} as const;

export type Typography = typeof typography;
export type TextStyles = typeof textStyles;
