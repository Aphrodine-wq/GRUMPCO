/**
 * Telemetry Opt-in Step for G-Rump CLI Wizard
 */

import chalk from 'chalk';
import { prompt as askUser } from '../utils/prompt.js';
import { branding } from '../branding.js';

export interface TelemetryResult {
  optIn: boolean;
}

/**
 * Run telemetry opt-in step
 */
export async function runTelemetryStep(): Promise<TelemetryResult> {
  console.log(chalk.white('  Help improve G-Rump!\n'));
  
  console.log(chalk.dim('  We collect anonymous usage data to improve the product.'));
  console.log(chalk.dim('  This includes:'));
  console.log(chalk.dim('    • Command usage frequency'));
  console.log(chalk.dim('    • Error rates and types'));
  console.log(chalk.dim('    • Feature usage patterns'));
  console.log();
  console.log(chalk.dim('  We NEVER collect:'));
  console.log(chalk.dim('    • Your code or project contents'));
  console.log(chalk.dim('    • API keys or credentials'));
  console.log(chalk.dim('    • Personal information'));
  console.log();

  const { optIn } = await askUser<{ optIn: boolean }>([{
    type: 'confirm',
    name: 'optIn',
    message: 'Enable anonymous telemetry?',
    default: true
  }]);

  if (optIn) {
    console.log();
    console.log(branding.status('Thank you! Telemetry enabled.', 'success'));
    console.log(chalk.dim('  You can disable this anytime with `grump config set telemetry false`'));
  } else {
    console.log();
    console.log(branding.status('Telemetry disabled.', 'info'));
    console.log(chalk.dim('  You can enable this anytime with `grump config set telemetry true`'));
  }

  return { optIn };
}
