import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump review - Sarcastic code review comments generator
 * Because code reviews need more personality (and less kindness)
 */

const reviewComments = {
  general: [
    "This code works... on your machine. In 2024. Maybe.",
    "I've seen clearer logic in political speeches.",
    "This function does 47 things. None of them well.",
    "Your variable naming convention is 'confusion'.",
    "This is the coding equivalent of a ' temporary' tattoo.",
    "I'm not saying this is bad code, but it has more issues than a magazine stand.",
    "Your code style is unique. Like a snowflake. A very ugly snowflake.",
    "This code is giving me trust issues.",
    "I'm adding this to my 'what not to do' presentation.",
    "Have you considered... not doing it this way?"
  ],
  architecture: [
    "This architecture is 'inspired by' spaghetti westerns. Very western.",
    "Your design pattern is 'chaos'. It's not in the Gang of Four book.",
    "This is less 'microservice' and more 'micro-disaster'.",
    "Your abstraction layers have abstraction layers. It's abstractions all the way down.",
    "This tightly-coupled code is in a committed relationship with disaster.",
    "Your API design makes REST look stressed.",
    "This inheritance hierarchy is deeper than my existential dread.",
    "You've reinvented the wheel. As a square. With a flat tire.",
    "This module separation is theoretical at best.",
    "Your code organization is 'wherever the file fit'."
  ],
  style: [
    "Your indentation is having an identity crisis.",
    "This code is formatted like a ransom note. Intentionally terrifying?",
    "I've seen more consistent spacing in a ransom letter.",
    "Your braces placement is... adventurous.",
    "This code style is 'eclectic'. And by eclectic, I mean wrong.",
    "Did you format this with your eyes closed?",
    "Your line lengths are playing hide and seek with the screen edge.",
    "This whitespace situation is unacceptable. And I accept very little.",
    "Your semicolon usage is 'creative'. That's not a compliment.",
    "This code formatting makes my linter cry. It's sobbing right now."
  ],
  logic: [
    "This logic is flawless... if you ignore all the flaws.",
    "Your conditional statements have conditions. Very conditional of them.",
    "This edge case handling is theoretical at best.",
    "Your error handling strategy is 'hope and pray'. Bold.",
    "This algorithm is O(n^2) where n is my disappointment.",
    "Your null checks are... present. I think. Can't find them.",
    "This code handles errors like I handle my emotions. Not well.",
    "Your validation is more of a gentle suggestion.",
    "This race condition is a feature, not a bug. Allegedly.",
    "Your state management is in a state. Not a good one."
  ],
  documentation: [
    "This comment is a lie. The code does the opposite.",
    "Your documentation is 'in the code'. Which is unreadable.",
    "This TODO has been here longer than my will to live.",
    "Your README says 'See code'. The code says 'Good luck'.",
    "This comment explains what the code does. Incorrectly.",
    "Your API docs are aspirational. The reality is depressing.",
    "This inline comment adds no value. Like my review, but less funny.",
    "Your JSDoc is 'present'. Also 'wrong'. But present.",
    "This 'temporary' solution has a 2-year anniversary coming up.",
    "Your commit message 'stuff' is very descriptive. Of your effort."
  ],
  testing: [
    "Tests? Where we're going, we don't need tests. (We do. We really do.)",
    "Your test coverage is a blind spot. Literally.",
    "This 'test' just checks that the code exists. Revolutionary.",
    "Your unit tests are having an identity crisis about what they're testing.",
    "This test passes 60% of the time, every time.",
    "Your integration tests are 'the users will find the bugs'.",
    "This mock is mocking you more than it's mocking the dependency.",
    "Your test data is suspiciously specific. Planning something?",
    "This test suite is 'in development'. Since 2019.",
    "Your tests are like Schrodinger's cat. They pass until observed."
  ],
  brutal: [
    "This code is a war crime against computer science.",
    "I've read obituaries with more life than this code.",
    "This repository is a crime scene and you're the prime suspect.",
    "Your git history tells a story of hubris and regret.",
    "This code violates the Geneva Convention for Software.",
    "I've seen clearer hieroglyphics. And those were 4000 years old.",
    "This code makes 'Hello World' look like enterprise architecture.",
    "Your PR is an archaeological dig through layers of bad decisions.",
    "This code is the reason aliens won't talk to us.",
    "I've reviewed a lot of code. This... this is something else."
  ]
};

