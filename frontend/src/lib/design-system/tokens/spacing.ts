/**
 * G-Rump Design System - Spacing Tokens
 * Consistent spacing scale for layout and components
 */

export const spacing = {
  // Base spacing scale (px values as rem)
  0: '0',
  px: '1px',
  0.5: '0.125rem', // 2px
  1: '0.25rem', // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem', // 8px
  2.5: '0.625rem', // 10px
  3: '0.75rem', // 12px
  3.5: '0.875rem', // 14px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  7: '1.75rem', // 28px
  8: '2rem', // 32px
  9: '2.25rem', // 36px
  10: '2.5rem', // 40px
  11: '2.75rem', // 44px
  12: '3rem', // 48px
  14: '3.5rem', // 56px
  16: '4rem', // 64px
  20: '5rem', // 80px
  24: '6rem', // 96px
} as const;

// Semantic spacing
export const semanticSpacing = {
  // Component internal padding (spacious)
  component: {
    xs: spacing[3], // 12px
    sm: spacing[4], // 16px
    md: spacing[5], // 20px
    lg: spacing[6], // 24px
    xl: spacing[8], // 32px
  },

  // Gaps between elements (generous spacing)
  gap: {
    xs: spacing[3], // 12px
    sm: spacing[4], // 16px
    md: spacing[5], // 20px
    lg: spacing[6], // 24px
    xl: spacing[8], // 32px
    '2xl': spacing[12], // 48px
  },

  // Section margins
  section: {
    sm: spacing[4], // 16px
    md: spacing[6], // 24px
    lg: spacing[8], // 32px
    xl: spacing[12], // 48px
  },

  // Input/button heights
  height: {
    sm: spacing[7], // 28px - small buttons
    md: spacing[9], // 36px - default inputs
    lg: spacing[11], // 44px - large buttons
  },

  // Border radius (rounded: 8, 12, 16, 24px)
  radius: {
    none: '0',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    full: '9999px',
  },

  // Sidebar and panels
  layout: {
    sidebarWidth: '230px',
    sidebarCollapsed: '64px', // Increased from 48px (was too small)
    headerHeight: '48px',
    maxContentWidth: '896px', // Same as before
    chatMaxWidth: '768px', // Claude.ai-style centered
  },
} as const;

export type Spacing = typeof spacing;
export type SemanticSpacing = typeof semanticSpacing;
