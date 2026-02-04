/**
 * G-Rump CLI First-Run Wizard
 * 
 * A playful, comprehensive setup wizard that guides users through:
 * 1. Welcome & system requirements check
 * 2. Authentication (OAuth or API key)
 * 3. AI provider selection
 * 4. Tech stack preferences
 * 5. CLI appearance settings
 * 6. Connection test
 * 7. Telemetry opt-in
 */

import chalk from 'chalk';
import { branding } from '../branding.js';
import { config } from '../config.js';
import { prompt as askUser } from '../utils/prompt.js';
import { withSpinner, createSpinner, MultiStepProgress } from '../utils/progress.js';
import { runSystemCheck, type SystemCheckResult } from './systemCheck.js';
import { runAuthStep, type AuthResult } from './authStep.js';
import { runApiProviderStep, type ApiProviderResult } from './apiProviderStep.js';
import { runTechStackStep, type TechStackResult } from './techStackStep.js';
import { runAppearanceStep, type AppearanceResult } from './appearanceStep.js';
import { runConnectionTest, type ConnectionTestResult } from './connectionTest.js';
import { runTelemetryStep, type TelemetryResult } from './telemetryStep.js';
import { saveWizardConfig, type WizardConfig } from './wizardConfig.js';

export interface WizardOptions {
  skipSystemCheck?: boolean;
  skipAuth?: boolean;
  skipTechStack?: boolean;
  quick?: boolean;
}

export interface WizardResult {
  success: boolean;
  config: Partial<WizardConfig>;
  skipped: boolean;
}

/**
 * Show the wizard welcome screen
 */
function showWelcome(): void {
  console.clear();
  console.log(branding.getLogo('detailed'));
  console.log(branding.getDivider());
  console.log();
  console.log(branding.format('  Welcome to the G-Rump Setup Wizard!', 'subtitle'));
  console.log();
  console.log(chalk.white('  This wizard will help you configure G-Rump for optimal grumpiness.'));
  console.log(chalk.white('  It should take about 3-5 minutes to complete.'));
  console.log();
  console.log(chalk.dim('  You can press Ctrl+C at any time to exit and configure later.'));
  console.log();
  console.log(branding.getDivider());
  console.log();
}

/**
 * Show wizard completion screen
 */
function showComplete(config: Partial<WizardConfig>): void {
  console.log();
  console.log(branding.getDivider());
  console.log();
  console.log(branding.getSuccessFace());
  console.log();
  console.log(branding.format('  Setup Complete!', 'title'));
  console.log();
  console.log(chalk.white('  G-Rump is now configured and ready to help you build amazing things.'));
  console.log(chalk.white('  (Even if I have to complain about your code along the way.)'));
  console.log();
  
  // Show summary
  console.log(branding.format('  Quick Summary:', 'subtitle'));
  console.log();
  
  if (config.aiProvider) {
    console.log(chalk.white(`    AI Provider: ${chalk.hex('#A855F7')(config.aiProvider)}`));
  }
  if (config.techStack?.frontend?.length) {
    console.log(chalk.white(`    Frontend: ${chalk.hex('#A855F7')(config.techStack.frontend.join(', '))}`));
  }
  if (config.techStack?.backendLanguage?.length) {
    console.log(chalk.white(`    Backend: ${chalk.hex('#A855F7')(config.techStack.backendLanguage.join(', '))}`));
  }
  if (config.theme) {
    console.log(chalk.white(`    Theme: ${chalk.hex('#A855F7')(config.theme)}`));
  }
  
  console.log();
  console.log(branding.getDivider());
  console.log();
  console.log(branding.format('  Next Steps:', 'subtitle'));
  console.log();
  console.log(chalk.dim('    1. Run ') + chalk.hex('#A855F7')('grump ship "Your project idea"') + chalk.dim(' to start building'));
  console.log(chalk.dim('    2. Run ') + chalk.hex('#A855F7')('grump --help') + chalk.dim(' to see all commands'));
  console.log(chalk.dim('    3. Run ') + chalk.hex('#A855F7')('grump doctor') + chalk.dim(' to check your setup anytime'));
  console.log();
  console.log(chalk.dim('  Happy coding! (Try not to disappoint me too much.)'));
  console.log();
}

/**
 * Run the first-run wizard
 */
