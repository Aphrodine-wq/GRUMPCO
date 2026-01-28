/**
 * G-Rump Design System - Spacing Tokens
 * Consistent spacing scale for layout and components
 */

export const spacing = {
  // Base spacing scale (px values as rem)
  0: '0',
  px: '1px',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  11: '2.75rem',     // 44px
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
} as const;

// Semantic spacing
export const semanticSpacing = {
  // Component internal padding
  component: {
    xs: spacing[1],      // 4px - very compact
    sm: spacing[2],      // 8px - compact
    md: spacing[3],      // 12px - default
    lg: spacing[4],      // 16px - comfortable
    xl: spacing[6],      // 24px - spacious
  },

  // Gaps between elements
  gap: {
    xs: spacing[1],      // 4px
    sm: spacing[2],      // 8px
    md: spacing[3],      // 12px
    lg: spacing[4],      // 16px
    xl: spacing[6],      // 24px
    '2xl': spacing[8],   // 32px
  },

  // Section margins
  section: {
    sm: spacing[4],      // 16px
    md: spacing[6],      // 24px
    lg: spacing[8],      // 32px
    xl: spacing[12],     // 48px
  },

  // Input/button heights
  height: {
    sm: spacing[7],      // 28px - small buttons
    md: spacing[9],      // 36px - default inputs
    lg: spacing[11],     // 44px - large buttons
  },

  // Border radius
  radius: {
    none: '0',
    sm: '0.25rem',       // 4px
    md: '0.375rem',      // 6px
    lg: '0.5rem',        // 8px
    xl: '0.75rem',       // 12px
    '2xl': '1rem',       // 16px
    full: '9999px',      // Pill shape
  },

  // Sidebar and panels
  layout: {
    sidebarWidth: '280px',
    sidebarCollapsed: '48px',
    headerHeight: '48px',
    maxContentWidth: '56rem',  // 896px
    chatMaxWidth: '48rem',     // 768px (original)
  },
} as const;

export type Spacing = typeof spacing;
export type SemanticSpacing = typeof semanticSpacing;
