import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import { branding } from '../branding.js';

/**
 * grump refactor - Aggressive refactoring suggestions with attitude
 * Because your code needs tough love
 */

const refactorStrategies = {
  naming: [
    "Rename variables from 'data' to something that doesn't scream 'I gave up'.",
    "Change all single-letter variables to actual words. Yes, even 'i'.",
    "Replace 'temp', 'tmp', and 'temporal' with actual descriptive names.",
    "Rename functions that start with 'do' or 'handle' to say what they actually do.",
    "Change 'foo', 'bar', 'baz' to anything else. Literally anything."
  ],
  
  structure: [
    "Split this 500-line function before it becomes sentient.",
    "Extract nested callbacks into separate functions. Save the callbacks!",
    "Move this logic out of the controller. Controllers shouldn't do everything.",
    "Separate concerns. This file is having an identity crisis.",
    "Break down giant switch statements. They're trying to be the entire app."
  ],
  
  cleanup: [
    "Remove commented-out code. Git remembers, you don't need to.",
    "Delete those console.logs. Production isn't your debug environment.",
    "Remove unused imports. They're dead weight.",
    "Clear out TODO comments older than your last vacation.",
    "Delete empty catch blocks. Swallowing errors is not error handling."
  ],
  
  modernization: [
    "Replace var with let/const. It's not 2010 anymore.",
    "Convert callbacks to async/await. Join the modern era.",
    "Use destructuring. Your fingers will thank you.",
    "Replace for loops with map/filter/reduce. Be functional.",
    "Use template literals. String concatenation is so last decade."
  ],
  
  architecture: [
    "This needs dependency injection. Stop hard-coding everything.",
    "Extract interfaces. Your types are having an identity crisis.",
    "Add a service layer. Controllers shouldn't touch the database directly.",
    "Implement proper error boundaries. Errors deserve better than console.log.",
    "Add proper validation. 'Trust the client' is not a strategy."
  ],
  
  testing: [
    "Write tests. Yes, actual tests. Not 'test.js' with one console.log.",
    "Add unit tests. 'It works on my machine' is not a test suite.",
    "Implement integration tests. Unit tests lie about reality.",
    "Add error case tests. Happy path testing is for optimists.",
    "Set up CI/CD. Manual deployment is so 2005."
  ],
  
  performance: [
    "Cache this database query. The database is tired of your nonsense.",
    "Add pagination. Loading 10,000 records at once is not 'efficient'.",
    "Debounce those API calls. The server is begging for mercy.",
    "Lazy load these components. Your bundle size is obese.",
    "Add indexes to these queries. Full table scans are not a feature."
  ]
};

const refactorRoasts = [
  "This code is like a hoarder's house - full of things nobody needs.",
  "Your functions are doing too much. They're the overachievers nobody asked for.",
  "This codebase has more technical debt than a student loan.",
  "I've seen better organized junk drawers than this code.",
  "Your naming conventions are giving me an identity crisis.",
  "This code violates the Single Responsibility Principle... and my sanity.",
  "Refactoring this will require therapy. For both of us.",
  "This is what happens when 'move fast and break things' meets 'never fix it'.",
  "Your code has more layers than an onion. And makes me cry just as much.",
  "This needs refactoring like I need coffee - desperately and immediately."
];

const beforeAfter = [
  {
    before: "if (x == true)",
    after: "if (x) // We fixed your redundant comparison. You're welcome.",
    issue: "Boolean comparison redundancy"
  },
  {
    before: "var x = 1; var y = 2;",
    after: "const x = 1; const y = 2; // Joined the 21st century.",
    issue: "Using var in modern JavaScript"
  },
  {
    before: "function(a, b, c, d, e, f)",
    after: "function({ a, b, c, d, e, f }) // Destructuring: learn it, love it.",
    issue: "Too many parameters"
  },
  {
    before: "// TODO: fix this",
    after: "// FIXED: Actually fixed it instead of writing comments.",
    issue: "TODO without action"
  }
];

interface RefactorOptions {
  file?: string;
  aggressive?: boolean;
}

