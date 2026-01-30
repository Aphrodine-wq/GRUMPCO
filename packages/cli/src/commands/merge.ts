import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump merge - Funny git merge conflict resolver with attitude
 * Because merge conflicts are painful enough without sass
 */

const mergeDramas = [
  "Your branch and main have filed for irreconcilable differences.",
  "The merge conflict is so bad, even Git is questioning its life choices.",
  "These branches haven't spoken in 47 commits. It's getting awkward.",
  "This conflict is less 'merge' and more 'battle royale'.",
  "Your code is having an identity crisis. Multiple personality disorder, even.",
  "The diff is longer than a Tolstoy novel. And equally tragic.",
  "These changes are fighting harder than siblings over the remote.",
  "Git is silently weeping. You can hear it if you listen closely.",
  "This merge is sponsored by Chaos Theory™.",
  "Your branches diverged so much they need couples therapy."
];

const conflictResolutions = [
  { strategy: "Accept Theirs", outcome: "You gave up. Respect.", emoji: "🏳️" },
  { strategy: "Accept Yours", outcome: "Bold. Probably wrong, but bold.", emoji: "💪" },
  { strategy: "Manual Merge", outcome: "Prepare for 3 hours of suffering.", emoji: "⚔️" },
  { strategy: "Delete and Recreate", outcome: "The nuclear option. Effective.", emoji: "☢️" },
  { strategy: "Ask Teammate", outcome: "Passing the buck. Classic.", emoji: "🤷" },
  { strategy: "Flip a Coin", outcome: "50% chance of correctness!", emoji: "🪙" },
  { strategy: "Both Changes", outcome: "Now you have twice the bugs!", emoji: "🎉" },
  { strategy: "Neither Changes", outcome: "Problem solved by deletion.", emoji: "🗑️" }
];

const gitBlameTargets = [
  "The intern who 'just fixed a typo'",
  "Senior Dev who refactored everything at 2 AM",
  "That person who never pulls before pushing",
  "The architect with 'vision' but no implementation skills",
  "The dev who uses --force 'because it's faster'",
  "QA who 'just changed one test'",
  "Product Manager who 'just needed a quick change'",
  "The ghost of legacy code past",
  "Your past self (traitor)",
  "The one who writes commit messages like 'stuff'"
];

const mergeAffirmations = [
  "I am one with the conflict. The conflict is one with me.",
  "This merge will not break me. It might break production, but not me.",
  "I accept that Git is mysterious and full of terrors.",
  "The HEAD is a suggestion, not a rule.",
  "Conflicts are just opportunities to practice patience.",
  "I will not cry. I will not cry. I am crying.",
  "Every merge makes me stronger. Or more cynical. Both.",
  "Git blame is a tool, not a weapon. I will not use it as a weapon.",
  "I choose to see the beauty in this 300-line diff.",
  "The repository is wise. I am... learning."
];

const mergeStages = [
  { stage: "Denial", desc: "It's not that bad. I can fix this in 5 minutes.", emoji: "😌" },
  { stage: "Anger", desc: "WHO WROTE THIS? I WILL FIND YOU.", emoji: "😡" },
  { stage: "Bargaining", desc: "Please, just let me keep my changes. I'll be good.", emoji: "🙏" },
  { stage: "Depression", desc: "It's been 2 hours. I don't know what 'ours' means anymore.", emoji: "😭" },
  { stage: "Acceptance", desc: "Okay, let's just delete both and start over.", emoji: "🫠" },
  { stage: "Testing", desc: "Wait, it works? I don't trust it.", emoji: "🤨" },
  { stage: "Push", desc: "YOLO. If it breaks, it wasn't me.", emoji: "🚀" }
];

interface MergeOptions {
  theirs?: boolean;
  ours?: boolean;
  abort?: boolean;
  dramatic?: boolean;
}

