import chalk from 'chalk';
import gradientString from 'gradient-string';

/**
 * G-Rump CLI Branding Module - Purple Edition
 * Features the signature frowny face and purple/white color themes
 * STRICT COLORS: #6B46C1 (Dark), #8B5CF6 (Medium), #A855F7 (Light), #FFFFFF (White)
 */

// Purple gradient for the grumpy theme (STRICT purple only)
const purpleGradient = gradientString(['#6B46C1', '#8B5CF6', '#A855F7']);
const darkPurple = '#6B46C1';
const mediumPurple = '#8B5CF6';
const lightPurple = '#A855F7';
const white = '#FFFFFF';

// Purple frowny face ASCII art variations
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
  `,
  // New: Shocked face for errors
  shocked: `
     ▄▄▄▄▄▄▄
   ▄▀       ▀▄
  █   ◯   ◯   █
  █      ◯      █
   █   ▀██▀   █
    ▀▄       ▄▀
      ▀▀▀▀▀▀▀
  `,
  // New: Sassy face
  sassy: `
     ▄▄▄▄▄▄▄
   ▄▀       ▀▄
  █   ¬   ¬   █
  █      -      █
   █   ▄██▄   █
    ▀▄       ▄▀
      ▀▀▀▀▀▀▀
  `
};

// Logo text variations
const logoTexts = {
  full: 'G-RUMP CLI',
  short: 'GRUMP',
  tagline: 'The grumpiest AI assistant (now in purple!)',
  altTaglines: [
    'The grumpiest AI assistant (now in purple!)',
    'Purple with sass',
    'Code review with attitude',
    'Your code\'s worst nightmare',
    '50 shades of purple rage',
    'Too sassy for your code',
    'Caffeinated and complaining',
    'Grumpy since 2024'
  ]
};

export const branding = {
  // Color constants
  colors: {
    darkPurple,
    mediumPurple,
    lightPurple,
    white
  },

  /**
   * Get the purple frowny face ASCII art
   */
  getFrownyFace(variant: keyof typeof frownyFaces = 'detailed'): string {
    return purpleGradient(frownyFaces[variant]);
  },

  /**
   * Get the full logo with frowny face and text
   */
  getLogo(variant: keyof typeof frownyFaces = 'detailed'): string {
    const face = this.getFrownyFace(variant);
    const title = purpleGradient(logoTexts.full);
    const randomTagline = logoTexts.altTaglines[Math.floor(Math.random() * logoTexts.altTaglines.length)];
    const tagline = chalk.hex(lightPurple)(randomTagline);
    const version = chalk.white(`v${process.env.npm_package_version || '3.0.0'}`);
    
    return `
