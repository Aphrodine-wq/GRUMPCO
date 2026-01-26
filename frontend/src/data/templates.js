export const templates = [
  {
    id: 'flowchart',
    label: 'Flowchart',
    icon: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h6v2H7v-2z',
    prompt: 'Create a flowchart for ',
    description: 'Process flows, decision trees, workflows'
  },
  {
    id: 'sequence',
    label: 'Sequence',
    icon: 'M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4zm12 0h4v4h-4v-4zM6 8v8M18 8v8M6 12h12',
    prompt: 'Create a sequence diagram showing ',
    description: 'API calls, user interactions, message flows'
  },
  {
    id: 'erd',
    label: 'ERD',
    icon: 'M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm4 2h10M7 11h10M7 15h6',
    prompt: 'Create an entity relationship diagram for ',
    description: 'Database schemas, data models'
  },
  {
    id: 'class',
    label: 'Class',
    icon: 'M4 4h16v5H4V4zm0 7h16v9H4v-9zm2 2h12M6 15h8',
    prompt: 'Create a class diagram for ',
    description: 'Object-oriented design, inheritance'
  },
  {
    id: 'state',
    label: 'State',
    icon: 'M12 4a8 8 0 100 16 8 8 0 000-16zm0 2a6 6 0 110 12 6 6 0 010-12zm0 2a4 4 0 100 8 4 4 0 000-8z',
    prompt: 'Create a state diagram for ',
    description: 'State machines, lifecycle flows'
  },
  {
    id: 'gantt',
    label: 'Gantt',
    icon: 'M3 6h18M3 12h18M3 18h18M6 3v18M6 6h4v2H6V6zm8 0h6v2h-6V6zM6 12h8v2H6v-2zm10 0h4v2h-4v-2zM6 18h6v2H6v-2z',
    prompt: 'Create a Gantt chart for ',
    description: 'Project timelines, schedules'
  }
];

export const examplePrompts = [
  'User authentication flow with OAuth',
  'REST API request-response cycle',
  'E-commerce database schema',
  'MVC architecture class diagram',
  'Order processing state machine',
  'Sprint planning timeline'
];
