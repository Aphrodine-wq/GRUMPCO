import { writable, derived, get } from 'svelte/store';

// ============================================================================
// TYPES
// ============================================================================

export type OnboardingStep =
  | 'welcome'
  | 'ship-workflow'
  | 'g-agent'
  | 'auth'
  | 'api-provider'
  | 'frontend-stack'
  | 'backend-stack'
  | 'infrastructure'
  | 'tooling'
  | 'app-preferences'
  | 'review'
  | 'next-steps';

export interface TechOption {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  popular?: boolean;
}

// Frontend frameworks
export const FRONTEND_OPTIONS: TechOption[] = [
  { id: 'react', name: 'React', icon: 'react', popular: true },
  { id: 'nextjs', name: 'Next.js', icon: 'nextjs', popular: true },
  { id: 'vue', name: 'Vue', icon: 'vue' },
  { id: 'nuxt', name: 'Nuxt', icon: 'nuxt' },
  { id: 'svelte', name: 'Svelte', icon: 'svelte', popular: true },
  { id: 'sveltekit', name: 'SvelteKit', icon: 'sveltekit' },
  { id: 'angular', name: 'Angular', icon: 'angular' },
  { id: 'solid', name: 'Solid', icon: 'solid' },
  { id: 'astro', name: 'Astro', icon: 'astro' },
  { id: 'qwik', name: 'Qwik', icon: 'qwik' },
  { id: 'remix', name: 'Remix', icon: 'remix' },
  { id: 'htmx', name: 'HTMX', icon: 'htmx' },
  { id: 'vanilla', name: 'Vanilla JS', icon: 'vanilla' },
  { id: 'none', name: 'No frontend', icon: 'none' },
];

// Backend languages
export const BACKEND_LANGUAGE_OPTIONS: TechOption[] = [
  { id: 'typescript', name: 'TypeScript', icon: 'typescript', popular: true },
  { id: 'javascript', name: 'JavaScript', icon: 'javascript', popular: true },
  { id: 'python', name: 'Python', icon: 'python', popular: true },
  { id: 'go', name: 'Go', icon: 'go' },
  { id: 'rust', name: 'Rust', icon: 'rust' },
  { id: 'java', name: 'Java', icon: 'java' },
  { id: 'kotlin', name: 'Kotlin', icon: 'kotlin' },
  { id: 'csharp', name: 'C#', icon: 'csharp' },
  { id: 'ruby', name: 'Ruby', icon: 'ruby' },
  { id: 'php', name: 'PHP', icon: 'php' },
  { id: 'elixir', name: 'Elixir', icon: 'elixir' },
  { id: 'none', name: 'No backend', icon: 'none' },
];

// Backend frameworks
export const BACKEND_FRAMEWORK_OPTIONS: TechOption[] = [
  { id: 'express', name: 'Express', icon: 'express', popular: true },
  { id: 'fastify', name: 'Fastify', icon: 'fastify' },
  { id: 'nestjs', name: 'NestJS', icon: 'nestjs' },
  { id: 'hono', name: 'Hono', icon: 'hono' },
  { id: 'fastapi', name: 'FastAPI', icon: 'fastapi', popular: true },
  { id: 'django', name: 'Django', icon: 'django' },
  { id: 'flask', name: 'Flask', icon: 'flask' },
  { id: 'gin', name: 'Gin (Go)', icon: 'gin' },
  { id: 'fiber', name: 'Fiber (Go)', icon: 'fiber' },
  { id: 'actix', name: 'Actix (Rust)', icon: 'actix' },
  { id: 'axum', name: 'Axum (Rust)', icon: 'axum' },
  { id: 'spring', name: 'Spring Boot', icon: 'spring' },
  { id: 'rails', name: 'Rails', icon: 'rails' },
  { id: 'laravel', name: 'Laravel', icon: 'laravel' },
  { id: 'phoenix', name: 'Phoenix', icon: 'phoenix' },
  { id: 'none', name: 'None / Custom', icon: 'none' },
];

// Databases
export const DATABASE_OPTIONS: TechOption[] = [
  { id: 'postgresql', name: 'PostgreSQL', icon: 'postgresql', popular: true },
  { id: 'mysql', name: 'MySQL', icon: 'mysql' },
  { id: 'mongodb', name: 'MongoDB', icon: 'mongodb', popular: true },
  { id: 'sqlite', name: 'SQLite', icon: 'sqlite' },
  { id: 'redis', name: 'Redis', icon: 'redis' },
  { id: 'supabase', name: 'Supabase', icon: 'supabase', popular: true },
  { id: 'firebase', name: 'Firebase', icon: 'firebase' },
  { id: 'planetscale', name: 'PlanetScale', icon: 'planetscale' },
  { id: 'neon', name: 'Neon', icon: 'neon' },
  { id: 'turso', name: 'Turso', icon: 'turso' },
  { id: 'dynamodb', name: 'DynamoDB', icon: 'dynamodb' },
  { id: 'cockroachdb', name: 'CockroachDB', icon: 'cockroachdb' },
  { id: 'none', name: 'No database', icon: 'none' },
];

