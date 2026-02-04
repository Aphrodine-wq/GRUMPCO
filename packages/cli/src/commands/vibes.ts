import chalk from 'chalk';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { branding } from '../branding.js';

/**
 * grump vibes - Emotional analysis of codebase
 * Returns emoji vibes for your code
 */

const vibeCategories = {
  chaotic: {
    emojis: ['🌪️', '🤯', '💥', '🔥', '😵‍💫'],
    descriptions: [
      "Pure chaos energy. This codebase is a tornado in a teacup.",
      "Maximum entropy achieved. Thermodynamics would be proud.",
      "This code is having an existential crisis.",
      "Organized? No. Functional? Somehow. Vibes? Chaotic.",
      "This codebase said 'no rules, just vibes' and ran with it."
    ]
  },
  
  anxious: {
    emojis: ['😰', '😨', '🫣', '😬', '🙀'],
    descriptions: [
      "Anxious energy everywhere. This code is worried about production.",
      "Too many TODOs, not enough DOs. Anxiety levels: critical.",
      "This codebase needs therapy and a vacation.",
      "Error handling is just panic with extra steps.",
      "The code is as nervous as a developer before a demo."
    ]
  },
  
  tired: {
    emojis: ['😴', '🥱', '💤', '😪', '🫠'],
    descriptions: [
      "Exhausted energy. This code is running on fumes.",
      "Legacy code that has seen things. Terrible things.",
      "This codebase needs a nap. And a complete rewrite.",
      "Technical debt so high, it's in the stratosphere.",
      "The code yawns every time it executes."
    ]
  },
  
  confused: {
    emojis: ['🤔', '😵', '🧐', '🫤', '😶'],
    descriptions: [
      "Confused vibes. Even the compiler is scratching its head.",
      "This code doesn't know what it wants to be when it grows up.",
      "Identity crisis: Am I a service? A controller? A mess?",
      "Comments explain what, not why. Very mysterious.",
      "This codebase is a riddle wrapped in a mystery inside spaghetti."
    ]
  },
  
  angry: {
    emojis: ['😤', '😠', '🤬', '👿', '🤯'],
    descriptions: [
      "Rage energy. This code wants to fight someone.",
      "Aggressive error messages. The code is not having it today.",
      "This codebase has anger management issues.",
      "Comments written by someone who definitely wasn't smiling.",
      "The code is one runtime error away from a meltdown."
    ]
  },
  
  chill: {
    emojis: ['😎', '🌊', '✨', '🌸', '🧘'],
    descriptions: [
      "Zen vibes. This code meditates before deployment.",
      "Clean, organized, and probably has good documentation.",
      "This codebase does yoga and drinks herbal tea.",
      "Surprisingly peaceful for a software project.",
      "Good energy. The code is at one with the universe."
    ]
  },
  
  cursed: {
    emojis: ['👻', '🎃', '💀', '🔮', '🧙'],
    descriptions: [
      "Cursed energy. Don't read this code at 3 AM.",
      "Dark magic was used to create this. Possibly blood sacrifice.",
      "This codebase is haunted by the ghost of dead features.",
      "Hexes and regexes. Mostly regexes. The cursed kind.",
      "This code was written under a blood moon."
    ]
  },
  
  hype: {
    emojis: ['🚀', '⚡', '🔥', '💪', '🎯'],
    descriptions: [
      "Hype energy! This code is ready to take on the world!",
      "Maximum enthusiasm. This codebase just had an energy drink.",
      "Aggressively optimistic. Probably has motivational comments.",
      "This code believes in itself. Too much, maybe.",
      "Powerful vibes. The code is flexing on other repos."
    ]
  },
  
  mysterious: {
    emojis: ['🕵️', '🌑', '🦉', '🎭', '🗝️'],
    descriptions: [
      "Mysterious vibes. Nobody knows how this works.",
      "Dark secrets lurk in these files. Ancient ones.",
      "This codebase has lore that predates the company.",
      "Legends say only one developer understands this code.",
      "Shrouded in mystery and poorly written documentation."
    ]
  }
};

