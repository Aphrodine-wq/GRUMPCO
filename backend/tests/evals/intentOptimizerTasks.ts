/**
 * Intent Optimizer eval tasks
 * Test POST /api/intent/optimize
 */

export interface IntentOptimizerTask {
  id: string;
  intent: string;
  mode: 'codegen' | 'architecture';
  expectations: {
    mustHaveFeatures?: boolean;
    mustHaveConstraintsOrNFRs?: boolean;
  };
}

export const intentOptimizerTasks: IntentOptimizerTask[] = [
  {
    id: 'optimize_todo_architecture',
    intent: 'Build a todo application with user authentication and project folders.',
    mode: 'architecture',
    expectations: {
      mustHaveFeatures: true,
      mustHaveConstraintsOrNFRs: true,
    },
  },
  {
    id: 'optimize_api_codegen',
    intent: 'Create a REST API for inventory management with CRUD operations.',
    mode: 'codegen',
    expectations: {
      mustHaveFeatures: true,
    },
  },
];
