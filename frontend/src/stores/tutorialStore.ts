import { writable, get } from 'svelte/store';

export interface TutorialStep {
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void;
}

export interface TutorialConfig {
  id: string;
  name: string;
  steps: TutorialStep[];
}

// Tutorial definitions
export const TUTORIALS: Record<string, TutorialConfig> = {
  'first-time': {
    id: 'first-time',
    name: 'Getting Started',
    steps: [
      {
        target: '.chat-input',
        title: 'Welcome to G-Rump!',
        content:
          'Start by typing your project idea here. Try "Build a todo app with React and Node.js"',
        position: 'top',
      },
      {
        target: '[data-mode-selector]',
        title: 'Choose Your Mode',
        content:
          'Switch between Design (architecture diagrams) and Code (interactive development) modes.',
        position: 'bottom',
      },
      {
        target: '[data-ship-button]',
        title: 'Ship Mode',
        content: 'Use Ship mode for complete project generation: Architecture → PRD → Plan → Code',
        position: 'left',
      },
      {
        target: '[data-settings-button]',
        title: 'Settings',
        content: 'Configure your API keys, model preferences, and view cost analytics here.',
        position: 'left',
      },
    ],
  },
  'ship-mode': {
    id: 'ship-mode',
    name: 'Ship Mode Tutorial',
    steps: [
      {
        target: '[data-ship-input]',
        title: 'Describe Your Project',
        content: 'Enter a detailed description of what you want to build.',
        position: 'top',
      },
      {
        target: '[data-preferences]',
        title: 'Set Preferences',
        content: 'Choose your preferred framework, runtime, and database.',
        position: 'bottom',
      },
      {
        target: '[data-workflow-phases]',
        title: 'Track Progress',
        content: 'Watch as G-Rump generates your architecture, PRD, plan, and code in sequence.',
        position: 'bottom',
      },
    ],
  },
  'code-mode': {
    id: 'code-mode',
    name: 'Code Mode Tutorial',
    steps: [
      {
        target: '[data-workspace-selector]',
        title: 'Set Workspace',
        content:
          'Choose your project directory. All file operations will be scoped to this folder.',
        position: 'bottom',
      },
      {
        target: '[data-agent-profile]',
        title: 'Agent Profiles',
        content: 'Select specialized agents: Frontend, Backend, DevOps, or General.',
        position: 'bottom',
      },
      {
        target: '[data-tool-calls]',
        title: 'Tool Execution',
        content:
          'Watch the AI use tools like bash, file_read, and file_write to build your project.',
        position: 'left',
      },
    ],
  },
};

// Quick start templates
export interface QuickStartTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  prompt: string;
  mode: 'design' | 'code' | 'ship';
  tags: string[];
}

export const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    id: 'todo-app',
    name: 'Todo App',
    description: 'Full-stack todo application with React and Node.js',
    icon: 'check',
    prompt:
      'Build a todo app with React frontend, Node.js/Express backend, and PostgreSQL database. Include user authentication, task CRUD operations, and due date reminders.',
    mode: 'ship',
    tags: ['React', 'Node.js', 'PostgreSQL', 'Full-stack'],
  },
  {
    id: 'rest-api',
    name: 'REST API',
    description: 'RESTful API with authentication and database',
    icon: 'plug',
    prompt:
      'Create a RESTful API with Node.js and Express. Include JWT authentication, user management, rate limiting, and PostgreSQL database with migrations.',
    mode: 'ship',
    tags: ['Node.js', 'API', 'PostgreSQL', 'Backend'],
  },
  {
    id: 'design-system',
    name: 'Design System',
    description: 'Component library with Storybook',
    icon: 'palette',
    prompt:
      'Build a design system with React components, TypeScript, Tailwind CSS, and Storybook. Include buttons, forms, cards, modals, and documentation.',
    mode: 'ship',
    tags: ['React', 'TypeScript', 'Storybook', 'Frontend'],
  },
  {
    id: 'microservices',
    name: 'Microservices Architecture',
    description: 'Microservices with API gateway and service mesh',
    icon: 'building',
    prompt:
      'Design a microservices architecture with API gateway, authentication service, user service, and product service. Include service discovery, load balancing, and inter-service communication.',
    mode: 'design',
    tags: ['Architecture', 'Microservices', 'Backend'],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Platform',
    description: 'Full e-commerce solution with payments',
    icon: 'shopping-cart',
    prompt:
      'Build an e-commerce platform with product catalog, shopping cart, checkout with Stripe, order management, and admin dashboard. Use Next.js, Node.js, and PostgreSQL.',
    mode: 'ship',
    tags: ['Next.js', 'E-commerce', 'Stripe', 'Full-stack'],
  },
  {
    id: 'chat-app',
    name: 'Real-time Chat',
    description: 'Chat application with WebSockets',
    icon: 'message-circle',
    prompt:
      'Create a real-time chat application with WebSocket support, user presence, typing indicators, message history, and file sharing. Use React, Socket.io, and MongoDB.',
    mode: 'ship',
    tags: ['React', 'WebSocket', 'MongoDB', 'Real-time'],
  },
  {
    id: 'dashboard',
    name: 'Analytics Dashboard',
    description: 'Data visualization dashboard',
    icon: 'bar-chart',
    prompt:
      'Build an analytics dashboard with charts, graphs, real-time data updates, and export functionality. Use React, D3.js, and a REST API backend.',
    mode: 'ship',
    tags: ['React', 'D3.js', 'Analytics', 'Frontend'],
  },
  {
    id: 'mobile-api',
    name: 'Mobile App Backend',
    description: 'Backend API for mobile applications',
    icon: 'smartphone',
    prompt:
      'Create a backend API for mobile apps with push notifications, file uploads, offline sync, and real-time updates. Use Node.js, MongoDB, and Firebase.',
    mode: 'ship',
    tags: ['Node.js', 'Mobile', 'Firebase', 'Backend'],
  },
];

interface TutorialState {
  activeTutorial: string | null;
  completedTutorials: string[];
  showQuickStart: boolean;
}

const STORAGE_KEY = 'g-rump-tutorials';

function loadTutorialState(): TutorialState {
  try {
    if (typeof window === 'undefined') {
      return { activeTutorial: null, completedTutorials: [], showQuickStart: true };
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load tutorial state:', error);
  }
  return { activeTutorial: null, completedTutorials: [], showQuickStart: true };
}

const tutorialState = writable<TutorialState>(loadTutorialState());

// Persist to localStorage
tutorialState.subscribe((state) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
});

export const tutorialStore = {
  subscribe: tutorialState.subscribe,

  startTutorial: (tutorialId: string) => {
    tutorialState.update((state) => ({
      ...state,
      activeTutorial: tutorialId,
    }));
  },

  completeTutorial: (tutorialId: string) => {
    tutorialState.update((state) => ({
      ...state,
      activeTutorial: null,
      completedTutorials: [...new Set([...state.completedTutorials, tutorialId])],
    }));
  },

  skipTutorial: () => {
    tutorialState.update((state) => ({
      ...state,
      activeTutorial: null,
    }));
  },

  hideQuickStart: () => {
    tutorialState.update((state) => ({
      ...state,
      showQuickStart: false,
    }));
  },

  showQuickStart: () => {
    tutorialState.update((state) => ({
      ...state,
      showQuickStart: true,
    }));
  },

  isTutorialCompleted: (tutorialId: string): boolean => {
    return get(tutorialState).completedTutorials.includes(tutorialId);
  },

  reset: () => {
    tutorialState.set({ activeTutorial: null, completedTutorials: [], showQuickStart: true });
  },
};
