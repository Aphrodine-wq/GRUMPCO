import inquirer from 'inquirer';

// Type assertion to work around inquirer v12 type issues
const inq = inquirer as unknown as {
  prompt: <T = Record<string, unknown>>(questions: unknown) => Promise<T>;
};

/**
 * Wrapper for inquirer prompts to handle typing issues with inquirer v12+
 */
export async function prompt<T = Record<string, unknown>>(questions: unknown): Promise<T> {
  return inq.prompt<T>(questions);
}

/**
 * Re-export inquirer for convenience
 */
export { inquirer };
