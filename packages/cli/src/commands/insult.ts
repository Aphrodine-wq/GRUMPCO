import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump insult - Generate personalized coding insults with purple sass
 * The ultimate insult generator for developers who need a reality check
 */

const insults = {
  general: [
    "Your code is like a black hole - it sucks in all the maintainability.",
    "I've seen better variable names in a mad libs game.",
    "Your function is doing so many things, it's having an identity crisis.",
    "This code is like a time bomb, but the timer is measured in technical debt.",
    "Your indentation is giving me vertigo.",
    "I've seen clearer spaghetti at an Italian restaurant.",
    "Your comments are like fortune cookies - vague and slightly disappointing.",
    "This error handling is basically just screaming into the void.",
    "Your code has more side effects than a pharmaceutical commercial.",
    "I've seen better architecture in a house of cards."
  ],
  skills: [
    "Your debugging skills are like a blindfolded person playing darts.",
    "You code like you're trying to win an obfuscation contest.",
    "Your git commits tell a story... a horror story.",
    "I've seen more organized chaos in a tornado.",
    "Your problem-solving approach is 'try random things until it works'.",
    "You have the attention to detail of a goldfish with amnesia.",
    "Your coding style is like abstract art - nobody understands it.",
    "I've met rocks with better logic than your code.",
    "Your testing strategy is 'hope the users find the bugs'.",
    "You write code like you're being paid by the character."
  ],
  personality: [
    "You're not lazy, you're just... energy efficient.",
    "Your optimism about deadlines is adorable. And delusional.",
    "You have the patience of a caffeinated squirrel.",
    "Your 'it works on my machine' energy is strong.",
    "You're like a unicorn - mythical productivity and questionable existence.",
    "Your can-do attitude is nice. Your can-actually-do skills need work.",
    "You're the human version of a 'WIP' commit.",
    "Your code reviews are like participation trophies - technically present.",
    "You have the consistency of a WiFi signal in a basement.",
    "Your documentation game is weaker than a decaf espresso."
  ],
  creativity: [
    "Your variable names are as creative as 'var1', 'var2', 'var2_but_actually_3'.",
    "I've seen more innovation in a photocopier manual.",
    "Your solution is like using a sledgehammer to crack a nut... then missing.",
    "This approach is so original, nobody's ever done it... for good reason.",
    "Your code creativity score: exists.",
    "I've seen better problem-solving from a Roomba.",
    "Your algorithm is like a Rube Goldberg machine... without the charm.",
    "This code is avant-garde. As in, it guards against anyone understanding it.",
    "Your architectural vision is as clear as mud. Brown, chunky mud.",
    "I've seen more elegant solutions in a brute force attack."
  ],
  brutal: [
    "Your code doesn't just have bugs, it has an ecosystem.",
    "Reading your code is like deciphering ancient curses.",
    "Your repository is a testament to what happens when hope meets incompetence.",
    "I've seen clearer hieroglyphics in Egyptian tombs.",
    "Your code quality makes 'Hello World' look like enterprise software.",
    "This codebase is a crime scene and you're the prime suspect.",
    "Your git history reads like a tragedy in slow motion.",
    "I've seen better code written by cats walking on keyboards.",
    "Your functions have more issues than a celebrity tabloid.",
    "This code is the reason StackOverflow has a dark mode - to hide the shame."
  ]
};

const targets = [
  "the junior dev who 'totally knows React'",
  "the senior dev who writes 'temporary' solutions",
  "the architect who loves over-engineering",
  "the code reviewer who only comments on formatting",
  "the dev who pushes directly to main",
  "the intern who broke production",
  "the manager who 'just needs a small tweak'",
  "the cowboy coder who hates tests",
  "the developer who documents in their head",
  "the genius who uses 47 nested ternaries"
];

