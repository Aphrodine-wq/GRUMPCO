import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump legacy - Deal with legacy code with maximum trauma
 * Because someone thought this was a good idea in 2007
 */

const legacyHorrors = [
  "This file was last modified when jQuery was cutting-edge.",
  "Comments in a language nobody on the team speaks.",
  "Dependencies that haven't been updated since Obama's first term.",
  "A single function that's longer than your entire modern codebase.",
  "Inline styles from before Flexbox existed.",
  "Global variables named 'temp', 'temp2', and 'tempFinal'.",
  "A switch statement with 47 cases.",
  "Commented-out code from 3 CEOs ago.",
  "A for loop that iterates backwards for no apparent reason.",
  "SQL queries built with string concatenation.",
  "A callback inside a callback inside a callback inside a callback.",
  "Error handling: if(error) { /* ignore */ }",
  "The entire business logic in one 5000-line stored procedure.",
  "A regex that would make Cthulhu weep.",
  "Documentation that just says 'self-explanatory'."
];

const refactoringExcuses = [
  "If it ain't broke, don't touch it. (It is very broke.)",
  "The original developer was a genius. We don't understand geniuses.",
  "There's no budget for refactoring. (There's also no budget for new features while this exists.)",
  "It's 'battle-tested code'. (The battle was lost.)",
  "We'll refactor it after this sprint. (Sprint 47 and counting.)",
  "It's a 'temporary solution'. (From 2011.)",
  "The documentation is 'coming soon'. (Since 2015.)",
  "We don't have test coverage. Because we value chaos.",
  "The person who wrote this left the company. And the industry.",
  "It works. Nobody knows how. But it works."
];

const archaeologyTips = [
  "git blame is your friend. Use it to know who to avoid.",
  "Read the commit messages. 'Fixed bug' tells you nothing, as intended.",
  "Check the .gitignore. The real horrors are hidden there.",
  "Look at package.json. Marvel at the abandoned dependencies.",
  "Search for TODO comments. Count your nightmares.",
  "Check the test folder. It's probably empty. Or worse, full of lies.",
  "Look at the database schema. Question your career choices.",
  "Read the README. It's for a completely different project.",
  "Check the environment variables. Notice the one named 'TEMP_FIX_REMOVE_LATER'.",
  "Review the error logs. They've been ignored since inception."
];

interface LegacyOptions {
  horror?: boolean;
  excuse?: boolean;
  tips?: boolean;
  age?: number;
}

export async function execute(options: LegacyOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🏚️ LEGACY CODE THERAPY 🏚️\n', 'title'));
  
  if (options.horror) {
    console.log(chalk.hex(branding.colors.mediumPurple)('  👻 LEGACY HORRORS UNCOVERED:\n'));
    const horrors = shuffleArray(legacyHorrors).slice(0, 5);
    for (const horror of horrors) {
      console.log(chalk.hex(branding.colors.white)(`    ☠️ ${horror}`));
      await delay(300);
    }
    console.log('\n' + branding.getDivider());
    return;
  }
  
  if (options.excuse) {
    const excuse = refactoringExcuses[Math.floor(Math.random() * refactoringExcuses.length)];
    console.log(branding.box('EXCUSE FOR NOT REFACTORING:', 'warning'));
    console.log(chalk.hex(branding.colors.white)(`\n  "${excuse}"\n`));
    return;
  }
  
  if (options.tips) {
    console.log(chalk.hex(branding.colors.mediumPurple)('  🔍 CODE ARCHAEOLOGY TIPS:\n'));
    for (const tip of archaeologyTips) {
      console.log(chalk.hex(branding.colors.white)(`    📜 ${tip}`));
    }
    console.log('\n' + branding.getDivider());
    return;
  }
  
  // Default: Full legacy experience
  const codeAge = options.age || Math.floor(Math.random() * 15) + 3;
  
  console.log(chalk.hex(branding.colors.mediumPurple)('  📅 LEGACY CODE ANALYSIS:\n'));
  console.log(chalk.hex(branding.colors.white)(`    Estimated age: ${codeAge} years`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    In JavaScript years: ${codeAge * 12} frameworks ago`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    In human suffering: Immeasurable`));
  
  console.log('\n' + branding.getDivider());
  
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🎰 LEGACY BINGO - What did you find?\n'));
  
  const bingoItems = [
    "[ ] jQuery", "[ ] CoffeeScript", "[ ] Backbone.js",
    "[ ] Angular 1.x", "[ ] Knockout.js", "[ ] Grunt",
    "[ ] var everywhere", "[ ] PHP", "[ ] Flash",
    "[ ] Table layouts", "[ ] IE6 hacks", "[ ] CVS"
  ];
  
  for (let i = 0; i < bingoItems.length; i += 3) {
    const row = bingoItems.slice(i, i + 3).map(item => 
      chalk.hex(branding.colors.lightPurple)(item.padEnd(18))
    ).join(' ');
    console.log(`    ${row}`);
  }
  
  console.log('\n' + branding.getDivider());
  
  const randomHorror = legacyHorrors[Math.floor(Math.random() * legacyHorrors.length)];
  console.log(branding.box(randomHorror, 'error'));
  
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Remember: Legacy code is just code that generates revenue.', 'sassy'));
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const legacyCommand = { execute };
