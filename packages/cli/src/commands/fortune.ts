import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump fortune - Random programming fortune with sass
 * The mystical command that reveals your coding destiny
 */

const fortunes = {
  lucky: [
    "Your code will compile on the first try today. Miracles do happen.",
    "A bug you thought was impossible will reveal itself to be a typo.",
    "Your pull request will be approved with zero comments. Enjoy this rare moment.",
    "The coffee machine will not break today. Your code will thank you.",
    "You will find the perfect StackOverflow answer on your first search.",
    "All your tests will pass. This is not a drill.",
    "You will discover an elegant solution to a complex problem. Write it down.",
    "Your documentation will actually be read by someone. Prepare your ego.",
    "A junior developer will ask you a question, and you'll know the answer.",
    "Your legacy code refactoring will go smoother than expected."
  ],
  
  caution: [
    "Beware the 'quick fix' at 4:59 PM. It will haunt you at 2 AM.",
    "A merge conflict approaches. Prepare your git skills.",
    "Your 'temporary' solution will become permanent. Choose wisely.",
    "The client will ask for 'just one small change.' It's never small.",
    "An undocumented feature will break in production. You have been warned.",
    "A library you depend on will release a breaking change. Update carefully.",
    "Your 'it works on my machine' excuse will be tested today.",
    "A race condition lurks in your async code. Thread carefully.",
    "Your npm install will take longer than expected. Pack a lunch.",
    "Someone will ask why you chose that framework. Have your reasons ready."
  ],
  
  doom: [
    "A critical bug will emerge 5 minutes before the demo. Embrace the chaos.",
    "Your production database will remind you that backups are important.",
    "A 'simple' refactor will cascade into an architectural nightmare.",
    "The intern will push to main. There will be no survivors.",
    "Your Friday deploy will teach you why we don't deploy on Fridays.",
    "A memory leak will reveal itself. Your RAM weeps.",
    "The legacy code you touched will break. It was waiting for you.",
    "Your 'harmless' configuration change will take down production.",
    "The CEO will ask to see the code. There is no escape.",
    "A security vulnerability scan will find something. Several somethings."
  ],
  
  wisdom: [
    "The code you write today is the legacy someone else inherits tomorrow.",
    "Write tests not because they catch bugs, but because they document intent.",
    "A function should do one thing. If it does two, it does too much.",
    "Comments explain 'why', code explains 'what'. Both are necessary.",
    "Refactor not because the code is wrong, but because you understand it better now.",
    "The best code is often the code you don't write.",
    "Optimize for readability first. The compiler optimizes for speed.",
    "Technical debt is like a credit card: convenient now, expensive later.",
    "A broken build is better than a broken production.",
    "Document your assumptions. Future you will be grateful."
  ],
  
  comedy: [
    "You will spend 3 hours on a bug caused by a missing semicolon.",
    "Your rubber duck debugging session will become a full conversation.",
    "You will explain to a non-technical person why the button can't just be 'more blue'.",
    "A variable named 'temp' will live longer than your career at this company.",
    "You will write 'TODO: fix this' and it will become a permanent fixture.",
    "Your 'temporary' workaround will outlast your employment contract.",
    "You will discover code you wrote drunk. It will be better than expected.",
    "A regex you wrote will work perfectly. You will not understand why.",
    "You will delete more code than you write today. This is success.",
    "Your commit messages will become increasingly unhinged as the day progresses."
  ],
  
  sarcastic: [
    "Your code quality is directly proportional to your caffeine intake. Drink up.",
    "That code you copied from StackOverflow will work perfectly. Trust me.",
    "Your 'elegant' solution will confuse everyone, including future you.",
    "The meeting about reducing meetings will last 2 hours. Irony is free.",
    "Your self-documenting code needs documentation to explain itself.",
    "Agile means 'we'll figure it out as we panic'.",
    "Your technical debt is now a technical mortgage with compound interest.",
    "That edge case you ignored? It's the main case now. Enjoy.",
    "Your 'final' version will be version 47. Naming is hard.",
    "The cloud is just someone else's computer. Someone else's expensive computer."
  ]
};

const luckyNumbers = [
  "404 - Not found (ironic, isn't it?)",
  "200 - OK (the best HTTP status)",
  "418 - I'm a teapot (yes, it's real)",
  "1337 - Elite status achieved",
  "500 - Internal server error (your mood today)",
  "42 - The answer to everything",
  "302 - Temporary redirect (your attention span)",
  "403 - Forbidden (like your weekend plans)",
  "503 - Service unavailable (you, after this sprint)",
  "∞ - Infinite bugs await"
];

const luckyColors = [
  "Hex #6B46C1 - G-Rump Purple (clearly superior)",
  "Hex #8B5CF6 - Medium Purple (balanced, as all things should be)",
  "Hex #A855F7 - Light Purple (for the optimists)",
  "Hex #FFFFFF - White (boring but practical)",
  "Hex #FF0000 - Red (for when production is down)",
  "Hex #00FF00 - Green (all tests pass, rare)",
  "Hex #000000 - Black (like your coffee should be)",
  "Hex #C0FFEE - Coffee (the only color that matters)"
];

