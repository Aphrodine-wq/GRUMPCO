import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump rant - AI complains about your code with sarcasm
 * The insult generator supreme
 */

const insults = {
  beginner: [
    "This code looks like you learned programming from a fortune cookie.",
    "My calculator has better logic than this.",
    "I've seen 'Hello World' tutorials with more sophistication.",
    "Did you copy this from StackOverflow... and mess it up?",
    "Your code is like a pizza with pineapple - technically works but wrong on many levels."
  ],
  
  intermediate: [
    "This function has more side effects than a pharmaceutical commercial.",
    "Your naming conventions are giving me an identity crisis.",
    "This code has commitment issues - it can't decide what it wants to do.",
    "Your error handling is basically 'hope for the best'.",
    "This variable name tells me nothing. It's like naming your kid 'Human'."
  ],
  
  advanced: [
    "Congratulations, you've successfully reinvented the wheel... as a square.",
    "This architectural decision is giving me existential dread.",
    "Your code complexity would make Big O notation cry.",
    "This is what happens when abstraction meets confusion.",
    "Your code violates more principles than a rebellious teenager."
  ],
  
  brutal: [
    "I've read obituaries with more life than this code.",
    "This code is so bad, even the compiler is judging you silently.",
    "If code quality was measured in screams, this would be a horror movie.",
    "Your git history tells a tragic story of hubris and regret.",
    "This repository is a monument to technical debt."
  ],

  roasts: [
    "Your code is like a Rubik's cube... frustrating and nobody wants to touch it.",
    "I've seen clearer documentation in fortune cookies.",
    "Your function does 47 things. None of them well.",
    "This code is the reason aliens won't talk to us.",
    "You named a variable 'data'. Might as well name it 'stuff' or 'thingy'.",
    "Your code has more TODOs than a procrastinator's notebook.",
    "I've seen cleaner code in ransom notes.",
    "Your error messages are less helpful than a Magic 8-Ball.",
    "This code is like a horror movie - I scream every time I read it.",
    "You have 50 imports but only use 3. It's like inviting people to a party and ignoring them."
  ],

  sarcastic: [
    "Oh wow, another 'if-else' chain. How... innovative.",
    "Console.log debugging? Living on the edge, I see.",
    "Copy-pasting from StackOverflow without understanding it? Bold strategy.",
    "Manual string concatenation in 2024? Time traveler detected.",
    "No tests? Living dangerously, I respect that (not really)."
  ]
};

interface RantOptions {
  level?: 'gentle' | 'harsh' | 'brutal';
  topic?: string;
  count?: number;
}

export async function execute(options: RantOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  ☕ THE G-RUMP CODE RANT SESSION ☕\n', 'title'));
  
  const level = options.level || 'harsh';
  const count = options.count || 3;
  const topic = options.topic;

  // Select insults based on level
  let selectedInsults: string[] = [];
  switch (level) {
    case 'gentle':
      selectedInsults = [...insults.beginner, ...insults.sarcastic];
      break;
    case 'harsh':
      selectedInsults = [...insults.intermediate, ...insults.advanced, ...insults.roasts];
      break;
    case 'brutal':
      selectedInsults = [...insults.brutal, ...insults.advanced, ...insults.roasts];
      break;
  }

  // Add topic-specific rant if provided
  if (topic) {
    console.log(branding.format(`  Ranting about: ${topic}`, 'subtitle'));
    console.log(branding.getThinDivider());
  }

  console.log(chalk.hex(branding.colors.lightPurple)(`\n  Rant Level: ${level.toUpperCase()} 🔥\n`));

  // Generate random rants
  for (let i = 0; i < count; i++) {
    const insult = selectedInsults[Math.floor(Math.random() * selectedInsults.length)];
    const prefix = [
      '🙄',
      '😤',
      '🤦',
      '🫠',
      '🙃',
      '😒',
      '🤨',
      '😵'
    ][Math.floor(Math.random() * 8)];
    
    await delay(500);
    console.log(chalk.hex(branding.colors.mediumPurple)(`  ${prefix}  ${insult}`));
  }

  // Closing rant
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Rant complete. Your feelings should recover in 3-5 business days.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.8) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Fun fact: This rant was generated with ${(Math.random() * 100).toFixed(1)}% genuine disappointment.\n`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const rantCommand = { execute };
