import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { branding } from '../branding.js';

/**
 * grump why - Explain why code exists (existential crisis mode)
 * The philosophical command that questions everything
 */

const existentialQuestions = [
  "Why are we here?",
  "What is the meaning of this function?",
  "Does this code have a purpose, or is it just existing?",
  "Why do we write code if entropy always wins?",
  "Is this feature necessary, or just a manifestation of our ego?",
  "What does it mean to 'work as expected'?",
  "Why does this bug exist? Is it a bug, or a feature in disguise?",
  "Do we write the code, or does the code write us?",
  "Why is there always one more edge case?",
  "What is the sound of one hand clapping... in production?"
];

const codePhilosophies = [
  {
    school: "Nihilistic Programming",
    belief: "Nothing matters. Ship it anyway.",
    quote: "In the end, all code becomes legacy code."
  },
  {
    school: "Optimistic Coding",
    belief: "It works on my machine, therefore it works everywhere.",
    quote: "Faith moves mountains, and also compiles code."
  },
  {
    school: "Pessimistic Development",
    belief: "Everything will break. It's just a matter of time.",
    quote: "Hope for the best, expect the exception."
  },
  {
    school: "Existential Engineering",
    belief: "We write code to distract ourselves from the void.",
    quote: "To refactor or not to refactor? That is the question."
  },
  {
    school: "Absurdist Architecture",
    belief: "The code doesn't have to make sense. It just has to run.",
    quote: "If it works, don't ask why."
  },
  {
    school: "Stoic Software",
    belief: "Accept the bugs you cannot fix, fix the bugs you can.",
    quote: "Waste no more time arguing what a good codebase should be. Be one."
  },
  {
    school: "Zen Coding",
    belief: "The code is in the doing, not the result.",
    quote: "A function written in anger is a function full of bugs."
  }
];

const codePurposeGuesses = [
  "This code exists because someone, somewhere, thought 'what if?'",
  "The purpose is to confuse future developers. It's working.",
  "This exists because requirements changed 47 times.",
  "It was written at 3 AM by someone running on coffee and desperation.",
  "This is the result of 'I'll fix it later' never happening.",
  "The purpose is to remind us that we're all human and make mistakes.",
  "This code exists because StackOverflow said to do it this way.",
  "It was created during a hackathon and never refactored.",
  "The client said 'just make it work' and here we are.",
  "This is what happens when you let a junior developer 'experiment'."
];

const deepThoughts = [
  "If a function runs in production and no one is monitoring it, does it make a sound?",
  "We are all just temporary custodians of our code. Eventually, someone will delete it.",
  "The code you write today is the legacy code someone else curses tomorrow.",
  "Every bug is just a feature that hasn't found its purpose yet.",
  "In an infinite universe, all code is legacy code.",
  "The Tao of Programming: Those who know do not speak. Those who speak... write documentation.",
  "Code is like humor. When you have to explain it, it's bad.",
  "We don't see the code as it is, but as we are.",
  "Sometimes the best code is the code you don't write.",
  "The journey of a thousand lines begins with a single import."
];

const whyAnswers = [
  "Because someone asked for it. Whether they should have is another question.",
  "Because it was Tuesday and the developer was bored.",
  "Because 'that's how we've always done it' is a valid reason, apparently.",
  "Because the alternative was worse. Much worse.",
  "Because technical debt needs friends too.",
  "Because it seemed like a good idea at 2 AM.",
  "Because requirements documents are just suggestions.",
  "Because refactoring is scary and this is comfortable.",
  "Because if it ain't broke, don't fix it. And it's not quite broke... yet.",
  "Because sometimes we code not because we should, but because we can."
];

interface WhyOptions {
  file?: string;
  deep?: boolean;
}

