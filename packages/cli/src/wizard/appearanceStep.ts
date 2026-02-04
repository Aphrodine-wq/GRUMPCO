/**
 * Appearance Settings Step for G-Rump CLI Wizard
 */

import chalk from 'chalk';
import { prompt as askUser } from '../utils/prompt.js';
import { branding } from '../branding.js';

export interface AppearanceResult {
  theme: 'dark' | 'light' | 'minimal' | 'grumpy';
  colors: {
    primary: string;
    secondary: string;
    error: string;
  };
}

interface ThemeOption {
  name: string;
  value: string;
  colors: {
    primary: string;
    secondary: string;
    error: string;
  };
  preview: string;
}

const THEMES: ThemeOption[] = [
  {
    name: 'Dark (Default)',
    value: 'dark',
    colors: {
      primary: '#6B46C1',
      secondary: '#8B5CF6',
      error: '#EF4444'
    },
    preview: '████'
  },
  {
    name: 'Light',
    value: 'light',
    colors: {
      primary: '#7C3AED',
      secondary: '#A855F7',
      error: '#DC2626'
    },
    preview: '████'
  },
  {
    name: 'Minimal',
    value: 'minimal',
    colors: {
      primary: '#6B7280',
      secondary: '#9CA3AF',
      error: '#F87171'
    },
    preview: '████'
  },
  {
    name: 'Grumpy (Extra Purple!)',
    value: 'grumpy',
    colors: {
      primary: '#581C87',
      secondary: '#7C3AED',
      error: '#BE185D'
    },
    preview: '████'
  }
];

/**
 * Show theme preview
 */
function showThemePreview(theme: ThemeOption): void {
  console.log();
  console.log(chalk.dim('  Preview:'));
  console.log(
    `    ${chalk.hex(theme.colors.primary)('█')}${chalk.hex(theme.colors.secondary)('█')}${chalk.hex(theme.colors.error)('█')} ` +
    chalk.white(theme.name)
  );
  console.log();
}

/**
 * Run appearance settings step
 */
export async function runAppearanceStep(): Promise<AppearanceResult> {
  console.log(chalk.white('  Customize your CLI appearance:\n'));

  // Theme selection
  const { theme } = await askUser<{ theme: string }>([{
    type: 'list',
    name: 'theme',
    message: 'Choose a theme:',
    choices: THEMES.map(t => ({
      name: `${chalk.hex(t.colors.primary)('█')}${chalk.hex(t.colors.secondary)('█')}${chalk.hex(t.colors.error)('█')} ${t.name}`,
      value: t.value,
      short: t.name
    }))
  }]);

  const selectedTheme = THEMES.find(t => t.value === theme) || THEMES[0];

  // Ask if user wants to customize colors
  const { customize } = await askUser<{ customize: boolean }>([{
    type: 'confirm',
    name: 'customize',
    message: 'Want to customize colors?',
    default: false
  }]);

  let colors = selectedTheme.colors;

  if (customize) {
    const customColors = await askUser<{
      primary: string;
      secondary: string;
      error: string;
    }>([
      {
        type: 'input',
        name: 'primary',
        message: 'Primary color (hex):',
        default: selectedTheme.colors.primary,
        validate: (input: string) => /^#[0-9A-Fa-f]{6}$/.test(input) || 'Enter a valid hex color (e.g., #6B46C1)'
      },
      {
        type: 'input',
        name: 'secondary',
        message: 'Secondary color (hex):',
        default: selectedTheme.colors.secondary,
        validate: (input: string) => /^#[0-9A-Fa-f]{6}$/.test(input) || 'Enter a valid hex color'
      },
      {
        type: 'input',
        name: 'error',
        message: 'Error color (hex):',
        default: selectedTheme.colors.error,
        validate: (input: string) => /^#[0-9A-Fa-f]{6}$/.test(input) || 'Enter a valid hex color'
      }
    ]);
    colors = customColors;
  }

  // Show preview
  console.log();
  console.log(chalk.dim('  Your theme:'));
  console.log(
    `    ${chalk.hex(colors.primary)('████')} ${chalk.hex(colors.secondary)('████')} ${chalk.hex(colors.error)('████')}`
  );
  console.log();

  console.log(branding.status('Appearance settings saved!', 'success'));

  return {
    theme: theme as AppearanceResult['theme'],
    colors
  };
}
