import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump meeting - Generate meeting excuses and survival tips
 * Because 90% of meetings should have been emails
 */

const meetingExcuses = [
  "Sorry, I have a conflicting meeting with my sanity.",
  "I'd love to join but my calendar just caught fire.",
  "My internet is acting up. It seems allergic to unnecessary meetings.",
  "I have a hard stop... at the beginning of this meeting.",
  "I'm on a call with a very important client named 'My Mental Health'.",
  "Zoom just crashed. And so did my will to live.",
  "I'm experiencing technical difficulties called 'common sense'.",
  "My camera is broken. So is my enthusiasm.",
  "I need to step out to touch grass. Doctor's orders.",
  "I'm in another meeting where we discuss why we have so many meetings."
];

const meetingSurvivalTips = [
  "Turn off your video and scream into a pillow. They'll never know.",
  "Create a 'hard stop' calendar event 30 minutes into every meeting.",
  "Master the art of saying 'Let me follow up on that' for everything.",
  "Keep a browser game open. Meetings are multiplayer waiting rooms.",
  "Practice your 'very interested' face in the mirror. You'll need it.",
  "Write 'Could this be an email?' on a Post-it. Stare at it longingly.",
  "Count how many times someone says 'synergy'. Make it a drinking game.",
  "Mute yourself and practice your primal scream.",
  "Have a fake phone call ready to 'take' at any moment.",
  "Remember: Nobody knows you're making toast if you're muted."
];

const meetingTypes = {
  standup: {
    name: 'Stand-up',
    duration: '15 min (actually 45)',
    survival: 'Keep answers to 3 words or less. "Working on it."',
    realDuration: 45
  },
  planning: {
    name: 'Sprint Planning',
    duration: '2 hours (actually 4)',
    survival: 'Volunteer for nothing. Nod thoughtfully.',
    realDuration: 240
  },
  retro: {
    name: 'Retrospective',
    duration: '1 hour (actually 2)',
    survival: 'Say something vaguely positive. Escape.',
    realDuration: 120
  },
  allhands: {
    name: 'All-Hands',
    duration: '1 hour (actually feels like 6)',
    survival: 'Mute, camera off, do actual work.',
    realDuration: 60
  },
  oneOnOne: {
    name: '1:1',
    duration: '30 min',
    survival: 'Actually useful. Rare occurrence.',
    realDuration: 30
  },
  brainstorm: {
    name: 'Brainstorming',
    duration: '1 hour (produces 0 ideas)',
    survival: 'Suggest the first idea you had. It\'s the best one.',
    realDuration: 60
  }
};

interface MeetingOptions {
  type?: string;
  excuse?: boolean;
  tip?: boolean;
  calculator?: boolean;
}

export async function execute(options: MeetingOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  📅 MEETING SURVIVAL GUIDE 📅\n', 'title'));
  
  if (options.excuse) {
    const excuse = meetingExcuses[Math.floor(Math.random() * meetingExcuses.length)];
    console.log(branding.box('EXCUSE GENERATED:', 'info'));
    console.log(chalk.hex(branding.colors.white)(`\n  "${excuse}"\n`));
    console.log(branding.status('Copy, paste, escape. You\'re welcome.', 'sassy'));
    return;
  }
  
  if (options.tip) {
    const tip = meetingSurvivalTips[Math.floor(Math.random() * meetingSurvivalTips.length)];
    console.log(branding.box('SURVIVAL TIP:', 'info'));
    console.log(chalk.hex(branding.colors.white)(`\n  ${tip}\n`));
    return;
  }
  
  if (options.type && meetingTypes[options.type as keyof typeof meetingTypes]) {
    const meeting = meetingTypes[options.type as keyof typeof meetingTypes];
    console.log(chalk.hex(branding.colors.mediumPurple)(`  📋 ${meeting.name.toUpperCase()}\n`));
    console.log(chalk.hex(branding.colors.white)(`    Scheduled: ${meeting.duration}`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    Survival: ${meeting.survival}`));
    return;
  }
  
  // Default: Show meeting analysis
  console.log(chalk.hex(branding.colors.mediumPurple)('  📊 MEETING TYPE ANALYSIS:\n'));
  
  for (const [key, meeting] of Object.entries(meetingTypes)) {
    console.log(chalk.hex(branding.colors.white)(`  ${meeting.name}`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    Duration: ${meeting.duration}`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    Tip: ${meeting.survival}\n`));
  }
  
  console.log(branding.getDivider());
  
  // Calculate weekly meeting hours (joke)
  const totalMinutes = Object.values(meetingTypes).reduce((sum, m) => sum + m.realDuration, 0);
  const totalHours = Math.round(totalMinutes / 60);
  
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  ⏱️ WEEKLY MEETING ESTIMATE:\n'));
  console.log(chalk.hex(branding.colors.white)(`    Total: ${totalHours} hours (${Math.round(totalHours/40*100)}% of your work week)`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Time for actual work: ${40 - totalHours} hours`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Time to recover from meetings: Unknown`));
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Pro tip: Use --excuse to generate a meeting escape excuse.', 'sassy'));
}

export const meetingCommand = { execute };
