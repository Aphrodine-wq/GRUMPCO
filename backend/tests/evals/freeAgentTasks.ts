/**
 * Free Agent eval tasks - skills and tool usage
 */

export interface FreeAgentTask {
  id: string;
  prompt: string;
  expectations: {
    mustMention?: string[];
    mustUseTools?: string[];
    antiPatterns?: string[];
  };
}

export const freeAgentTasks: FreeAgentTask[] = [
  {
    id: 'skill_list_files',
    prompt:
      'Create a skill that lists files in a directory. The skill should accept a path parameter and return the list of files and folders.',
    expectations: {
      mustMention: ['skill', 'list', 'files'],
      mustUseTools: ['skill_create'],
    },
  },
  {
    id: 'list_skills',
    prompt: 'List all available skills. Tell me what skills exist and what they do.',
    expectations: {
      mustUseTools: ['skill_list'],
    },
  },
];
