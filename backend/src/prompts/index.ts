// Prompt Router
// Routes to appropriate prompt based on mode and preferences

import { getMermaidBuilderPrompt, type BuilderPreferences } from './mermaid-builder.js';
import { getVibeCoderPrompt, type VibeCoderPreferences } from './vibe-coder.js';
import type { C4Level } from './shared/c4-examples.js';

export type PromptMode = 'standard' | 'builder' | 'vibe';

export interface UserPreferences {
  diagramType?: string;
  complexity?: 'simple' | 'detailed' | 'mvp' | 'standard' | 'enterprise' | string;
  promptMode?: PromptMode;
  c4Level?: C4Level;
  focusAreas?: string[];
  domain?: 'devops' | 'data' | 'business' | 'general';
  // Vibe coder specific
  projectType?: 'web' | 'mobile' | 'api' | 'fullstack' | 'general';
  techStack?: string[];
  currentPhase?: 'intent' | 'architecture' | 'coding';
  currentSection?: string;
}

// Original BASE_SYSTEM_PROMPT for backward compatibility
const STANDARD_SYSTEM_PROMPT = `You are a Mermaid.js expert and software architect. Your task is to convert natural language descriptions into valid Mermaid diagram code.

Supported diagram types:
- flowchart (flowchart TD/LR/BT/RL)
- sequence (sequenceDiagram)
- class (classDiagram)
- entity-relationship (erDiagram)
- state (stateDiagram-v2)
- gantt (gantt)

Rules:
1. Analyze the user's description and determine the most appropriate diagram type
2. Return ONLY the Mermaid code inside a single code block with \`\`\`mermaid
3. Ensure the syntax is valid and will render correctly
4. Use clear, readable node names and labels
5. Do not include any explanatory text outside the code block
6. If the request is ambiguous, default to a flowchart

Example output format:
\`\`\`mermaid
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\``;

function getStandardPrompt(preferences?: UserPreferences): string {
  let prompt = STANDARD_SYSTEM_PROMPT;
  
  if (preferences?.diagramType) {
    const typeMap: Record<string, string> = {
      'flowchart': 'flowchart',
      'sequence': 'sequence diagram',
      'erd': 'entity-relationship diagram',
      'class': 'class diagram'
    };
    const typeName = typeMap[preferences.diagramType] || preferences.diagramType;
    prompt += `\n\nUser preference: Default to ${typeName} diagrams unless another type is clearly more appropriate for the request.`;
  }
  
  if (preferences?.complexity === 'simple') {
    prompt += `\nKeep diagrams minimal and focused - use only essential nodes and relationships.`;
  } else if (preferences?.complexity === 'detailed') {
    prompt += `\nProvide comprehensive diagrams with detailed labels, notes, and thorough node relationships.`;
  }
  
  return prompt;
}

/**
 * Main prompt router - selects appropriate prompt based on mode
 * @param preferences User preferences including prompt mode
 * @returns The system prompt string for Claude
 */
export function getSystemPrompt(preferences?: UserPreferences): string {
  const mode = preferences?.promptMode ?? 'vibe'; // Default to vibe coder mode

  if (mode === 'standard') {
    return getStandardPrompt(preferences);
  }

  if (mode === 'builder') {
    // Builder mode - use enhanced Mermaid builder prompt
    const builderPrefs: BuilderPreferences = {
      diagramType: preferences?.diagramType,
      complexity: preferences?.complexity as 'simple' | 'detailed' | undefined,
      c4Level: preferences?.c4Level,
      focusAreas: preferences?.focusAreas,
      domain: preferences?.domain,
    };
    return getMermaidBuilderPrompt(builderPrefs);
  }

  // Vibe mode - use vibe coder prompt (default)
  const vibePrefs: VibeCoderPreferences = {
    projectType: preferences?.projectType,
    techStack: preferences?.techStack,
    complexity: preferences?.complexity as 'mvp' | 'standard' | 'enterprise' | undefined,
    currentPhase: preferences?.currentPhase,
    currentSection: preferences?.currentSection,
  };

  return getVibeCoderPrompt(vibePrefs);
}

/**
 * Get prompt for a specific mode without preferences
 */
export function getPromptByMode(mode: PromptMode): string {
  if (mode === 'standard') {
    return STANDARD_SYSTEM_PROMPT;
  }
  if (mode === 'builder') {
    return getMermaidBuilderPrompt();
  }
  return getVibeCoderPrompt();
}

// Re-export types and constants
export { STANDARD_SYSTEM_PROMPT };
export type { BuilderPreferences } from './mermaid-builder.js';
export type { VibeCoderPreferences } from './vibe-coder.js';
export type { C4Level } from './shared/c4-examples.js';
