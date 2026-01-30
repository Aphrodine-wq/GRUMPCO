import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump deadline - Calculate how screwed you are for upcoming deadlines
 * The reality check you didn't ask for but definitely need
 */

const deadlineTypes = [
  { name: "Feature Launch", urgency: "CRITICAL", panic: 95 },
  { name: "Sprint End", urgency: "HIGH", panic: 80 },
  { name: "Code Review", urgency: "MEDIUM", panic: 60 },
  { name: "Demo Day", urgency: "MAXIMUM", panic: 100 },
  { name: "Production Deploy", urgency: "NUCLEAR", panic: 110 },
  { name: "Client Presentation", urgency: "CRITICAL", panic: 90 },
  { name: "Quarterly Review", urgency: "HIGH", panic: 75 },
  { name: "Bug Fix Deadline", urgency: "URGENT", panic: 85 }
];

const screwageLevels = [
  { range: "0-20%", level: "Manageable", emoji: "😌", desc: "You might actually survive this" },
  { range: "21-40%", level: "Concerning", emoji: "😅", desc: "Start brewing stronger coffee" },
  { range: "41-60%", level: "Problematic", emoji: "😬", desc: "Consider sacrificing sleep" },
  { range: "61-80%", level: "Dire", emoji: "😰", desc: "Emergency snacks required" },
  { range: "81-99%", level: "Catastrophic", emoji: "😱", desc: "Update your resume" },
  { range: "100%+", level: "Apocalyptic", emoji: "🤯", desc: "Abandon all hope" }
];

const timeTranslations = [
  { dev: "Almost done", reality: "Just getting started" },
  { dev: "Just a small change", reality: "Complete rewrite needed" },
  { dev: "Should be quick", reality: "Will take 3 days minimum" },
  { dev: "Minor bug fix", reality: "Architectural nightmare" },
  { dev: "Final touches", reality: "Everything is broken" },
  { dev: "Code complete", reality: "Hasn't been tested" },
  { dev: "Ready for review", reality: "Has TODOs everywhere" },
  { dev: "Deployed to staging", reality: "Probably works locally" }
];

const copingMechanisms = [
  { strategy: "Denial", effectiveness: "High short-term, disaster long-term", emoji: "🙈" },
  { strategy: "Caffeine Overdose", effectiveness: "Sustainable for 48 hours max", emoji: "☕" },
  { strategy: "Asking for Extension", effectiveness: "50/50 chance of success", emoji: "🙏" },
  { strategy: "Blaming Dependencies", effectiveness: "Classic move, usually fails", emoji: "🤷" },
  { strategy: "Emergency Refactoring", effectiveness: "Adds more bugs than fixes", emoji: "🔥" },
  { strategy: "Calling in Sick", effectiveness: "Delays the inevitable", emoji: "🤒" },
  { strategy: "Pair Programming", effectiveness: "Misery loves company", emoji: "👥" },
  { strategy: "Blind Hope", effectiveness: "Has worked before (once)", emoji: "🍀" }
];

const deadlineExcuses = [
  "The requirements changed... again.",
  "Legacy code decided to misbehave.",
  "Third-party API is having an existential crisis.",
  "QA found 'just a few' edge cases.",
  "The intern pushed to production.",
  "Database migration went... sideways.",
  "Client 'just remembered' a critical feature.",
  "The build pipeline is unionizing.",
  "Solar flares affected our servers (allegedly).",
  "My cat walked on the keyboard. All of it."
];

interface DeadlineOptions {
  days?: number;
  type?: string;
  optimistic?: boolean;
}

