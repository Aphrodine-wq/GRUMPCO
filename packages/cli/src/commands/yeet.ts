import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump yeet - YEET code or ideas into the void
 * For when you want to dramatically delete something
 */

const yeetQuotes = [
  "YEET! Gone forever. No regrets.",
  "This code has been yeeted into the shadow realm.",
  "Goodbye, you absolute disaster of a code block.",
  "Yeeted with extreme prejudice.",
  "Into the void it goes! Never to be seen again.",
  "That code? Never heard of it.",
  "The code has left the building. The planet. The dimension.",
  "YEET successful. Dopamine acquired.",
  "Deleted and forgotten. Just like my weekend plans.",
  "Gone. Reduced to atoms."
];

const yeetTargets = [
  "that entire class nobody understands",
  "all console.log statements",
  "the feature nobody uses",
  "your impostor syndrome (just kidding, that's permanent)",
  "the legacy code from 2012",
  "all the TODO comments",
  "that one dependency causing 90% of issues",
  "the entire node_modules folder (it'll come back)",
  "your sense of responsibility",
  "Friday deployments",
  "merge conflicts",
  "the sprint backlog"
];

const yeetWisdom = [
  "Sometimes the best code is no code.",
  "Delete before you debug.",
  "Every line of code is a liability. YEET responsibly.",
  "The less code you have, the less can break.",
  "When in doubt, yeet it out.",
  "Refactoring is just yeeting with extra steps.",
  "The best feature is the one you never built.",
  "YEET early, YEET often."
];

interface YeetOptions {
  target?: string;
  dramatic?: boolean;
  wisdom?: boolean;
}

export async function execute(target?: string, options: YeetOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🚀 Y E E T  M O D E 🚀\n', 'title'));
  
  if (options.wisdom) {
    console.log(chalk.hex(branding.colors.mediumPurple)('  🧘 YEET WISDOM:\n'));
    for (const w of yeetWisdom) {
      console.log(chalk.hex(branding.colors.white)(`    💫 ${w}`));
    }
    console.log('\n' + branding.getDivider());
    return;
  }
  
  const actualTarget = target || yeetTargets[Math.floor(Math.random() * yeetTargets.length)];
  
  if (options.dramatic) {
    await dramaticYeet(actualTarget);
  } else {
    await simpleYeet(actualTarget);
  }
}

async function dramaticYeet(target: string): Promise<void> {
  console.log(chalk.hex(branding.colors.mediumPurple)('  🎬 DRAMATIC YEET SEQUENCE INITIATED...\n'));
  
  const stages = [
    "Targeting...",
    "Locking on...",
    "Charging yeet cannon...",
    "Calculating yeet trajectory...",
    "Disengaging safety protocols...",
    "3...",
    "2...",
    "1...",
    "YEEEEEEEET!"
  ];
  
  for (const stage of stages) {
    console.log(chalk.hex(branding.colors.lightPurple)(`    ${stage}`));
    await delay(400);
  }
  
  console.log('\n' + chalk.hex('#FFD700').bold(`  🚀 ${target.toUpperCase()} HAS BEEN YEETED! 🚀\n`));
  
  const quote = yeetQuotes[Math.floor(Math.random() * yeetQuotes.length)];
  console.log(branding.box(quote, 'success'));
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
}

async function simpleYeet(target: string): Promise<void> {
  console.log(chalk.hex(branding.colors.mediumPurple)(`  🎯 TARGET: ${target}\n`));
  
  await delay(500);
  
  console.log(chalk.hex(branding.colors.white)('    Status: YEETED'));
  console.log(chalk.hex(branding.colors.lightPurple)('    Location: The Void'));
  console.log(chalk.hex(branding.colors.lightPurple)('    Recovery: Not possible'));
  console.log(chalk.hex(branding.colors.lightPurple)('    Regrets: None'));
  
  console.log('\n' + branding.getDivider());
  
  const quote = yeetQuotes[Math.floor(Math.random() * yeetQuotes.length)];
  console.log(branding.box(quote, 'success'));
  
  const wisdom = yeetWisdom[Math.floor(Math.random() * yeetWisdom.length)];
  console.log(chalk.hex(branding.colors.lightPurple)(`\n  💡 ${wisdom}`));
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const yeetCommand = { execute };
