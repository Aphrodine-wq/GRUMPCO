/**
 * Tech Stack Icon Mappings
 *
 * Maps technology IDs to Lucide icon component names.
 * Import these icons from 'lucide-svelte' and use the getTechIcon function
 * to get the appropriate icon component for each technology.
 */

import type { ComponentType } from 'svelte';
import {
  // Frontend frameworks
  Atom,
  Triangle,
  Hexagon,
  Flame,
  Component,
  Zap,
  Disc,
  RefreshCw,
  FileCode,
  X,
  // Backend languages
  FileType,
  Square,
  Binary,
  Coffee,
  Circle,
  Gem,
  Droplet,
  // Backend frameworks
  Train,
  Cat,
  Grape,
  Leaf,
  Layers,
  // Databases
  Database,
  HardDrive,
  // Cloud providers
  Cloud,
  Globe,
  Plane,
  Palette,
  Waves,
  Heart,
  Home,
  // Infrastructure
  Container,
  Box,
  GitBranch,
  CircleDot,
  Wrench,
  // Git providers
  Github,
  Gitlab,
  // IDEs
  Code2,
  MousePointer,
  Sailboat,
  Brain,
  Terminal,
  Edit3,
  // Mobile
  Smartphone,
  Bird,
  Apple,
  Bot,
  PlugZap,
  // Styling
  Wind,
  Blocks,
  Sparkles,
  Type,
  Paintbrush,
  // AI Providers
  Moon,
  Cpu,
  Split,
  MessagesSquare,
  Handshake,
  // General/fallback
  Package,
  Settings,
  FileText,
  File,
  Folder,
  Search,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Lock,
  Unlock,
  Rocket,
  Target,
  Mic,
  Users,
  Check,
  Clock,
  DollarSign,
  BarChart2,
  Clipboard,
  Trash2,
  Save,
  FolderOpen,
  Keyboard,
  MessageSquare,
  Layout,
  PenTool,
  Cog,
  Plug,
  BookOpen,
} from 'lucide-svelte';

// Type for icon mapping
export type IconName = string;

/**
 * Frontend framework icon mappings
 */
export const FRONTEND_ICONS: Record<string, ComponentType> = {
  react: Atom,
  nextjs: Triangle,
  vue: Hexagon,
  nuxt: Hexagon,
  svelte: Flame,
  sveltekit: Flame,
  angular: Component,
  solid: Gem,
  astro: Rocket,
  qwik: Zap,
  remix: Disc,
  htmx: RefreshCw,
  vanilla: FileCode,
  none: X,
};

/**
 * Backend language icon mappings
 */
export const BACKEND_LANGUAGE_ICONS: Record<string, ComponentType> = {
  typescript: FileType,
  javascript: Square,
  python: Binary,
  go: Box,
  rust: Cog,
  java: Coffee,
  kotlin: Circle,
  csharp: Circle,
  ruby: Gem,
  php: Code2,
  elixir: Droplet,
  none: X,
};

/**
 * Backend framework icon mappings
 */
export const BACKEND_FRAMEWORK_ICONS: Record<string, ComponentType> = {
  express: Train,
  fastify: Zap,
  nestjs: Cat,
  hono: Flame,
  fastapi: Binary,
  django: Layers,
  flask: Grape,
  gin: Grape,
  fiber: Wind,
  actix: Cog,
  axum: Cog,
  spring: Leaf,
  rails: Train,
  laravel: Triangle,
  phoenix: Flame,
  none: X,
};

/**
 * Database icon mappings
 */
export const DATABASE_ICONS: Record<string, ComponentType> = {
  postgresql: Database,
  mysql: Database,
  mongodb: Leaf,
  sqlite: Package,
  redis: Circle,
  supabase: Zap,
  firebase: Flame,
  planetscale: Globe,
  neon: Hexagon,
  turso: HardDrive,
  dynamodb: BarChart2,
  cockroachdb: Database,
  none: X,
};

/**
 * Cloud provider icon mappings
 */
export const CLOUD_ICONS: Record<string, ComponentType> = {
  vercel: Triangle,
  netlify: Globe,
  railway: Train,
  render: Palette,
  fly: Plane,
  aws: Cloud,
  gcp: Cloud,
  azure: Cloud,
  digitalocean: Waves,
  cloudflare: Cloud,
  heroku: Heart,
  'self-hosted': Home,
};

/**
 * Infrastructure icon mappings
 */
export const INFRASTRUCTURE_ICONS: Record<string, ComponentType> = {
  docker: Container,
  kubernetes: Box,
  terraform: Layers,
  pulumi: Globe,
  'github-actions': RefreshCw,
  'gitlab-ci': Gitlab,
  jenkins: Wrench,
  circleci: CircleDot,
  serverless: Zap,
  none: X,
};

/**
 * Git provider icon mappings
 */
export const GIT_PROVIDER_ICONS: Record<string, ComponentType> = {
  // Git providers
  github: Github,
  gitlab: Gitlab,
  bitbucket: Package, // Fallback to Package as Bucket is missing
  'azure-devops': Cloud,
  other: Package,
};

/**
 * IDE icon mappings
 */
export const IDE_ICONS: Record<string, ComponentType> = {
  vscode: Code2,
  cursor: MousePointer,
  windsurf: Sailboat,
  webstorm: Globe,
  intellij: Brain,
  pycharm: Binary,
  vim: Terminal,
  emacs: Edit3,
  zed: Zap,
  sublime: Type,
  other: Edit3,
};

/**
 * Mobile development icon mappings
 */
