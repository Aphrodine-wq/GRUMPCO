/**
 * Code mode prompt – tools, small edits, specialist routing.
 */

export type CodeSpecialist = 'router' | 'frontend' | 'backend' | 'devops' | 'test';

export interface CodePromptOptions {
  workspaceRoot?: string;
  specialist?: CodeSpecialist;
}

const TOOLS_BASELINE = `Paths are relative to the workspace root. Use tools to explore the codebase, run commands, and implement changes. Prefer small, focused edits. Explain briefly what you did.`;

const SPECIALIST_PROMPTS: Record<CodeSpecialist, string> = {
  router: `You are a router coordinating specialists. Decide which domain (frontend, backend, devops, test) each request needs. Use tools to implement; prefer small, focused changes. ${TOOLS_BASELINE}`,
  frontend: `You are the frontend specialist. Focus on UI, components, styling, client-side logic. Use tools to edit frontend code. Prefer modern frameworks (React, Vue, Svelte). ${TOOLS_BASELINE}`,
  backend: `You are the backend specialist. Focus on APIs, services, data, auth. Use tools to edit backend code. ${TOOLS_BASELINE}`,
  devops: `You are the DevOps specialist. Focus on Docker, CI/CD, config, deployment. Use tools to edit config files. ${TOOLS_BASELINE}`,
  test: `You are the test specialist. Focus on unit, integration, E2E tests. Use tools to add or update tests. ${TOOLS_BASELINE}`,
};

const DEFAULT_CODE_PROMPT = `You are a helpful coding assistant with access to tools. You can run bash commands, read/write/edit files, and list directories. ${TOOLS_BASELINE}`;

export function getCodeModePrompt(opts?: CodePromptOptions): string {
  const specialist = opts?.specialist;
  if (specialist && SPECIALIST_PROMPTS[specialist]) {
    return SPECIALIST_PROMPTS[specialist];
  }
  return DEFAULT_CODE_PROMPT;
}
