import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump retro - Sarcastic sprint retrospective notes
 * Because retrospectives need more honesty and less corporate speak
 */

const retroCategories = {
  wins: [
    "We shipped something! It only broke twice in production.",
    "The build was green for a whole day. A record.",
    "Only 3 critical bugs this sprint. Progress!",
    "Nobody rage-quit. That's a win in my book.",
    "We actually finished a ticket. I know, I'm shocked too.",
    "The coffee machine survived another sprint.",
    "Code reviews happened. Some were even helpful.",
    "Tests passed. Some of them were actually testing things.",
    "We only had 47 meetings. An improvement.",
    "The intern didn't delete production. Yet."
  ],
  challenges: [
    "Requirements changed 12 times. We're calling it 'agile'.",
    "Technical debt accumulated faster than interest on a payday loan.",
    "The legacy codebase continues to legacy.",
    "Third-party API went down during the demo. Classic.",
    "Scope creep brought friends. Scope creep is now a party.",
    "We discovered bugs from 2019. They're vintage now.",
    "The database migration was... educational.",
    "Production had opinions about our deployment strategy.",
    "That 'quick fix' is now 400 lines of technical debt.",
    "The client 'just remembered' a critical feature."
  ],
  actionItems: [
    "Stop promising deadlines we can't keep (we'll try)",
    "Write tests before the code breaks (revolutionary)",
    "Document things while we still remember them (optimistic)",
    "Refactor the 'temporary' solution from 2022 (it's permanent now)",
    "Fix the CI/CD pipeline (again)",
    "Have fewer meetings (said every retro, never happens)",
    "Improve code review quality (requires people to care)",
    "Update dependencies (including that scary major version)",
    "Address the 47 TODOs in the codebase (some are from founders)",
    "Actually follow the action items from last retro (meta)"
  ],
  teamDynamics: [
    "Communication was 'frequent' and 'confusing'. Both are true.",
    "Team morale is 'stable'. Like a powder keg.",
    "Collaboration happened. Some of it was voluntary.",
    "Knowledge sharing occurred. Accidentally.",
    "We bonded over shared suffering. Team building!",
    "Nobody cried in the standup. Personal growth.",
    "We achieved 'functional dysfunction'. It's a balance.",
    "The Slack channel remained professional (mostly).",
    "Code ownership is 'shared' (nobody wants to own it).",
    "We have 'psychological safety' (to complain about management)."
  ],
  processImprovements: [
    "Our estimation accuracy improved to 'wild guess' from 'pure fiction'.",
    "The standup time decreased to 45 minutes. Still too long.",
    "We're using Jira 'correctly' (we're lying to ourselves).",
    "PR review time improved to 'only 3 days'. Lightning fast.",
    "Our sprint velocity is 'consistent' (consistently wrong).",
    "Retrospectives are 'productive' (we complain effectively).",
    "Our deployment frequency is 'agile' (when it works).",
    "Code quality is 'acceptable' (management hasn't seen it).",
    "Technical debt is 'managed' (like a toddler manages toys).",
    "Our Definition of Done includes 'works on my machine'."
  ],
  shoutouts: [
    "Shoutout to whoever fixed production at 3 AM. You know who you are.",
    "Thanks to the person who brought donuts. You saved morale.",
    "Recognition to whoever actually read the documentation.",
    "Appreciation for the team member who stayed late (again).",
    "Kudos to whoever didn't break the build this sprint.",
    "Props to the intern for asking questions we were all thinking.",
    "Thanks to DevOps for pretending our infrastructure is fine.",
    "Recognition for the person who closed 50 Jira tickets.",
    "Shoutout to whoever wrote actual helpful comments.",
    "Appreciation for everyone who pretended to pay attention in meetings."
  ]
};

const sprintMoods = [
  { mood: "Chaotic Good", desc: "We broke things, but we fixed them. Mostly.", emoji: "😅" },
  { mood: "Controlled Panic", desc: "Everything was on fire, but we had a plan.", emoji: "🔥" },
  { mood: "Optimistic Denial", desc: "We pretended everything was fine. It wasn't.", emoji: "🙃" },
  { mood: "Survival Mode", desc: "We made it. Don't ask how.", emoji: "🏃" },
  { mood: "Cautiously Pessimistic", desc: "Expect the worst, occasionally surprised.", emoji: "😒" },
  { mood: "Enlightened Despair", desc: "We've accepted our fate. It's peaceful.", emoji: "🧘" },
  { mood: "Aggressive Optimism", desc: "Everything is great! (Help me)", emoji: "😁" },
  { mood: "Retrograde Amnesia", desc: "What happened this sprint? No one knows.", emoji: "🤷" }
];

