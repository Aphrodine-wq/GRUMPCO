import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump friday - Friday deployment checker and predictor
 * Because deploying on Friday is always a great idea
 */

const fridayWarnings = [
  "It's Friday. Step away from the deploy button.",
  "Friday deployments are sponsored by weekend on-call rotations.",
  "Remember: Friday deploys create Monday problems.",
  "DANGER: Weekend plans detected. Friday deploy not recommended.",
  "Statistics show 87% of Friday deploys result in sad pizza dinners.",
  "The deploy can wait. Your sanity cannot.",
  "If you deploy on Friday, you deploy with consequences.",
  "Friday deployment? That's a bold strategy, Cotton.",
  "Your future self is begging you to wait until Monday.",
  "Every Friday deploy adds a gray hair to an SRE somewhere."
];

const emergencyExcuses = [
  "Sorry boss, my computer caught fire. Literally. Definitely not metaphorically.",
  "The deploy script developed sentience and refused. I respect its choice.",
  "Mercury is in retrograde. Company policy forbids Friday deploys during this period.",
  "I consulted the Magic 8 Ball. It said 'Ask again Monday'.",
  "Our security team flagged 'Friday' as a vulnerability. We're patching it.",
  "The intern already left. We can't deploy without the intern's blessing.",
  "AWS went down. All of it. Just for us. Specifically to prevent this deploy.",
  "Legal is reviewing the deploy. They'll get back to us Q3 next year.",
  "The deployment pipeline became self-aware and locked us out.",
  "I'd love to deploy, but my dog ate the CI/CD config."
];

const survivalGuide = [
  "1. Don't deploy on Friday.",
  "2. If you must deploy, deploy early (before 10 AM).",
  "3. Keep rollback plans ready. You'll need them.",
  "4. Warn the on-call engineer. Apologize in advance.",
  "5. Have the incident response channel open.",
  "6. Order food. You might be here a while.",
  "7. Update your resume. Just in case.",
  "8. Remember: 'It worked in staging' is not a defense.",
  "9. Pray to your deity of choice.",
  "10. Actually, just don't deploy on Friday."
];

interface FridayOptions {
  check?: boolean;
  excuse?: boolean;
  guide?: boolean;
  force?: boolean;
}

export async function execute(options: FridayOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  📅 FRIDAY DEPLOY DETECTOR 📅\n', 'title'));
  
  const today = new Date();
  const dayOfWeek = today.getDay();
  const hour = today.getHours();
  const isFriday = dayOfWeek === 5;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isLate = hour >= 16;
  
  if (options.excuse) {
    const excuse = emergencyExcuses[Math.floor(Math.random() * emergencyExcuses.length)];
    console.log(branding.box('EMERGENCY EXCUSE:', 'info'));
    console.log(chalk.hex(branding.colors.white)(`\n  "${excuse}"\n`));
    console.log(branding.status('Use wisely. Reusable once per quarter.', 'sassy'));
    return;
  }
  
  if (options.guide) {
    console.log(chalk.hex(branding.colors.mediumPurple)('  📋 FRIDAY DEPLOYMENT SURVIVAL GUIDE:\n'));
    for (const step of survivalGuide) {
      console.log(chalk.hex(branding.colors.white)(`    ${step}`));
    }
    console.log('\n' + branding.getDivider());
    return;
  }
  
  // Check current day
  console.log(chalk.hex(branding.colors.mediumPurple)('  🔍 ANALYZING DEPLOYMENT SAFETY...\n'));
  
  await delay(500);
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  console.log(chalk.hex(branding.colors.white)(`    Current day: ${days[dayOfWeek]}`));
  console.log(chalk.hex(branding.colors.white)(`    Current time: ${hour}:${String(today.getMinutes()).padStart(2, '0')}`));
  
  console.log('\n' + branding.getDivider());
  
  // Calculate risk level
  let riskLevel = 0;
  const riskFactors: string[] = [];
  
  if (isFriday) {
    riskLevel += 50;
    riskFactors.push("It's Friday (+50 risk)");
  }
  
  if (isLate) {
    riskLevel += 30;
    riskFactors.push("It's after 4 PM (+30 risk)");
  }
  
  if (isFriday && isLate) {
    riskLevel += 20;
    riskFactors.push("Friday afternoon combo (+20 risk)");
  }
  
  if (isWeekend) {
    riskLevel += 40;
    riskFactors.push("Weekend deployment (+40 risk... why?)");
  }
  
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  ⚠️ RISK ASSESSMENT:\n'));
  
  if (riskFactors.length > 0) {
    for (const factor of riskFactors) {
      console.log(chalk.hex('#FFD700')(`    ⚡ ${factor}`));
    }
  } else {
    console.log(chalk.hex('#00FF00')('    ✓ No critical risk factors detected'));
  }
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📊 DEPLOY RISK SCORE: ${riskLevel}%`));
  
  const riskBar = `[${'█'.repeat(Math.round(riskLevel / 5))}${'░'.repeat(20 - Math.round(riskLevel / 5))}]`;
  const riskColor = riskLevel > 60 ? '#FF6B6B' : riskLevel > 30 ? '#FFD700' : '#00FF00';
  console.log(chalk.hex(riskColor)(`    ${riskBar}`));
  
  console.log('\n' + branding.getDivider());
  
  // Verdict
  let verdict: string;
  let verdictType: 'success' | 'warning' | 'error';
  
  if (riskLevel >= 60) {
    verdict = fridayWarnings[Math.floor(Math.random() * fridayWarnings.length)];
    verdictType = 'error';
  } else if (riskLevel >= 30) {
    verdict = "Proceed with caution. Keep your phone charged.";
    verdictType = 'warning';
  } else {
    verdict = "Deploy window looks safe. Go forth and ship!";
    verdictType = 'success';
  }
  
  console.log(branding.box(verdict, verdictType));
  
  if (options.force && riskLevel >= 60) {
    console.log(chalk.hex('#FF6B6B')('\n  ⚠️ FORCE MODE ENABLED'));
    console.log(chalk.hex('#FF6B6B')('    You chose chaos. May the odds be ever in your favor.'));
  }
  
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Remember: Every Friday deploy is a cry for help.', 'sassy'));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const fridayCommand = { execute };