${face}
${title} ${version}
${tagline}
`;
  },

  /**
   * Get a mini logo for inline use (purple + white)
   */
  getMiniLogo(): string {
    return chalk.hex(darkPurple)('☹️ ') + chalk.hex(white)('G-Rump');
  },

  /**
   * Get a sassy mini logo
   */
  getSassyLogo(): string {
    const sassies = [
      '☹️  G-Rump',
      '🙄 G-Rump',
      '😤 G-Rump',
      '🤦 G-Rump',
      '😒 G-Rump',
      '🤨 G-Rump',
      '🙃 G-Rump',
      '🫠 G-Rump'
    ];
    return chalk.hex(darkPurple)(sassies[Math.floor(Math.random() * sassies.length)]);
  },

  /**
   * Get error frowny face (STRICT: purple background concept, white text)
   */
  getErrorFace(): string {
    return chalk.bgHex(darkPurple).whiteBright.bold(`
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
   * Get success face (purple checkmark style - white bg with purple)
   */
  getSuccessFace(): string {
    return chalk.hex(mediumPurple)(`
    ▄▄▄▄▄▄▄
  ▄▀       ▀▄
 █   ◠   ◠   █
 █             █
  █   ▄██▄   █
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
    return chalk.hex(mediumPurple)(face);
  },

  /**
   * Get shocked face
   */
  getShockedFace(): string {
    return purpleGradient(frownyFaces.shocked);
  },

  /**
   * Get sassy face
   */
  getSassyFace(): string {
    return chalk.hex(lightPurple)(frownyFaces.sassy);
  },

  /**
   * Format text with the purple/white theme (STRICT)
   * White text on purple backgrounds, Purple on white backgrounds
   */
  format(text: string, style: 'title' | 'subtitle' | 'text' | 'dim' | 'error' | 'success' | 'sassy' = 'text'): string {
    switch (style) {
      case 'title':
        // White text with purple bold
        return chalk.hex(white).bold.bgHex(darkPurple)(` ${text} `);
      case 'subtitle':
        // Purple on white (inverse)
        return chalk.hex(mediumPurple).bold(text);
      case 'text':
        // Default white
        return chalk.hex(white)(text);
      case 'dim':
        // Light purple for dim text
        return chalk.hex('#C4B5FD')(text);
      case 'error':
        // STRICT: Purple background with white text
        return chalk.bgHex(darkPurple).whiteBright.bold(` ${text} `);
      case 'success':
        // White background with purple text
        return chalk.bgHex(white).hex(darkPurple).bold(` ${text} `);
      case 'sassy':
        // Light purple with sass
        return chalk.hex(lightPurple).italic(text);
      default:
        return text;
    }
  },

  /**
   * Get a colored divider line (purple gradient)
   */
  getDivider(): string {
    return purpleGradient('━'.repeat(60));
  },

  /**
   * Get a thin divider
   */
  getThinDivider(): string {
    return chalk.hex(darkPurple)('─'.repeat(60));
  },

  /**
   * Colorize status text (STRICT purple/white theme)
   */
  status(text: string, type: 'success' | 'error' | 'warning' | 'info' | 'pending' | 'sassy' = 'info'): string {
    switch (type) {
      case 'success':
        // White bg with purple checkmark
        return chalk.bgHex(white).hex(darkPurple)(` ✓ ${text} `);
      case 'error':
        // Purple bg with white text
        return chalk.bgHex(darkPurple).whiteBright(` ✗ ${text} `);
      case 'warning':
        // Medium purple warning
        return chalk.hex(mediumPurple)(` ⚠ ${text} `);
      case 'pending':
        // Light purple spinner
        return chalk.hex(lightPurple)(` ◐ ${text} `);
      case 'sassy':
        // Sassy purple
        return chalk.hex(lightPurple).italic(` 🙄 ${text} `);
      case 'info':
      default:
        // White info on purple
        return chalk.bgHex(darkPurple).white(` ℹ ${text} `);
    }
  },

  /**
   * Get themed progress indicators (purple themed - STRICT)
   */
  getSpinnerFrames(): string[] {
    return [
      chalk.hex(darkPurple)('◐'),
      chalk.hex(mediumPurple)('◓'),
      chalk.hex(lightPurple)('◑'),
      chalk.hex(mediumPurple)('◒')
    ];
  },

  /**
   * Get a purple progress bar
   */
  getProgressBar(percent: number, width: number = 30): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return purpleGradient(bar);
  },

  /**
   * Apply purple gradient to text
   */
  applyGradient(text: string): string {
    return purpleGradient(text);
  },

  /**
   * Get a random sass message
   */
  getSass(): string {
    const sassyMessages = [
      "Your code has more issues than a magazine stand.",
      "I've seen better code in my nightmares.",
      "This code is giving me a headache... and I'm just a CLI.",
      "Is this what you call programming? Cute.",
      "My grandma codes better than this, and she uses punch cards.",
      "Error: Your code is too terrible to process.",
      "I've seen spaghetti code, but this is a whole buffet.",
      "Congratulations! You've discovered new ways to write bad code.",
      "This code is why I drink (metaphorically speaking).",
      "I'm not mad, just disappointed. Very, very disappointed.",
      "Did you write this before or after your coffee?",
      "Your code needs therapy. So do I, after reading it.",
      "This makes me want to throw an exception... at you.",
      "I've seen bugs smarter than this code.",
      "Your code quality: exists in the realm of imagination only."
    ];
    return chalk.hex(lightPurple).italic(sassyMessages[Math.floor(Math.random() * sassyMessages.length)]);
  },

  /**
   * Box a message in purple
   */
  box(text: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): string {
    const lines = text.split('\n');
    const maxLen = Math.max(...lines.map(l => l.length));
    const top = chalk.hex(darkPurple)('┌' + '─'.repeat(maxLen + 2) + '┐');
    const bottom = chalk.hex(darkPurple)('└' + '─'.repeat(maxLen + 2) + '┘');
    const content = lines.map(l => {
      const padded = l.padEnd(maxLen);
      switch (type) {
        case 'error':
          return chalk.bgHex(darkPurple).whiteBright(`│ ${padded} │`);
        case 'success':
          return chalk.hex(mediumPurple)(`│ ${padded} │`);
        case 'warning':
          return chalk.hex(lightPurple)(`│ ${padded} │`);
        default:
          return chalk.hex(white)(`│ ${padded} │`);
      }
    }).join('\n');
    return `${top}\n${content}\n${bottom}`;
  },

  /**
   * Get a random emoji with purple tint
   */
  getEmoji(type: 'grumpy' | 'sassy' | 'shocked' | 'thinking' = 'grumpy'): string {
    const emojis = {
      grumpy: ['☹️', '😤', '😠', '🤬', '😡'],
      sassy: ['🙄', '🤨', '😒', '🤦', '🙃'],
      shocked: ['😱', '😰', '😨', '🫠', '😵'],
      thinking: ['🤔', '🧐', '🤨', '🫤', '😶']
    };
    return emojis[type][Math.floor(Math.random() * emojis[type].length)];
  }
};

// Export individual elements for convenience
export const { 
  getFrownyFace, 
  getLogo, 
  getMiniLogo, 
  getSassyLogo,
  getErrorFace, 
  getSuccessFace,
  getThinkingFace,
  getShockedFace,
  getSassyFace,
  format,
  getDivider,
  getThinDivider,
  status,
  getSpinnerFrames,
  getProgressBar,
  applyGradient,
  getSass,
  box,
  getEmoji,
  colors
} = branding;