const reviewApproaches = [
  { style: "Gentle Suggestion", tone: "Maybe consider...", emoji: "🌸" },
  { style: "Direct Feedback", tone: "This needs work.", emoji: "🎯" },
  { style: "Constructive Criticism", tone: "Have you thought about...", emoji: "🔨" },
  { style: "Brutal Honesty", tone: "This is wrong.", emoji: "⚡" },
  { style: "Sarcastic Observation", tone: "Interesting choice...", emoji: "🙃" },
  { style: "Genuine Concern", tone: "I'm worried about...", emoji: "😰" },
  { style: "Maximum Savagery", tone: "What is this???", emoji: "🔥" },
  { style: "Confused Disbelief", tone: "I don't understand why...", emoji: "🤯" }
];

const reviewerPersonas = [
  { name: "The Nitpicker", focus: "Formatting, spacing, semicolons", catchphrase: "Actually..." },
  { name: "The Architect", focus: "Design patterns, scalability, coupling", catchphrase: "Have you considered microservices?" },
  { name: "The Optimist", focus: "Finding silver linings... barely", catchphrase: "It's not the worst I've seen..." },
  { name: "The Veteran", focus: "War stories and 'back in my day'", catchphrase: "We didn't have [new tech] in 2010..." },
  { name: "The Robot", focus: "Automated comments, no emotions", catchphrase: "Does not meet standard #47.3" },
  { name: "The Cowboy", focus: "Speed over quality", catchphrase: "LGTM, ship it!" },
  { name: "The Perfectionist", focus: "Everything must be flawless", catchphrase: "This could be more elegant..." },
  { name: "The Ghost", focus: "Nothing - never shows up", catchphrase: "[No response after 5 days]" }
];

const approvalLevels = [
  { level: "Request Changes", chance: "85%", desc: "Back to the drawing board", emoji: "🔄" },
  { level: "Comment", chance: "10%", desc: "Not approved, but not rejected", emoji: "💬" },
  { level: "Approve with Comments", chance: "4%", desc: "Mercy approval", emoji: "✅" },
  { level: "Pure Approval", chance: "1%", desc: "You've achieved the impossible", emoji: "🌟" }
];

interface ReviewOptions {
  type?: 'general' | 'architecture' | 'style' | 'logic' | 'documentation' | 'testing' | 'brutal' | 'all';
  count?: number;
  persona?: string;
  severity?: 'gentle' | 'normal' | 'brutal';
}

