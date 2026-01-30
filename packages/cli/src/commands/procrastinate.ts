import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump procrastinate - Generate excuses to avoid coding
 * Because sometimes you need a good reason to not do the thing
 */

const procrastinationExcuses = {
  classic: [
    "I need to reorganize my desktop icons by color... for productivity.",
    "My rubber duck is giving me the silent treatment. Can't code without moral support.",
    "The stars aren't aligned for optimal coding conditions today.",
    "I should really clean my keyboard first. Look at those crumbs.",
    "My IDE needs to 'warm up' for at least 3 hours. It's like an old car.",
    "I need to read all 47 tabs I opened 'for later' first.",
    "My chair isn't at the perfect ergonomic angle. That's a safety issue.",
    "I should alphabetize my Spotify playlists. It's been weighing on me.",
    "The coffee isn't at optimal drinking temperature yet. Science matters.",
    "I need to watch one more tutorial video. Just one. Maybe two."
  ],
  technical: [
    "My npm install has been running for 4 hours. Must. Not. Interrupt.",
    "The build cache needs... emotional support before I can proceed.",
    "I'm waiting for my dependencies to finish their existential crisis.",
    "The linter is thinking about its life choices. I should give it space.",
    "My Docker container is having a spa day. Can't disturb it.",
    "The git history needs therapy. I'm being a supportive friend.",
    "My terminal font isn't inspiring creativity right now.",
    "The WiFi is having a moment. I must respect its boundaries.",
    "My code editor is updating. This happens every time I open it.",
    "The cloud provider is 'experiencing issues' (my will to code)."
  ],
  creative: [
    "I need to find the perfect coding playlist first. This is crucial.",
    "My muse hasn't visited today. Can't force art, you know?",
    "I should really sketch out the architecture on paper. With colors.",
    "My creativity well is dry. Need to refill it with memes first.",
    "The right side of my brain is on lunch break. Left side is sulking.",
    "I need to journal about my coding feelings before I can begin.",
    "My brain is buffering. The loading animation is mesmerizing.",
    "I'm waiting for inspiration to strike. Might be a while.",
    "The code spirits haven't blessed this endeavor yet. Patience.",
    "I should really research 'best practices' for another 5 hours."
  ],
  relatable: [
    "It's 5 PM somewhere, and that's close enough to the weekend.",
    "My motivation and my will to live are having a race. Both are losing.",
    "I was productive yesterday. That's enough for the week, right?",
    "My brain has switched to power-saving mode. Very low power.",
    "I have a meeting in 2 hours. Not worth starting anything big.",
    "It's almost lunch time. Then it's almost end-of-day. Math checks out.",
    "My coffee hasn't kicked in yet. Or it kicked and missed.",
    "I'm in a staring contest with my cursor. It's winning.",
    "The 'flow state' is a myth perpetuated by people who don't have ADHD.",
    "I coded yesterday. The code gods demand rest."
  ],
  absurd: [
    "A squirrel outside looked at me funny. I need to process this.",
    "My horoscope said 'avoid logical thinking' today. Who am I to argue?",
    "The moon is in retrograde and so is my productivity.",
    "I accidentally saw a bug in the wild. Now I have PTSD.",
    "My houseplant looks sad. I must address this crisis first.",
    "There's a spider in the corner watching me. I can't perform under pressure.",
    "I need to alphabetize my pantry. It's a compulsion now.",
    "The shadows in my room changed. I must investigate.",
    "A bird chirped ominously. I should heed this warning.",
    "My left shoelace is untied. This is clearly a sign."
  ]
};

const procrastinationLevels = [
  { name: "Novice Procrastinator", emoji: "😅", desc: "Mild avoidance, still feels guilty" },
  { name: "Intermediate Avoider", emoji: "😬", desc: "Getting creative with excuses" },
  { name: "Expert Time-Waster", emoji: "🙃", desc: "Professional-grade procrastination" },
  { name: "Master of Avoidance", emoji: "🫠", desc: "Hasn't coded in days, thriving" },
  { name: "Legendary Procrastinator", emoji: "😇", desc: "Has achieved procrastination enlightenment" }
];

