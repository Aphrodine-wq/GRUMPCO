import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump intern - Generate code that looks like an intern wrote it
 * Or translate existing code to "intern quality"
 */

const internPatterns = [
  { name: "Magic Numbers", example: "if (x === 7) { // don't change this }" },
  { name: "TODO Forever", example: "// TODO: Fix this later (written 3 years ago)" },
  { name: "Comment Lies", example: "// This increments x\nx--;" },
  { name: "Variable Soup", example: "let data, data2, data3, dataFinal, dataReallyFinal;" },
  { name: "Try-Catch-Ignore", example: "try { ... } catch(e) { /* lol */ }" },
  { name: "Console.log Everywhere", example: "console.log('here'); console.log('here 2');" },
  { name: "Copy-Paste Paradise", example: "// The same function appears 6 times" },
  { name: "Nuclear Option", example: "!important !important !important" },
  { name: "Callback Hell", example: "func(() => func(() => func(() => {})))" },
  { name: "One-Letter Variables", example: "let a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p;" }
];

const internExcuses = [
  "It worked on my local machine!",
  "The test said it passed! I didn't know tests could lie.",
  "I followed the tutorial exactly!",
  "Stack Overflow said to do it this way!",
  "The senior dev said to 'just make it work'!",
  "I didn't know we had a style guide!",
  "But it's only 500 lines in one function!",
  "The deadline was in 10 minutes!",
  "I'll refactor it later, I promise!",
  "ChatGPT wrote this, not me!"
];

const internAchievements = [
  { name: "First Commit", desc: "Made first commit (to main, of course)" },
  { name: "Force Pusher", desc: "Learned about git push --force the hard way" },
  { name: "Bug Creator", desc: "Fixed 1 bug, created 5 new ones" },
  { name: "Merge Conflict Expert", desc: "Accepted both changes everywhere" },
  { name: "Production Tester", desc: "Who needs staging anyway?" },
  { name: "npm install Master", desc: "Added 847 dependencies for a button" },
  { name: "CSS Wizard", desc: "Made everything !important" },
  { name: "Coffee Survivor", desc: "5 cups before noon" },
  { name: "Meeting Endurer", desc: "Survived first sprint planning" },
  { name: "Impostor", desc: "Realized everyone else is also pretending" }
];

interface InternOptions {
  excuse?: boolean;
  translate?: boolean;
  achievement?: boolean;
}

export async function execute(options: InternOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  👶 INTERN SIMULATOR 👶\n', 'title'));
  
  if (options.excuse) {
    const excuse = internExcuses[Math.floor(Math.random() * internExcuses.length)];
    console.log(branding.box('INTERN EXCUSE:', 'info'));
    console.log(chalk.hex(branding.colors.white)(`\n  "${excuse}"\n`));
    console.log(branding.status('This excuse has been used 47 times today.', 'sassy'));
    return;
  }
  
  if (options.achievement) {
    console.log(chalk.hex(branding.colors.mediumPurple)('  🏆 INTERN ACHIEVEMENTS UNLOCKED:\n'));
    
    const unlocked = internAchievements.slice(0, Math.floor(Math.random() * 5) + 3);
    for (const achievement of unlocked) {
      console.log(chalk.hex(branding.colors.white)(`    🎖️ ${achievement.name}`));
      console.log(chalk.hex(branding.colors.lightPurple)(`       ${achievement.desc}\n`));
    }
    console.log(branding.getDivider());
    return;
  }
  
  // Default: Show intern code patterns
  console.log(chalk.hex(branding.colors.mediumPurple)('  📋 CLASSIC INTERN CODE PATTERNS:\n'));
  
  for (const pattern of internPatterns) {
    console.log(chalk.hex(branding.colors.white)(`  📌 ${pattern.name}`));
    console.log(chalk.bgHex(branding.colors.darkPurple).hex(branding.colors.lightPurple)(`     ${pattern.example}`));
    console.log('');
  }
  
  console.log(branding.getDivider());
  
  // Random stats
  const stats = {
    linesWritten: Math.floor(Math.random() * 1000) + 100,
    linesDeleted: Math.floor(Math.random() * 800) + 50,
    prsRejected: Math.floor(Math.random() * 20) + 5,
    stackOverflowVisits: Math.floor(Math.random() * 500) + 100,
    cryingSessions: Math.floor(Math.random() * 10) + 1
  };
  
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📊 INTERN PRODUCTIVITY METRICS:\n'));
  console.log(chalk.hex(branding.colors.white)(`    Lines of code written: ${stats.linesWritten}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Lines of code deleted: ${stats.linesDeleted}`));
  console.log(chalk.hex(branding.colors.white)(`    PRs rejected: ${stats.prsRejected}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Stack Overflow visits: ${stats.stackOverflowVisits}`));
  console.log(chalk.hex(branding.colors.white)(`    Bathroom crying sessions: ${stats.cryingSessions}`));
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Remember: Every senior dev was once an intern. There is hope.', 'sassy'));
}

export const internCommand = { execute };