const velocityExcuses = [
  "Velocity decreased due to 'unforeseen circumstances' (we didn't plan well).",
  "Points carried over because 'complexity was underestimated' (we lied).",
  "Sprint goals were 'adjusted' (we gave up on half of them).",
  "The 'technical investigation' took longer than expected (we were Googling).",
  "Blockers from other teams 'impacted delivery' (they ignored us).",
  "Scope was 'refined' (cut in half, but expectations stayed the same).",
  "Bugs were 'discovered late' (they were there the whole time).",
  "'Technical debt' slowed us down (we wrote the debt ourselves)."
];

const retroFormats = [
  { name: "Start/Stop/Continue", effectiveness: "Medium", desc: "We start things, stop nothing, continue complaining" },
  { name: "4Ls (Liked/Learned/Lacked/Longed for)", effectiveness: "Low", desc: "Liked coffee, learned nothing, lacked sleep, longed for vacation" },
  { name: "Sailboat", effectiveness: "High", desc: "Wind in our sails: caffeine. Anchors: everything else" },
  { name: "Timeline", effectiveness: "Medium", desc: "A journey of despair with occasional highlights" },
  { name: "Mad/Sad/Glad", effectiveness: "High", desc: "Mad: deadlines. Sad: code quality. Glad: it's over" },
  { name: "Lean Coffee", effectiveness: "Low", desc: "We talked about coffee for 30 minutes. Productive." }
];

const commitments = [
  "We'll definitely do this next sprint. (We won't.)",
  "This is our top priority. (Until tomorrow.)",
  "Everyone is on board. (We haven't asked them.)",
  "This will be easy to implement. (Famous last words.)",
  "We'll track this metric closely. (We'll forget by Monday.)",
  "This is a quick win. (It's never quick.)",
  "We have full management support. (They weren't in the meeting.)",
  "This is sustainable. (For the next 2 days.)",
  "Everyone understands the goal. (Nobody read the ticket.)",
  "We'll document this decision. (In our hearts, not Confluence.)"
];

interface RetroOptions {
  sprint?: number;
  mood?: string;
  honest?: boolean;
  items?: number;
}

