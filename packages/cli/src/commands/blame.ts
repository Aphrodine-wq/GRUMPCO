import chalk from 'chalk';
import { execSync } from 'child_process';
import { branding } from '../branding.js';

/**
 * grump blame - Git blame with personality
 * Shows who to "blame" with funny comments
 */

const blameComments = {
  praise: [
    "This line is a masterpiece. Someone give this developer a raise.",
    "Elegant solution. The code equivalent of a mic drop.",
    "Beautifully written. Shakespeare would be jealous.",
    "This is what peak performance looks like.",
    "Clean, efficient, and probably written on a good hair day."
  ],

  neutral: [
    "It works. That's... something.",
    "Functional code. Not exciting, but not horrifying either.",
    "Meh. I've seen worse. I've seen better.",
    "This code is the equivalent of plain toast.",
    "Does the job. Like a reliable but boring employee."
  ],

  suspicious: [
    "This code has 'it worked on my machine' energy.",
    "3 AM commit. We've all been there. No judgment. (Okay, some judgment.)",
    "Written on a Friday at 4:55 PM. Bold choice.",
    "This commit message just says 'fix'. Very descriptive.",
    "Someone was clearly rushing to catch a bus when they wrote this."
  ],

  roast: [
    "This line is a war crime against programming.",
    "I'm not saying this is bad code, but it made my CPU cry.",
    "If bugs could vote, this would be their favorite line.",
    "This code has more red flags than a communist parade.",
    "I've seen clearer hieroglyphics. And those are 3000 years old."
  ],

  devastating: [
    "This code is so bad, even the compiler filed a complaint with HR.",
    "Not all heroes wear capes, but this villain definitely wears this code.",
    "If this code was a movie, it would be 'Plan 9 from Outer Space'.",
    "This line alone has set software engineering back 20 years.",
    "I've read obituaries with more life than this code."
  ]
};

const gitPuns = [
  "git-ing real tired of this code",
  "commit-ting crimes against programming",
  "push-ing my patience to the limit",
  "merge-ing into disaster",
  "branch-ing into questionable decisions",
  "pull-ing my hair out",
  "tag-ged as 'avoid at all costs'",
  "stash-ing away my sanity",
  "rebase-ing on false hope",
  "cherry-pick-ing the worst option"
];

interface BlameOptions {
  file?: string;
  line?: number;
  funny?: boolean;
}

