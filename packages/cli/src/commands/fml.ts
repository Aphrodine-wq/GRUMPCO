import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump fml - FML (Fix My Life) mode for when everything is broken
 * A therapeutic debugging companion
 */

const fmlMoments = [
  "Deployed to production on a Friday at 4:59 PM.",
  "The bug only appears on the client's machine.",
  "It worked on staging.",
  "Someone force-pushed to main.",
  "The documentation is just the word 'TODO'.",
  "You've been debugging for 3 hours. It was a typo.",
  "The intern 'fixed' the CSS.",
  "The API key was in git history all along.",
  "You merged the wrong branch.",
  "The test was green because it was skipped.",
  "There are 847 unread Slack messages.",
  "Your Docker container works. Your Docker compose doesn't.",
  "The requirements changed. Again.",
  "You fixed one bug and created seven more.",
  "The senior dev who wrote this quit last year.",
  "There are no comments. There is no documentation. There is only fear.",
  "The database migration can't be rolled back.",
  "The vendor API returns 200 for errors.",
  "Node modules just ate 4GB of your SSD.",
  "The sprint ends tomorrow. You haven't started."
];

const encouragement = [
  "But hey, at least you're not debugging CSS in IE6.",
  "Remember: Someone somewhere is debugging PHP. You're fine.",
  "This too shall pass. Unlike your code review.",
  "You're not alone. Well, you are, but everyone else is also alone in their misery.",
  "Take a deep breath. Then git reset --hard.",
  "Every expert was once a disaster.",
  "At least the servers are still... oh wait.",
  "Coffee exists. That's something.",
  "Tomorrow is another day to create new bugs.",
  "You're getting paid for this. Allegedly."
];

const survivalKit = [
  "Step 1: Stop. Breathe. Step away from the keyboard.",
  "Step 2: Get coffee, tea, or something stronger.",
  "Step 3: Remember that code is temporary. So is pain.",
  "Step 4: Read the error message. No, actually read it.",
  "Step 5: Check if it's plugged in. (Metaphorically)",
  "Step 6: git blame someone else.",
  "Step 7: Accept that perfection is the enemy of deployed.",
  "Step 8: If all else fails, restart everything."
];

interface FMLOptions {
  vent?: boolean;
  help?: boolean;
  random?: boolean;
}

export async function execute(options: FMLOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  😱 FML (FIX MY LIFE) MODE 😱\n', 'title'));
  
  if (options.help) {
    console.log(chalk.hex(branding.colors.mediumPurple)('  🆘 SURVIVAL KIT:\n'));
    for (const step of survivalKit) {
      console.log(chalk.hex(branding.colors.white)(`    ${step}`));
      await delay(300);
    }
    console.log('\n' + branding.getDivider());
    return;
  }
  
  if (options.vent) {
    console.log(chalk.hex(branding.colors.mediumPurple)('  🗣️ VENTING MODE ACTIVATED:\n'));
    console.log(chalk.hex(branding.colors.white)('    Type your frustrations here. Nobody is listening.\n'));
    console.log(chalk.hex(branding.colors.lightPurple)('    (Just kidding, we\'re all too busy with our own problems.)\n'));
    console.log(branding.getDivider());
    return;
  }
  
  // Default: Random FML moment with encouragement
  console.log(chalk.hex(branding.colors.mediumPurple)('  💔 TODAY\'S FML MOMENT:\n'));
  
  const fmlMoment = fmlMoments[Math.floor(Math.random() * fmlMoments.length)];
  console.log(branding.box(fmlMoment, 'error'));
  
  await delay(1000);
  
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  💪 BUT REMEMBER:\n'));
  
  const encourage = encouragement[Math.floor(Math.random() * encouragement.length)];
  console.log(branding.box(encourage, 'success'));
  
  // Stats for humor
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📊 YOUR FML STATS:\n'));
  
  const stats = {
    daysWithoutIncident: 0,
    coffeeConsumed: Math.floor(Math.random() * 10) + 5,
    bugsCreated: Math.floor(Math.random() * 20) + 1,
    bugsFixed: Math.floor(Math.random() * 10),
    existentialCrises: Math.floor(Math.random() * 5) + 1,
    timeToNextBreakdown: Math.floor(Math.random() * 60) + 1
  };
  
  console.log(chalk.hex(branding.colors.white)(`    Days without incident: ${stats.daysWithoutIncident}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Coffees consumed today: ${stats.coffeeConsumed}`));
  console.log(chalk.hex(branding.colors.white)(`    Bugs created: ${stats.bugsCreated}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Bugs fixed: ${stats.bugsFixed}`));
  console.log(chalk.hex(branding.colors.white)(`    Existential crises: ${stats.existentialCrises}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Est. time to next breakdown: ${stats.timeToNextBreakdown} minutes`));
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Use --help for survival tips. You\'ll need them.', 'sassy'));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const fmlCommand = { execute };