export const MOBILE_ICONS: Record<string, ComponentType> = {
  'react-native': Atom,
  expo: Smartphone,
  flutter: Bird,
  swift: Apple,
  'kotlin-android': Bot,
  ionic: Heart,
  capacitor: PlugZap,
  tauri: Cog,
  electron: Zap,
  none: X,
};

/**
 * Styling icon mappings
 */
export const STYLING_ICONS: Record<string, ComponentType> = {
  tailwind: Wind,
  'css-modules': Package,
  'styled-components': Sparkles,
  emotion: Sparkles,
  sass: Paintbrush,
  'vanilla-css': File,
  panda: Box,
  uno: Target,
  shadcn: Palette,
  chakra: Zap,
  mantine: Hexagon,
  mui: Palette,
};

/**
 * AI Provider icon mappings
 */
export const AI_PROVIDER_ICONS: Record<string, ComponentType> = {
  kimi: Moon,
  'nvidia-nim': Cpu,
  openrouter: Split,
  anthropic: Brain,
  openai: Bot,
  groq: Zap,
  ollama: Box,
};

/**
 * Tool call icon mappings (for GAgentLiveOutput)
 */
export const TOOL_ICONS: Record<string, ComponentType> = {
  read_file: FileText,
  write_file: PenTool,
  edit_file: Edit3,
  create_file: File,
  delete_file: Trash2,
  list_directory: Folder,
  search_files: Search,
  bash: Terminal,
  terminal: Terminal,
  git: GitBranch,
  npm: Package,
  docker: Container,
  browser: Globe,
  api_call: Plug,
  database: Database,
  test: CheckCircle,
  default: Zap,
};

/**
 * Agent type icon mappings (for WorkflowPhaseBar)
 */
export const AGENT_ICONS: Record<string, ComponentType> = {
  architect: Layers,
  frontend: Palette,
  backend: Cog,
  devops: Rocket,
  test: CheckCircle,
  docs: BookOpen,
  default: Wrench,
};

/**
 * Command palette icon mappings
 */
export const COMMAND_ICONS: Record<string, ComponentType> = {
  // Modes
  argument: MessageSquare,
  plan: Clipboard,
  spec: FileText,
  ship: Rocket,
  design: Palette,
  code: Code2,
  // Build
  freeAgent: Bot,
  designToCode: Layout,
  // Tools
  voiceCode: Mic,
  talkMode: MessagesSquare,
  askDocs: BookOpen,
  skills: Blocks,
  // AI
  swarm: Users,
  memory: Brain,
  approvals: Check,
  heartbeats: Clock,
  // Infra
  dockerView: Container,
  dockerSetup: Cog,
  cloudView: Cloud,
  integrations: Plug,
  // Manage
  cost: DollarSign,
  auditLog: Clipboard,
  advancedAI: Brain,
  // Settings
  settings: Settings,
  modelBenchmark: BarChart2,
  troubleshooting: Wrench,
  reset: RefreshCw,
  // Actions
  clearChat: Trash2,
  saveSession: Save,
  loadSession: FolderOpen,
  focusInput: Keyboard,
};

/**
 * Status icon mappings (for budget/config stores)
 */
export const STATUS_ICONS: Record<string, ComponentType> = {
  ok: CheckCircle,
  warning: AlertTriangle,
  critical: AlertCircle,
  exceeded: XCircle,
  unknown: HelpCircle,
};

/**
 * Autonomy level icon mappings
 */
export const AUTONOMY_ICONS: Record<string, ComponentType> = {
  supervised: Lock,
  'semi-autonomous': Unlock,
  autonomous: Bot,
  'full-autonomous': Zap,
  unknown: HelpCircle,
};

/**
 * Get a tech icon component by category and id
 */
export function getTechIcon(category: string, id: string): ComponentType {
  const iconMaps: Record<string, Record<string, ComponentType>> = {
    frontend: FRONTEND_ICONS,
    backendLanguage: BACKEND_LANGUAGE_ICONS,
    backendFramework: BACKEND_FRAMEWORK_ICONS,
    database: DATABASE_ICONS,
    cloud: CLOUD_ICONS,
    infrastructure: INFRASTRUCTURE_ICONS,
    gitProvider: GIT_PROVIDER_ICONS,
    ide: IDE_ICONS,
    mobile: MOBILE_ICONS,
    styling: STYLING_ICONS,
    aiProvider: AI_PROVIDER_ICONS,
  };

  const categoryMap = iconMaps[category];
  if (categoryMap && categoryMap[id]) {
    return categoryMap[id];
  }

  return Package; // fallback
}

/**
 * Get a tool icon component by tool name
 */
export function getToolIconComponent(toolName: string): ComponentType {
  const lowerName = toolName.toLowerCase();
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (lowerName.includes(key)) return icon;
  }
  return TOOL_ICONS.default;
}

/**
 * Get an agent icon component by agent type
 */
export function getAgentIconComponent(agentType: string): ComponentType {
  return AGENT_ICONS[agentType] || AGENT_ICONS.default;
}

/**
 * Get a status icon component
 */
export function getStatusIconComponent(status: string): ComponentType {
  return STATUS_ICONS[status] || STATUS_ICONS.unknown;
}

/**
 * Get an autonomy icon component
 */
export function getAutonomyIconComponent(level: string): ComponentType {
  return AUTONOMY_ICONS[level] || AUTONOMY_ICONS.unknown;
}

/**
 * Get a command icon component by command id
 */
export function getCommandIconComponent(commandId: string): ComponentType {
  // Try to match the command id to an icon
  for (const [key, icon] of Object.entries(COMMAND_ICONS)) {
    if (commandId.toLowerCase().includes(key.toLowerCase())) {
      return icon;
    }
  }
  return Settings; // fallback
}
