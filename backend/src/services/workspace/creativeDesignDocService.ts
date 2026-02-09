/**
 * Creative Design Document (CDD) Service
 * Generates layout, UI/UX, key screens, and UX flows from project description and architecture
 */

import { getRequestLogger, default as _logger } from "../../middleware/logger.js";
import { createApiTimer } from "../../middleware/metrics.js";
import {
  getCreativeDesignDocPrompt,
  getCreativeDesignDocUserPrompt,
} from "../../prompts/creative-design-doc.js";
import type {
  CreativeDesignDoc,
  PRDOverviewForCDD,
} from "../../types/creativeDesignDoc.js";
import type { SystemArchitecture } from "../../types/architecture.js";
import { withResilience } from "../infra/resilience.js";
import { getCompletion } from "../ai-providers/llmGatewayHelper.js";

// Create resilient wrapper for LLM gateway calls
const resilientLlmCall = withResilience(
  async (params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  }) => {
    return await getCompletion(params);
  },
  "llm-cdd",
);

/**
 * Generate a Creative Design Document from project description, architecture, and optional PRD overview.
 */
export async function generateCreativeDesignDoc(
  projectDescription: string,
  architecture: SystemArchitecture,
  prdOverview?: PRDOverviewForCDD,
): Promise<CreativeDesignDoc> {
  const log = getRequestLogger();
  const timer = createApiTimer("generate_cdd");

  try {
    const architectureJson = JSON.stringify(architecture.metadata, null, 2);
    const systemPrompt = getCreativeDesignDocPrompt();
    const userPrompt = getCreativeDesignDocUserPrompt(
      projectDescription,
      architectureJson,
      prdOverview,
    );

    log.info({}, "Calling LLM API for Creative Design Document");

    const result = await resilientLlmCall({
      model: "claude-opus-4-5-20251101",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    if (result.error) {
      throw new Error(`LLM API error: ${result.error}`);
    }

    let jsonText = result.text.trim();
    if (jsonText.includes("```json")) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes("```")) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    }

    const data = JSON.parse(jsonText);

    const cdd: CreativeDesignDoc = {
      id:
        data.id ||
        `cdd_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      layout: {
        regions: Array.isArray(data.layout?.regions) ? data.layout.regions : [],
        breakpoints: Array.isArray(data.layout?.breakpoints)
          ? data.layout.breakpoints
          : [],
        gridDescription: data.layout?.gridDescription || "",
      },
      uiPrinciples: {
        visualHierarchy: Array.isArray(data.uiPrinciples?.visualHierarchy)
          ? data.uiPrinciples.visualHierarchy
          : [],
        spacing: Array.isArray(data.uiPrinciples?.spacing)
          ? data.uiPrinciples.spacing
          : [],
        typography: Array.isArray(data.uiPrinciples?.typography)
          ? data.uiPrinciples.typography
          : [],
        keyInteractions: Array.isArray(data.uiPrinciples?.keyInteractions)
          ? data.uiPrinciples.keyInteractions
          : [],
      },
      keyScreens: Array.isArray(data.keyScreens) ? data.keyScreens : [],
      uxFlows: Array.isArray(data.uxFlows) ? data.uxFlows : [],
      accessibilityNotes: Array.isArray(data.accessibilityNotes)
        ? data.accessibilityNotes
        : [],
      responsivenessNotes: Array.isArray(data.responsivenessNotes)
        ? data.responsivenessNotes
        : [],
      metadata: {
        createdAt: data.metadata?.createdAt || new Date().toISOString(),
        projectName: data.metadata?.projectName || architecture.projectName,
      },
    };

    timer.success();
    log.info({ cddId: cdd.id }, "Creative Design Document generated");
    return cdd;
  } catch (error) {
    timer.failure("cdd_error");
    log.error(
      { error: (error as Error).message },
      "Creative Design Document generation failed",
    );
    throw error;
  }
}