// Cloud/hosting providers
export const CLOUD_OPTIONS: TechOption[] = [
  { id: 'vercel', name: 'Vercel', icon: 'vercel', popular: true },
  { id: 'netlify', name: 'Netlify', icon: 'netlify' },
  { id: 'railway', name: 'Railway', icon: 'railway', popular: true },
  { id: 'render', name: 'Render', icon: 'render' },
  { id: 'fly', name: 'Fly.io', icon: 'fly' },
  { id: 'aws', name: 'AWS', icon: 'aws' },
  { id: 'gcp', name: 'Google Cloud', icon: 'gcp' },
  { id: 'azure', name: 'Azure', icon: 'azure' },
  { id: 'digitalocean', name: 'DigitalOcean', icon: 'digitalocean' },
  { id: 'cloudflare', name: 'Cloudflare', icon: 'cloudflare' },
  { id: 'heroku', name: 'Heroku', icon: 'heroku' },
  { id: 'self-hosted', name: 'Self-hosted', icon: 'self-hosted' },
];

// Infrastructure tools
export const INFRASTRUCTURE_OPTIONS: TechOption[] = [
  { id: 'docker', name: 'Docker', icon: 'docker', popular: true },
  { id: 'kubernetes', name: 'Kubernetes', icon: 'kubernetes' },
  { id: 'terraform', name: 'Terraform', icon: 'terraform' },
  { id: 'pulumi', name: 'Pulumi', icon: 'pulumi' },
  { id: 'github-actions', name: 'GitHub Actions', icon: 'github-actions', popular: true },
  { id: 'gitlab-ci', name: 'GitLab CI', icon: 'gitlab-ci' },
  { id: 'jenkins', name: 'Jenkins', icon: 'jenkins' },
  { id: 'circleci', name: 'CircleCI', icon: 'circleci' },
  { id: 'serverless', name: 'Serverless', icon: 'serverless' },
  { id: 'none', name: 'None yet', icon: 'none' },
];

// Git providers
export const GIT_PROVIDER_OPTIONS: TechOption[] = [
  { id: 'github', name: 'GitHub', icon: 'github', popular: true },
  { id: 'gitlab', name: 'GitLab', icon: 'gitlab' },
  { id: 'bitbucket', name: 'Bitbucket', icon: 'bitbucket' },
  { id: 'azure-devops', name: 'Azure DevOps', icon: 'azure-devops' },
  { id: 'other', name: 'Other', icon: 'other' },
];

// IDEs/Editors
export const IDE_OPTIONS: TechOption[] = [
  { id: 'vscode', name: 'VS Code', icon: 'vscode', popular: true },
  { id: 'cursor', name: 'Cursor', icon: 'cursor', popular: true },
  { id: 'windsurf', name: 'Windsurf', icon: 'windsurf' },
  { id: 'webstorm', name: 'WebStorm', icon: 'webstorm' },
  { id: 'intellij', name: 'IntelliJ IDEA', icon: 'intellij' },
  { id: 'pycharm', name: 'PyCharm', icon: 'pycharm' },
  { id: 'vim', name: 'Vim/Neovim', icon: 'vim' },
  { id: 'emacs', name: 'Emacs', icon: 'emacs' },
  { id: 'zed', name: 'Zed', icon: 'zed' },
  { id: 'sublime', name: 'Sublime Text', icon: 'sublime' },
  { id: 'other', name: 'Other', icon: 'other' },
];

// Mobile development
export const MOBILE_OPTIONS: TechOption[] = [
  { id: 'react-native', name: 'React Native', icon: 'react-native', popular: true },
  { id: 'expo', name: 'Expo', icon: 'expo' },
  { id: 'flutter', name: 'Flutter', icon: 'flutter', popular: true },
  { id: 'swift', name: 'Swift (iOS)', icon: 'swift' },
  { id: 'kotlin-android', name: 'Kotlin (Android)', icon: 'kotlin-android' },
  { id: 'ionic', name: 'Ionic', icon: 'ionic' },
  { id: 'capacitor', name: 'Capacitor', icon: 'capacitor' },
  { id: 'tauri', name: 'Tauri', icon: 'tauri' },
  { id: 'electron', name: 'Electron', icon: 'electron' },
  { id: 'none', name: 'No mobile', icon: 'none' },
];

