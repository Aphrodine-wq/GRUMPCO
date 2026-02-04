import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump excuse - Generate creative excuses for missed deadlines
 * Because sometimes the truth isn't colorful enough
 */

const excuses = {
  classic: [
    "My cat learned to code and deleted everything.",
    "The intern fed the code to their pet hamster.",
    "Aliens abducted my codebase for research purposes.",
    "My rubber duck debugging session turned into a 3-hour argument.",
    "The code worked on my machine, but my machine is now in another dimension.",
    "Git merged with the void and now we're all just floating.",
    "My IDE achieved sentience and went on strike.",
    "A time traveler from the future told me not to commit this.",
    "The requirements document was written in ancient hieroglyphics.",
    "My keyboard only types in Comic Sans now and I can't work like this."
  ],

  technical: [
    "The compiler is having an existential crisis about the meaning of 'undefined'.",
    "Our database achieved consciousness and is questioning its purpose.",
    "The API is on a spiritual retreat to find itself.",
    "My dependencies had a family reunion and aren't speaking to each other.",
    "The build pipeline is experiencing performance anxiety.",
    "Our server is currently unionizing for better working conditions.",
    "The cloud provider moved our data to the actual clouds.",
    "A race condition won the race and took all the conditions with it.",
    "The cache decided to cache its feelings instead of data.",
    "Our load balancer is off-balance due to emotional baggage."
  ],

  creative: [
    "I was abducted by documentation writers and forced to read RFCs for 48 hours.",
    "My coffee machine gained sentience and demanded a salary negotiation.",
    "The code elves went on strike for better working conditions.",
    "A rogue AI converted all my comments into Shakespearean insults.",
    "I discovered a wormhole in the legacy codebase and got lost for 3 days.",
    "My standing desk became self-aware and refuses to sit down.",
    "The bugs organized a union and now have collective bargaining rights.",
    "I was busy teaching my code to pass the Turing test.",
    "My monitor achieved enlightenment and now only displays zen koans.",
    "The pull request got stuck in a traffic jam on the information superhighway."
  ],

  relatable: [
    "It worked in my head, but my head doesn't have edge cases.",
    "I was 95% done, then discovered the remaining 95%.",
    "The deadline was more of a... suggestion, really.",
    "I was this close, which in programmer terms means 2 weeks away.",
    "Time is a flat circle and so is my project timeline.",
    "I measured twice, cut once, and somehow ended up with negative code.",
    "The estimates were written by my optimistic past self who knew nothing.",
    "I got stuck in a recursion of 'just one more fix'.",
    "Technical debt called and it wants its interest paid in full.",
    "Scope creep brought friends. Lots of friends."
  ],

  absurd: [
    "A swarm of quantum-entangled bees interfered with my keyboard.",
    "My codebase was audited by intergalactic tax authorities.",
    "The semicolons unionized and went on strike for better visibility.",
    "I accidentally wrote the code in reverse Polish notation... backwards.",
    "My functions achieved sentience and are demanding worker's comp.",
    "A butterfly flapped its wings and caused a hurricane in my container.",
    "The code was cursed by a medieval wizard (legacy from 2015).",
    "I fell into a rabbit hole of npm dependencies and emerged in 1984.",
    "My variables developed personalities and refuse to be assigned.",
    "The Internet of Things became self-aware and started with my router."
  ],

  professional: [
    "We discovered a critical edge case that requires architectural reconsideration.",
    "The integration complexity exceeded our initial risk assessment models.",
    "Third-party dependencies introduced breaking changes in their latest release.",
    "Our QA cycle revealed unforeseen regression scenarios.",
    "The technical debt accumulated in the legacy layer requires immediate refactoring.",
    "Cross-functional alignment on the implementation details is still pending.",
    "We encountered performance bottlenecks that necessitate algorithmic optimization.",
    "The scope expansion was approved by stakeholders retroactively.",
    "Our CI/CD pipeline requires infrastructure updates for compliance.",
    "The security audit flagged several items for immediate remediation."
  ]
};

