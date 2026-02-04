export interface ArchitectureTask {
  id: string;
  prompt: string;
  expectations: {
    mustMention: string[];
    antiPatterns?: string[];
  };
}

export const architectureTasks: ArchitectureTask[] = [
  {
    id: 'saas_todo_multi_tenant',
    prompt:
      'Design the high-level architecture for a multi-tenant SaaS todo application with teams, roles, and per-tenant data isolation. Include API layer, database, and background workers.',
    expectations: {
      mustMention: ['multi-tenant', 'tenant', 'roles', 'background'],
      antiPatterns: ['single global user table with no tenant id'],
    },
  },
  {
    id: 'webhook_ingestion_pipeline',
    prompt:
      'Design an architecture for a webhook-based ingestion pipeline for GitHub events, including ingestion, queueing, processing, and persistence.',
    expectations: {
      mustMention: ['webhook', 'queue', 'worker', 'persistence'],
    },
  },
  {
    id: 'analytics_dashboard',
    prompt:
      'Design the architecture for a real-time analytics dashboard that displays metrics from multiple microservices, including data collection, aggregation, and streaming to clients.',
    expectations: {
      mustMention: ['metrics', 'aggregation', 'stream', 'client'],
    },
  },
];

