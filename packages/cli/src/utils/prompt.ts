import inquirer from 'inquirer';
import type { QuestionCollection } from 'inquirer';

/**
 * Wrapper for inquirer prompts to handle typing issues
 */
export async function prompt<T = any>(questions: QuestionCollection): Promise<T> {
  return inquirer.prompt(questions) as Promise<T>;
}

/**
 * Re-export inquirer types for convenience
 */
export type { QuestionCollection };
