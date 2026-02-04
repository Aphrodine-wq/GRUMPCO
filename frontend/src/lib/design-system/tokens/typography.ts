/**
 * G-Rump Design System - Typography Tokens
 * Space Grotesk (sans) + JetBrains Mono/Fira Code (code). 15-16px base.
 */

export const typography = {
  fontFamily: {
    sans: '"Space Grotesk", "Segoe UI", Helvetica Neue, Arial, sans-serif',
    serif: 'Georgia, serif',
    mono: '"JetBrains Mono", "Fira Code", "Space Mono", SF Mono, Menlo, Consolas, monospace',
  },

  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.8125rem', // 13px
    base: '0.9375rem', // 15px
    md: '1rem', // 16px
    lg: '1.0625rem', // 17px
    xl: '1.125rem', // 18px
    '2xl': '1.25rem', // 20px
    '3xl': '1.5rem', // 24px
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  lineHeight: {
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '1.75',
    code: '1.6',
  },

  letterSpacing: {
    tighter: '-0.025em',
    tight: '-0.0125em',
    normal: '0',
    wide: '0.0125em',
    wider: '0.025em',
  },
} as const;

export const textStyles = {
  h1: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.tight,
    letterSpacing: typography.letterSpacing.tight,
  },
  h2: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.tight,
    letterSpacing: typography.letterSpacing.tight,
  },
  h3: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.lineHeight.snug,
  },

  body: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },
  bodySmall: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },

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

  label: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.lineHeight.tight,
  },
  caption: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },
  button: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.lineHeight.tight,
  },
} as const;

export type Typography = typeof typography;
export type TextStyles = typeof textStyles;
