import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { extname } from 'path';
import { branding } from '../branding.js';

/**
 * grump coffee - Check if code is "coffee-ready" or needs more work
 * Because code quality is directly proportional to caffeine intake
 */

const coffeeReadiness: Record<string, string[]> = {
  ready: [
    "Code is steaming hot and ready to ship! ☕",
    "This code has been properly caffeinated and is ready for production.",
    "Code quality: Double espresso level. Ready to deploy!",
    "Freshly brewed and ready to go. The code, not you. You still need coffee.",
    "This code is like a perfect latte - smooth, balanced, and ready to enjoy."
  ],
  
  needsCoffee: [
    "Code needs more coffee. Currently decaf quality.",
    "This code is like cold coffee - technically works but nobody wants it.",
    "Needs a triple shot. Currently running on empty.",
    "Your code is yawning. Give it some caffeine.",
    "This code hasn't had its morning coffee yet."
  ],
  
  emergency: [
    "EMERGENCY: Code is completely uncaffeinated. DO NOT SHIP.",
    "This code is running on pure sleep deprivation. Dangerous levels.",
    "WARNING: Code quality below coffee threshold. Abort mission.",
    "Your code needs an IV drip of espresso, stat!",
    "This code hasn't seen caffeine in days. It's delirious."
  ]
};

const coffeeChecks = {
  hasTests: (content: string) => {
    return content.includes('test') || content.includes('describe') || content.includes('it(');
  },
  
  hasErrorHandling: (content: string) => {
    return content.includes('try') || content.includes('catch') || content.includes('throw');
  },
  
  hasComments: (content: string) => {
    const lines = content.split('\n');
    const commentLines = lines.filter(l => 
      l.trim().startsWith('//') || 
      l.trim().startsWith('#') || 
      l.trim().startsWith('*') ||
      l.trim().startsWith('/*')
    ).length;
    return commentLines > 2;
  },
  
  noConsoleLogs: (content: string) => {
    const matches = content.match(/console\.log/g);
    return !matches || matches.length <= 2;
  },
  
  reasonableLength: (content: string) => {
    const lines = content.split('\n').length;
    return lines < 300;
  },
  
  noTODOs: (content: string) => {
    const matches = content.match(/TODO|FIXME|HACK/g);
    return !matches || matches.length <= 3;
  }
};

interface CoffeeOptions {
  file?: string;
  all?: boolean;
}

export async function execute(filePath: string | undefined, options: CoffeeOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  ☕ COFFEE READINESS CHECK ☕\n', 'title'));
  
  const target = filePath;
  
  if (!target && !options.all) {
    console.log(branding.status('No file specified. Checking your caffeine levels instead...', 'sassy'));
    await checkDeveloperCoffeeLevels();
    return;
  }

  if (options.all) {
    console.log(branding.format('  Checking all files... This might take a few coffee breaks.', 'subtitle'));
    console.log(branding.getThinDivider());
  } else if (target) {
    console.log(branding.format(`  Target: ${target}`, 'subtitle'));
    console.log(branding.getThinDivider());
    
    if (!existsSync(target)) {
      console.log(branding.status("File not found. Did it run away from its responsibilities too?", 'error'));
      return;
    }
    
    await checkFileCoffeeReadiness(target);
  }
}