export async function execute(target: string | undefined, options: WhyOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🤔 G-RUMP EXISTENTIAL INQUIRY 🤔\n', 'title'));
  
  const deep = options.deep || false;
  
  if (target) {
    console.log(branding.format(`  Subject: ${target}`, 'subtitle'));
  }
  console.log(chalk.hex(branding.colors.lightPurple)(`  Mode: ${deep ? 'DEEP PHILOSOPHICAL' : 'CASUAL EXISTENTIAL'}`));
  console.log(branding.getThinDivider());
  
  // The Big Question
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🌌 THE BIG QUESTION:\n`));
  const question = existentialQuestions[Math.floor(Math.random() * existentialQuestions.length)];
  console.log(chalk.hex(branding.colors.white).bold(`    ${question}`));
  
  await delay(800);
  
  // If file provided, analyze it
  if (target && existsSync(target)) {
    await analyzeFile(target);
  }
  
  // Philosophy lesson
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📚 CODE PHILOSOPHY:\n`));
  
  const philosophy = codePhilosophies[Math.floor(Math.random() * codePhilosophies.length)];
  console.log(chalk.hex(branding.colors.mediumPurple)(`    School: ${philosophy.school}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Belief: ${philosophy.belief}`));
  console.log(chalk.hex(branding.colors.white).italic(`    "${philosophy.quote}"`));
  
  await delay(600);
  
  // Purpose analysis
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎯 PURPOSE ANALYSIS:\n`));
  const purpose = codePurposeGuesses[Math.floor(Math.random() * codePurposeGuesses.length)];
  console.log(chalk.hex(branding.colors.lightPurple)(`    ${purpose}`));
  
  await delay(400);
  
  // The Answer
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  ✨ THE ANSWER TO "WHY?":\n`));
  const answer = whyAnswers[Math.floor(Math.random() * whyAnswers.length)];
  console.log(chalk.hex(branding.colors.white).bold(`    ${answer}`));
  
  // Deep thoughts (if deep mode)
  if (deep) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🧘 DEEP THOUGHTS:\n`));
    
    const thoughts = deepThoughts
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    for (const thought of thoughts) {
      await delay(500);
      console.log(chalk.hex(branding.colors.lightPurple).italic(`    • ${thought}`));
    }
  }
  
  // Conclusion
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🌅 CONCLUSION:\n`));
  console.log(chalk.hex(branding.colors.white)(`    The code exists because we choose to write it.`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Its purpose is defined by those who use it.`));
  console.log(chalk.hex(branding.colors.white)(`    And in the end, we're all just trying to make things work.`));
  
  // Easter egg - Matrix reference
  if (Math.random() > 0.8) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💊 CHOICE:`));
    console.log(chalk.hex(branding.colors.white)(`    Red pill: Keep questioning everything.`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    Blue pill: Just ship it and move on.`));
  }
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Existential inquiry complete. Go forth and code with purpose (or caffeine).', 'sassy'));
  
  // Final thought
  if (Math.random() > 0.9) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Final thought: Does the code exist because we write it, or do we write because the code exists?`));
  }
}

async function analyzeFile(filePath: string): Promise<void> {
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📁 FILE ANALYSIS:\n`));
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    const functions = (content.match(/function|=>/g) || []).length;
    const comments = (content.match(/\/\/|\/\*|#/g) || []).length;
    
    console.log(chalk.hex(branding.colors.lightPurple)(`    Lines: ${lines} (each a choice in the tapestry of existence)`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    Functions: ${functions} (attempts to impose order on chaos)`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    Comments: ${comments} (whispers of the developer's state of mind)`));
    
    if (lines > 500) {
      console.log(chalk.hex(branding.colors.lightPurple)(`    Analysis: This file has become sentient. Treat with caution.`));
    } else if (lines < 10) {
      console.log(chalk.hex(branding.colors.lightPurple)(`    Analysis: Brief, yet profound. Or just incomplete.`));
    }
    
    await delay(400);
    
  } catch {
    console.log(chalk.hex(branding.colors.lightPurple)(`    The file remains a mystery. Some things are better left unknown.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const whyCommand = { execute };
