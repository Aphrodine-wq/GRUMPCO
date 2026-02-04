import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump panic - Emergency fix mode (dramatic output)
 * For when everything is on fire and you need drama
 */

const panicScenarios = [
  {
    title: "PRODUCTION IS DOWN",
    level: "CRITICAL",
    message: "The servers have achieved consciousness and are on strike.",
    drama: "MAXIMUM"
  },
  {
    title: "DATABASE CORRUPTION",
    level: "SEVERE",
    message: "Your data went on vacation and forgot to come back.",
    drama: "HIGH"
  },
  {
    title: "MEMORY LEAK APOCALYPSE",
    level: "CRITICAL",
    message: "RAM usage is climbing faster than your anxiety.",
    drama: "MAXIMUM"
  },
  {
    title: "DEPENDENCY HELL",
    level: "MODERATE",
    message: "npm install created a black hole. Send help.",
    drama: "HIGH"
  },
  {
    title: "SECURITY BREACH",
    level: "CRITICAL",
    message: "Someone's in the mainframe. And it's not you.",
    drama: "MAXIMUM"
  }
];

const panicActions = [
  "Breathing into a paper bag...",
  "Checking if it's actually plugged in...",
  "Contemplating a career in farming...",
  "Sending thoughts and prayers to the server...",
  "Googling 'how to code' for the 1000th time...",
  "Pacing nervously in circles...",
  "Questioning every life choice...",
  "Preparing the 'we're experiencing technical difficulties' page...",
  "Calling your mom for emotional support...",
  "Debating if turning it off and on again will work this time..."
];

const dramaticQuotes = [
  "TO INFINITY AND BEYOND! (But please, let's stay in production)",
  "HOUSTON, WE HAVE A PROBLEM.",
  "I'M THE KING OF THE WORLD! (Of fixing bugs)",
  "I'LL BE BACK... with a hotfix.",
  "MAY THE FORCE BE WITH YOU. (You'll need it)",
  "HERE'S LOOKING AT YOU, BUG.",
  "YOU CAN'T HANDLE THE TRUTH! (About this error)",
  "I SEE DEAD CODE.",
  "SHOW ME THE MONEY! (Actually, show me the logs)",
  "THERE'S NO PLACE LIKE ~/PRODUCTION"
];

interface PanicOptions {
  reason?: string;
  fix?: boolean;
}

export async function execute(options: PanicOptions = {}): Promise<void> {
  console.clear(); // Clear screen for maximum drama
  
  // Flashy intro
  for (let i = 0; i < 3; i++) {
    console.log(chalk.bgHex(branding.colors.darkPurple).white('\n\n\n\n\n'));
    console.log(chalk.bgHex(branding.colors.darkPurple).white('     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     '));
    console.log(chalk.bgHex(branding.colors.darkPurple).white('                                                                         '));
    console.log(chalk.bgHex(branding.colors.darkPurple).whiteBright.bold('              E M E R G E N C Y   M O D E   A C T I V A T E D              '));
    console.log(chalk.bgHex(branding.colors.darkPurple).white('                                                                         '));
    console.log(chalk.bgHex(branding.colors.darkPurple).white('     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     '));
    console.log(chalk.bgHex(branding.colors.darkPurple).white('\n\n\n\n\n'));
    await delay(300);
    console.clear();
    await delay(200);
  }
  
  // Final display
  console.log(chalk.bgHex(branding.colors.darkPurple).white('\n\n'));
  console.log(chalk.bgHex(branding.colors.darkPurple).white('     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     '));
  console.log(chalk.bgHex(branding.colors.darkPurple).white('                                                                         '));
  console.log(chalk.bgHex(branding.colors.darkPurple).whiteBright.bold('              E M E R G E N C Y   M O D E   A C T I V A T E D              '));
  console.log(chalk.bgHex(branding.colors.darkPurple).white('                                                                         '));
  console.log(chalk.bgHex(branding.colors.darkPurple).white('     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     🚨     '));
  console.log(chalk.bgHex(branding.colors.darkPurple).white('\n\n'));
  
  console.log(branding.format('\n  🔥 PANIC MODE: ENGAGED 🔥\n', 'error'));
  
  const reason = options.reason || 'UNKNOWN CATASTROPHE';
  console.log(branding.format(`  REASON: ${reason.toUpperCase()}`, 'error'));
  console.log(branding.getDivider());
  
  // Select random scenario
  const scenario = panicScenarios[Math.floor(Math.random() * panicScenarios.length)];
  
  console.log(chalk.hex(branding.colors.lightPurple)(`\n  🎭 CURRENT STATUS:\n`));
  console.log(chalk.bgHex(branding.colors.darkPurple).whiteBright(`    ALERT LEVEL: ${scenario.level}`));
  console.log(chalk.bgHex(branding.colors.darkPurple).whiteBright(`    DRAMA LEVEL: ${scenario.drama}`));
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n    ${scenario.title}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    "${scenario.message}"`));
  
  // Dramatic actions
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎬 PERFORMING EMERGENCY PROTOCOLS:\n`));
  
  const selectedActions = panicActions
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);
  
  for (const action of selectedActions) {
    await delay(800);
    console.log(chalk.hex(branding.colors.lightPurple)(`    ⏳ ${action}`));
  }
  
  // Dramatic quote
  await delay(1000);
  console.log('\n' + branding.getDivider());
  const quote = dramaticQuotes[Math.floor(Math.random() * dramaticQuotes.length)];
  console.log(chalk.hex(branding.colors.lightPurple).italic(`\n  💬 "${quote}"\n`));
  
  // If fix mode
  if (options.fix) {
    console.log(branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🔧 ATTEMPTING EMERGENCY FIX:\n`));
    
    const fixSteps = [
      "Analyzing the situation with maximum anxiety...",
      "Consulting StackOverflow while hyperventilating...",
      "Writing a hotfix while questioning reality...",
      "Testing in production (YOLO mode engaged)...",
      "Praying to the server gods...",
      "Deploying with fingers crossed..."
    ];
    
    for (const step of fixSteps) {
      await delay(600);
      console.log(chalk.hex(branding.colors.lightPurple)(`    🚑 ${step}`));
    }
    
    await delay(1000);
    console.log('\n' + branding.getDivider());
    
    const outcomes = [
      "FIX DEPLOYED! Crisis averted. Time for a nervous breakdown.",
      "PARTIAL SUCCESS! Something worked. Don't ask what.",
      "HOLDING STEADY! The server is wheezing but alive.",
      "REQUIRES FURTHER PANIC! The fix didn't fix enough.",
      "CALL FOR BACKUP! This needs more hands on deck."
    ];
    
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    console.log(chalk.bgHex(branding.colors.darkPurple).whiteBright(`\n    🎯 OUTCOME: ${outcome}`));
  }
  
  // Closing
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  💊 POST-PANIC CARE:\n`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    • Take 5 deep breaths`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    • Drink water (or something stronger)`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    • Step away from the computer`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    • Remember: it's just code`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    • The sun will rise tomorrow, probably`));
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Panic mode complete. Normal anxiety levels may resume.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.8) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Fun fact: This panic session burned ${Math.floor(Math.random() * 1000)} theoretical calories.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const panicCommand = { execute };