export async function runWizard(options: WizardOptions = {}): Promise<WizardResult> {
  const wizardConfig: Partial<WizardConfig> = {};
  
  try {
    // Welcome screen
    showWelcome();
    
    // Ask if user wants to proceed
    const { proceed } = await askUser<{ proceed: boolean }>([{
      type: 'confirm',
      name: 'proceed',
      message: 'Ready to begin setup?',
      default: true
    }]);
    
    if (!proceed) {
      console.log();
      console.log(branding.status('Setup cancelled. Run `grump init` when you\'re ready.', 'info'));
      return { success: false, config: {}, skipped: true };
    }
    
    console.log();
    
    // Step 1: System Requirements Check
    if (!options.skipSystemCheck) {
      console.log(branding.format('Step 1/7: System Check', 'subtitle'));
      console.log();
      
      const systemResult = await runSystemCheck();
      wizardConfig.systemCheck = systemResult;
      
      if (!systemResult.passed) {
        const { continueAnyway } = await askUser<{ continueAnyway: boolean }>([{
          type: 'confirm',
          name: 'continueAnyway',
          message: 'Some requirements are not met. Continue anyway?',
          default: false
        }]);
        
        if (!continueAnyway) {
          console.log();
          console.log(branding.status('Please address the issues above and run `grump init` again.', 'warning'));
          return { success: false, config: wizardConfig, skipped: false };
        }
      }
      console.log();
    }
    
    // Step 2: Authentication
    if (!options.skipAuth) {
      console.log(branding.format('Step 2/7: Authentication', 'subtitle'));
      console.log();
      
      const authResult = await runAuthStep();
      wizardConfig.auth = authResult;
      console.log();
    }
    
    // Step 3: AI Provider Selection
    console.log(branding.format('Step 3/7: AI Provider', 'subtitle'));
    console.log();
    
    const apiProviderResult = await runApiProviderStep();
    wizardConfig.aiProvider = apiProviderResult.provider;
    wizardConfig.aiProviderApiKey = apiProviderResult.apiKey;
    console.log();
    
    // Step 4: Tech Stack (can be skipped in quick mode)
    if (!options.skipTechStack && !options.quick) {
      console.log(branding.format('Step 4/7: Tech Stack Preferences', 'subtitle'));
      console.log();
      
      const techStackResult = await runTechStackStep();
      wizardConfig.techStack = techStackResult;
      console.log();
    } else if (options.quick) {
      console.log(branding.format('Step 4/7: Tech Stack Preferences', 'subtitle'));
      console.log(chalk.dim('  Skipped (quick mode)'));
      console.log();
    }
    
    // Step 5: Appearance Settings
    console.log(branding.format('Step 5/7: Appearance', 'subtitle'));
    console.log();
    
    const appearanceResult = await runAppearanceStep();
    wizardConfig.theme = appearanceResult.theme;
    wizardConfig.colors = appearanceResult.colors;
    console.log();
    
    // Step 6: Connection Test
    console.log(branding.format('Step 6/7: Connection Test', 'subtitle'));
    console.log();
    
    const connectionResult = await runConnectionTest(
      config.get('apiUrl'),
      wizardConfig.aiProvider,
      wizardConfig.aiProviderApiKey
    );
    wizardConfig.connectionTest = connectionResult;
    console.log();
    
    // Step 7: Telemetry
    console.log(branding.format('Step 7/7: Telemetry', 'subtitle'));
    console.log();
    
    const telemetryResult = await runTelemetryStep();
    wizardConfig.telemetryOptIn = telemetryResult.optIn;
    console.log();
    
    // Save configuration
    await withSpinner(
      'Saving configuration...',
      async () => {
        await saveWizardConfig(wizardConfig);
      },
      'Configuration saved!'
    );
    
    // Show completion
    showComplete(wizardConfig);
    
    return { success: true, config: wizardConfig, skipped: false };
    
  } catch (error) {
    if ((error as Error).message?.includes('User force closed')) {
      console.log();
      console.log(branding.status('Setup cancelled.', 'info'));
      return { success: false, config: wizardConfig, skipped: true };
    }
    throw error;
  }
}

/**
 * Check if first-run wizard should be shown
 */
export function shouldShowWizard(): boolean {
  try {
    // Check if wizard has been completed before
    const features = config.get('features') as Record<string, unknown>;
    if (features?.wizardComplete) {
      return false;
    }
    
    // Check if we have minimal config (API key set)
    if (config.hasApiKey()) {
      return false;
    }
    
    return true;
  } catch {
    return true;
  }
}

export { type WizardConfig } from './wizardConfig.js';
