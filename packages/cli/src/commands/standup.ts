import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump standup - Generate fake standup updates when you did nothing
 * The art of saying nothing while sounding busy
 */

const standupExcuses = {
  technical: [
    "Deep diving into the codebase architecture to identify optimization opportunities.",
    "Investigating intermittent test failures in the CI/CD pipeline.",
    "Analyzing dependency tree conflicts and version compatibility issues.",
    "Reviewing legacy code documentation to understand historical decisions.",
    "Researching alternative libraries for improved performance metrics.",
    "Profiling memory usage patterns in the staging environment.",
    "Evaluating different database indexing strategies for query optimization.",
    "Setting up comprehensive logging infrastructure for better observability.",
    "Investigating race conditions in the async job processing queue.",
    "Analyzing API response times and identifying bottlenecks."
  ],
  collaborative: [
    "Participating in cross-functional alignment meetings with the product team.",
    "Onboarding the new team member and knowledge transfer sessions.",
    "Collaborating with DevOps on infrastructure improvements.",
    "Attending stakeholder meetings to clarify requirements.",
    "Conducting code review sessions with junior developers.",
    "Working with QA to reproduce and document edge cases.",
    "Liaising with the design team on UI/UX implementation details.",
    "Participating in architecture review board discussions.",
    "Coordinating with external vendors on API integrations.",
    "Facilitating team retrospectives and process improvement workshops."
  ],
  research: [
    "Researching industry best practices for microservices architecture.",
    "Evaluating new framework versions and migration strategies.",
    "Studying security vulnerability reports and patches.",
    "Investigating cloud cost optimization techniques.",
    "Exploring new monitoring and alerting solutions.",
    "Researching accessibility standards compliance requirements.",
    "Analyzing competitor feature implementations for inspiration.",
    "Studying performance optimization case studies.",
    "Researching GDPR compliance for the new data features.",
    "Exploring machine learning integration possibilities."
  ],
  blocked: [
    "Waiting for API credentials from the third-party provider.",
    "Blocked pending infrastructure provisioning from DevOps.",
    "Waiting for design mockups for the new feature.",
    "Blocked by dependencies on other team's deliverables.",
    "Awaiting security review approval for the database changes.",
    "Waiting for environment access permissions to be granted.",
    "Blocked by pending decisions from product management.",
    "Awaiting clarification on ambiguous requirements.",
    "Waiting for the legacy system migration to complete.",
    "Blocked by VPN connectivity issues."
  ],
  vague: [
    "Making progress on various ongoing initiatives.",
    "Working through the backlog items as prioritized.",
    "Addressing technical debt in multiple components.",
    "Improving overall system stability and reliability.",
    "Enhancing developer experience tooling.",
    "Optimizing various performance metrics.",
    "Refining the implementation approach.",
    "Continuing work on the strategic roadmap items.",
    "Addressing feedback from previous reviews.",
    "Making incremental improvements across the stack."
  ],
  honest: [
    "Staring at the code hoping it fixes itself.",
    "Down a StackOverflow rabbit hole since 9 AM.",
    "Coffee. Lots of coffee. Minimal coding.",
    "My IDE is open. That's... something.",
    "Contemplating my career choices.",
    "Refreshing Twitter while 'thinking'.",
    "Writing this standup update. That's all.",
    "Got distracted by a squirrel. Metaphorically.",
    "The build has been 'compiling' for 3 hours.",
    "Existential crisis in progress. Check back tomorrow."
  ]
};

const yesterdayActivities = [
  "Attended meetings that could've been emails",
  "Wrote code that compiled on the third try",
  "Fixed one bug, created two more",
  "Explained to QA that it's not a bug, it's a feature",
  "Rebased my branch 47 times",
  "Wrote comprehensive tests (they all pass, suspiciously)",
  "Documented my code (the comments are lies)",
  "Refactored 'just one small thing' (it wasn't small)",
  "Participated in a 2-hour meeting about meeting efficiency",
  "Actually did some work (this is rare, cherish it)"
];

const todayPlans = [
  "Continue pretending to understand the codebase",
  "Attempt to fix what I broke yesterday",
  "Write code that future-me will hate",
  "Survive until lunch",
  "Make the build green (or at least yellow)",
  "Reply to Slack messages within 24 hours",
  "Merge my PR before someone finds the bugs",
  "Document things I should have documented last year",
  "Test in production (it's the only environment that matters)",
  "Create more technical debt for future teams"
];

const blockers = [
  "My own incompetence (working on it)",
  "The compiler hates me specifically",
  "Git merge conflicts from hell",
  "Requirements that change every 2 hours",
  "The legacy codebase is legacy-ing",
  "My imposter syndrome is having a field day",
  "The coffee machine is broken (critical)",
  "StackOverflow is down (panic mode)",
  "My motivation file is corrupted",
  "Nothing (which is suspicious in itself)"
];

const confidenceLevels = [
  { level: "Very Confident", emoji: "😎", desc: "Dangerously optimistic" },
  { level: "Confident", emoji: "🙂", desc: "Probably lying" },
  { level: "Moderately Confident", emoji: "😐", desc: "Realistic" },
  { level: "Slightly Worried", emoji: "😅", desc: "Honest for once" },
  { level: "Panicking Internally", emoji: "😰", desc: "Being transparent" },
  { level: "No Clue", emoji: "🤷", desc: "Maximum honesty" }
];

interface StandupOptions {
  style?: 'technical' | 'collaborative' | 'research' | 'blocked' | 'vague' | 'honest' | 'random';
  yesterday?: boolean;
  blockers?: boolean;
  confidence?: number;
}