const deliveries = [
  "delivered with a disappointed sigh",
  "spoken through gritted teeth",
  "muttered while shaking head slowly",
  "proclaimed with dramatic flair",
  "whispered like a terrible secret",
  "shouted into the codebase abyss",
  "typed with passive-aggressive precision",
  "delivered with a pitying smile",
  "announced with the enthusiasm of a Monday morning",
  "conveyed through interpretive eye-rolling"
];

interface InsultOptions {
  target?: string;
  count?: number;
  brutal?: boolean;
}

export async function execute(options: InsultOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🔥 THE G-RUMP INSULT GENERATOR 🔥\n', 'title'));
  
  const target = options.target || targets[Math.floor(Math.random() * targets.length)];
  const count = Math.min(options.count || 3, 7);
  const brutal = options.brutal || false;

  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  Target: ${target}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Intensity: ${brutal ? 'MAXIMUM SAVAGE' : 'Moderately Disappointed'}`));
  console.log(branding.getThinDivider());

  // Build insult pool
  let insultPool = [...insults.general, ...insults.skills, ...insults.personality, ...insults.creativity];
  if (brutal) {
    insultPool = [...insultPool, ...insults.brutal];
  }

  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  💜 YOUR PERSONALIZED INSULTS:\n`));

  const selectedInsults: string[] = [];
  for (let i = 0; i < count; i++) {
    let insult = insultPool[Math.floor(Math.random() * insultPool.length)];
    while (selectedInsults.includes(insult)) {
      insult = insultPool[Math.floor(Math.random() * insultPool.length)];
    }
    selectedInsults.push(insult);

    const delivery = deliveries[Math.floor(Math.random() * deliveries.length)];
    const emoji = ['🙄', '😤', '🤦', '🫠', '🙃', '😒', '🤨', '😵'][i % 8];
    
    await delay(500);
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${emoji} Insult #${i + 1} (${delivery}):`));
    console.log(chalk.hex(branding.colors.white)(`     "${insult}"`));
    console.log();
  }

  // Calculate savagery score
  console.log(branding.getDivider());
  const savageryScore = brutal ? Math.floor(Math.random() * 20) + 80 : Math.floor(Math.random() * 40) + 40;
  const tier = savageryScore > 90 ? "LEGENDARY SAVAGE" : 
               savageryScore > 70 ? "Expert Roaster" : 
               savageryScore > 50 ? "Adequately Mean" : "Softboiled Egg";
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📊 SAVAGERY SCORE: ${savageryScore}/100 - ${tier}`));
  
  // Damage assessment
  const damages = [
    "Target's ego has entered critical condition.",
    "Victim is questioning their career choices.",
    "Subject has gone to 'find themselves' in the break room.",
    "Target updated their LinkedIn to 'Open to Work'.",
    "Victim is hugging their imposter syndrome for comfort.",
    "Subject has requested a transfer to a different team.",
    "Target is re-reading their CS degree certificate for validation.",
    "Victim has started looking at coding bootcamp ads."
  ];
  
  const damage = damages[Math.floor(Math.random() * damages.length)];
  console.log(chalk.hex(branding.colors.lightPurple)(`  💀 Damage Assessment: ${damage}`));

  // Recovery advice
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  💡 Recovery Advice:\n'));
  const advice = [
    "Apply ice to the burned areas immediately.",
    "Victims should avoid mirrors for 24-48 hours.",
    "Therapy sessions recommended. Group rates available.",
    "Target may need a comfort blanket and their favorite debugging duck.",
    "Victims should hydrate... preferably with something strong.",
    "A heartfelt apology and some actual good code might help.",
    "Suggest victim practices self-care by deleting their git history.",
    "Recommend target takes up yoga... or just yodeling into the void."
  ];
  console.log(chalk.hex(branding.colors.white)(`  → ${advice[Math.floor(Math.random() * advice.length)]}`));

  // Closing
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Insults delivered. Friendship may require 2-4 weeks to recover.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.85) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Pro tip: The best comeback is better code. But crying works too.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const insultCommand = { execute };