const codingHoroscopes: Record<string, string[]> = {
  "Aries": ["Charge headfirst into refactoring. What could go wrong?", "Your impulsive coding will either be genius or disaster."],
  "Taurus": ["Refuse to update dependencies. If it works, don't touch it.", "Your stubbornness will keep legacy code alive forever."],
  "Gemini": ["Start two projects today. Finish neither.", "Your dual nature means you'll write conflicting code."],
  "Cancer": ["Stay in your comfort zone. The legacy codebase is safe.", "Nostalgia for jQuery will overcome you today."],
  "Leo": ["Write code that demands attention. All caps comments incoming.", "Your code will be dramatic and unnecessarily complex."],
  "Virgo": ["Refactor everything. Organize those imports alphabetically.", "Your perfectionism will delay the release by 3 days."],
  "Libra": ["Can't decide between frameworks. Use both. Cry later.", "Your quest for balance will create technical debt."],
  "Scorpio": ["Find the deepest, darkest bug. Fix it ruthlessly.", "Your intensity will scare the junior developers."],
  "Sagittarius": ["Ship code without testing. Fortune favors the bold (foolish).", "Your optimism will be tested in production."],
  "Capricorn": ["Write enterprise-grade code for a to-do app.", "Your ambition exceeds the project requirements."],
  "Aquarius": ["Invent a new framework. Abandon it by lunch.", "Your unconventional approach will confuse everyone."],
  "Pisces": ["Daydream about perfect code. Write messy reality.", "Your intuition will find bugs before they happen."]
};

interface FortuneOptions {
  category?: 'lucky' | 'caution' | 'doom' | 'wisdom' | 'comedy' | 'sarcastic' | 'random';
  sign?: string;
}

export async function execute(options: FortuneOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🔮 G-RUMP CODING FORTUNE 🔮\n', 'title'));
  
  const category = options.category || 'random';
  const sign = options.sign || getRandomSign();
  
  console.log(chalk.hex(branding.colors.lightPurple)(`  Reading your coding destiny...`));
  console.log(branding.getThinDivider());
  
  // Mystical animation
  await mysticalAnimation();
  
  console.log('\n' + branding.getDivider());
  
  // Select fortune category
  let selectedFortunes: string[] = [];
  if (category === 'random') {
    selectedFortunes = Object.values(fortunes).flat();
  } else {
    selectedFortunes = fortunes[category] || fortunes.lucky;
  }
  
  // Get fortune
  const fortune = selectedFortunes[Math.floor(Math.random() * selectedFortunes.length)];
  
  // Display fortune with drama
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  ✨ YOUR FORTUNE ✨\n`));
  console.log(chalk.bgHex(branding.colors.darkPurple).whiteBright(`  ${fortune}`));
  
  await delay(400);
  
  // Lucky number
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎱 LUCKY HTTP STATUS CODE:\n`));
  const luckyNum = luckyNumbers[Math.floor(Math.random() * luckyNumbers.length)];
  console.log(chalk.hex(branding.colors.lightPurple)(`    ${luckyNum}`));
  
  // Lucky color
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎨 LUCKY COLOR:\n`));
  const luckyCol = luckyColors[Math.floor(Math.random() * luckyColors.length)];
  console.log(chalk.hex(branding.colors.lightPurple)(`    ${luckyCol}`));
  
  // Coding horoscope
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  ♈ CODING HOROSCOPE (${sign}):\n`));
  const horoscope = codingHoroscopes[sign];
  if (horoscope) {
    console.log(chalk.hex(branding.colors.lightPurple)(`    ${horoscope[Math.floor(Math.random() * horoscope.length)]}`));
  }
  
  await delay(300);
  
  // Fortune cookie wisdom
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🥠 FORTUNE COOKIE WISDOM:\n`));
  const wisdom = fortunes.wisdom[Math.floor(Math.random() * fortunes.wisdom.length)];
  console.log(chalk.hex(branding.colors.white).italic(`    "${wisdom}"`));
  
  await delay(200);
  
  // Compatibility check
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  💜 TODAY'S CODING COMPATIBILITY:\n`));
  const compatibilities = [
    "Coffee: 100% compatible",
    "Deadlines: 23% compatible",
    "Legacy code: 0% compatible",
    "New frameworks: 67% compatible",
    "Meetings: -50% compatible",
    "Rubber duck debugging: 99% compatible"
  ];
  const randomCompat = compatibilities.sort(() => Math.random() - 0.5).slice(0, 3);
  for (const compat of randomCompat) {
    console.log(chalk.hex(branding.colors.lightPurple)(`    • ${compat}`));
  }
  
  // Closing
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Fortune revealed. Future is uncertain. Code carefully.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.9) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Remember: Fortune favors the prepared... and those who write tests.`));
  }
}

async function mysticalAnimation(): Promise<void> {
  const frames = [
    "🔮 Consulting the server spirits...",
    "🌙 Reading the commit logs of destiny...",
    "☕ Analyzing coffee grounds patterns...",
    "🎲 Rolling the dice of probability...",
    "🌌 Channeling the wisdom of legacy code...",
    "✨ Interpreting the error messages of fate..."
  ];
  
  for (const frame of frames) {
    process.stdout.write(chalk.hex(branding.colors.mediumPurple)(`\r  ${frame}`));
    await delay(300);
  }
  console.log();
}

function getRandomSign(): string {
  const signs = Object.keys(codingHoroscopes);
  return signs[Math.floor(Math.random() * signs.length)];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const fortuneCommand = { execute };
