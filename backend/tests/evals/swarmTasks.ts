/**
 * Swarm eval tasks – POST /api/agents/swarm (Kimi-orchestrated multi-agent)
 */

export interface SwarmTask {
  id: string;
  prompt: string;
  expectations: {
    mustDecompose?: boolean;
    mustHaveSummaryOrAgents?: boolean;
  };
}

export const swarmTasks: SwarmTask[] = [
  {
    id: 'swarm_todo_api',
    prompt: 'Build a simple todo API with add, list, complete, and delete.',
    expectations: {
      mustDecompose: true,
      mustHaveSummaryOrAgents: true,
    },
  },
  {
    id: 'swarm_add_tests',
    prompt: 'Add unit tests for a user authentication module (login, logout, session).',
    expectations: {
      mustDecompose: true,
      mustHaveSummaryOrAgents: true,
    },
  },
  {
    id: 'swarm_full_stack',
    prompt:
      'Design and implement a full-stack e-commerce checkout: product catalog API, cart service, payment integration, order persistence, and admin dashboard.',
    expectations: {
      mustDecompose: true,
      mustHaveSummaryOrAgents: true,
    },
  },
  {
    id: 'swarm_microservices',
    prompt:
      'Architect a microservices system for a ride-sharing app: user service, driver service, trip matching, payment service, and real-time notifications. Include API contracts and deployment considerations.',
    expectations: {
      mustDecompose: true,
      mustHaveSummaryOrAgents: true,
    },
  },
  {
    id: 'swarm_ci_cd',
    prompt:
      'Set up CI/CD for a React + Node.js app: lint, test, build, Docker image, and deploy to staging. Include GitHub Actions workflows and environment configuration.',
    expectations: {
      mustDecompose: true,
      mustHaveSummaryOrAgents: true,
    },
  },
];
