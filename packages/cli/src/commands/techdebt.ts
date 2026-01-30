import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump tech-debt - Measure and lament your technical debt
 * Because every codebase is just a pile of IOUs
 */

const debtCategories = {
  architecture: {
    name: "Architectural Debt",
    symptoms: ["Circular dependencies", "God classes", "Spaghetti code"],
    severity: Math.floor(Math.random() * 100)
  },
  testing: {
    name: "Testing Debt", 
    symptoms: ["No tests", "Flaky tests", "Tests that test nothing"],
    severity: Math.floor(Math.random() * 100)
  },
  documentation: {
    name: "Documentation Debt",
    symptoms: ["Outdated README", "Missing API docs", "Comments that lie"],
    severity: Math.floor(Math.random() * 100)
  },
  dependencies: {
    name: "Dependency Debt",
    symptoms: ["Outdated packages", "Security vulns", "Abandoned libraries"],
    severity: Math.floor(Math.random() * 100)
  },
  infrastructure: {
    name: "Infrastructure Debt",
    symptoms: ["Manual deployments", "No monitoring", "YAML hell"],
    severity: Math.floor(Math.random() * 100)
  },
  ux: {
    name: "UX Debt",
    symptoms: ["Inconsistent UI", "Accessibility issues", "Mobile? What mobile?"],
    severity: Math.floor(Math.random() * 100)
  }
};

const debtExcuses = [
  "We'll pay it down next sprint. (We won't.)",
  "It's a 'known issue' in the backlog since 2019.",
  "The original architect said it was 'intentional'.",
  "We don't have time to fix it. We only have time to make it worse.",
  "It's not debt, it's 'deferred optimization'.",
  "Technical debt builds character. And also bugs.",
  "We're waiting for the next major rewrite. It's been 5 years.",
  "If we ignore it long enough, maybe it'll fix itself.",
  "That's a problem for future us. Future us hates current us.",
  "We measured it. Management said 'acceptable'."
];

const payoffStrategies = [
  "Strangler Fig Pattern: Slowly replace the bad with the less bad.",
  "Boy Scout Rule: Leave code better than you found it. (Good luck with this one.)",
  "Refactoring Fridays: Reserve time that will immediately be taken by 'urgent' features.",
  "Technical Debt Tickets: Create tickets that will never be prioritized.",
  "Complete Rewrite: The nuclear option. Usually makes things worse.",
  "Acceptance: Just accept this is how things are. Embrace the chaos."
];

interface TechDebtOptions {
  calculate?: boolean;
  excuses?: boolean;
  strategies?: boolean;
}

export async function execute(options: TechDebtOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  💳 TECHNICAL DEBT CALCULATOR 💳\n', 'title'));
  
  if (options.excuses) {
    console.log(chalk.hex(branding.colors.mediumPurple)('  🙈 EXCUSES FOR NOT PAYING DOWN DEBT:\n'));
    for (const excuse of debtExcuses) {
      console.log(chalk.hex(branding.colors.white)(`    • ${excuse}`));
    }
    console.log('\n' + branding.getDivider());
    return;
  }
  
  if (options.strategies) {
    console.log(chalk.hex(branding.colors.mediumPurple)('  💡 DEBT PAYOFF STRATEGIES:\n'));
    for (const strategy of payoffStrategies) {
      console.log(chalk.hex(branding.colors.white)(`    📋 ${strategy}`));
    }
    console.log('\n' + branding.getDivider());
    return;
  }
  
  // Default: Calculate debt
  console.log(chalk.hex(branding.colors.mediumPurple)('  📊 CALCULATING TECHNICAL DEBT...\n'));
  
  let totalDebt = 0;
  
  for (const [_, category] of Object.entries(debtCategories)) {
    await delay(300);
    totalDebt += category.severity;
    
    const bar = createProgressBar(category.severity);
    const color = category.severity > 70 ? '#FF6B6B' : category.severity > 40 ? '#FFD700' : '#00FF00';
    
    console.log(chalk.hex(branding.colors.white)(`  ${category.name}`));
    console.log(chalk.hex(color)(`    ${bar} ${category.severity}%`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    Symptoms: ${category.symptoms.join(', ')}`));
    console.log('');
  }
  
  const averageDebt = Math.round(totalDebt / Object.keys(debtCategories).length);
  
  console.log(branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📈 OVERALL TECHNICAL DEBT SCORE:\n'));
  
  const overallBar = createProgressBar(averageDebt);
  const overallColor = averageDebt > 70 ? '#FF6B6B' : averageDebt > 40 ? '#FFD700' : '#00FF00';
  console.log(chalk.hex(overallColor).bold(`    ${overallBar} ${averageDebt}%`));
  
  // Convert to fake money
  const dollarValue = averageDebt * 1000 * (Math.random() * 10 + 5);
  console.log(chalk.hex(branding.colors.lightPurple)(`\n    Estimated cost to fix: $${Math.round(dollarValue).toLocaleString()}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Time to fix: ${Math.round(averageDebt / 5)} sprints (lol, as if)`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Likelihood of being fixed: 0.7%`));
  
  console.log('\n' + branding.getDivider());
  
  const excuse = debtExcuses[Math.floor(Math.random() * debtExcuses.length)];
  console.log(branding.box(excuse, averageDebt > 50 ? 'error' : 'warning'));
  
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Technical debt: The gift that keeps on taking.', 'sassy'));
}

function createProgressBar(percentage: number): string {
  const filled = Math.round(percentage / 5);
  const empty = 20 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const techDebtCommand = { execute };