export async function execute(options: MergeOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🔀 THE G-RUMP MERGE CONFLICT THERAPIST 🔀\n', 'title'));
  
  const dramatic = options.dramatic || false;
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  Mode: ${dramatic ? 'MAXIMUM DRAMA' : 'Controlled Chaos'}`));
  console.log(branding.getThinDivider());

  // Drama intro
  if (dramatic) {
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎭 ACT I: THE CONFLICT:\n`));
    await delay(800);
    const drama = mergeDramas[Math.floor(Math.random() * mergeDramas.length)];
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${drama}`));
    await delay(800);
    console.log(chalk.hex(branding.colors.white)(`\n  The repository trembles. Git whispers warnings.`));
    console.log(chalk.hex(branding.colors.lightPurple)(`  Conflicts bloom like toxic flowers in your codebase.`));
  } else {
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📋 CONFLICT DETECTED:\n`));
    const drama = mergeDramas[Math.floor(Math.random() * mergeDramas.length)];
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${drama}`));
  }

  // Blame assignment
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🎯 BLAME ANALYSIS:\n'));
  
  const blames = gitBlameTargets.sort(() => 0.5 - Math.random()).slice(0, 3);
  blames.forEach((target, i) => {
    const emoji = ['🕵️', '🔍', '👀'][i];
    const percent = Math.floor(Math.random() * 40) + 30;
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${emoji} ${percent}% probability: ${target}`));
  });

  // Resolution options
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  ⚖️ RESOLUTION STRATEGIES:\n'));
  
  conflictResolutions.forEach((res, i) => {
    console.log(chalk.hex(branding.colors.white)(`  ${i + 1}. ${res.strategy} ${res.emoji}`));
    console.log(chalk.hex(branding.colors.lightPurple)(`     → ${res.outcome}`));
  });

  // Recommended strategy
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  💡 G-RUMP RECOMMENDATION:\n'));
  
  let recommendation: typeof conflictResolutions[0];
  if (options.theirs) {
    recommendation = conflictResolutions[0];
    console.log(chalk.hex(branding.colors.white)(`  You chose: Accept Theirs ${recommendation.emoji}`));
    console.log(chalk.hex(branding.colors.lightPurple)(`  Status: You surrendered. Wise choice or cowardice? History will judge.`));
  } else if (options.ours) {
    recommendation = conflictResolutions[1];
    console.log(chalk.hex(branding.colors.white)(`  You chose: Accept Yours ${recommendation.emoji}`));
    console.log(chalk.hex(branding.colors.lightPurple)(`  Status: Confidence level: 100%. Accuracy level: Unknown.`));
  } else if (options.abort) {
    console.log(chalk.hex(branding.colors.white)(`  You chose: ABORT MISSION 🏃`));
    console.log(chalk.hex(branding.colors.lightPurple)(`  Status: Sometimes the bravest thing is knowing when to run.`));
  } else {
    recommendation = conflictResolutions[Math.floor(Math.random() * conflictResolutions.length)];
    console.log(chalk.hex(branding.colors.white)(`  Recommended: ${recommendation.strategy} ${recommendation.emoji}`));
    console.log(chalk.hex(branding.colors.lightPurple)(`  Why: ${recommendation.outcome}`));
  }

  // The 7 stages
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🔄 THE 7 STAGES OF MERGE GRIEF:\n'));
  
  mergeStages.forEach((stage, i) => {
    const isCurrent = i === 2; // Start at bargaining
    const color = isCurrent ? branding.colors.lightPurple : branding.colors.mediumPurple;
    const marker = isCurrent ? '→ ' : '  ';
    console.log(chalk.hex(color)(`${marker}${stage.emoji} ${stage.stage}: ${stage.desc}`));
  });

  // Meditation moment
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  🧘 MERGE MEDITATION:\n'));
  
  const affirmation = mergeAffirmations[Math.floor(Math.random() * mergeAffirmations.length)];
  console.log(chalk.hex(branding.colors.lightPurple)(`  Take a deep breath and repeat:`));
  await delay(600);
  console.log(chalk.hex(branding.colors.white)(`  "${affirmation}"`));
  await delay(600);
  console.log(chalk.hex(branding.colors.lightPurple)(`  Namaste. Or whatever keeps you from rage-quitting.`));

  // Post-merge checklist
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  ✅ POST-MERGE SURVIVAL CHECKLIST:\n'));
  
  const checklist = [
    { item: "Tests pass", status: Math.random() > 0.7 ? "✅ (miraculously)" : "❌ (as expected)" },
    { item: "No syntax errors", status: Math.random() > 0.6 ? "✅" : "❌ (find the missing semicolon)" },
    { item: "Logic still makes sense", status: "🤷 (debatable)" },
    { item: "Teammates won't hate you", status: Math.random() > 0.5 ? "✅" : "❌ (they already did)" },
    { item: "Production won't explode", status: "🎲 (roll the dice)" },
    { item: "You kept your sanity", status: "❌ (lost it at stage 4)" }
  ];

  checklist.forEach(item => {
    console.log(chalk.hex(branding.colors.lightPurple)(`  ${item.item}: ${item.status}`));
  });

  // Final words
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎬 FINAL WISDOM:\n`));
  
  const wisdom = [
    "Remember: Git is just a tool. A confusing, powerful, terrifying tool.",
    "The best merge is the one you don't have to do. Pull more often.",
    "Communication prevents conflicts. Or creates better ones. 50/50.",
    "When in doubt, blame the intern. It's tradition.",
    "Merge conflicts build character. Or resentment. Both are character.",
    "There's always git reset --hard. The nuclear option of peace."
  ];
  
  console.log(chalk.hex(branding.colors.lightPurple)(`  ${wisdom[Math.floor(Math.random() * wisdom.length)]}`));

  // Closing
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Merge complete. Your blood pressure may now return to normal.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.85) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Pro tip: Git reflog remembers everything. Even the things you want to forget.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const mergeCommand = { execute };
