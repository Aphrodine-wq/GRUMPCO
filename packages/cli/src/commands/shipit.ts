import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump shipit - Force deploy with funny warnings
 * YOLO deploy mode with maximum sass
 */

const warnings = [
  "⚠️  WARNING: You're about to ship code on a Friday.",
  "⚠️  ALERT: No tests were run. Bold strategy.",
  "⚠️  CAUTION: Production hasn't reviewed this yet.",
  "⚠️  DANGER: You haven't had your coffee yet.",
  "⚠️  NOTICE: Your boss is watching. Probably.",
  "⚠️  ALERT: This commit message is suspiciously vague.",
  "⚠️  WARNING: You deleted more lines than you added. Hope that's intentional.",
  "⚠️  CAUTION: It's 4:59 PM. Do you really want to do this?",
  "⚠️  DANGER: Someone said 'what could go wrong?' earlier.",
  "⚠️  NOTICE: Your rubber duck is concerned about this deployment."
];

const deploymentDramas = [
  {
    stage: "Pre-flight Check",
    drama: "Checking if your computer is still on...",
    outcome: "Affirmative. Proceeding with questionable judgment."
  },
  {
    stage: "Code Review",
    drama: "Consulting the imaginary senior developer in your head...",
    outcome: "They're shaking their head, but you can't see it."
  },
  {
    stage: "Testing Phase",
    drama: "Running tests in imagination...",
    outcome: "All tests passed (in your mind)."
  },
  {
    stage: "Build Process",
    drama: "Building with fingers crossed...",
    outcome: "Build successful! (Errors are just suggestions, right?)"
  },
  {
    stage: "Deployment",
    drama: "Pushing to production with reckless abandon...",
    outcome: "Deployed! The servers are questioning their life choices."
  }
];

const successMessages = [
  "🚀 Code deployed! The internet just got slightly more interesting.",
  "🚀 Shipped! History will remember this moment (and judge it).",
  "🚀 Deployed! May the server gods have mercy on your soul.",
  "🚀 Code is live! Time to pretend everything is fine.",
  "🚀 Shipped with confidence! (And a hint of terror)",
  "🚀 Deployed! Your code is now someone else's problem.",
  "🚀 LIVE! It's not a bug, it's a feature you haven't discovered yet."
];

const failureExcuses = [
  "The deployment failed. Probably Mercury in retrograde.",
  "Servers said 'nah' and rejected your code.",
  "Deployment failed. Even the infrastructure has standards.",
  "The cloud is full. Try again later.",
  "Rejected! Your code didn't meet the server's minimum quality bar."
];

const postDeployRituals = [
  "Stare at the monitoring dashboard while sweating profusely.",
  "Refresh the page 47 times to make sure it's really working.",
  "Send a Slack message saying 'deployed!' with way too many exclamation marks.",
  "Update your resume, just in case.",
  "Prepare your 'it's not a bug, it's a feature' speech.",
  "Check Twitter to see if users have noticed yet.",
  "Question every decision that led you to this moment."
];

interface ShipitOptions {
  force?: boolean;
  message?: string;
  yolo?: boolean;
}

export async function execute(options: ShipitOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  🚀 G-RUMP SHIPIT MODE 🚀\n', 'title'));
  
  const isYOLO = options.yolo || false;
  const isForce = options.force || false;
  
  // Warning sequence
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  ⚠️  INITIATING DEPLOYMENT SEQUENCE ⚠️\n`));
  
  if (!isYOLO && !isForce) {
    console.log(chalk.hex(branding.colors.lightPurple)(`  Running pre-flight warnings...\n`));
    
    const selectedWarnings = warnings
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
    
    for (const warning of selectedWarnings) {
      await delay(400);
      console.log(chalk.hex(branding.colors.lightPurple)(`  ${warning}`));
    }
    
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🤔 FINAL CONFIRMATION:\n`));
    console.log(chalk.hex(branding.colors.white)(`    Are you SURE you want to deploy?`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    Think of your users. Think of your sleep tonight.`));
    console.log(chalk.hex(branding.colors.white)(`    Type 'yes' to proceed, or 'nope' to save your career.`));
    
    // Simulate user input (in real implementation, would use inquirer)
    await delay(1000);
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  (Simulating brave developer typing 'yes'...)`));
    await delay(800);
  } else {
    console.log(chalk.hex(branding.colors.mediumPurple)(`  🏴‍☠️ YOLO MODE ENGAGED! SKIPPING ALL SAFETY CHECKS!\n`));
    console.log(chalk.hex(branding.colors.lightPurple)(`  Safety is for people who don't live on the edge.`));
    await delay(600);
  }
  
  // Deployment drama
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  🎬 DEPLOYMENT DRAMA:\n`));
  
  for (const stage of deploymentDramas) {
    await delay(600);
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n    📦 ${stage.stage}`));
    console.log(chalk.hex(branding.colors.lightPurple)(`       ${stage.drama}`));
    await delay(400);
    console.log(chalk.hex(branding.colors.white)(`       ✓ ${stage.outcome}`));
  }
  
  // Deployment result
  await delay(800);
  console.log('\n' + branding.getDivider());
  
  const success = Math.random() > 0.2; // 80% success rate for fun
  
  if (success || isForce) {
    const message = successMessages[Math.floor(Math.random() * successMessages.length)];
    console.log(chalk.bgHex(branding.colors.white).hex(branding.colors.darkPurple).bold(`\n  ${message}`));
    
    if (isYOLO) {
      console.log(chalk.hex(branding.colors.lightPurple)(`\n  🎉 YOLO DEPLOYMENT SUCCESSFUL!`));
      console.log(chalk.hex(branding.colors.lightPurple)(`  Your courage (recklessness) paid off!`));
    }
  } else {
    const excuse = failureExcuses[Math.floor(Math.random() * failureExcuses.length)];
    console.log(chalk.bgHex(branding.colors.darkPurple).whiteBright(`\n  ${excuse}`));
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💡 Try again with --force if you're feeling stubborn.`));
  }
  
  // Post-deploy rituals
  if (success || isForce) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📋 POST-DEPLOYMENT RITUALS:\n`));
    
    const selectedRituals = postDeployRituals
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    for (let i = 0; i < selectedRituals.length; i++) {
      await delay(300);
      console.log(chalk.hex(branding.colors.lightPurple)(`    ${i + 1}. ${selectedRituals[i]}`));
    }
  }
  
  // Metrics
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📊 DEPLOYMENT METRICS:\n`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Anxiety Level: ${(Math.random() * 100).toFixed(1)}%`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Confidence: ${(Math.random() * 100).toFixed(1)}%`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Regret Probability: ${(Math.random() * 100).toFixed(1)}%`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Sleep Quality Tonight: Questionable`));
  
  // Closing
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Shipit complete. May the logs be ever in your favor.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.9) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Remember: Every deployment is a learning experience. Mostly about stress management.`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const shipitCommand = { execute };