// Styling approaches
export const STYLING_OPTIONS: TechOption[] = [
  { id: 'tailwind', name: 'Tailwind CSS', icon: 'tailwind', popular: true },
  { id: 'css-modules', name: 'CSS Modules', icon: 'css-modules' },
  { id: 'styled-components', name: 'Styled Components', icon: 'styled-components' },
  { id: 'emotion', name: 'Emotion', icon: 'emotion' },
  { id: 'sass', name: 'Sass/SCSS', icon: 'sass' },
  { id: 'vanilla-css', name: 'Vanilla CSS', icon: 'vanilla-css' },
  { id: 'panda', name: 'Panda CSS', icon: 'panda' },
  { id: 'uno', name: 'UnoCSS', icon: 'uno' },
  { id: 'shadcn', name: 'shadcn/ui', icon: 'shadcn', popular: true },
  { id: 'chakra', name: 'Chakra UI', icon: 'chakra' },
  { id: 'mantine', name: 'Mantine', icon: 'mantine' },
  { id: 'mui', name: 'Material UI', icon: 'mui' },
];

// AI Providers
export const AI_PROVIDER_OPTIONS: TechOption[] = [
  {
    id: 'kimi',
    name: 'Kimi K2.5',
    icon: 'kimi',
    popular: true,
    description: 'Recommended - Great balance of speed & quality',
  },
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    icon: 'nvidia-nim',
    description: 'GPU-accelerated inference',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: 'openrouter',
    popular: true,
    description: 'Access multiple models',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: 'anthropic',
    description: 'Advanced reasoning',
  },
  { id: 'mistral', name: 'Mistral AI', icon: 'mistral', description: 'Efficient open models' },
  { id: 'groq', name: 'Groq', icon: 'groq', description: 'Ultra-fast inference' },
  { id: 'cohere', name: 'Cohere', icon: 'cohere', description: 'Command and embed models' },
  { id: 'fireworks', name: 'Fireworks AI', icon: 'fireworks', description: 'Open model inference' },
  { id: 'replicate', name: 'Replicate', icon: 'replicate', description: 'Run open-source models' },
  { id: 'anyscale', name: 'Anyscale', icon: 'anyscale', description: 'Ray and LLM inference' },
  { id: 'gemini', name: 'Google AI (Gemini)', icon: 'gemini', description: 'Gemini models' },
  { id: 'ollama', name: 'Ollama (Local)', icon: 'ollama', description: 'Run models locally' },
];

// Auth providers supported
export type AuthProvider = 'google' | 'github' | 'discord';

// App theme options
export type AppTheme = 'light' | 'dark' | 'system';

// ============================================================================
// ONBOARDING STATE
// ============================================================================

export interface OnboardingData {
  // Current step
  currentStep: OnboardingStep;

  // Auth state
  authProvider?: AuthProvider;
  isAuthenticated: boolean;

  // AI Provider
  aiProvider?: string;
  aiProviderApiKey?: string;

  // Tech stack selections (can select multiple per category)
  frontend: string[];
  backendLanguage: string[];
  backendFramework: string[];
  database: string[];
  cloud: string[];
  infrastructure: string[];
  gitProvider: string[];
  ide: string[];
  mobile: string[];
  styling: string[];

  // App preferences
  theme: AppTheme;
  telemetryOptIn: boolean;

  // Completion state
  completedSteps: OnboardingStep[];
  isComplete: boolean;
  skipped: boolean;
}

const STORAGE_KEY = 'g-rump-onboarding-v2';

const DEFAULT_ONBOARDING_DATA: OnboardingData = {
  currentStep: 'welcome',
  isAuthenticated: false,
  frontend: [],
  backendLanguage: [],
  backendFramework: [],
  database: [],
  cloud: [],
  infrastructure: [],
  gitProvider: [],
  ide: [],
  mobile: [],
  styling: [],
  theme: 'system',
  telemetryOptIn: true,
  completedSteps: [],
  isComplete: false,
  skipped: false,
};

// Step order for navigation (g-agent early – right after welcome; tech stack removed – AI chooses best fit)
export const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'g-agent',
  'ship-workflow',
  'auth',
  'api-provider',
  'app-preferences',
  'review',
  'next-steps',
];

