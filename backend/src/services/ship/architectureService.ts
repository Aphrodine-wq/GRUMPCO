/**
 * Architecture Service
 * Generates system architectures and C4 diagrams using LLM Gateway
 */

import { getRequestLogger, default as logger } from "../../middleware/logger.js";
import { createApiTimer } from "../../middleware/metrics.js";
import { getArchitectPrompt } from "../../prompts/architect.js";
import { analyzeProjectIntent } from "../intent/intentParser.js";
import type {
  ArchitectureRequest,
  SystemArchitecture,
  ArchitectureResponse,
} from "../../types/architecture.js";
import type { ConversationMessage } from "../../types/index.js";
import type { EnrichedIntent } from "../intent/intentCompilerService.js";
import { withCache } from "../caching/cacheService.js";
import { getIntentGuidedRagContext } from "../rag/ragService.js";
import { getStream, type StreamParams } from "../ai-providers/llmGateway.js";

const DEFAULT_MODEL = "moonshotai/kimi-k2.5";
const ARCHITECTURE_TIMEOUT_MS = 120000; // 2 minute timeout

/**
 * Custom error types for architecture generation
 */
export class ArchitectureError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ArchitectureError";
  }
}

export class LLMResponseError extends ArchitectureError {
  constructor(
    message: string,
    public readonly responseText?: string,
  ) {
    super(message);
    this.name = "LLMResponseError";
  }
}

