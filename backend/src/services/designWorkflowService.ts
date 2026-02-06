/**
 * Design Workflow Service
 * Handles inline Architecture → PRD → Plan → Code workflow in chat
 */

import logger from "../middleware/logger.js";
import { generateArchitecture } from "./architectureService.js";
import { generatePRD } from "./prdGeneratorService.js";
import { getHeadSystemPrompt } from "../prompts/head.js";
import { getChatModePrompt } from "../prompts/chat/index.js";
import type { SystemArchitecture } from "../types/architecture.js";
import type { PRD } from "../types/prd.js";

const ISO_NOW = (): string => new Date().toISOString();

export type DesignPhase = 'architecture' | 'prd' | 'plan' | 'code' | 'completed';

export interface ArchitectureResult {
  mermaidCode: string;
  description: string;
  architecture?: SystemArchitecture;
}

export interface PRDResult {
  content: string;
  summary: string;
  prd?: PRD;
}

export interface PlanResult {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in-progress' | 'completed';
  }>;
}

export interface CodeResult {
  files: Array<{
    path: string;
    content: string;
    language: string;
  }>;
}

export interface PhaseData {
  architecture?: ArchitectureResult;
  prd?: PRDResult;
  plan?: PlanResult;
  code?: CodeResult;
}

export interface DesignWorkflowState {
  currentPhase: DesignPhase;
  phaseData: PhaseData;
  userApprovals: Record<DesignPhase, boolean>;
  isActive: boolean;
  projectDescription?: string;
}

/**
 * Generate architecture diagram for chat workflow
 */
export async function generateArchitectureForChat(
  projectDescription: string,
  existingProject: boolean = false,
  systemPromptPrefix?: string
): Promise<ArchitectureResult> {
  const log = logger.child({ component: "DesignWorkflowService", phase: "architecture" });
  
  log.info({ existingProject }, "Generating architecture");

  try {
    // If existing project, provide summary instead of full architecture
    if (existingProject) {
      return {
        mermaidCode: "",
        description: `I'll work with your existing project. Let me understand what you have and what you'd like to add or modify. Could you tell me more about the current state and what changes you're looking to make?`,
      };
    }

    const headPrompt = getHeadSystemPrompt();
    const designModePrompt = getChatModePrompt("design");
    const prefix = systemPromptPrefix || `${headPrompt}\n\n${designModePrompt}`;

    // Generate architecture
    const archResponse = await generateArchitecture({
      projectDescription,
      projectType: "general",
      systemPromptPrefix: prefix,
    });

    if (archResponse.status === "error" || !archResponse.architecture) {
      throw new Error(archResponse.error || "Architecture generation failed");
    }

    const architecture = archResponse.architecture;
    
    // Generate Mermaid diagram from architecture
    const mermaidCode = generateMermaidFromArchitecture(architecture);
    const description = generateArchitectureDescription(architecture);

    log.info("Architecture generated successfully");

    return {
      mermaidCode,
      description,
      architecture,
    };
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, "Architecture generation failed");
    throw err;
  }
}

/**
 * Generate PRD for chat workflow
 */
export async function generatePRDForChat(
  projectDescription: string,
  architecture: ArchitectureResult
): Promise<PRDResult> {
  const log = logger.child({ component: "DesignWorkflowService", phase: "prd" });
  
  log.info("Generating PRD");

  try {
    if (!architecture.architecture) {
      throw new Error("Architecture required for PRD generation");
    }

    const prdResponse = await generatePRD(
      {
        architectureId: architecture.architecture.id,
        projectName: architecture.architecture.projectName,
        projectDescription,
      },
      architecture.architecture
    );

    if (prdResponse.status === "error" || !prdResponse.prd) {
      throw new Error(prdResponse.error || "PRD generation failed");
    }

    const prd = prdResponse.prd;
    const summary = generatePRDSummary(prd);

    log.info("PRD generated successfully");

    return {
      content: JSON.stringify(prd, null, 2),
      summary,
      prd,
    };
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, "PRD generation failed");
    throw err;
  }
}

/**
 * Generate implementation plan for chat workflow
 */
