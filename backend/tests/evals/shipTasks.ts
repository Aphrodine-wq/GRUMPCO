export interface ShipTask {
  id: string;
  prompt: string;
  expectations: {
    mustPhases: string[];
  };
}

export const shipTasks: ShipTask[] = [
  {
    id: 'ship_todo_app',
    prompt:
      'Run the full SHIP flow for a simple todo web application with user accounts, projects, and due dates. Produce design, PRD, plan, and (optionally) code.',
    expectations: {
      mustPhases: ['design', 'spec', 'plan'],
    },
  },
  {
    id: 'ship_appointment_scheduler',
    prompt:
      'Run the SHIP pipeline for an appointment scheduling system for small clinics, including patient portal and staff dashboard.',
    expectations: {
      mustPhases: ['design', 'spec', 'plan'],
    },
  },
];

