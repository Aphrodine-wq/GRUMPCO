import chalk from 'chalk';
import gradientString from 'gradient-string';

/**
 * G-Rump CLI Branding Module
 * Features the signature frowny face and color themes
 */

// Red/Orange gradient for the grumpy theme
const grumpyGradient = gradientString(['#FF4136', '#FF6B35', '#F7931E']);

// Frowny face ASCII art variations
const frownyFaces = {
  classic: `
    ▄▄▄▄▄▄▄
  ▄▀       ▀▄
 █   ▀   ▀   █
 █             █
  █   ▀██▀   █
   ▀▄       ▄▀
     ▀▀▀▀▀▀▀
  `,
  detailed: `
       ▄████████▄
     ▄███      ███▄
   ▄███   ▀  ▀   ███▄
  ███             ███
 ███               ███
 ███   ▀▀████▀▀   ███
  ███             ███
   ▀███   ▀▀▀   ███▀
     ▀███      ███▀
       ▀▀████▀▀
  `,
  compact: `
   ╭───────╮
   │ ╭ ╮ ╭ │
   │       │
   │  ╭╯╰╮ │
   ╰───────╯
  `,
  minimal: `
   ( ╭╮╭ )
    (   )
     ╰─╯
  `
};

// Logo text variations
const logoTexts = {
  full: 'G-RUMP CLI',
  short: 'GRUMP',
  tagline: 'The grumpiest AI assistant'
};

export const branding = {
  /**
   * Get the frowny face ASCII art
   */
  getFrownyFace(variant: keyof typeof frownyFaces = 'detailed'): string {
    return grumpyGradient(frownyFaces[variant]);
  },

  /**
   * Get the full logo with frowny face and text
   */
  getLogo(variant: keyof typeof frownyFaces = 'detailed'): string {
    const face = this.getFrownyFace(variant);
    const title = grumpyGradient(logoTexts.full);
    const tagline = chalk.hex('#F7931E')(logoTexts.tagline);
    const version = chalk.gray(`v${process.env.npm_package_version || '3.0.0'}`);
    
    return `
${face}
${title} ${version}
${tagline}
`;
  },

  /**
   * Get a mini logo for inline use
   */
  getMiniLogo(): string {
    return grumpyGradient('☹️  G-Rump');
  },

  /**
   * Get error frowny face
   */
  getErrorFace(): string {
    return chalk.redBright(`
    ▄▄▄▄▄▄▄
  ▄▀       ▀▄
 █   ╳   ╳   █
 █             █
  █   ▀██▀   █
   ▀▄       ▄▀
     ▀▀▀▀▀▀▀
    `);
  },

  /**
   * Get success face (slightly less frowny)
   */
  getSuccessFace(): string {
    return gradientString(['#F7931E', '#FF6B35'])(`
    ▄▄▄▄▄▄▄
  ▄▀       ▀▄
 █   ◠   ◠   █
 █             █
  █   ▀██▀   █
   ▀▄       ▄▀
     ▀▀▀▀▀▀▀
    `);
  },

  /**
   * Get thinking face
   */
  getThinkingFace(): string {
    const face = `
    ▄▄▄▄▄▄▄
  ▄▀       ▀▄
 █   o   o   █
 █      -      █
  █   ▄██▄   █
   ▀▄       ▄▀
     ▀▀▀▀▀▀▀
    `;
    return chalk.hex('#FF6B35')(face);
  },

  /**
   * Format text with the grumpy theme
   */
  format(text: string, style: 'title' | 'subtitle' | 'text' | 'dim' | 'error' = 'text'): string {
    switch (style) {
      case 'title':
        return chalk.bold(grumpyGradient(text));
      case 'subtitle':
        return chalk.hex('#FF6B35').bold(text);
      case 'text':
        return chalk.white(text);
      case 'dim':
        return chalk.gray(text);
      case 'error':
        return chalk.redBright.bold(text);
      default:
        return text;
    }
  },

  /**
   * Get a colored divider line
   */
  getDivider(): string {
    return grumpyGradient('─'.repeat(60));
  },

  /**
   * Colorize status text
   */
  status(text: string, type: 'success' | 'error' | 'warning' | 'info' | 'pending' = 'info'): string {
    switch (type) {
      case 'success':
        return chalk.greenBright(`✓ ${text}`);
      case 'error':
        return chalk.redBright(`✗ ${text}`);
      case 'warning':
        return chalk.yellowBright(`⚠ ${text}`);
      case 'pending':
        return chalk.hex('#FF6B35')(`◐ ${text}`);
      case 'info':
      default:
        return chalk.cyan(`ℹ ${text}`);
    }
  },

  /**
   * Get themed progress indicators
   */
  getSpinnerFrames(): string[] {
    return ['◐', '◓', '◑', '◒'];
  },

  /**
   * Apply red/orange gradient to text
   */
  applyGradient(text: string): string {
    return grumpyGradient(text);
  }
};

// Export individual elements for convenience
export const { 
  getFrownyFace, 
  getLogo, 
  getMiniLogo, 
  getErrorFace, 
  getSuccessFace,
  getThinkingFace,
  format,
  getDivider,
  status,
  getSpinnerFrames,
  applyGradient
} = branding;