const activities = [
  { name: "Reddit rabbit hole", time: "2 hours", guilt: "High" },
  { name: "YouTube 'educational' videos", time: "3 hours", guilt: "Medium" },
  { name: "Twitter/X doom scrolling", time: "45 mins", guilt: "Maximum" },
  { name: "Cleaning your desk... again", time: "1 hour", guilt: "Low" },
  { name: "Making the perfect coffee", time: "30 mins", guilt: "None" },
  { name: "Staring into space", time: "∞", guilt: "Philosophical" },
  { name: "Checking email (again)", time: "15 mins", guilt: "Medium" },
  { name: "Organizing file system", time: "2 hours", guilt: "Low" },
  { name: "Reading documentation", time: "4 hours", guilt: "None (technically working)" },
  { name: "Planning to plan", time: "1 hour", guilt: "Recursive" }
];

interface ProcrastinateOptions {
  level?: 'novice' | 'expert' | 'master';
  category?: 'classic' | 'technical' | 'creative' | 'relatable' | 'absurd' | 'random';
  count?: number;
}

export async function execute(options: ProcrastinateOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🦥 THE G-RUMP PROCRASTINATION GENERATOR 🦥\n', 'title'));
  
  const level = options.level || 'expert';
  const category = options.category || 'random';
  const count = Math.min(options.count || 3, 5);

  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  Level: ${level.toUpperCase()}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Category: ${category.toUpperCase()}`));
  console.log(branding.getThinDivider());

  // Select excuse pool
  let excusePool: string[] = [];
  if (category === 'random') {
    excusePool = Object.values(procrastinationExcuses).flat();
  } else {
    excusePool = procrastinationExcuses[category] || procrastinationExcuses.classic;
  }

  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎯 YOUR PROCRASTINATION EXCUSES:\n`));

  const selectedExcuses: string[] = [];
  for (let i = 0; i < count; i++) {
    let excuse = excusePool[Math.floor(Math.random() * excusePool.length)];
    while (selectedExcuses.includes(excuse)) {
      excuse = excusePool[Math.floor(Math.random() * excusePool.length)];
    }
    selectedExcuses.push(excuse);

    const emoji = ['🙈', '🙉', '🙊', '🤷', '🫣', '😬', '🤐', '🤥', '🫠', '😇'][i % 10];
    
    await delay(400);
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${emoji} Excuse #${i + 1}:`));
    console.log(chalk.hex(branding.colors.white)(`     "${excuse}"`));
    console.log();
  }

  // Procrastination level assessment
  console.log(branding.getDivider());
  const levelInfo = procrastinationLevels[
    level === 'master' ? 4 : level === 'expert' ? 3 : 1
  ];
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🏆 CERTIFICATION LEVEL: ${levelInfo.name} ${levelInfo.emoji}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`     ${levelInfo.desc}`));

  // Suggested procrastination activity
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🎪 RECOMMENDED DIVERSION ACTIVITY:\n'));
  
  const activity = activities[Math.floor(Math.random() * activities.length)];
  console.log(chalk.hex(branding.colors.white)(`  Activity: ${activity.name}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Time Sink: ${activity.time}`));
  console.log(chalk.hex(branding.colors.mediumPurple)(`  Guilt Level: ${activity.guilt}`));

  // Productivity forecast
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📊 PRODUCTIVITY FORECAST:\n'));
  
  const forecasts = [
    "0% chance of actual work today. Embrace it.",
    "10% chance you'll start after 'just one more video'.",
    "25% chance of productive guilt-spiral later tonight.",
    "50% chance you'll start strong, then get distracted.",
    "75% chance tomorrow-you will hate today-you.",
    "99% chance this is not your day. Try again tomorrow."
  ];
  console.log(chalk.hex(branding.colors.lightPurple)(`  ${forecasts[Math.floor(Math.random() * forecasts.length)]}`));

  // Coping strategies
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  💡 Justification Strategies:\n'));
  const strategies = [
    "Tell yourself you're 'letting ideas marinate'.",
    "Claim you're 'researching best practices' (Reddit counts, right?)",
    "Frame it as 'mental health maintenance'.",
    "Say you're 'waiting for the optimal coding window'.",
    "Blame it on 'creative block' - sounds professional.",
    "Call it 'strategic delay' instead of procrastination.",
    "Tell your team you're 'in deep architectural thought'.",
    "Claim the codebase is 'gestating'. Very organic."
  ];
  console.log(chalk.hex(branding.colors.white)(`  → ${strategies[Math.floor(Math.random() * strategies.length)]}`));

  // Closing
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Procrastination is the art of keeping up with yesterday.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.85) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Remember: The deadline is a suggestion, sleep is a requirement.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const procrastinateCommand = { execute };