export async function generatePlanForChat(
  projectDescription: string,
  prd: PRDResult
): Promise<PlanResult> {
  const log = logger.child({ component: "DesignWorkflowService", phase: "plan" });
  
  log.info("Generating implementation plan");

  try {
    // Generate plan from PRD sections
    const tasks: PlanResult['tasks'] = [];
    
    if (prd.prd?.sections?.features) {
      prd.prd.sections.features.forEach((feature, index) => {
        tasks.push({
          id: `task-${index + 1}`,
          title: feature.name || `Feature ${index + 1}`,
          description: feature.description || '',
          status: 'pending',
        });
      });
    }

    // Add tasks for user stories
    if (prd.prd?.sections?.userStories) {
      prd.prd.sections.userStories.forEach((story, index) => {
        tasks.push({
          id: `story-${index + 1}`,
          title: story.title || `User Story ${index + 1}`,
          description: story.description || '',
          status: 'pending',
        });
      });
    }

    log.info({ taskCount: tasks.length }, "Implementation plan generated");

    return {
      tasks,
    };
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, "Plan generation failed");
    throw err;
  }
}

/**
 * Generate code for chat workflow
 */
export async function generateCodeForChat(
  projectDescription: string,
  plan: PlanResult
): Promise<CodeResult> {
  const log = logger.child({ component: "DesignWorkflowService", phase: "code" });
  
  log.info("Generating code");

  try {
    // This would integrate with your code generation service
    // For now, return placeholder structure
    const files: CodeResult['files'] = [
      {
        path: 'README.md',
        content: `# Generated Project\n\n${projectDescription}`,
        language: 'markdown',
      },
    ];

    log.info({ fileCount: files.length }, "Code generated");

    return {
      files,
    };
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, "Code generation failed");
    throw err;
  }
}

/**
 * Handle design phase iteration based on user feedback
 */
export async function iteratePhase(
  phase: Exclude<DesignPhase, 'completed'>,
  currentData: PhaseData[typeof phase],
  feedback: string,
  projectDescription: string
): Promise<PhaseData[typeof phase]> {
  const log = logger.child({ component: "DesignWorkflowService", phase, action: "iterate" });
  
  log.info({ feedback }, "Iterating phase");

  // In a real implementation, this would call the AI again with the feedback
  // For now, we'll just log it and return the current data
  // The actual iteration would be handled by the chat system with appropriate prompts
  
  return currentData;
}

// Helper functions

function generateMermaidFromArchitecture(arch: SystemArchitecture): string {
  // Generate a flowchart diagram from architecture metadata
  const components = arch.metadata?.components || [];
  const integrations = arch.metadata?.integrations || [];
  
  let mermaid = "flowchart TD\n";
  
  // Add components as nodes
  components.forEach((comp, index) => {
    mermaid += `  C${index}["${comp}"]\n`;
  });
  
  // Add integrations as connections
  integrations.forEach((integ, index) => {
    if (index < components.length - 1) {
      mermaid += `  C${index} --> C${index + 1}\n`;
    }
  });
  
  return mermaid;
}

function generateArchitectureDescription(arch: SystemArchitecture): string {
  const parts = [
    `**Project:** ${arch.projectName}`,
    `**Type:** ${arch.projectType}`,
    `**Complexity:** ${arch.complexity}`,
  ];
  
  if (arch.techStack?.length) {
    parts.push(`**Tech Stack:** ${arch.techStack.join(', ')}`);
  }
  
  if (arch.metadata?.components?.length) {
    parts.push(`**Components:** ${arch.metadata.components.join(', ')}`);
  }
  
  return parts.join('\n');
}

function generatePRDSummary(prd: PRD): string {
  const parts = [
    `**Version:** ${prd.version}`,
    `**Features:** ${prd.sections?.features?.length || 0}`,
    `**User Stories:** ${prd.sections?.userStories?.length || 0}`,
  ];
  
  if (prd.sections?.overview?.vision) {
    parts.push(`**Vision:** ${prd.sections.overview.vision.substring(0, 100)}...`);
  }
  
  return parts.join('\n');
}