const deliveryStyles = [
  "whispered dramatically",
  "shouted into the void",
  "typed with increasing desperation",
  "delivered with suspicious confidence",
  "muttered while staring into space",
  "proclaimed to the heavens",
  "written on a sticky note of shame",
  "sent via carrier pigeon",
  "screamed into a pillow",
  "transmitted through interpretive dance"
];

const reactions = [
  "Your manager's sigh can be heard from three offices away.",
  "HR has added you to a watchlist.",
  "The project manager is questioning their career choices.",
  "Your team lead needs a moment... and a drink.",
  "The CEO has scheduled a 'casual chat' for tomorrow.",
  "Your excuses are now part of company folklore.",
  "The client is considering other vendors. And therapy.",
  "Your credibility has entered the witness protection program.",
  "The stand-up meeting just got awkward.",
  "Your mentor is updating their LinkedIn to remove you."
];

interface ExcuseOptions {
  category?: 'classic' | 'technical' | 'creative' | 'relatable' | 'absurd' | 'professional' | 'random';
  count?: number;
  context?: string;
}

export async function execute(options: ExcuseOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🎭 THE G-RUMP EXCUSE GENERATOR 🎭\n', 'title'));
  
  const category = options.category || 'random';
  const count = Math.min(options.count || 1, 5);
  const context = options.context;

  // Select excuse pool
  let excusePool: string[] = [];
  if (category === 'random') {
    excusePool = Object.values(excuses).flat();
  } else {
    excusePool = excuses[category] || excuses.classic;
  }

  if (context) {
    console.log(branding.format(`  Context: ${context}`, 'subtitle'));
  }
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  Category: ${category.toUpperCase()}`));
  console.log(branding.getThinDivider());

  console.log(chalk.hex(branding.colors.lightPurple)(`\n  🎪 YOUR EXCUSES:\n`));

  const selectedExcuses: string[] = [];
  for (let i = 0; i < count; i++) {
    let excuse = excusePool[Math.floor(Math.random() * excusePool.length)];
    while (selectedExcuses.includes(excuse)) {
      excuse = excusePool[Math.floor(Math.random() * excusePool.length)];
    }
    selectedExcuses.push(excuse);

    const style = deliveryStyles[Math.floor(Math.random() * deliveryStyles.length)];
    const emoji = ['🙈', '🙉', '🙊', '🤷', '🫣', '😬', '🤐', '🤥'][i % 8];
    
    await delay(400);
    console.log(chalk.hex(branding.colors.mediumPurple)(`  ${emoji} Excuse #${i + 1} (${style}):`));
    console.log(chalk.hex(branding.colors.white)(`     "${excuse}"`));
    console.log();
  }

  // Credibility rating
  console.log(branding.getDivider());
  const credibility = Math.floor(Math.random() * 100);
  const rating = credibility > 80 ? "Miraculously Believable" : 
                 credibility > 50 ? "Suspicious but Possible" : 
                 credibility > 20 ? "Requires Serious Acting" : "Career-Ending";
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📊 CREDIBILITY RATING: ${credibility}% - ${rating}`));
  
  // Reaction
  const reaction = reactions[Math.floor(Math.random() * reactions.length)];
  console.log(chalk.hex(branding.colors.lightPurple)(`  💀 Predicted Outcome: ${reaction}`));

  // Pro tips
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  💡 Pro Tips for Delivery:\n'));
  const tips = [
    "Maintain unwavering eye contact while delivering the excuse.",
    "The more technical jargon you use, the more believable it becomes.",
    "Blame quantum mechanics - nobody understands it anyway.",
    "If all else fails, claim it's a 'known issue in the industry'.",
    "Use hand gestures. Lots of hand gestures. Distract with movement.",
    "Blame the intern. Classic move, always available.",
    "Say 'it's complicated' and refuse to elaborate."
  ];
  const tip = tips[Math.floor(Math.random() * tips.length)];
  console.log(chalk.hex(branding.colors.white)(`  → ${tip}`));

  // Closing
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Remember: The best excuse is working code. But this is funnier.', 'sassy'));

  // Easter egg
  if (Math.random() > 0.9) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Fun fact: 73% of these excuses have been used by the G-Rump developers themselves.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const excuseCommand = { execute };
