/**
 * G-Rump Design System - Token Exports
 * Central export for all design tokens
 */

export { colors, type Colors, type ColorKey } from './colors';
export { typography, textStyles, type Typography, type TextStyles } from './typography';
export { spacing, semanticSpacing, type Spacing, type SemanticSpacing } from './spacing';
export {
  animations,
  keyframes,
  animationPresets,
  type Animations,
  type Keyframes,
  type AnimationPresets,
} from './animations';

// CSS Custom Properties generator
import { colors } from './colors';
import { typography } from './typography';
import { spacing, semanticSpacing } from './spacing';
import { animations } from './animations';

/**
 * Generate CSS custom properties from tokens
 * Use in global styles or :root
 */
export function generateCSSVariables(): string {
  const lines: string[] = [];

  // Colors
  lines.push('/* Colors */');
  lines.push(`--color-bg-primary: ${colors.background.primary};`);
  lines.push(`--color-bg-secondary: ${colors.background.secondary};`);
  lines.push(`--color-bg-tertiary: ${colors.background.tertiary};`);
  lines.push(`--color-bg-code: ${colors.background.code};`);
  lines.push(`--color-bg-input: ${colors.background.input};`);
  lines.push(`--color-bg-sidebar: ${colors.background.sidebar};`);

  lines.push(`--color-text-primary: ${colors.text.primary};`);
  lines.push(`--color-text-secondary: ${colors.text.secondary};`);
  lines.push(`--color-text-muted: ${colors.text.muted};`);
  lines.push(`--color-text-inverse: ${colors.text.inverse};`);

  lines.push(`--color-accent-primary: ${colors.accent.primary};`);
  lines.push(`--color-accent-primary-hover: ${colors.accent.primaryHover};`);
  lines.push(`--color-accent-primary-light: ${colors.accent.primaryLight};`);

  lines.push(`--color-status-success: ${colors.status.success};`);
  lines.push(`--color-status-success-light: ${colors.status.successLight};`);
  lines.push(`--color-status-error: ${colors.status.error};`);
  lines.push(`--color-status-error-light: ${colors.status.errorLight};`);
  lines.push(`--color-status-warning: ${colors.status.warning};`);
  lines.push(`--color-status-warning-light: ${colors.status.warningLight};`);

  lines.push(`--color-border-default: ${colors.border.default};`);
  lines.push(`--color-border-light: ${colors.border.light};`);
  lines.push(`--color-border-focus: ${colors.border.focus};`);

  // Diff colors
  lines.push('/* Diff Colors */');
  lines.push(`--color-diff-added-bg: ${colors.diff.added.background};`);
  lines.push(`--color-diff-added-border: ${colors.diff.added.border};`);
  lines.push(`--color-diff-added-text: ${colors.diff.added.text};`);
  lines.push(`--color-diff-removed-bg: ${colors.diff.removed.background};`);
  lines.push(`--color-diff-removed-border: ${colors.diff.removed.border};`);
  lines.push(`--color-diff-removed-text: ${colors.diff.removed.text};`);
  lines.push(`--color-diff-unchanged-bg: ${colors.diff.unchanged.background};`);
  lines.push(`--color-diff-unchanged-text: ${colors.diff.unchanged.text};`);
  lines.push(`--color-diff-line-number-bg: ${colors.diff.lineNumber.background};`);
  lines.push(`--color-diff-line-number-text: ${colors.diff.lineNumber.text};`);

  // Typography
  lines.push('/* Typography */');
  lines.push(`--font-mono: ${typography.fontFamily.mono};`);
  lines.push(`--font-sans: ${typography.fontFamily.sans};`);
  lines.push(`--font-size-xs: ${typography.fontSize.xs};`);
  lines.push(`--font-size-sm: ${typography.fontSize.sm};`);
  lines.push(`--font-size-base: ${typography.fontSize.base};`);
  lines.push(`--font-size-md: ${typography.fontSize.md};`);
  lines.push(`--font-size-lg: ${typography.fontSize.lg};`);
  lines.push(`--font-size-xl: ${typography.fontSize.xl};`);
  lines.push(`--font-size-2xl: ${typography.fontSize['2xl']};`);
  lines.push(`--line-height-code: ${typography.lineHeight.code};`);

  // Spacing
  lines.push('/* Spacing */');
  lines.push(`--space-1: ${spacing[1]};`);
  lines.push(`--space-2: ${spacing[2]};`);
  lines.push(`--space-3: ${spacing[3]};`);
  lines.push(`--space-4: ${spacing[4]};`);
  lines.push(`--space-5: ${spacing[5]};`);
  lines.push(`--space-6: ${spacing[6]};`);
  lines.push(`--space-8: ${spacing[8]};`);
  lines.push(`--space-10: ${spacing[10]};`);
  lines.push(`--space-12: ${spacing[12]};`);

  // Radius
  lines.push('/* Border Radius */');
  lines.push(`--radius-sm: ${semanticSpacing.radius.sm};`);
  lines.push(`--radius-md: ${semanticSpacing.radius.md};`);
  lines.push(`--radius-lg: ${semanticSpacing.radius.lg};`);
  lines.push(`--radius-xl: ${semanticSpacing.radius.xl};`);
  lines.push(`--radius-full: ${semanticSpacing.radius.full};`);

  // Layout
  lines.push('/* Layout */');
  lines.push(`--sidebar-width: ${semanticSpacing.layout.sidebarWidth};`);
  lines.push(`--sidebar-collapsed: ${semanticSpacing.layout.sidebarCollapsed};`);
  lines.push(`--header-height: ${semanticSpacing.layout.headerHeight};`);
  lines.push(`--max-content-width: ${semanticSpacing.layout.maxContentWidth};`);

  // Animations
  lines.push('/* Animations */');
  lines.push(`--duration-fast: ${animations.duration.fast};`);
  lines.push(`--duration-quick: ${animations.duration.quick};`);
  lines.push(`--duration-normal: ${animations.duration.normal};`);
  lines.push(`--duration-slow: ${animations.duration.slow};`);
  lines.push(`--ease-out: ${animations.easing.easeOut};`);
  lines.push(`--ease-in: ${animations.easing.easeIn};`);
  lines.push(`--ease-in-out: ${animations.easing.easeInOut};`);
  lines.push(`--ease-spring: ${animations.easing.spring};`);
  lines.push(`--transition-fast: ${animations.transition.fast};`);
  lines.push(`--transition-default: ${animations.transition.default};`);
  lines.push(`--transition-slow: ${animations.transition.slow};`);

  return lines.join('\n');
}
