/**
 * Scheduled agent eval tasks
 * Test POST /api/agents/schedule
 */

export interface ScheduledAgentTask {
  id: string;
  name: string;
  action: 'ship' | 'codegen';
  params: Record<string, unknown>;
  cronExpression: string;
  expectations: {
    mustReturnId?: boolean;
  };
}

export const scheduledAgentTasks: ScheduledAgentTask[] = [
  {
    id: 'schedule_ship_todo',
    name: 'eval-ship-todo',
    action: 'ship',
    params: { projectDescription: 'A simple todo app with add, complete, delete.' },
    cronExpression: '0 * * * *',
    expectations: {
      mustReturnId: true,
    },
  },
  {
    id: 'schedule_ship_auth',
    name: 'eval-ship-auth',
    action: 'ship',
    params: {
      projectDescription: 'A user authentication service with login, signup, and password reset.',
    },
    cronExpression: '0 9 * * 1',
    expectations: {
      mustReturnId: true,
    },
  },
  {
    id: 'schedule_codegen_crud',
    name: 'eval-codegen-crud',
    action: 'codegen',
    params: {
      description: 'CRUD API for tasks',
      techStack: 'express-typescript',
    },
    cronExpression: '0 0 * * *',
    expectations: {
      mustReturnId: true,
    },
  },
  {
    id: 'schedule_codegen_api',
    name: 'eval-codegen-api',
    action: 'codegen',
    params: {
      description: 'REST API for products with list, create, update, delete',
      techStack: 'fastapi-python',
    },
    cronExpression: '0 0 1 * *',
    expectations: {
      mustReturnId: true,
    },
  },
];
