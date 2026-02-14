/**
 * Constants and template data for the DesignToCodeScreen.
 * Extracted to keep the main component under ~500 lines.
 */

export const LAYOUT_PRESETS = [
  { id: 'none', label: 'None', description: 'No structure preset' },
  {
    id: 'header-hero-2col-footer',
    label: 'Header + Hero + 2-col + Footer',
    description: 'Section-based page',
  },
  { id: 'header-hero-footer', label: 'Header + Hero + Footer', description: 'Simple landing' },
  { id: '2col', label: '2-column grid', description: 'Two equal columns' },
  { id: '3col', label: '3-column grid', description: 'Three equal columns' },
  { id: 'sidebar-main', label: 'Sidebar + Main', description: 'Sidebar layout' },
  { id: 'app-shell', label: 'App shell', description: 'Header, nav, main content area' },
] as const;

export type LayoutPresetId = (typeof LAYOUT_PRESETS)[number]['id'];

export interface DesignTemplate {
  id?: string;
  label: string;
  description: string;
  group: string;
}

export const TEMPLATES_FALLBACK: DesignTemplate[] = [
  {
    label: 'Dashboard',
    description: 'A dashboard with header, sidebar, and main content area with stats cards.',
    group: 'Layouts',
  },
  {
    label: 'Card',
    description: 'A responsive card grid with image, title, and description per card.',
    group: 'Layouts',
  },
  {
    label: 'Form',
    description: 'A form with labels, inputs, and submit button.',
    group: 'Forms & Pages',
  },
  {
    label: 'Auth',
    description: 'Login or signup form with email, password, and Submit.',
    group: 'Forms & Pages',
  },
  {
    label: 'List',
    description: 'A list view with items, optional filters, and actions.',
    group: 'Layouts',
  },
  {
    label: 'Settings',
    description: 'A settings page with sections and toggle/input controls.',
    group: 'Forms & Pages',
  },
  {
    label: 'Pricing',
    description: 'A pricing table with tiers and feature lists.',
    group: 'Layouts',
  },
  {
    label: 'Landing',
    description: 'A landing page with hero, features section, and CTA.',
    group: 'Layouts',
  },
  {
    label: 'Data table',
    description: 'A data table with sortable columns, filters, and pagination.',
    group: 'Layouts',
  },
  {
    label: 'Profile',
    description: 'A user profile page with avatar, bio, and edit form.',
    group: 'Forms & Pages',
  },
  {
    label: 'Hero',
    description: 'A hero section with headline, subtext, and CTA button.',
    group: 'Layouts',
  },
  {
    label: 'Sidebar layout',
    description: 'App layout with sidebar navigation and main content.',
    group: 'Layouts',
  },
  {
    label: 'App shell',
    description: 'Shell with header, nav, and main content area.',
    group: 'Layouts',
  },
  {
    label: 'Login form',
    description: 'A login form with email, password, and Submit button.',
    group: 'Forms & Pages',
  },
  {
    label: 'Settings page',
    description: 'A settings page with sections and toggle/input controls.',
    group: 'Forms & Pages',
  },
  {
    label: 'Pricing table',
    description: 'A pricing table with tiers and feature lists.',
    group: 'Layouts',
  },
];

export const STEP_LABELS = [
  { step: 1, title: 'Image(s)', hint: 'Screenshot or design mockup' },
  { step: 2, title: 'Description', hint: 'What you want the UI to do' },
  { step: 3, title: 'Template & Layout', hint: 'Preset and structure' },
  { step: 4, title: 'Framework', hint: 'Output framework' },
  { step: 5, title: 'Generate', hint: 'Get code + explanation' },
] as const;