async function checkFileCoffeeReadiness(filePath: string): Promise<void> {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    console.log(branding.status("Can't read this file. It's probably sleeping.", 'error'));
    return;
  }

  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  ☕ ANALYZING CAFFEINE LEVELS...\n`));
  
  // Run checks
  const results = {
    tests: { passed: coffeeChecks.hasTests(content), name: 'Has Tests' },
    errorHandling: { passed: coffeeChecks.hasErrorHandling(content), name: 'Error Handling' },
    comments: { passed: coffeeChecks.hasComments(content), name: 'Has Comments' },
    noDebug: { passed: coffeeChecks.noConsoleLogs(content), name: 'No Debug Logs' },
    reasonable: { passed: coffeeChecks.reasonableLength(content), name: 'Reasonable Size' },
    todos: { passed: coffeeChecks.noTODOs(content), name: 'Minimal TODOs' }
  };
  
  let passedCount = 0;
  
  for (const [key, result] of Object.entries(results)) {
    await delay(300);
    const emoji = result.passed ? '☕' : '😴';
    const status = result.passed 
      ? chalk.bgHex(branding.colors.white).hex(branding.colors.darkPurple)(` ✓ `)
      : chalk.bgHex(branding.colors.darkPurple).white(` ✗ `);
    
    console.log(`  ${status} ${emoji} ${result.name}`);
    
    if (result.passed) passedCount++;
  }
  
  // Calculate coffee score
  const score = (passedCount / 6) * 100;
  
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  ☕ COFFEE SCORE: ${score.toFixed(0)}%`));
  
  // Determine readiness
  let readiness: keyof typeof coffeeReadiness;
  if (score >= 80) {
    readiness = 'ready';
  } else if (score >= 50) {
    readiness = 'needsCoffee';
  } else {
    readiness = 'emergency';
  }
  
  const message = coffeeReadiness[readiness][Math.floor(Math.random() * coffeeReadiness[readiness].length)];
  
  if (score >= 80) {
    console.log(branding.box(message, 'success'));
  } else if (score >= 50) {
    console.log(branding.box(message, 'warning'));
  } else {
    console.log(branding.box(message, 'error'));
  }
  
  // Recommendations
  if (score < 100) {
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n  💡 COFFEE RECOMMENDATIONS:\n`));
    if (!results.tests.passed) console.log(chalk.hex(branding.colors.lightPurple)(`    → Add some tests. Your future self will thank you.`));
    if (!results.errorHandling.passed) console.log(chalk.hex(branding.colors.lightPurple)(`    → Error handling isn't optional. Handle it.`));
    if (!results.comments.passed) console.log(chalk.hex(branding.colors.lightPurple)(`    → Comments help. Future you is an amnesiac.`));
    if (!results.noDebug.passed) console.log(chalk.hex(branding.colors.lightPurple)(`    → Remove console.logs. They're not decorations.`));
    if (!results.reasonable.passed) console.log(chalk.hex(branding.colors.lightPurple)(`    → Split large files. Your sanity will improve.`));
    if (!results.todos.passed) console.log(chalk.hex(branding.colors.lightPurple)(`    → Fix those TODOs. Or admit defeat and remove them.`));
  }
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Coffee check complete. Remember: Decaf is for the weak.', 'sassy'));
}

async function checkDeveloperCoffeeLevels(): Promise<void> {
  const hours = new Date().getHours();
  let status: string;
  let emoji: string;
  
  if (hours < 6) {
    status = "Why are you even awake? Go back to bed.";
    emoji = '😴';
  } else if (hours < 9) {
    status = "Early bird special! Your first coffee is probably cold by now.";
    emoji = '☕';
  } else if (hours < 12) {
    status = "Morning coffee levels should be optimal. Time to code!";
    emoji = '☕☕';
  } else if (hours < 14) {
    status = "Post-lunch slump detected. Time for coffee #3.";
    emoji = '☕☕☕';
  } else if (hours < 17) {
    status = "Afternoon coffee required. Code quality depends on it.";
    emoji = '☕☕☕☕';
  } else if (hours < 20) {
    status = "Evening coding? You're either dedicated or procrastinating.";
    emoji = '🌙☕';
  } else {
    status = "Late night coding. Switch to decaf or sleep, please.";
    emoji = '🌙😴';
  }
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  ${emoji} DEVELOPER COFFEE STATUS:\n`));
  console.log(chalk.hex(branding.colors.white)(`    ${status}`));
  
  const coffeeNeeded = hours >= 14 && hours < 20 ? "EMERGENCY COFFEE NEEDED" : "Coffee levels acceptable";
  console.log(chalk.hex(branding.colors.lightPurple)(`\n    Assessment: ${coffeeNeeded}`));
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const coffeeCommand = { execute };
