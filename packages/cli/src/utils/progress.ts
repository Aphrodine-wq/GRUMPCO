import chalk from 'chalk';
import ora from 'ora';
import type { Options, Ora as OraType } from 'ora';
import { branding } from '../branding.js';
import { config } from '../config.js';

/**
 * Progress indicator utilities using ora spinners
 */

interface SpinnerOptions {
  text?: string;
  color?: string;
  spinner?: string;
}

/**
 * Create a themed spinner with grumpy colors
 */
export function createSpinner(options: SpinnerOptions = {}): OraType {
  const enabled = config.get('features').progressIndicators;
  
  if (!enabled) {
    return {
      start: () => ({ text: options.text } as OraType),
      succeed: () => ({} as OraType),
      fail: () => ({} as OraType),
      warn: () => ({} as OraType),
      info: () => ({} as OraType),
      stop: () => ({} as OraType),
      clear: () => ({} as OraType),
      render: () => ({} as OraType),
      frame: () => '',
      text: options.text || '',
      color: 'red',
      spinner: { interval: 80, frames: ['◐', '◓', '◑', '◒'] }
    } as OraType;
  }
  
  const spinner = ora({
    text: options.text,
    spinner: 'dots',
    color: 'red'
  });
  
  return spinner;
}

/**
 * Show progress with percentage
 */
export function createProgressSpinner(initialText: string, totalSteps: number) {
  let currentStep = 0;
  const spinner = createSpinner({ text: initialText });
  
  return {
    start: () => spinner.start(),
    
    update(text: string, step?: number) {
      if (step !== undefined) {
        currentStep = step;
      } else {
        currentStep++;
      }
      const percent = Math.round((currentStep / totalSteps) * 100);
      spinner.text = `${text} ${chalk.dim(`(${percent}%)`)}`;
    },
    
    succeed(text?: string) {
      spinner.succeed(text ? branding.status(text, 'success') : undefined);
    },
    
    fail(text?: string) {
      spinner.fail(text ? branding.status(text, 'error') : undefined);
    },
    
    stop() {
      spinner.stop();
    }
  };
}

/**
 * Run a task with a spinner
 */
export async function withSpinner<T>(
  text: string,
  task: (spinner: OraType) => Promise<T>,
  successText?: string
): Promise<T> {
  const spinner = createSpinner({ text });
  spinner.start();
  
  try {
    const result = await task(spinner);
    spinner.succeed(successText ? branding.status(successText, 'success') : undefined);
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

/**
 * Display a progress bar in the terminal
 */
export function showProgressBar(current: number, total: number, width = 30): string {
  const percent = Math.min(100, Math.round((current / total) * 100));
  const filled = Math.round((width * current) / total);
  const empty = width - filled;
  
  const bar = branding.applyGradient('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  
  return `[${bar}] ${percent}%`;
}

/**
 * Show a multi-step progress indicator
 */
export class MultiStepProgress {
  private steps: string[];
  private current = 0;
  private spinner: ReturnType<typeof createSpinner>;
  
  constructor(steps: string[]) {
    this.steps = steps;
    this.spinner = createSpinner({ text: this.getStepText() });
  }
  
  start() {
    this.spinner.start();
  }
  
  next() {
    this.current++;
    if (this.current < this.steps.length) {
      this.spinner.text = this.getStepText();
    }
  }
  
  succeed(message?: string) {
    this.spinner.succeed(message);
  }
  
  fail(message?: string) {
    this.spinner.fail(message);
  }
  
  private getStepText(): string {
    const step = this.steps[this.current];
    const progress = chalk.dim(`[${this.current + 1}/${this.steps.length}]`);
    return `${progress} ${step}`;
  }
}
