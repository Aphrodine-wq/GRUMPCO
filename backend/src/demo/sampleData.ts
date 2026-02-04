/**
 * Demo mode sample data – fixed architecture and PRD for one-click demo.
 * Used when ?demo=true or body.demo === true to skip LLM calls.
 */

import type { SystemArchitecture } from '../types/architecture.js';
import type { PRD } from '../types/prd.js';

const now = new Date().toISOString();

export const DEMO_ARCHITECTURE: SystemArchitecture = {
  id: 'demo-arch-1',
  projectName: 'Demo Todo App',
  projectDescription: 'A simple todo app with user authentication and real-time sync.',
  projectType: 'fullstack',
  complexity: 'mvp',
  techStack: ['React', 'Node.js', 'PostgreSQL'],
  c4Diagrams: {
    context: `flowchart LR
  User[User] --> App[Todo App]
  App --> API[API Server]
  API --> DB[(Database)]`,
    container: `flowchart TB
  subgraph Frontend
    Web[Web App]
  end
  subgraph Backend
    API[API]
    DB[(DB)]
  end
  Web --> API --> DB`,
    component: `flowchart LR
  A[Auth] --> B[Tasks]
  B --> C[Sync]`,
  },
  metadata: {
    components: [
      {
        id: 'c1',
        name: 'Web App',
        description: 'React SPA',
        type: 'frontend',
        technology: ['React'],
      },
      { id: 'c2', name: 'API', description: 'REST API', type: 'backend', technology: ['Node.js'] },
      {
        id: 'c3',
        name: 'Database',
        description: 'PostgreSQL',
        type: 'database',
        technology: ['PostgreSQL'],
      },
    ],
    integrations: [],
    dataModels: [],
    apiEndpoints: [],
    technologies: { frontend: ['React'], backend: ['Node.js'], database: ['PostgreSQL'] },
  },
  createdAt: now,
  updatedAt: now,
};

export const DEMO_PRD: PRD = {
  id: 'demo-prd-1',
  projectName: 'Demo Todo App',
  projectDescription: 'A simple todo app with user authentication and real-time sync.',
  version: '1.0',
  createdAt: now,
  updatedAt: now,
  sections: {
    overview: {
      vision: 'A minimal todo app to demonstrate G-Rump Architecture → Spec → Code.',
      problem: 'Users need a quick way to manage tasks.',
      solution: 'Web and mobile todo app with auth and sync.',
      targetMarket: 'Individual users and small teams.',
    },
    personas: [
      {
        id: 'p1',
        name: 'End User',
        role: 'User',
        description: 'Someone who wants to track tasks.',
        goals: ['Add and complete tasks', 'Sync across devices'],
        painPoints: ['Forgotten tasks'],
        successCriteria: ['Can add and complete tasks in under 30 seconds'],
      },
    ],
    features: [
      {
        id: 'f1',
        name: 'Task management',
        description: 'Create, edit, complete, and delete tasks.',
        priority: 'must',
        userStories: ['As a user I want to add tasks so that I can track work.'],
        acceptanceCriteria: ['User can add a task with a title', 'User can mark a task complete'],
      },
    ],
    userStories: [
      {
        id: 'us1',
        title: 'Add task',
        asA: 'user',
        iWant: 'to add a new task',
        soThat: 'I can track what I need to do',
        acceptanceCriteria: ['Task has title', 'Task appears in list'],
      },
    ],
    nonFunctionalRequirements: [],
    apis: [
      {
        method: 'GET',
        path: '/api/tasks',
        description: 'List tasks',
        responses: [{ status: 200, description: 'OK' }],
      },
      {
        method: 'POST',
        path: '/api/tasks',
        description: 'Create task',
        responses: [{ status: 201, description: 'Created' }],
      },
    ],
    dataModels: [
      {
        name: 'Task',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'title', type: 'string', required: true },
          { name: 'done', type: 'boolean', required: true },
        ],
      },
    ],
    successMetrics: [],
  },
};