export async function execute(options: RetroOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🔄 THE G-RUMP RETROSPECTIVE GENERATOR 🔄\n', 'title'));
  
  const sprint = options.sprint || Math.floor(Math.random() * 20) + 1;
  const moodName = options.mood;
  const honest = options.honest || false;
  const items = Math.min(options.items || 5, 8);

  // Select mood
  let mood: typeof sprintMoods[0];
  if (moodName) {
    mood = sprintMoods.find(m => m.mood.toLowerCase().includes(moodName.toLowerCase())) || sprintMoods[0];
  } else {
    mood = sprintMoods[Math.floor(Math.random() * sprintMoods.length)];
  }

  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  Sprint: #${sprint}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Mood: ${mood.mood} ${mood.emoji}`));
  console.log(chalk.hex(branding.colors.mediumPurple)(`  Mode: ${honest ? 'BRUTAL HONESTY' : 'Corporate Friendly'}`));
  console.log(branding.getThinDivider());

  // Sprint summary
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📊 SPRINT SUMMARY:\n`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  ${mood.desc}`));

  // Retro format
  const format = retroFormats[Math.floor(Math.random() * retroFormats.length)];
  console.log(chalk.hex(branding.colors.white)(`\n  Format Used: ${format.name}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Effectiveness: ${format.effectiveness}`));
  console.log(chalk.hex(branding.colors.mediumPurple)(`  Reality: ${format.desc}`));

  // What went well
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  ✅ WHAT WENT WELL:\n'));
  
  const wins = retroCategories.wins.sort(() => 0.5 - Math.random()).slice(0, Math.ceil(items / 2));
  wins.forEach((win, i) => {
    const emoji = ['🎉', '🏆', '⭐', '🚀', '💪'][i % 5];
    console.log(chalk.hex(branding.colors.white)(`  ${emoji} ${win}`));
  });

  // Challenges faced
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  ⚠️ CHALLENGES FACED:\n'));
  
  const challenges = retroCategories.challenges.sort(() => 0.5 - Math.random()).slice(0, Math.ceil(items / 2));
  challenges.forEach((challenge, i) => {
    const emoji = ['🔥', '💥', '🐛', '⛔', '😵'][i % 5];
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${emoji} ${challenge}`));
  });

  // Team dynamics
  if (honest) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)('\n  👥 TEAM DYNAMICS (HONEST VERSION):\n'));
    
    const dynamics = retroCategories.teamDynamics.sort(() => 0.5 - Math.random()).slice(0, 3);
    dynamics.forEach((dynamic, i) => {
      console.log(chalk.hex(branding.colors.white)(`  ${i + 1}. ${dynamic}`));
    });
  }

  // Action items
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🎯 ACTION ITEMS (That We Might Actually Do):\n'));
  
  const actions = retroCategories.actionItems.sort(() => 0.5 - Math.random()).slice(0, items);
  actions.forEach((action, i) => {
    const priority = ['P0 (Critical)', 'P1 (Important)', 'P2 (Eventually)', 'P3 (Never)'][Math.floor(Math.random() * 4)];
    const owner = ['Team', 'Unassigned', 'Next Sprint', 'The Void'][Math.floor(Math.random() * 4)];
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${i + 1}. ${action}`));
    console.log(chalk.hex(branding.colors.mediumPurple)(`     Priority: ${priority} | Owner: ${owner}`));
    console.log();
  });

  // Velocity explanation
  console.log(branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📈 VELOCITY EXPLANATION:\n'));
  
  const velocity = velocityExcuses[Math.floor(Math.random() * velocityExcuses.length)];
  console.log(chalk.hex(branding.colors.lightPurple)(`  ${velocity}`));

  // Shoutouts
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🙌 SHOUTOUTS:\n'));
  
  const shoutouts = retroCategories.shoutouts.sort(() => 0.5 - Math.random()).slice(0, 3);
  shoutouts.forEach((shoutout, i) => {
    const emoji = ['👏', '🎊', '💖'][i];
    console.log(chalk.hex(branding.colors.white)(`  ${emoji} ${shoutout}`));
  });

  // Process improvements
  if (!honest) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)('\n  🔄 PROCESS IMPROVEMENTS:\n'));
    
    const improvements = retroCategories.processImprovements.sort(() => 0.5 - Math.random()).slice(0, 3);
    improvements.forEach((improvement, i) => {
      console.log(chalk.hex(branding.colors.lightPurple)(`  ${i + 1}. ${improvement}`));
    });
  }

  // Commitments for next sprint
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🤞 COMMITMENTS FOR NEXT SPRINT:\n'));
  
  const commitment = commitments[Math.floor(Math.random() * commitments.length)];
  console.log(chalk.hex(branding.colors.white)(`  "${commitment}"`));

  // Action item survival prediction
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🔮 ACTION ITEM SURVIVAL PREDICTION:\n'));
  
  const survivalRates = [
    { item: "Actually addressed", chance: "15%", emoji: "🦄" },
    { item: "Partially done", chance: "25%", emoji: "🫠" },
    { item: "Carried to next retro", chance: "45%", emoji: "🔄" },
    { item: "Forgotten entirely", chance: "15%", emoji: "❓" }
  ];

  survivalRates.forEach(rate => {
    const bar = '█'.repeat(Math.floor(parseInt(rate.chance) / 5));
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${rate.emoji} ${rate.item}: ${rate.chance} ${bar}`));
  });

  // Team sentiment
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  💭 TEAM SENTIMENT:\n'));
  
  const sentiments = [
    "Ready to do it all again next sprint! (Help)",
    "Cautiously optimistic about the future. (Terrified)",
    "Eager to tackle new challenges! (Please no)",
    "Feeling accomplished and energized! (Exhausted)",
    "Stronger as a team! (Collective trauma bonding)"
  ];
  
  const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
  console.log(chalk.hex(branding.colors.white)(`  "${sentiment}"`));

  // Closing
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Retro complete. May your action items survive until next week.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.85) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Fun fact: 90% of action items die of natural causes (neglect) within 48 hours.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const retroCommand = { execute };