export async function execute(filePath: string | undefined, options: BlameOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🔍 GIT BLAME (WITH ATTITUDE) 🔍\n', 'title'));
  
  const targetFile = filePath;
  const targetLine = options.line;
  
  if (!targetFile) {
    console.log(branding.status('No file specified. Who should I blame? You?', 'error'));
    console.log(chalk.hex(branding.colors.lightPurple)('\n  Usage: grump blame <file> [--line <number>]'));
    return;
  }

  console.log(branding.format(`  Target: ${targetFile}`, 'subtitle'));
  if (targetLine) {
    console.log(chalk.hex(branding.colors.lightPurple)(`  Line: ${targetLine}`));
  }
  console.log(branding.getThinDivider());

  // Try to get git blame info
  let blameInfo: string | null = null;
  try {
    const cmd = targetLine 
      ? `git blame -L ${targetLine},${targetLine} "${targetFile}"`
      : `git blame "${targetFile}" | head -20`;
    blameInfo = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() });
  } catch (error) {
    console.log(branding.status("Can't run git blame. Are you in a git repo? Or are you just blame-shy?", 'warning'));
    
    // Generate fake blame data for demo purposes
    await generateFakeBlame(targetFile, targetLine);
    return;
  }

  if (!blameInfo || blameInfo.trim() === '') {
    console.log(branding.status('No blame info found. File is either perfect or non-existent.', 'sassy'));
    return;
  }

  // Parse and display blame info with personality
  const lines = blameInfo.split('\n').filter(l => l.trim());
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📋 THE BLAME GAME:\n`));

  for (const line of lines) {
    // Parse git blame output
    const match = line.match(/^([\w^]+)\s+\(([^)]+)\s+(\d{4}-\d{2}-\d{2})\s+\d+:\d+:\d+\s+([+-]\d+)\s+(\d+)\)/);
    
    if (match) {
      const [, commit, author, date, , lineNum] = match;
      const code = line.substring(line.indexOf(') ') + 2);
      
      // Generate random comment based on "code quality assessment"
      const qualityScore = Math.random();
      let commentCategory: keyof typeof blameComments;
      let emoji: string;
      
      if (qualityScore > 0.8) {
        commentCategory = 'praise';
        emoji = '✨';
      } else if (qualityScore > 0.6) {
        commentCategory = 'neutral';
        emoji = '😐';
      } else if (qualityScore > 0.4) {
        commentCategory = 'suspicious';
        emoji = '🤨';
      } else if (qualityScore > 0.2) {
        commentCategory = 'roast';
        emoji = '😤';
      } else {
        commentCategory = 'devastating';
        emoji = '💀';
      }
      
      const comment = blameComments[commentCategory][Math.floor(Math.random() * blameComments[commentCategory].length)];
      const gitPun = gitPuns[Math.floor(Math.random() * gitPuns.length)];
      
      console.log(chalk.hex(branding.colors.darkPurple)(`  Line ${lineNum}:`));
      console.log(chalk.hex(branding.colors.white)(`    Code: ${code.slice(0, 60)}${code.length > 60 ? '...' : ''}`));
      console.log(chalk.hex(branding.colors.mediumPurple)(`    Author: ${author.trim()}`));
      console.log(chalk.hex(branding.colors.lightPurple)(`    Date: ${date} (${gitPun})`));
      console.log(chalk.hex(branding.colors.lightPurple)(`    ${emoji} ${comment}`));
      console.log();
      
      await delay(300);
    }
  }

  // Summary
  console.log(branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📊 BLAME STATISTICS:\n`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Total lines analyzed: ${lines.length}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Developer dignity: Compromised`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Finger-pointing effectiveness: 100%`));
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Blame complete. Remember: git blame never forgets.', 'sassy'));

  // Easter egg
  if (Math.random() > 0.85) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Tip: If everyone is blaming everyone, maybe the codebase is just cursed.`));
  }
}

async function generateFakeBlame(filePath: string, targetLine?: number): Promise<void> {
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📋 SIMULATED BLAME (for demo purposes):\n`));
  
  const fakeAuthors = ['developer1', 'hacker99', 'codeNinja', 'bugCreator', 'seniorDev'];
  const fakeDates = ['2024-01-15', '2024-02-30', '2024-03-14', '2024-11-11', '2024-12-25'];
  
  const linesToShow = targetLine ? 1 : 5;
  const startLine = targetLine || 1;
  
  for (let i = 0; i < linesToShow; i++) {
    const lineNum = startLine + i;
    const author = fakeAuthors[Math.floor(Math.random() * fakeAuthors.length)];
    const date = fakeDates[Math.floor(Math.random() * fakeDates.length)];
    
    const qualityScore = Math.random();
    let commentCategory: keyof typeof blameComments;
    let emoji: string;
    
    if (qualityScore > 0.8) {
      commentCategory = 'praise';
      emoji = '✨';
    } else if (qualityScore > 0.6) {
      commentCategory = 'neutral';
      emoji = '😐';
    } else if (qualityScore > 0.4) {
      commentCategory = 'suspicious';
      emoji = '🤨';
    } else if (qualityScore > 0.2) {
      commentCategory = 'roast';
      emoji = '😤';
    } else {
      commentCategory = 'devastating';
      emoji = '💀';
    }
    
    const comment = blameComments[commentCategory][Math.floor(Math.random() * blameComments[commentCategory].length)];
    const gitPun = gitPuns[Math.floor(Math.random() * gitPuns.length)];
    
    console.log(chalk.hex(branding.colors.darkPurple)(`  Line ${lineNum}:`));
    console.log(chalk.hex(branding.colors.mediumPurple)(`    Author: ${author}`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    Date: ${date} (${gitPun})`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    ${emoji} ${comment}`));
    console.log();
    
    await delay(300);
  }
  
  console.log(branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📊 SIMULATED BLAME STATISTICS:\n'));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Total lines: ${linesToShow}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Developer accountability: Questionable`));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Reality check: This was a simulation. Real blame is worse.`));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const blameCommand = { execute };