export async function execute(options: StandupOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🎭 THE G-RUMP STANDUP GENERATOR 🎭\n', 'title'));
  
  const style = options.style || 'random';
  const showYesterday = options.yesterday !== false;
  const showBlockers = options.blockers !== false;
  const confidenceLevel = options.confidence || Math.floor(Math.random() * 100);

  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  Style: ${style.toUpperCase()}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Confidence Level: ${confidenceLevel}%`));
  console.log(branding.getThinDivider());

  // Select standup pool
  let standupPool: string[] = [];
  if (style === 'random') {
    standupPool = Object.values(standupExcuses).flat();
  } else {
    standupPool = standupExcuses[style] || standupExcuses.vague;
  }

  // Yesterday section
  if (showYesterday) {
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📅 YESTERDAY:\n`));
    const yesterday = yesterdayActivities[Math.floor(Math.random() * yesterdayActivities.length)];
    await delay(300);
    console.log(chalk.hex(branding.colors.white)(`  ${yesterday}`));
    
    // Add a secondary item
    const secondary = standupPool[Math.floor(Math.random() * standupPool.length)];
    await delay(300);
    console.log(chalk.hex(branding.colors.lightPurple)(`  Also: ${secondary}`));
  }

  // Today section
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📋 TODAY:\n'));
  
  const today = todayPlans[Math.floor(Math.random() * todayPlans.length)];
  await delay(300);
  console.log(chalk.hex(branding.colors.white)(`  ${today}`));
  
  const todaySecondary = standupPool[Math.floor(Math.random() * standupPool.length)];
  await delay(300);
  console.log(chalk.hex(branding.colors.lightPurple)(`  Also planning to: ${todaySecondary}`));

  // Blockers section
  if (showBlockers) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)('\n  🚧 BLOCKERS:\n'));
    
    const blocker = blockers[Math.floor(Math.random() * blockers.length)];
    await delay(300);
    console.log(chalk.hex(branding.colors.white)(`  ${blocker}`));
  }

  // Confidence assessment
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  💪 CONFIDENCE ASSESSMENT:\n'));
  
  let confidence: typeof confidenceLevels[0];
  if (confidenceLevel > 80) confidence = confidenceLevels[0];
  else if (confidenceLevel > 60) confidence = confidenceLevels[1];
  else if (confidenceLevel > 40) confidence = confidenceLevels[2];
  else if (confidenceLevel > 20) confidence = confidenceLevels[3];
  else if (confidenceLevel > 5) confidence = confidenceLevels[4];
  else confidence = confidenceLevels[5];
  
  console.log(chalk.hex(branding.colors.white)(`  ${confidence.emoji} ${confidence.level}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Translation: ${confidence.desc}`));

  // BS Detection
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🕵️ BS DETECTION ANALYSIS:\n'));
  
  const bsMetrics = {
    "Buzzwords Used": Math.floor(Math.random() * 8) + 2,
    "Vague Statements": Math.floor(Math.random() * 5) + 1,
    "Actual Accomplishments": Math.floor(Math.random() * 2),
    "Plausible Excuses": Math.floor(Math.random() * 4) + 1,
    "Measurable Metrics": Math.floor(Math.random() * 1)
  };

  Object.entries(bsMetrics).forEach(([key, value]) => {
    const bar = '█'.repeat(value);
    const color = key === "Actual Accomplishments" && value === 0 ? branding.colors.lightPurple : branding.colors.mediumPurple;
    console.log(chalk.hex(color)(`  ${key}: ${value} ${bar}`));
  });

  const bsScore = (bsMetrics["Buzzwords Used"] * 10) + (bsMetrics["Vague Statements"] * 15) - (bsMetrics["Actual Accomplishments"] * 50);
  const bsRating = bsScore > 100 ? "Master of Deception" : bsScore > 50 ? "Professional BS Artist" : bsScore > 0 ? "Amateur Hour" : "Suspiciously Honest";
  
  console.log(chalk.hex(branding.colors.lightPurple)(`\n  Overall BS Rating: ${bsRating}`));

  // Delivery tips
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🎤 DELIVERY TIPS:\n'));
  
  const tips = [
    "Maintain steady eye contact. Don't blink. Dominance.",
    "Use hand gestures to distract from lack of substance.",
    "Speak quickly during the vague parts. Slow down for 'blockers'.",
    "Nod confidently while others speak. Appear thoughtful.",
    "If questioned, use 'I'll circle back on that' liberally.",
    "Reference 'the team' to distribute blame/responsibility.",
    "Use 'strategic' and 'holistic' - nobody knows what they mean.",
    "End with 'any blockers?' even though you already listed them."
  ];

  const tip = tips[Math.floor(Math.random() * tips.length)];
  console.log(chalk.hex(branding.colors.white)(`  → ${tip}`));

  // Team reaction prediction
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  👥 PREDICTED TEAM REACTIONS:\n'));
  
  const reactions = [
    "Manager: Nods thoughtfully, immediately forgets everything.",
    "Product Owner: Writes down 'optimization opportunities' as a ticket.",
    "Senior Dev: Knows you're BS-ing but respects the effort.",
    "Junior Dev: Takes notes on your buzzwords. Poor soul.",
    "QA: Already creating test cases for the bugs you introduced.",
    "DevOps: Mentally calculating how much this will cost in AWS.",
    "Team Lead: Planning the 'follow-up' meeting you just created.",
    "Everyone: Waiting for their turn to give equally vague updates."
  ];

  reactions.forEach((reaction, i) => {
    console.log(chalk.hex(branding.colors.lightPurple)(`  • ${reaction}`));
  });

  // Closing
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Standup update generated. May your team buy it.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.85) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Remember: The best standup is the one where everyone else also has nothing to report.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const standupCommand = { execute };
