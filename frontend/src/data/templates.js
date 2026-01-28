export const templates = [
  {
    id: 'ship-mode',
    label: 'Build full app from description',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    prompt: '',
    description: 'Run SHIP: Design → Spec → Plan → Code in one go'
  },
  {
    id: 'webapp',
    label: 'Web App',
    icon: 'M3 4h18v16H3V4zm2 2v12h14V6H5zm2 2h10v2H7V8zm0 4h6v2H7v-2z',
    prompt: 'Build a web app that ',
    description: 'Full-stack web applications'
  },
  {
    id: 'api',
    label: 'API',
    icon: 'M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4zm12 0h4v4h-4v-4zM6 8v8M18 8v8M6 12h12',
    prompt: 'Build an API for ',
    description: 'REST APIs, backend services'
  },
  {
    id: 'saas',
    label: 'SaaS',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    prompt: 'Build a SaaS platform for ',
    description: 'Subscription software products'
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
    prompt: 'Build a dashboard for ',
    description: 'Analytics, admin panels'
  },
  {
    id: 'ecommerce',
    label: 'E-commerce',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
    prompt: 'Build an e-commerce store for ',
    description: 'Online stores, marketplaces'
  },
  {
    id: 'mobile',
    label: 'Mobile App',
    icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
    prompt: 'Build a mobile app for ',
    description: 'iOS and Android apps'
  }
];

export const examplePrompts = [
  'a task management app with teams and projects',
  'a booking system for appointments',
  'a social platform for developers',
  'an inventory management system',
  'a real-time chat application',
  'a subscription billing service'
];