// Load from localStorage
function loadOnboardingData(): OnboardingData {
  try {
    if (typeof window === 'undefined') return DEFAULT_ONBOARDING_DATA;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_ONBOARDING_DATA, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load onboarding data:', error);
  }
  return DEFAULT_ONBOARDING_DATA;
}

// ============================================================================
// STORE
// ============================================================================

const onboardingData = writable<OnboardingData>(loadOnboardingData());

// Persist to localStorage on changes
onboardingData.subscribe((value) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    }
  } catch (error) {
    console.error('Failed to save onboarding data:', error);
  }
});

// Derived stores
export const currentStep = derived(onboardingData, ($data) => $data.currentStep);
export const currentStepIndex = derived(onboardingData, ($data) =>
  STEP_ORDER.indexOf($data.currentStep)
);
export const totalSteps = STEP_ORDER.length;
export const isOnboardingComplete = derived(
  onboardingData,
  ($data) => $data.isComplete || $data.skipped
);
export const progress = derived(onboardingData, ($data) => {
  const index = STEP_ORDER.indexOf($data.currentStep);
  return ((index + 1) / STEP_ORDER.length) * 100;
});

// ============================================================================
// ACTIONS
// ============================================================================

export const newOnboardingStore = {
  // Subscribe to the store
  subscribe: onboardingData.subscribe,

  // Get current data
  get: () => get(onboardingData),

  // Navigation
  goToStep: (step: OnboardingStep) => {
    onboardingData.update((data) => ({
      ...data,
      currentStep: step,
    }));
  },

  nextStep: () => {
    onboardingData.update((data) => {
      const currentIndex = STEP_ORDER.indexOf(data.currentStep);
      const nextIndex = Math.min(currentIndex + 1, STEP_ORDER.length - 1);
      const completedSteps = data.completedSteps.includes(data.currentStep)
        ? data.completedSteps
        : [...data.completedSteps, data.currentStep];

      return {
        ...data,
        currentStep: STEP_ORDER[nextIndex],
        completedSteps,
      };
    });
  },

  prevStep: () => {
    onboardingData.update((data) => {
      const currentIndex = STEP_ORDER.indexOf(data.currentStep);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return {
        ...data,
        currentStep: STEP_ORDER[prevIndex],
      };
    });
  },

  // Update selections
  setAuthProvider: (provider: AuthProvider) => {
    onboardingData.update((data) => ({
      ...data,
      authProvider: provider,
    }));
  },

  setAuthenticated: (isAuth: boolean) => {
    onboardingData.update((data) => ({
      ...data,
      isAuthenticated: isAuth,
    }));
  },

  setAiProvider: (provider: string, apiKey?: string) => {
    onboardingData.update((data) => ({
      ...data,
      aiProvider: provider,
      aiProviderApiKey: apiKey,
    }));
  },

  toggleSelection: (
    category: keyof Pick<
      OnboardingData,
      | 'frontend'
      | 'backendLanguage'
      | 'backendFramework'
      | 'database'
      | 'cloud'
      | 'infrastructure'
      | 'gitProvider'
      | 'ide'
      | 'mobile'
      | 'styling'
    >,
    id: string
  ) => {
    onboardingData.update((data) => {
      const current = data[category];
      const updated = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      return { ...data, [category]: updated };
    });
  },

  setSelections: (
    category: keyof Pick<
      OnboardingData,
      | 'frontend'
      | 'backendLanguage'
      | 'backendFramework'
      | 'database'
      | 'cloud'
      | 'infrastructure'
      | 'gitProvider'
      | 'ide'
      | 'mobile'
      | 'styling'
    >,
    ids: string[]
  ) => {
    onboardingData.update((data) => ({
      ...data,
      [category]: ids,
    }));
  },

  setTheme: (theme: AppTheme) => {
    onboardingData.update((data) => ({
      ...data,
      theme,
    }));
  },

  setTelemetry: (optIn: boolean) => {
    onboardingData.update((data) => ({
      ...data,
      telemetryOptIn: optIn,
    }));
  },

  // Completion
  complete: () => {
    onboardingData.update((data) => ({
      ...data,
      isComplete: true,
      completedSteps: [...STEP_ORDER],
    }));
  },

  skip: () => {
    onboardingData.update((data) => ({
      ...data,
      skipped: true,
    }));
  },

  // Reset (for testing/dev)
  reset: () => {
    onboardingData.set(DEFAULT_ONBOARDING_DATA);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to remove onboarding data:', e);
    }
  },

  // Check if onboarding has been seen (for backwards compatibility)
  isOnboardingSeenOnDevice: (): boolean => {
    const data = get(onboardingData);
    return data.isComplete || data.skipped;
  },
};

export default newOnboardingStore;
