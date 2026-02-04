/**
 * Wizard Configuration Save/Load for G-Rump CLI
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { config } from '../config.js';
import type { SystemCheckResult } from './systemCheck.js';
import type { AuthResult } from './authStep.js';
import type { TechStackResult } from './techStackStep.js';
import type { ConnectionTestResult } from './connectionTest.js';

export interface WizardConfig {
  // System check results
  systemCheck?: SystemCheckResult;
  
  // Authentication
  auth?: AuthResult;
  
  // AI Provider
  aiProvider?: string;
  aiProviderApiKey?: string;
  
  // Tech Stack
  techStack?: TechStackResult;
  
  // Appearance
  theme?: 'dark' | 'light' | 'minimal' | 'grumpy';
  colors?: {
    primary: string;
    secondary: string;
    error: string;
  };
  
  // Connection test results
  connectionTest?: ConnectionTestResult;
  
  // Telemetry
  telemetryOptIn?: boolean;
  
  // Metadata
  wizardVersion: string;
  completedAt: string;
}

const WIZARD_VERSION = '1.0.0';
const GLOBAL_CONFIG_DIR = join(homedir(), '.config', 'grump');
const WIZARD_STATE_FILE = join(GLOBAL_CONFIG_DIR, 'wizard-state.json');

/**
 * Save wizard configuration
 */
export async function saveWizardConfig(wizardConfig: Partial<WizardConfig>): Promise<void> {
  // Ensure config directory exists
  if (!existsSync(GLOBAL_CONFIG_DIR)) {
    mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }

  // Build complete config
  const fullConfig: WizardConfig = {
    ...wizardConfig,
    wizardVersion: WIZARD_VERSION,
    completedAt: new Date().toISOString()
  };

  // Save wizard state
  writeFileSync(WIZARD_STATE_FILE, JSON.stringify(fullConfig, null, 2));

  // Update main config with relevant settings
  if (wizardConfig.aiProvider) {
    config.set('apiKey', wizardConfig.aiProviderApiKey || null, true);
  }

  if (wizardConfig.theme) {
    config.set('theme', wizardConfig.theme, true);
  }

  if (wizardConfig.colors) {
    config.set('colors', wizardConfig.colors, true);
  }

  // Create/update .grumprc in current directory with project-specific settings
  const localConfig: Record<string, unknown> = {
    apiUrl: config.get('apiUrl'),
    theme: wizardConfig.theme || 'dark',
    defaultOutputDir: './output',
    colors: wizardConfig.colors || {
      primary: '#6B46C1',
      secondary: '#8B5CF6',
      error: '#EF4444'
    },
    features: {
      autoStream: false,
      cacheEnabled: true,
      progressIndicators: true,
      wizardComplete: true
    }
  };

  // Add tech stack if configured
  if (wizardConfig.techStack) {
    localConfig.techStack = wizardConfig.techStack;
  }

  // Add AI provider preference
  if (wizardConfig.aiProvider) {
    localConfig.preferredProvider = wizardConfig.aiProvider;
  }

  // Add telemetry setting
  if (wizardConfig.telemetryOptIn !== undefined) {
    localConfig.telemetry = wizardConfig.telemetryOptIn;
  }

  // Write local config
  const localConfigPath = join(process.cwd(), '.grumprc');
  writeFileSync(localConfigPath, JSON.stringify(localConfig, null, 2));
}

/**
 * Load wizard state (for resuming or checking completion)
 */
export function loadWizardState(): WizardConfig | null {
  try {
    if (!existsSync(WIZARD_STATE_FILE)) {
      return null;
    }
    const content = readFileSync(WIZARD_STATE_FILE, 'utf-8');
    return JSON.parse(content) as WizardConfig;
  } catch {
    return null;
  }
}

/**
 * Check if wizard has been completed
 */
export function isWizardComplete(): boolean {
  const state = loadWizardState();
  return !!state?.completedAt;
}

/**
 * Reset wizard state (for re-running wizard)
 */
export function resetWizardState(): void {
  try {
    if (existsSync(WIZARD_STATE_FILE)) {
      const { unlinkSync } = require('fs');
      unlinkSync(WIZARD_STATE_FILE);
    }
  } catch {
    // Ignore errors
  }
}