const vibeIndicators = {
  chaotic: {
    patterns: ['any', 'TODO', 'FIXME', 'HACK', 'var ', 'eval(', 'console.log'],
    threshold: 10
  },
  anxious: {
    patterns: ['throw', 'panic', 'catch', 'Error', 'emergency', 'urgent'],
    threshold: 5
  },
  tired: {
    patterns: ['legacy', 'deprecated', 'old', 'refactor', 'technical debt'],
    threshold: 3
  },
  confused: {
    patterns: ['??', 'undefined', 'null', 'unknown', 'mystery'],
    threshold: 5
  },
  angry: {
    patterns: ['kill', 'destroy', 'stupid', 'dumb', 'wtf', 'ugly'],
    threshold: 3
  },
  cursed: {
    patterns: ['magic', 'voodoo', 'black box', 'dark', 'cursed', 'hex'],
    threshold: 2
  }
};

interface VibesOptions {
  path?: string;
  deep?: boolean;
}

export async function execute(options: VibesOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🎭 G-RUMP VIBE CHECK 🎭\n', 'title'));
  
  const targetPath = options.path || process.cwd();
  
  console.log(branding.format(`  Analyzing vibes at: ${targetPath}`, 'subtitle'));
  console.log(branding.getThinDivider());
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🔮 CONSULTING THE VIBE ORACLE...\n`));
  
  // Analyze codebase
  const vibeScores = await analyzeCodebase(targetPath, options.deep || false);
  
  // Determine dominant vibe
  const dominantVibe = determineDominantVibe(vibeScores);
  
  await delay(500);
  
  // Display vibe reading
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  ✨ VIBE READING ✨\n`));
  
  const vibe = vibeCategories[dominantVibe];
  const randomEmoji = vibe.emojis[Math.floor(Math.random() * vibe.emojis.length)];
  const randomDescription = vibe.descriptions[Math.floor(Math.random() * vibe.descriptions.length)];
  
  // Big vibe display
  console.log(chalk.hex(branding.colors.lightPurple)(`    ${' '.repeat(10)}${randomEmoji}`));
  console.log(chalk.hex(branding.colors.white).bold(`\n    DOMINANT VIBE: ${dominantVibe.toUpperCase()}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`\n    ${randomDescription}`));
  
  // Vibe breakdown
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📊 VIBE BREAKDOWN:\n`));
  
  const sortedVibes = Object.entries(vibeScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  
  for (const [vibeName, score] of sortedVibes) {
    if (score > 0) {
      const barLength = Math.min(score, 20);
      const bar = '█'.repeat(barLength);
      const vibeEmojis = vibeCategories[vibeName as keyof typeof vibeCategories]?.emojis || ['❓'];
      console.log(chalk.hex(branding.colors.lightPurple)(`    ${vibeEmojis[0]} ${vibeName.padEnd(12)} ${chalk.hex(branding.colors.mediumPurple)(bar)} ${score}%`));
    }
  }
  
  // Special messages based on vibe
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  💫 VIBE INSIGHTS:\n`));
  
  const insights = generateInsights(vibeScores);
  for (const insight of insights) {
    console.log(chalk.hex(branding.colors.white)(`    • ${insight}`));
  }
  
  // Recommendations
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎯 VIBE RECOMMENDATIONS:\n`));
  
  const recommendations = generateRecommendations(dominantVibe);
  for (const rec of recommendations) {
    console.log(chalk.hex(branding.colors.lightPurple)(`    → ${rec}`));
  }
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status(`Vibe check complete. Current mood: ${randomEmoji}`, 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.9) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Your codebase's zodiac sign is ${getCodeZodiac()}.`));
  }
}

