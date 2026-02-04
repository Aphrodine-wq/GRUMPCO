import chalk from 'chalk';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { branding } from '../branding.js';

/**
 * grump roast <file> - Brutal code review with funny insults
 * Analyzes files and delivers savage yet hilarious critiques
 */

const codeRoasts: Record<string, string[]> = {
  js: [
    "JavaScript is already chaotic, but this? This is a new level.",
    "I've seen more structure in a bowl of spaghetti.",
    "Your promises are more broken than my trust in humanity.",
    "This async/await usage is giving me anxiety.",
    "Your callbacks are nested deeper than my existential dread."
  ],
  ts: [
    "TypeScript without types is just JavaScript with commitment issues.",
    "Any types everywhere? Might as well use 'magic'.",
    "Your interfaces are as empty as my coffee cup.",
    "Type safety left the chat when this file was written.",
    "This code is strongly typed... strongly typed garbage."
  ],
  py: [
    "Pythonic? This is more like Pyth-off-ic.",
    "Your indentation is as inconsistent as my sleep schedule.",
    "This would make Guido van Rossum weep.",
    "More exceptions than a bad dating history.",
    "Your imports are having a party and forgot to invite logic."
  ],
  java: [
    "Java? More like 'Jav-avoid this codebase'.",
    "Your factory factory factory is factory-ing my patience.",
    "This boilerplate could sink the Titanic.",
    "More abstract classes than concrete decisions.",
    "Your null checks are just accepting defeat gracefully."
  ],
  go: [
    "Go is simple, but you found a way to complicate it.",
    "Error handling by ignoring errors? Bold.",
    "Goroutines everywhere with no synchronization. Chaos theory in action.",
    "Your interfaces are implicit... and implicitly wrong.",
    "Panic recovery? More like panic inducement."
  ],
  rs: [
    "Rust is safe, but reading this code is dangerous for my sanity.",
    "So many unsafe blocks, I'm getting second-hand fear.",
    "Your lifetimes are shorter than my attention span.",
    "This borrows checker patience and never returns it.",
    "unwrap() everywhere? Living dangerously, I see."
  ],
  rb: [
    "Ruby is elegant. This file is... evidence against that.",
    "Monkey patching? More like gorilla warfare on good practices.",
    "Your blocks are more confusing than blockchain.",
    "Metaprogramming magic that's actually tragic.",
    "This syntax is giving me a headache. And I don't even get headaches."
  ],
  php: [
    "PHP has come so far. This code hasn't.",
    "Dollar signs everywhere but the code is worthless.",
    "Your includes are including chaos.",
    "More deprecated functions than a museum.",
    "This is why PHP gets roasted at conferences."
  ],
  html: [
    "HTML is forgiving, but I'm not.",
    "Your divs are having a nesting party.",
    "Tables for layout? Welcome to 1999.",
    "Inline styles? We need to talk about your life choices.",
    "This structure is more broken than my last relationship."
  ],
  css: [
    "CSS is hard, but !important everything is harder to maintain.",
    "Your specificity wars are more intense than Marvel movies.",
    "More floats than a parade, and just as chaotic.",
    "Responsive design? This responds to nothing.",
    "z-index of 9999? Trying to win at CSS like it's a video game."
  ],
  generic: [
    "This code violates the Geneva Convention... for code.",
    "I've seen clearer hieroglyphics.",
    "Your comments are lies and your code is the truth we don't want.",
    "This file should come with a trigger warning.",
    "Reading this code is like watching a slow-motion car crash.",
    "Your functions are doing God's work... if God was angry.",
    "This is what happens when caffeine and confidence collide.",
    "I've seen more organization in a toddler's toy box."
  ]
};

const metrics = {
  lineCount: (content: string) => content.split('\n').length,
  commentRatio: (content: string) => {
    const lines = content.split('\n');
    const commentLines = lines.filter(l => 
      l.trim().startsWith('//') || 
      l.trim().startsWith('#') || 
      l.trim().startsWith('*') ||
      l.trim().startsWith('/*') ||
      l.trim().startsWith("'")
    ).length;
    return (commentLines / lines.length * 100).toFixed(1);
  },
  todoCount: (content: string) => {
    const matches = content.match(/TODO|FIXME|HACK|XXX|BUG/gi);
    return matches ? matches.length : 0;
  },
  consoleLogCount: (content: string) => {
    const matches = content.match(/console\.log|print\(|printf|fmt\.Println|System\.out\.print/gi);
    return matches ? matches.length : 0;
  }
};

interface RoastOptions {
  brutal?: boolean;
  stats?: boolean;
}

export async function execute(filePath: string, options: RoastOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  
  if (!filePath) {
    console.log(branding.status('No file specified. What am I supposed to roast? Your ego?', 'error'));
    return;
  }

  if (!existsSync(filePath)) {
    console.log(branding.status(`File not found: ${filePath}. Did you delete it out of shame?`, 'error'));
    return;
  }

  const ext = extname(filePath).slice(1) || 'generic';
  const stats = statSync(filePath);
  
  console.log(branding.format(`\n  🔥 PREPARING THE ROAST 🔥\n`, 'title'));
  console.log(branding.format(`  Target: ${filePath}`, 'subtitle'));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Size: ${(stats.size / 1024).toFixed(2)} KB`));
  console.log(branding.getThinDivider());

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.log(branding.status("Can't read this file. It's probably embarrassed too.", 'error'));
    return;
  }

  // Show stats if requested
  if (options.stats) {
    console.log(chalk.hex(branding.colors.mediumPurple)('\n  📊 CODE STATISTICS (The Evidence):\n'));
    console.log(`  Lines: ${metrics.lineCount(content)}`);
    console.log(`  Comments: ${metrics.commentRatio(content)}% (probably lying anyway)`);
    console.log(`  TODOs/FIXMEs: ${metrics.todoCount(content)} (signs of hope)`);
    console.log(`  Debug logs: ${metrics.consoleLogCount(content)} (confession of sins)`);
    console.log(branding.getThinDivider());
  }

  // Get language-specific roasts or generic
  const langRoasts = codeRoasts[ext] || codeRoasts.generic;
  const allRoasts = options.brutal ? [...langRoasts, ...codeRoasts.generic] : langRoasts;

  // Deliver the roast
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🎤 THE ROAST:\n'));
  
  const roastCount = options.brutal ? 5 : 3;
  const selectedRoasts: string[] = [];
  
  while (selectedRoasts.length < roastCount) {
    const roast = allRoasts[Math.floor(Math.random() * allRoasts.length)];
    if (!selectedRoasts.includes(roast)) {
      selectedRoasts.push(roast);
    }
  }

  for (let i = 0; i < selectedRoasts.length; i++) {
    await delay(600);
    const emoji = ['🙄', '😤', '🤦', '🫠', '😵'][i % 5];
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${emoji}  ${selectedRoasts[i]}`));
  }

  // File-specific analysis
  await delay(400);
  console.log('\n' + branding.getDivider());
  
  const lineCount = metrics.lineCount(content);
  if (lineCount > 500) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  📏 This file is ${lineCount} lines. Split it before it splits my sanity.`));
  }
  
  if (metrics.todoCount(content) > 5) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  📝 Found ${metrics.todoCount(content)} TODOs. 'TODO' is not a valid architecture pattern.`));
  }
  
  if (metrics.consoleLogCount(content) > 3) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  🐛 ${metrics.consoleLogCount(content)} debug logs. Production-ready, are we?`));
  }

  // Closing
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Roast complete. Apply aloe vera to burned areas.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.85) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Pro tip: The compiler is judging you too, it just can't speak.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const roastCommand = { execute };
