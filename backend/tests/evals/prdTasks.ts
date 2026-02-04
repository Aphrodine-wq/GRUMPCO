export interface PrdTask {
  id: string;
  title: string;
  description: string;
  architectureSummary: string;
  expectations: {
    mustSections: string[];
  };
}

export const prdTasks: PrdTask[] = [
  {
    id: 'saas_todo_prd',
    title: 'Multi-tenant SaaS Todo App PRD',
    description:
      'Produce a product requirements document for a multi-tenant SaaS todo app with teams and roles. PRD should be suitable for a small engineering team to implement.',
    architectureSummary:
      'Single-page web app, backend API, multi-tenant database with tenant_id on core tables, background workers for notifications.',
    expectations: {
      mustSections: ['Overview', 'User Stories', 'Functional Requirements', 'Non-Functional Requirements', 'Out of Scope'],
    },
  },
  {
    id: 'webhook_pipeline_prd',
    title: 'GitHub Webhook Ingestion PRD',
    description:
      'PRD for a webhook ingestion pipeline that receives GitHub webhooks, validates them, enqueues jobs, and processes them into an internal event store.',
    architectureSummary:
      'Public webhook endpoint, queue for events, worker service, event store database, monitoring and retry policies.',
    expectations: {
      mustSections: ['Overview', 'Functional Requirements', 'Data Model', 'Monitoring'],
    },
  },
];