async function analyzeCodebase(targetPath: string, deep: boolean): Promise<Record<string, number>> {
  const scores: Record<string, number> = {
    chaotic: 0,
    anxious: 0,
    tired: 0,
    confused: 0,
    angry: 0,
    chill: 10, // Start with some chill
    cursed: 0,
    hype: 10,
    mysterious: 0
  };
  
  try {
    const files = getCodeFiles(targetPath, deep ? 3 : 1);
    
    for (const file of files.slice(0, 20)) { // Limit to 20 files
      try {
        const content = readFileSync(file, 'utf-8');
        
        // Check for vibe patterns
        for (const [vibe, indicators] of Object.entries(vibeIndicators)) {
          for (const pattern of indicators.patterns) {
            const matches = content.match(new RegExp(pattern, 'gi'));
            if (matches) {
              scores[vibe] += matches.length * 5;
            }
          }
        }
        
        // File size affects tired score
        const lines = content.split('\n').length;
        if (lines > 500) scores.tired += 10;
        if (lines > 1000) scores.tired += 20;
        
        // Good practices add chill
        if (content.includes('test') || content.includes('describe')) scores.chill += 5;
        if (content.includes('README') || content.includes('documentation')) scores.chill += 5;
        
        // TODO count
        const todos = content.match(/TODO/gi);
        if (todos && todos.length > 5) scores.anxious += todos.length;
        
      } catch {
        // Skip files we can't read
      }
    }
    
    // Normalize scores
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      for (const key of Object.keys(scores)) {
        scores[key] = Math.min(Math.round((scores[key] / maxScore) * 100), 100);
      }
    }
    
  } catch {
    // Default vibes if we can't analyze
    scores.chaotic = 50;
    scores.chill = 50;
  }
  
  return scores;
}

function getCodeFiles(dir: string, depth: number): string[] {
  const files: string[] = [];
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.rb', '.php'];
  
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules') continue;
      
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory() && depth > 0) {
        files.push(...getCodeFiles(fullPath, depth - 1));
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignore errors
  }
  
  return files;
}

function determineDominantVibe(scores: Record<string, number>): keyof typeof vibeCategories {
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  return sorted[0][0] as keyof typeof vibeCategories;
}

function generateInsights(scores: Record<string, number>): string[] {
  const insights: string[] = [];
  
  if (scores.chaotic > 50) insights.push("High entropy detected. Consider refactoring.");
  if (scores.anxious > 50) insights.push("Code shows signs of stress. Add more error handling.");
  if (scores.tired > 50) insights.push("Legacy patterns detected. Technical debt is accumulating.");
  if (scores.chill > 70) insights.push("Surprisingly well-organized. What's the catch?");
  if (scores.cursed > 30) insights.push("Dark magic detected. Proceed with caution.");
  if (scores.hype > 50) insights.push("Overly enthusiastic code. Might be over-engineered.");
  if (scores.angry > 30) insights.push("Aggressive coding style detected. Take a deep breath.");
  
  if (insights.length === 0) {
    insights.push("Vibes are balanced, like all things should be.");
  }
  
  return insights;
}

function generateRecommendations(dominantVibe: string): string[] {
  const recs: Record<string, string[]> = {
    chaotic: ["Add structure. Your code needs boundaries.", "Consider a linter. Seriously.", "Organize files by feature, not by chaos."],
    anxious: ["Add comprehensive error handling.", "Write tests to build confidence.", "Take breaks. Code smells fear."],
    tired: ["Schedule refactoring sprints.", "Pay down technical debt.", "Consider modernization."],
    confused: ["Add clear documentation.", "Refactor for clarity.", "Comments should explain why, not what."],
    angry: ["Take a walk. Cool down.", "Refactor with empathy for future you.", "Remove aggressive comments."],
    chill: ["Keep it up! Share your practices.", "Document your zen approach.", "Help others find the chill."],
    cursed: ["Consult an exorcist.", "Rewrite from scratch.", "Check for hex values in your code."],
    hype: ["Channel that energy into tests.", "Document your enthusiasm.", "Don't over-engineer."],
    mysterious: ["Add comprehensive documentation.", "Knowledge sharing sessions.", "Demystify the magic."]
  };
  
  return recs[dominantVibe] || ["Keep coding. The vibes will align."];
}

function getCodeZodiac(): string {
  const signs = ['Bug', 'Feature', 'Refactor', 'Merge Conflict', 'Legacy Code', 'Hello World', 'Infinite Loop', 'Stack Overflow'];
  return signs[Math.floor(Math.random() * signs.length)];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const vibesCommand = { execute };
