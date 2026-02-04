import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump imposter - Imposter syndrome therapy and validation
 * Because we all feel like frauds sometimes
 */

const imposterTruths = [
  "Everyone is googling basic syntax. Yes, even the seniors.",
  "That 10x developer? They just have 10x more Stack Overflow tabs open.",
  "Nobody knows what they're doing. We're all figuring it out.",
  "Your code works. That makes you a real programmer.",
  "The people who seem confident are just better at pretending.",
  "Even Linus Torvalds had to learn what a for loop was once.",
  "Your bugs don't define you. Your persistence does.",
  "Being confused is a sign you're learning something new.",
  "Asking questions is a superpower, not a weakness.",
  "You're not an imposter. Imposters don't worry about being imposters."
];

const reassurances = [
  "You belong here. The code compiles (sometimes), and that's what matters.",
  "That senior dev? They still Google 'how to center a div'. Regularly.",
  "You've shipped code that users actually use. That's the job.",
  "The fact that you care about being good at this means you're already ahead.",
  "Every expert started as someone who had no idea what they were doing.",
  "Your confusion today is your expertise tomorrow.",
  "You're not faking it. You're learning. There's a difference.",
  "The code doesn't care about your self-doubt. It just runs (or doesn't).",
  "Remember: You were hired for a reason. Multiple people agreed.",
  "You're reading documentation and asking questions. That IS being a developer."
];

const affirmations = [
  "I am a real developer. My code proves it.",
  "I don't need to know everything. Nobody does.",
  "Asking for help is professional, not weakness.",
  "I contribute value, even when I don't feel like it.",
  "My learning journey is valid and ongoing.",
  "I've solved problems that once seemed impossible.",
  "I belong in this field. I earned my place.",
  "Every bug I fix makes me a better engineer.",
  "I am allowed to not know things.",
  "My worth is not measured in lines of code."
];

interface ImposterOptions {
  truth?: boolean;
  affirm?: boolean;
  stats?: boolean;
}

export async function execute(options: ImposterOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🎭 IMPOSTER SYNDROME THERAPY 🎭\n', 'title'));
  
  if (options.truth) {
    console.log(chalk.hex(branding.colors.mediumPurple)('  💡 UNCOMFORTABLE TRUTHS ABOUT PROGRAMMING:\n'));
    for (const truth of imposterTruths) {
      console.log(chalk.hex(branding.colors.white)(`    ✓ ${truth}`));
      await delay(200);
    }
    console.log('\n' + branding.getDivider());
    return;
  }
  
  if (options.affirm) {
    console.log(chalk.hex(branding.colors.mediumPurple)('  💪 DEVELOPER AFFIRMATIONS:\n'));
    console.log(chalk.hex(branding.colors.lightPurple)('    Repeat after me:\n'));
    for (const affirmation of affirmations) {
      console.log(chalk.hex(branding.colors.white)(`    "${affirmation}"`));
      await delay(300);
    }
    console.log('\n' + branding.getDivider());
    return;
  }
  
  if (options.stats) {
    await showImposterStats();
    return;
  }
  
  // Default: Provide reassurance
  console.log(chalk.hex(branding.colors.mediumPurple)('  🤗 YOU ARE NOT AN IMPOSTER. HERE\'S PROOF:\n'));
  
  const stats = {
    bugsFixed: Math.floor(Math.random() * 1000) + 100,
    linesWritten: Math.floor(Math.random() * 50000) + 10000,
    problemsSolved: Math.floor(Math.random() * 500) + 50,
    coffeeConsumed: Math.floor(Math.random() * 5000) + 1000,
    timesYouAlmostQuit: Math.floor(Math.random() * 100) + 10,
    timesYouDidnt: Math.floor(Math.random() * 100) + 10
  };
  
  stats.timesYouDidnt = stats.timesYouAlmostQuit; // Always equal, you never quit!
  
  console.log(chalk.hex(branding.colors.white)(`    Bugs you've fixed: ${stats.bugsFixed.toLocaleString()}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Lines of code written: ${stats.linesWritten.toLocaleString()}`));
  console.log(chalk.hex(branding.colors.white)(`    Problems you've solved: ${stats.problemsSolved.toLocaleString()}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Cups of coffee consumed: ${stats.coffeeConsumed.toLocaleString()}`));
  console.log(chalk.hex(branding.colors.white)(`    Times you almost quit: ${stats.timesYouAlmostQuit.toLocaleString()}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Times you didn't: ${stats.timesYouDidnt.toLocaleString()} (100% resilience rate!)`));
  
  console.log('\n' + branding.getDivider());
  
  const reassurance = reassurances[Math.floor(Math.random() * reassurances.length)];
  console.log(branding.box(reassurance, 'success'));
  
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('You\'re doing better than you think. Keep going.', 'sassy'));
}

async function showImposterStats(): Promise<void> {
  console.log(chalk.hex(branding.colors.mediumPurple)('  📊 INDUSTRY-WIDE IMPOSTER STATS:\n'));
  
  const stats = [
    { label: 'Developers who feel like imposters', value: '70%' },
    { label: 'Senior devs who still Google basic things', value: '100%' },
    { label: 'Experts who once knew nothing', value: '100%' },
    { label: 'Code written without any doubt', value: '0%' },
    { label: 'People who have it all figured out', value: '0%' },
    { label: 'Successful devs who asked "dumb" questions', value: '100%' }
  ];
  
  for (const stat of stats) {
    console.log(chalk.hex(branding.colors.white)(`    ${stat.label}: ${chalk.hex(branding.colors.lightPurple)(stat.value)}`));
    await delay(200);
  }
  
  console.log('\n' + branding.getDivider());
  console.log(branding.box("You're in good company. Everyone feels this way.", 'success'));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const imposterCommand = { execute };