export class TimeoutError extends ArchitectureError {
  constructor(timeoutMs: number) {
    super(`Architecture generation timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs),
    ),
  ]);
}

/**
 * Generate system architecture from project description
 */
async function _generateArchitecture(
  request: ArchitectureRequest,
  conversationHistory?: ConversationMessage[],
  enrichedIntent?: EnrichedIntent,
): Promise<SystemArchitecture> {
  const log = getRequestLogger();
  const timer = createApiTimer("generate_architecture");

  try {
    const projectDescription =
      enrichedIntent?.raw ?? request.projectDescription;
    const techStack =
      request.techStack ??
      enrichedIntent?.enriched?.tech_stack ??
      enrichedIntent?.tech_stack_hints ??
      (enrichedIntent ? [] : undefined);
    const intent = enrichedIntent
      ? {
        projectType: (request.projectType as "general") ?? "general",
        techStack: techStack ?? [],
        features:
          enrichedIntent.enriched?.features ?? enrichedIntent.features ?? [],
      }
      : analyzeProjectIntent(request.projectDescription);

    log.info(
      {
        projectType: intent.projectType,
        techStack: intent.techStack,
        features: intent.features,
      },
      "Building architecture",
    );

    const basePrompt = getArchitectPrompt({
      projectType: request.projectType || intent.projectType || "general",
      complexity:
        request.complexity || intent.features.length > 5 ? "standard" : "mvp",
      techStack: (request.techStack ||
        techStack ||
        intent.techStack) as string[],
    });
    let systemPrompt = request.systemPromptPrefix
      ? `${request.systemPromptPrefix}\n\n${basePrompt}`
      : basePrompt;
    if (request.namespace) {
      try {
        const ragResult = await getIntentGuidedRagContext(projectDescription, {
          namespace: request.namespace,
          maxChunks: 6,
        });
        if (ragResult?.context)
          systemPrompt += `\n\nRelevant context from knowledge base:\n\n${ragResult.context}`;
      } catch {
        // RAG optional
      }
    }

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    let userMessage = projectDescription;
    if (enrichedIntent) {
      userMessage += "\n\nExtracted intent:";
      const e = enrichedIntent.enriched;
      if (e?.features?.length)
        userMessage += `\n- Features: ${e.features.join(", ")}`;
      else if (enrichedIntent.features?.length)
        userMessage += `\n- Features: ${enrichedIntent.features.join(", ")}`;
      if (e?.users?.length) userMessage += `\n- Users: ${e.users.join(", ")}`;
      if (e?.data_flows?.length)
        userMessage += `\n- Data flows: ${e.data_flows.join(", ")}`;
      if (e?.tech_stack?.length)
        userMessage += `\n- Tech stack: ${e.tech_stack.join(", ")}`;
      else if (enrichedIntent.tech_stack_hints?.length)
        userMessage += `\n- Tech hints: ${enrichedIntent.tech_stack_hints.join(", ")}`;
    }
    if (request.refinements && request.refinements.length > 0) {
      userMessage += `\n\nRefinements requested:\n${request.refinements.map((r) => `- ${r}`).join("\n")}`;
    }

    messages.push({
      role: "user",
      content: userMessage,
    });

    log.info(
      {
        messageCount: messages.length,
        projectType: request.projectType,
        hasEnrichedIntent: !!enrichedIntent,
        provider: "nim",
        model: DEFAULT_MODEL,
        maxTokens: 4096,
      },
      "🚀 Starting AI architecture generation",
    );

    const startTime = Date.now();

    // Call LLM Gateway via streaming and collect full response
    const params: StreamParams = {
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    };

    // Wrap stream collection with timeout and progress tracking
    const streamCollectionPromise = (async () => {
      const stream = getStream(params, {
        provider: "nim",
        modelId: DEFAULT_MODEL,
      });
      let fullText = "";
      let chunkCount = 0;
      let lastLogTime = Date.now();

      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          fullText += chunk.delta.text;
          chunkCount++;

          // Log progress every 50 chunks or every 5 seconds
          const now = Date.now();
          if (chunkCount % 50 === 0 || now - lastLogTime > 5000) {
            log.info(
              {
                chunksReceived: chunkCount,
                textLength: fullText.length,
                elapsedMs: now - startTime,
              },
              "📝 Receiving AI response...",
            );
            lastLogTime = now;
          }
        }
      }

      log.info(
        {
          totalChunks: chunkCount,
          totalLength: fullText.length,
          elapsedMs: Date.now() - startTime,
        },
        "✅ AI response complete",
      );

      return fullText;
    })();

    let fullText: string;
    try {
      fullText = await withTimeout(
        streamCollectionPromise,
        ARCHITECTURE_TIMEOUT_MS,
        "architecture stream",
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        log.error(
          {
            timeoutMs: ARCHITECTURE_TIMEOUT_MS,
            elapsedMs: Date.now() - startTime,
          },
          "⏱️ Architecture generation timed out",
        );
        throw error;
      }
      log.error(
        { error: (error as Error).message, elapsedMs: Date.now() - startTime },
        "❌ Architecture generation failed",
      );
      throw new ArchitectureError(
        "Failed to generate architecture from LLM",
        error as Error,
      );
    }

    // Extract JSON from response
    log.info("🔍 Extracting JSON from AI response...");
    let jsonText = fullText.trim();

    // Remove markdown code blocks if present
    if (jsonText.includes("```json")) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) {
        jsonText = match[1].trim();
        log.info("📄 Found JSON in ```json block");
      }
    } else if (jsonText.includes("```")) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) {
        jsonText = match[1].trim();
        log.info("📄 Found JSON in ``` block");
      }
    }

    // Try to find JSON object if text contains other content
    if (!jsonText.startsWith("{")) {
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
        log.info("📄 Extracted JSON object from text");
      }
    }

    // Parse JSON with better error handling
    log.info("🔄 Parsing JSON structure...");
    let architectureData: unknown;
    try {
      architectureData = JSON.parse(jsonText);
    } catch (e) {
      log.error(
        {
          error: String(e),
          jsonText: jsonText.substring(0, 500),
          fullText: fullText.substring(0, 500),
        },
        "❌ Failed to parse architecture JSON",
      );
      throw new LLMResponseError(
        `Failed to parse architecture from LLM response: ${(e as Error).message}`,
        fullText.substring(0, 1000),
      );
    }

    // Validate parsed data is an object
    if (!architectureData || typeof architectureData !== "object") {
      throw new LLMResponseError(
        "LLM response is not a valid object",
        jsonText.substring(0, 1000),
      );
    }

    // Cast to expected type for property access
    const data = architectureData as Record<string, unknown>;

    // Validate and construct SystemArchitecture
    log.info(
      {
        projectName: data.projectName,
        hasTechStack: !!data.techStack,
        hasC4Diagrams: !!data.c4Diagrams,
        hasMetadata: !!data.metadata,
      },
      "🏗️ Building architecture object...",
    );

    const projectType = (data.projectType as string) || "general";
    const complexity = (data.complexity as string) || "standard";

    const architecture: SystemArchitecture = {
      id: `arch_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      projectName: (data.projectName as string) || "Unnamed Project",
      projectDescription:
        (data.projectDescription as string) || request.projectDescription,
      projectType: ([
        "web",
        "mobile",
        "api",
        "fullstack",
        "saas",
        "general",
      ].includes(projectType)
        ? projectType
        : "general") as SystemArchitecture["projectType"],
      complexity: (["mvp", "standard", "enterprise"].includes(complexity)
        ? complexity
        : "standard") as SystemArchitecture["complexity"],
      techStack: (data.techStack as string[]) || [],
      c4Diagrams: {
        context: (data.c4Diagrams as Record<string, string>)?.context || "",
        container: (data.c4Diagrams as Record<string, string>)?.container || "",
        component: (data.c4Diagrams as Record<string, string>)?.component || "",
      },
      metadata: (data.metadata as SystemArchitecture["metadata"]) || {
        components: [],
        integrations: [],
        dataModels: [],
        apiEndpoints: [],
        technologies: {},
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const totalTime = Date.now() - startTime;
    log.info(
      {
        architectureId: architecture.id,
        components: architecture.metadata.components.length,
        techStackCount: architecture.techStack.length,
        hasDiagrams: !!(
          architecture.c4Diagrams.context || architecture.c4Diagrams.container
        ),
        totalTimeMs: totalTime,
      },
      "✅ Architecture generated successfully",
    );

    timer.success();
    return architecture;
  } catch (error) {
    timer.success();
    const err = error as Error;
    log.error(
      { error: err.message, stack: err.stack },
      "Architecture generation failed",
    );
    throw error;
  }
}

/**
 * Public API with error handling
 */
export async function generateArchitecture(
  request: ArchitectureRequest,
  conversationHistory?: ConversationMessage[],
  enrichedIntent?: EnrichedIntent,
): Promise<ArchitectureResponse> {
  try {
    // Create cache key from request
    const cacheKey = JSON.stringify({
      projectDescription: enrichedIntent?.raw ?? request.projectDescription,
      projectType: request.projectType,
      techStack: request.techStack,
      complexity: request.complexity,
      refinements: request.refinements,
    });

    const architecture = await withCache("architecture", cacheKey, async () => {
      return await _generateArchitecture(
        request,
        conversationHistory,
        enrichedIntent,
      );
    });

    return {
      id: architecture.id,
      status: "complete",
      architecture,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, "Architecture generation error");
    return {
      id: `err_${Date.now()}`,
      status: "error",
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Generate architecture with streaming (returns async iterator)
 */
export async function* generateArchitectureStream(
  request: ArchitectureRequest,
  conversationHistory?: ConversationMessage[],
  enrichedIntent?: EnrichedIntent,
): AsyncGenerator<string> {
  const log = getRequestLogger();

  try {
    const projectDescription =
      enrichedIntent?.raw ?? request.projectDescription;
    const techStack =
      request.techStack ??
      enrichedIntent?.enriched?.tech_stack ??
      enrichedIntent?.tech_stack_hints ??
      undefined;
    const intent = enrichedIntent
      ? {
        projectType: (request.projectType as "general") ?? "general",
        techStack: (techStack ?? []) as string[],
        features:
          enrichedIntent.enriched?.features ?? enrichedIntent.features ?? [],
      }
      : analyzeProjectIntent(request.projectDescription);

    const basePrompt = getArchitectPrompt({
      projectType: request.projectType || intent.projectType || "general",
      complexity: request.complexity || "standard",
      techStack: (request.techStack ||
        techStack ||
        intent.techStack) as string[],
    });
    const systemPrompt = request.systemPromptPrefix
      ? `${request.systemPromptPrefix}\n\n${basePrompt}`
      : basePrompt;

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    let userMessage = projectDescription;
    if (enrichedIntent) {
      userMessage += "\n\nExtracted intent:";
      const e = enrichedIntent.enriched;
      if (e?.features?.length)
        userMessage += `\n- Features: ${e.features.join(", ")}`;
      else if (enrichedIntent.features?.length)
        userMessage += `\n- Features: ${enrichedIntent.features.join(", ")}`;
      if (e?.users?.length) userMessage += `\n- Users: ${e.users.join(", ")}`;
      if (e?.data_flows?.length)
        userMessage += `\n- Data flows: ${e.data_flows.join(", ")}`;
      if (e?.tech_stack?.length)
        userMessage += `\n- Tech stack: ${e.tech_stack.join(", ")}`;
      else if (enrichedIntent.tech_stack_hints?.length)
        userMessage += `\n- Tech hints: ${enrichedIntent.tech_stack_hints.join(", ")}`;
    }
    if (request.refinements && request.refinements.length > 0) {
      userMessage += `\n\nRefinements:\n${request.refinements.map((r) => `- ${r}`).join("\n")}`;
    }

    messages.push({
      role: "user",
      content: userMessage,
    });

    log.info({}, "Starting architecture stream");

    // Create streaming response via LLM Gateway
    const params: StreamParams = {
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    };

    const stream = getStream(params, {
      provider: "nim",
      modelId: DEFAULT_MODEL,
    });

    let buffer = "";
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        buffer += chunk.delta.text;
        yield `data: ${JSON.stringify({ type: "text", content: chunk.delta.text })}\n\n`;
      }
    }

    // Parse final JSON
    let jsonText = buffer;
    if (jsonText.includes("```json")) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) {
        jsonText = match[1];
      }
    } else if (jsonText.includes("```")) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) {
        jsonText = match[1];
      }
    }

    const architectureData = JSON.parse(jsonText);
    const architecture: SystemArchitecture = {
      id: `arch_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      projectName: architectureData.projectName || "Unnamed Project",
      projectDescription:
        architectureData.projectDescription ||
        (enrichedIntent?.raw ?? request.projectDescription),
      projectType: architectureData.projectType || "general",
      complexity: architectureData.complexity || "standard",
      techStack: architectureData.techStack || [],
      c4Diagrams: architectureData.c4Diagrams || {
        context: "",
        container: "",
        component: "",
      },
      metadata: architectureData.metadata || {
        components: [],
        integrations: [],
        dataModels: [],
        apiEndpoints: [],
        technologies: {},
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    yield `data: ${JSON.stringify({ type: "complete", architecture })}\n\n`;
    log.info(
      { architectureId: architecture.id },
      "Architecture stream completed",
    );
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, "Architecture streaming failed");
    yield `data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`;
  }
}