export async function execute(options: ReviewOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  👁️ THE G-RUMP CODE REVIEW GENERATOR 👁️\n', 'title'));
  
  const type = options.type || 'all';
  const count = Math.min(options.count || 5, 10);
  const severity = options.severity || 'normal';
  const personaName = options.persona;

  // Select reviewer persona
  let persona: typeof reviewerPersonas[0];
  if (personaName) {
    persona = reviewerPersonas.find(p => p.name.toLowerCase().includes(personaName.toLowerCase())) || reviewerPersonas[0];
  } else {
    persona = reviewerPersonas[Math.floor(Math.random() * reviewerPersonas.length)];
  }

  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  Reviewer Persona: ${persona.name}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Focus Area: ${persona.focus}`));
  console.log(chalk.hex(branding.colors.mediumPurple)(`  Severity: ${severity.toUpperCase()}`));
  console.log(branding.getThinDivider());

  // Build comment pool
  let commentPool: string[] = [];
  if (type === 'all') {
    commentPool = Object.values(reviewComments).flat();
  } else {
    commentPool = reviewComments[type] || reviewComments.general;
  }

  if (severity === 'brutal') {
    commentPool = [...commentPool, ...reviewComments.brutal];
  } else if (severity === 'gentle') {
    commentPool = reviewComments.general.slice(0, 5);
  }

  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📝 CODE REVIEW COMMENTS:\n`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Catchphrase: "${persona.catchphrase}"\n`));

  // Generate review comments
  const selectedComments: string[] = [];
  for (let i = 0; i < count; i++) {
    let comment = commentPool[Math.floor(Math.random() * commentPool.length)];
    while (selectedComments.includes(comment)) {
      comment = commentPool[Math.floor(Math.random() * commentPool.length)];
    }
    selectedComments.push(comment);

    const approach = reviewApproaches[Math.floor(Math.random() * reviewApproaches.length)];
    
    await delay(400);
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${approach.emoji} [${approach.style}]`));
    console.log(chalk.hex(branding.colors.white)(`     "${comment}"`));
    console.log();
  }

  // Approval prediction
  console.log(branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎯 APPROVAL PREDICTION:\n`));
  
  const approval = approvalLevels[Math.floor(Math.random() * approvalLevels.length)];
  console.log(chalk.hex(branding.colors.white)(`  ${approval.emoji} ${approval.level}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Probability: ${approval.chance}`));
  console.log(chalk.hex(branding.colors.mediumPurple)(`  Meaning: ${approval.desc}`));

  // Review statistics
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📊 REVIEW STATISTICS:\n'));
  
  const stats = {
    "Nitpicks Found": Math.floor(Math.random() * 15) + 3,
    "Major Issues": Math.floor(Math.random() * 5) + 1,
    "Questions Asked": Math.floor(Math.random() * 8) + 2,
    "Suggestions Made": Math.floor(Math.random() * 10) + 5,
    "Compliments Given": Math.floor(Math.random() * 2),
    "Times 'LGTM' Considered": Math.floor(Math.random() * 3)
  };

  Object.entries(stats).forEach(([key, value]) => {
    const bar = '█'.repeat(Math.min(value, 10));
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${key}: ${value} ${bar}`));
  });

  // Reviewer satisfaction
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  😤 REVIEWER SATISFACTION:\n'));
  
  const satisfaction = Math.floor(Math.random() * 100);
  const satisfactionBar = branding.getProgressBar(satisfaction, 20);
  
  console.log(chalk.hex(branding.colors.white)(`  ${satisfactionBar} ${satisfaction}%`));
  
  const reaction = satisfaction > 80 ? "Surprisingly pleased. Check for fever." :
                   satisfaction > 60 ? "Tolerable. Like a lukewarm coffee." :
                   satisfaction > 40 ? "Disappointed but not surprised." :
                   satisfaction > 20 ? "Questioning career choices." :
                   "Considering a new profession. Farming, perhaps.";
  
  console.log(chalk.hex(branding.colors.lightPurple)(`  Assessment: ${reaction}`));

  // Suggested improvements
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  💡 SUGGESTED IMPROVEMENTS:\n'));
  
  const improvements = [
    "Read 'Clean Code'... again. And this time, understand it.",
    "Use a linter. Please. For all our sanity.",
    "Write tests. No, 'it works on my machine' is not a test.",
    "Add comments. Real ones. Not '// TODO: fix this'.",
    "Refactor. The code smells. I can smell it from here.",
    "Delete half the code. The good half stays.",
    "Start over. Sometimes fresh beginnings are best.",
    "Get a rubber duck. Explain your code to it. Listen to its silence."
  ];

  const selectedImprovements = improvements.sort(() => 0.5 - Math.random()).slice(0, 4);
  selectedImprovements.forEach((imp, i) => {
    console.log(chalk.hex(branding.colors.white)(`  ${i + 1}. ${imp}`));
  });

  // Closing
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Review complete. Apply feedback or face the consequences.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.85) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Pro tip: The best code review is the one where you review your own code first.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const reviewCommand = { execute };
