// Screen types
export const SCREENS = {
  SPLASH: 'splash',
  AUTH: 'auth',
  SETUP: 'setup',
  RESUME: 'resume',
  MAIN: 'main'
} as const;

export type ScreenType = typeof SCREENS[keyof typeof SCREENS];

// User preferences
export interface UserPreferences {
  diagramType: 'flowchart' | 'sequence' | 'erd' | 'class';
  complexity: 'simple' | 'medium' | 'detailed';
}

// Message types
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  diagramCode?: string;
  timestamp?: number;
}

// Diagram version for tracking refinement history
export interface DiagramVersion {
  id: string;
  code: string;
  timestamp: number;
  userPrompt: string;
  parentVersionId?: string; // For tracking refinement lineage
}

// Refinement context for AI
export interface RefinementContext {
  baseDiagram?: string;
  refinementType?: 'modify' | 'convert' | 'expand' | 'simplify';
  instruction?: string;
}

// Session types
export interface Session {
  id: string;
  name: string;
  messages: Message[];
  timestamp: number;
  updatedAt: number;
  diagramVersions?: DiagramVersion[]; // Track diagram history
  currentDiagramId?: string; // Current active diagram version
}

// Legacy session type for migration
export interface LegacySession {
  messages: Message[];
  timestamp: number;
}

// App state types
export interface AppState {
  hasCompletedSetup: boolean;
  lastSession: Session | LegacySession | null;
  sessions?: Session[];
  currentSessionId?: string;
  apiKeyValid: boolean;
  preferences?: UserPreferences;
}

// Mermaid types
export interface MermaidRenderResult {
  svg: string;
}

export interface MermaidThemeVariables {
  primaryColor: string;
  primaryTextColor: string;
  primaryBorderColor: string;
  lineColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  background: string;
  mainBkg: string;
  nodeBorder: string;
  clusterBkg: string;
  titleColor: string;
  edgeLabelBackground: string;
  fontFamily: string;
}

export interface MermaidConfig {
  startOnLoad: boolean;
  theme: string;
  securityLevel: string;
  flowchart: {
    useMaxWidth: boolean;
    htmlLabels: boolean;
  };
  themeVariables: MermaidThemeVariables;
}

// API types
export interface DiagramRequest {
  prompt: string;
  apiKey: string;
  preferences?: UserPreferences;
}

export interface DiagramResponse {
  code: string;
  title?: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode?: number;
}
