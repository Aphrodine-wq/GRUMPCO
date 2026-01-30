import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump overtime - Calculate how much unpaid overtime you've worked
 * Because we all pretend it's "passion" and not exploitation
 */

const overtimeQuotes = [
  "Your work-life balance left a voicemail. It's moving on.",
  "Sleep is just death being shy. Work harder.",
  "Remember: Every hour of overtime brings you closer to... more overtime.",
  "Your family remembers you, right? Ask them at the next standup.",
  "Weekends are just weekdays with less Slack messages.",
  "You're not a workaholic. You're a 'passion-driven individual.'",
  "Time is money, and you're broke in both.",
  "The grind never stops. Neither does your impending burnout.",
  "Your hobbies miss you. Your git log doesn't.",
  "Remember when you had dreams? Neither do we."
];

const burnoutLevels = {
  safe: { emoji: '🌱', label: 'Healthy', color: '#00FF00' },
  warning: { emoji: '🔥', label: 'Getting Warm', color: '#FFD700' },
  danger: { emoji: '💀', label: 'Danger Zone', color: '#FF6B00' },
  critical: { emoji: '☠️', label: 'Critical', color: '#FF0000' },
  rip: { emoji: '⚰️', label: 'R.I.P.', color: '#8B0000' }
};

interface OvertimeOptions {
  hours?: number;
  rate?: number;
  weeks?: number;
}

export async function execute(options: OvertimeOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  ⏰ OVERTIME CALCULATOR ⏰\n', 'title'));
  
  const weeklyHours = options.hours || 40;
  const hourlyRate = options.rate || 50;
  const weeks = options.weeks || 52;
  
  const standardHours = 40;
  const overtimePerWeek = Math.max(0, weeklyHours - standardHours);
  const totalOvertime = overtimePerWeek * weeks;
  const unpaidValue = totalOvertime * hourlyRate;
  
  console.log(chalk.hex(branding.colors.mediumPurple)('  📊 YOUR OVERTIME ANALYSIS:\n'));
  
  console.log(chalk.hex(branding.colors.white)(`    Weekly hours worked: ${weeklyHours}`));
  console.log(chalk.hex(branding.colors.white)(`    Standard hours: ${standardHours}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Overtime per week: ${overtimePerWeek} hours`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Annual overtime: ${totalOvertime} hours`));
  
  console.log('\n' + branding.getDivider());
  
  // Calculate burnout level
  let burnoutLevel: keyof typeof burnoutLevels;
  if (overtimePerWeek === 0) {
    burnoutLevel = 'safe';
  } else if (overtimePerWeek <= 5) {
    burnoutLevel = 'warning';
  } else if (overtimePerWeek <= 15) {
    burnoutLevel = 'danger';
  } else if (overtimePerWeek <= 25) {
    burnoutLevel = 'critical';
  } else {
    burnoutLevel = 'rip';
  }
  
  const level = burnoutLevels[burnoutLevel];
  
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🔥 BURNOUT STATUS:\n'));
  console.log(chalk.hex(level.color)(`    ${level.emoji} ${level.label}`));
  
  if (overtimePerWeek > 0) {
    console.log(chalk.hex(branding.colors.mediumPurple)('\n  💸 UNPAID OVERTIME VALUE:\n'));
    console.log(chalk.hex(branding.colors.white)(`    At $${hourlyRate}/hour: $${unpaidValue.toLocaleString()}/year`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    That's ${Math.round(totalOvertime / 24)} full days of unpaid work!`));
  }
  
  console.log('\n' + branding.getDivider());
  
  const quote = overtimeQuotes[Math.floor(Math.random() * overtimeQuotes.length)];
  console.log(branding.box(quote, overtimePerWeek > 10 ? 'error' : 'warning'));
  
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Remember: You can always be replaced. But can your burnout?', 'sassy'));
}

export const overtimeCommand = { execute };