export async function execute(filePath: string | undefined, options: RefactorOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🔨 G-RUMP AGGRESSIVE REFACTORING 🔨\n', 'title'));
  
  const target = filePath;
  const aggressive = options.aggressive || false;
  
  if (!target) {
    console.log(branding.status('No file specified. Giving you general refactoring wisdom instead.', 'sassy'));
    await generateGeneralRefactoringTips(aggressive);
    return;
  }
  
  if (!existsSync(target)) {
    console.log(branding.status(`File not found: ${target}. Nothing to refactor! (Or everything, if it's that bad.)`, 'error'));
    return;
  }
  
  console.log(branding.format(`  Target: ${target}`, 'subtitle'));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Mode: ${aggressive ? 'AGGRESSIVE' : 'Standard'}`));
  console.log(branding.getThinDivider());
  
  // Analyze file
  let content: string;
  try {
    content = readFileSync(target, 'utf-8');
  } catch {
    console.log(branding.status("Can't read this file. It's scared of refactoring.", 'error'));
    return;
  }
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🔍 ANALYZING CODE FOR REFACTORING OPPORTUNITIES...\n`));
  
  await delay(500);
  
  // Generate specific suggestions
  const suggestions = generateRefactorSuggestions(content, aggressive);
  
  // Display roast
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎤 INITIAL ROAST:\n`));
  const roast = refactorRoasts[Math.floor(Math.random() * refactorRoasts.length)];
  console.log(chalk.hex(branding.colors.lightPurple)(`    🙄 ${roast}`));
  
  // Display suggestions
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  💡 REFACTORING SUGGESTIONS:\n`));
  
  const categories = Object.keys(refactorStrategies) as Array<keyof typeof refactorStrategies>;
  const selectedCategories = aggressive ? categories : categories.slice(0, 4);
  
  for (const category of selectedCategories) {
    const strategy = refactorStrategies[category][Math.floor(Math.random() * refactorStrategies[category].length)];
    const emoji = {
      naming: '📝',
      structure: '🏗️',
      cleanup: '🧹',
      modernization: '🚀',
      architecture: '🏛️',
      testing: '🧪',
      performance: '⚡'
    }[category];
    
    await delay(300);
    console.log(chalk.hex(branding.colors.mediumPurple)(`    ${emoji} ${category.toUpperCase()}:`));
    console.log(chalk.hex(branding.colors.lightPurple)(`       → ${strategy}`));
    console.log();
  }
  
  // Before/After examples
  if (aggressive || Math.random() > 0.5) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📚 BEFORE & AFTER EXAMPLES:\n`));
    
    const examples = beforeAfter.slice(0, aggressive ? 4 : 2);
    for (const example of examples) {
      console.log(chalk.hex(branding.colors.lightPurple)(`    Issue: ${example.issue}`));
      console.log(chalk.hex('#C4B5FD')(`    Before: ${example.before}`));
      console.log(chalk.hex(branding.colors.white)(`    After:  ${example.after}`));
      console.log();
    }
  }
  
  // Refactoring metrics
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📊 REFACTORING ESTIMATES:\n`));
  
  const lines = content.split('\n').length;
  const estimatedHours = Math.ceil(lines / 50);
  const estimatedCoffees = Math.ceil(estimatedHours / 2);
  const therapySessions = Math.ceil(lines / 200);
  
  console.log(chalk.hex(branding.colors.lightPurple)(`    Lines of code: ${lines}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Estimated time: ${estimatedHours} hours`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Coffee required: ${estimatedCoffees} cups`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Therapy sessions needed: ${therapySessions}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Regret factor: ${(Math.random() * 100).toFixed(1)}%`));
  
  // Priority list
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎯 REFACTORING PRIORITY:\n`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    1. Fix the obvious bugs first (if you can find them)`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    2. Rename variables before you forget what they do`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    3. Add tests so you don't break everything`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    4. Refactor gradually (don't try to fix it all at once)`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    5. Update documentation (LOL, as if)`));
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Refactoring advice complete. Your code is now aware of its flaws.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.9) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Remember: Refactoring is just admitting your past self was wrong. And they were.`));
  }
}

async function generateGeneralRefactoringTips(aggressive: boolean): Promise<void> {
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  💡 GENERAL REFACTORING WISDOM:\n`));
  
  const allStrategies = Object.values(refactorStrategies).flat();
  const selected = allStrategies
    .sort(() => Math.random() - 0.5)
    .slice(0, aggressive ? 10 : 6);
  
  for (let i = 0; i < selected.length; i++) {
    await delay(200);
    console.log(chalk.hex(branding.colors.lightPurple)(`    ${i + 1}. ${selected[i]}`));
  }
  
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎓 REFACTORING PHILOSOPHY:\n`));
  const philosophies = [
    "Refactoring: Because 'working' isn't good enough.",
    "Leave the codebase better than you found it. Even if that's a low bar.",
    "Technical debt is like a credit card - interest compounds.",
    "Refactoring is not rewriting. It's saving your future self.",
    "Good code is code you won't hate in 6 months."
  ];
  const philosophy = philosophies[Math.floor(Math.random() * philosophies.length)];
  console.log(chalk.hex(branding.colors.white)(`    "${philosophy}"`));
}

function generateRefactorSuggestions(content: string, aggressive: boolean): string[] {
  const suggestions: string[] = [];
  
  // Check for specific issues
  if (content.includes('var ')) {
    suggestions.push("Replace 'var' with 'let' or 'const'");
  }
  if ((content.match(/console\.log/g) || []).length > 5) {
    suggestions.push("Remove excessive console.log statements");
  }
  if ((content.match(/TODO|FIXME/g) || []).length > 3) {
    suggestions.push("Address TODO comments or remove them");
  }
  if (content.split('\n').length > 300) {
    suggestions.push("Split large file into smaller modules");
  }
  
  return suggestions;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const refactorCommand = { execute };