export async function execute(options: DeadlineOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  ⏰ THE G-RUMP DEADLINE CALCULATOR ⏰\n', 'title'));
  
  const days = options.days || 3;
  const type = options.type || deadlineTypes[Math.floor(Math.random() * deadlineTypes.length)].name;
  const optimistic = options.optimistic || false;

  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  Deadline Type: ${type}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Days Remaining: ${days}`));
  console.log(chalk.hex(branding.colors.mediumPurple)(`  Mindset: ${optimistic ? 'Dangerously Optimistic' : 'Realistically Pessimistic'}`));
  console.log(branding.getThinDivider());

  // Calculate screwage percentage
  const basePanic = deadlineTypes.find(d => d.name === type)?.panic || 70;
  const randomFactor = Math.floor(Math.random() * 30) - 15;
  const screwage = Math.min(100, Math.max(0, basePanic - (days * 5) + randomFactor + (optimistic ? -20 : 20)));

  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📊 SCREWAGE ANALYSIS:\n`));
  
  // Progress bar of doom
  const filled = Math.round((screwage / 100) * 30);
  const empty = 30 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const gradientBar = branding.applyGradient(bar);
  
  console.log(chalk.hex(branding.colors.white)(`  Screwed Level: ${screwage}%`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  [${gradientBar}]`));

  // Determine level
  const level = screwageLevels.find(l => {
    const [min, max] = l.range.replace('%', '').split('-').map(Number);
    return screwage >= min && screwage <= (max || 100);
  }) || screwageLevels[5];

  await delay(600);
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  ${level.emoji} ASSESSMENT: ${level.level}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`     ${level.desc}`));

  // Time translation table
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📅 DEVELOPER TIME vs REALITY:\n'));
  
  const translations = timeTranslations.sort(() => 0.5 - Math.random()).slice(0, 4);
  translations.forEach((t, i) => {
    const emoji = ['🤥', '🙄', '😬', '🫠'][i];
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${emoji} "${t.dev}"`));
    console.log(chalk.hex(branding.colors.white)(`     → Reality: ${t.reality}`));
  });

  // Work remaining estimate
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📝 WORK REMAINING CALCULATION:\n'));
  
  const workItems = Math.floor(Math.random() * 15) + 5;
  const actualHours = workItems * (optimistic ? 2 : 4);
  const availableHours = days * 8;
  const deficit = actualHours - availableHours;

  console.log(chalk.hex(branding.colors.white)(`  Estimated Tasks: ${workItems}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Actual Hours Needed: ${actualHours}`));
  console.log(chalk.hex(branding.colors.mediumPurple)(`  Available Hours: ${availableHours}`));
  console.log(chalk.hex(branding.colors.white)(`  Time Deficit: ${deficit > 0 ? deficit + ' hours 😱' : 'Surplus? (suspicious)'}`));

  // Coping mechanism recommendation
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🆘 RECOMMENDED COPING MECHANISM:\n'));
  
  const mechanism = copingMechanisms[Math.floor(Math.random() * copingMechanisms.length)];
  console.log(chalk.hex(branding.colors.white)(`  Strategy: ${mechanism.strategy} ${mechanism.emoji}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Effectiveness: ${mechanism.effectiveness}`));

  // Excuse bank
  if (screwage > 60) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)('\n  💡 EMERGENCY EXCUSE BANK:\n'));
    const excuses = deadlineExcuses.sort(() => 0.5 - Math.random()).slice(0, 3);
    excuses.forEach((excuse, i) => {
      console.log(chalk.hex(branding.colors.lightPurple)(`  ${i + 1}. "${excuse}"`));
    });
  }

  // Survival guide
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🛟 SURVIVAL GUIDE:\n'));
  
  const survivalTips = screwage > 80 ? [
    "Acceptance is the first step.",
    "Start drafting that apology email.",
    "Consider which bugs are 'features'.",
    "Hydrate. You'll need it for the tears."
  ] : screwage > 50 ? [
    "Coffee. Lots of coffee.",
    "Break tasks into manageable panic sessions.",
    "Remove all distractions (including hope).",
    "Communicate early and often about the disaster."
  ] : [
    "You might actually make it!",
    "Don't get cocky though.",
    "Test everything twice.",
    "Have a backup plan anyway."
  ];

  survivalTips.forEach((tip, i) => {
    console.log(chalk.hex(branding.colors.white)(`  ${i + 1}. ${tip}`));
  });

  // Final prognosis
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🔮 FINAL PROGNOSIS:\n`));
  
  if (screwage > 90) {
    console.log(chalk.hex(branding.colors.lightPurple)(`  You will meet your deadline... in an alternate universe.`));
  } else if (screwage > 70) {
    console.log(chalk.hex(branding.colors.lightPurple)(`  Miracles happen. Just not to you, apparently.`));
  } else if (screwage > 50) {
    console.log(chalk.hex(branding.colors.lightPurple)(`  Doable, if you sacrifice sleep, sanity, and social life.`));
  } else if (screwage > 30) {
    console.log(chalk.hex(branding.colors.lightPurple)(`  You've got this! Probably. Maybe. Don't quote me.`));
  } else {
    console.log(chalk.hex(branding.colors.lightPurple)(`  Wait... you're actually okay? Suspicious.`));
  }

  // Closing
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Deadlines are just suggestions with consequences.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.9) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Fun fact: Time estimations were invented by developers who wanted to feel optimistic.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const deadlineCommand = { execute };
