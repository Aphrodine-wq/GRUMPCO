/**
 * Frontend Designer Skill
 * High-end Svelte 5 component generation using the G-Rump design system.
 * Uses Kimi K2.5 via LLM Gateway.
 */

import { Router } from "express";
import { BaseSkill } from "../base/BaseSkill.js";
import type {
  SkillManifest,
  SkillTools,
  SkillPrompts,
  SkillContext,
  SkillExecutionInput,
  SkillExecutionResult,
  SkillEvent,
  ToolExecutionResult,
} from "../types.js";
import { FRONTEND_DESIGNER_SYSTEM_PROMPT, templates } from "./prompts.js";
import { definitions } from "./tools.js";
import type {
  DesignType,
  DesignTier,
  DesignRequest,
  DesignResult,
  DesignReviewResult,
} from "./types.js";
import _logger from "../../middleware/logger.js";
import { withResilience } from "../../services/infra/resilience.js";

class FrontendDesignerSkill extends BaseSkill {
  manifest!: SkillManifest;

  prompts: SkillPrompts = {
    system: FRONTEND_DESIGNER_SYSTEM_PROMPT,
    templates,
  };

  tools: SkillTools = {
    definitions,
    handlers: {
      design_component: this.handleDesignComponent.bind(this),
      review_design: this.handleReviewDesign.bind(this),
      enhance_design: this.handleEnhanceDesign.bind(this),
    },
  };

  declare routes: Router;

  constructor() {
    super();
    this.routes = this.createRoutes();
  }

  private createRoutes(): Router {
    const router = Router();

    // Design a new component
    router.post("/design", async (req, res): Promise<void> => {
      try {
        const { description, designType, tier, responsive, animated, context } =
          req.body as DesignRequest & {
            responsive?: boolean;
            animated?: boolean;
          };

        if (!description) {
          res.status(400).json({ error: "description is required" });
          return;
        }

        const result = await this.designComponent({
          description,
          designType: designType || "component",
          tier: tier || "premium",
          responsive: responsive !== false,
          animated: animated !== false,
          context,
        });

        res.json(result);
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Design generation failed",
        });
      }
    });

    // Review an existing component
    router.post("/review", async (req, res): Promise<void> => {
      try {
        const { code } = req.body;

        if (!code) {
          res.status(400).json({ error: "code is required" });
          return;
        }

        const result = await this.reviewDesign(code);
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Design review failed",
        });
      }
    });

    // Enhance an existing component
    router.post("/enhance", async (req, res): Promise<void> => {
      try {
        const { code, focusAreas } = req.body;

        if (!code) {
          res.status(400).json({ error: "code is required" });
          return;
        }

        const result = await this.enhanceDesign(code, focusAreas);
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Design enhancement failed",
        });
      }
    });

    return router;
  }

  /**
   * Main streaming execution
   */
  async *execute(
    input: SkillExecutionInput,
    context: SkillContext,
  ): AsyncGenerator<SkillEvent, SkillExecutionResult, undefined> {
    const startTime = Date.now();

    yield {
      type: "started",
      skillId: this.manifest.id,
      timestamp: new Date(),
    };

    yield {
      type: "thinking",
      content:
        "Analyzing design request and mapping to G-Rump design system...",
    };

    try {
      const designType = this.detectDesignType(input.message);
      const tier = this.detectTier(input.message);

      yield {
        type: "progress",
        percent: 20,
        message: `Designing ${designType} at ${tier} tier...`,
      };

      // If files provided, read for enhancement
      let existingCode = "";
      if (input.files && input.files.length > 0) {
        const content = await this.readFile(context, input.files[0]);
        if (content) {
          existingCode = content;
          yield {
            type: "progress",
            percent: 30,
            message: `Loaded ${input.files[0]} for enhancement`,
          };
        }
      }

      let output: string;

      if (existingCode) {
        // Enhance existing component
        yield {
          type: "progress",
          percent: 50,
          message: "Enhancing component with design system tokens...",
        };
        const enhanced = await this.enhanceDesign(
          existingCode,
          undefined,
          context,
        );
        output = enhanced;
      } else {
        // Design new component
        yield {
          type: "progress",
          percent: 50,
          message: "Generating component with design system compliance...",
        };
        const result = await this.designComponent(
          {
            description: input.message,
            designType,
            tier,
            responsive: true,
            animated: true,
          },
          context,
        );
        output = this.formatDesignResult(result);
      }

      yield {
        type: "progress",
        percent: 90,
        message: "Finalizing design output...",
      };

      yield { type: "output", content: output };

      yield {
        type: "completed",
        summary: `Generated ${designType} component (${tier} tier)`,
        duration: Date.now() - startTime,
      };

      return {
        success: true,
        output,
        events: [],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      yield { type: "error", error: err, recoverable: false };

      return {
        success: false,
        output: "",
        events: [],
        duration: Date.now() - startTime,
        error: err,
      };
    }
  }

  // ---- Core logic ----

  private async designComponent(
    request: DesignRequest & { responsive?: boolean; animated?: boolean },
    context?: SkillContext,
  ): Promise<DesignResult> {
    const prompt = templates.component
      .replace("{{description}}", request.description)
      .replace("{{designType}}", request.designType || "component")
      .replace("{{tier}}", request.tier || "premium")
      .replace("{{responsive}}", String(request.responsive !== false))
      .replace("{{animated}}", String(request.animated !== false));

    const responseText = await this.callLLMWithResilience(prompt, context);
    return this.parseDesignResponse(responseText, request);
  }

  private async reviewDesign(
    code: string,
    context?: SkillContext,
  ): Promise<DesignReviewResult> {
    const prompt = templates.review.replace("{{code}}", code);
    const responseText = await this.callLLMWithResilience(prompt, context);
    return this.parseReviewResponse(responseText);
  }

  private async enhanceDesign(
    code: string,
    focusAreas?: string[],
    context?: SkillContext,
  ): Promise<string> {
    let prompt = templates.enhance.replace("{{code}}", code);
    if (focusAreas && focusAreas.length > 0) {
      prompt += `\n\nFocus specifically on: ${focusAreas.join(", ")}`;
    }
    return await this.callLLMWithResilience(prompt, context);
  }

  private async callLLMWithResilience(
    prompt: string,
    context?: SkillContext,
  ): Promise<string> {
    if (context) {
      const callLLM = withResilience(
        async () =>
          await context.services.llm.complete({
            messages: [{ role: "user", content: prompt }],
            system: FRONTEND_DESIGNER_SYSTEM_PROMPT,
            maxTokens: 4096,
          }),
        "frontend-designer",
      );
      return await callLLM();
    }

    // Fallback without context
    const { createSkillContext } = await import("../base/SkillContext.js");
    const tempContext = createSkillContext({});
    const callLLM = withResilience(
      async () =>
        await tempContext.services.llm.complete({
          messages: [{ role: "user", content: prompt }],
          system: FRONTEND_DESIGNER_SYSTEM_PROMPT,
          maxTokens: 4096,
        }),
      "frontend-designer",
    );
    return await callLLM();
  }

  // ---- Parsers ----

  private parseDesignResponse(
    response: string,
    request: DesignRequest & { responsive?: boolean; animated?: boolean },
  ): DesignResult {
    // Extract code block from response
    const codeMatch = response.match(/```svelte\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : response;

    // Detect tokens used
    const tokenMatches = code.match(/var\(--[\w-]+\)/g) || [];
    const tokensUsed = [
      ...new Set(
        tokenMatches.map((m) => m.replace("var(", "").replace(")", "")),
      ),
    ];

    // Extract component name from script or generate one
    const nameMatch = code.match(/(?:class|function|const)\s+(\w+)/);
    const componentName =
      nameMatch?.[1] || this.generateComponentName(request.description);

    const features: string[] = [];
    if (tokensUsed.length > 0) features.push("design-system-tokens");
    if (code.includes("glass-")) features.push("glassmorphism");
    if (code.includes("transition") || code.includes("animation"))
      features.push("animations");
    if (code.includes("@media")) features.push("responsive");
    if (code.includes("aria-") || code.includes("role="))
      features.push("accessible");
    if (code.includes("prefers-reduced-motion")) features.push("motion-safe");

    const accessibilityNotes: string[] = [];
    if (!code.includes("aria-"))
      accessibilityNotes.push("Consider adding ARIA attributes");
    if (!code.includes("role="))
      accessibilityNotes.push("Consider adding semantic roles");
    if (!code.includes(":focus"))
      accessibilityNotes.push("Consider adding focus styles");

    return {
      componentName,
      code,
      designType: request.designType || "component",
      tier: request.tier || "premium",
      features,
      tokensUsed,
      accessibilityNotes:
        accessibilityNotes.length === 0
          ? ["Good accessibility coverage"]
          : accessibilityNotes,
    };
  }

  private parseReviewResponse(response: string): DesignReviewResult {
    // Extract a numeric score if present
    const scoreMatch = response.match(
      /(\d{1,3})\s*\/\s*100|score[:\s]*(\d{1,3})/i,
    );
    const score = scoreMatch
      ? parseInt(scoreMatch[1] || scoreMatch[2], 10)
      : 70;

    const issues: DesignReviewResult["issues"] = [];
    const strengths: string[] = [];

    const lines = response.split("\n");
    let currentSection = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        /issue|problem|fix|warning/i.test(trimmed) &&
        trimmed.startsWith("#")
      ) {
        currentSection = "issues";
      } else if (
        /strength|positive|good/i.test(trimmed) &&
        trimmed.startsWith("#")
      ) {
        currentSection = "strengths";
      } else if (currentSection === "issues" && trimmed.startsWith("- ")) {
        const text = trimmed.substring(2);
        issues.push({
          severity: /critical|must/i.test(text)
            ? "critical"
            : /should|warning/i.test(text)
              ? "warning"
              : "suggestion",
          category: this.categorizeIssue(text),
          message: text,
        });
      } else if (currentSection === "strengths" && trimmed.startsWith("- ")) {
        strengths.push(trimmed.substring(2));
      }
    }

    return {
      summary:
        lines.find((l) => l.trim() && !l.startsWith("#"))?.trim() ||
        "Review complete",
      score: Math.min(100, Math.max(0, score)),
      issues,
      strengths:
        strengths.length > 0
          ? strengths
          : ["Component follows general design patterns"],
      tokenCoverage: score / 100,
      themeCompliance: !issues.some(
        (i) => i.category === "theme" && i.severity === "critical",
      ),
      accessibilityScore:
        issues.filter((i) => i.category === "accessibility").length === 0
          ? 90
          : 60,
    };
  }

  private categorizeIssue(
    text: string,
  ): DesignReviewResult["issues"][number]["category"] {
    const lower = text.toLowerCase();
    if (
      lower.includes("token") ||
      lower.includes("variable") ||
      lower.includes("hard-coded") ||
      lower.includes("hardcoded")
    )
      return "tokens";
    if (
      lower.includes("aria") ||
      lower.includes("accessibility") ||
      lower.includes("focus") ||
      lower.includes("keyboard")
    )
      return "accessibility";
    if (
      lower.includes("responsive") ||
      lower.includes("mobile") ||
      lower.includes("breakpoint")
    )
      return "responsive";
    if (
      lower.includes("animation") ||
      lower.includes("transition") ||
      lower.includes("motion")
    )
      return "animation";
    if (
      lower.includes("theme") ||
      lower.includes("dark") ||
      lower.includes("light")
    )
      return "theme";
    return "structure";
  }

  // ---- Helpers ----

  private detectDesignType(message: string): DesignType {
    const lower = message.toLowerCase();
    const map: Array<[string[], DesignType]> = [
      [["dashboard"], "dashboard"],
      [["modal", "dialog", "popup"], "modal"],
      [["form", "input form", "signup", "login"], "form"],
      [["card"], "card"],
      [["page", "screen"], "page"],
      [["layout"], "layout"],
      [["section", "hero", "banner"], "section"],
      [["nav", "navbar", "sidebar", "menu", "header", "footer"], "navigation"],
    ];

    for (const [keywords, type] of map) {
      if (keywords.some((k) => lower.includes(k))) return type;
    }
    return "component";
  }

  private detectTier(message: string): DesignTier {
    const lower = message.toLowerCase();
    if (/premium|luxury|high.?end|deluxe|elite|stunning/.test(lower))
      return "premium";
    if (/simple|basic|minimal|clean|quick/.test(lower)) return "minimal";
    return "polished";
  }

  private generateComponentName(description: string): string {
    return description
      .replace(/[^a-zA-Z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("");
  }

  private formatDesignResult(result: DesignResult): string {
    const lines: string[] = [];

    lines.push(`## ${result.componentName}`);
    lines.push(`**Type:** ${result.designType} | **Tier:** ${result.tier}\n`);

    if (result.features.length > 0) {
      lines.push(`**Features:** ${result.features.join(", ")}\n`);
    }

    if (result.tokensUsed.length > 0) {
      lines.push(`**Design tokens used:** ${result.tokensUsed.length}\n`);
    }

    lines.push("```svelte");
    lines.push(result.code);
    lines.push("```\n");

    if (result.accessibilityNotes.length > 0) {
      lines.push("### Accessibility Notes");
      result.accessibilityNotes.forEach((note) => lines.push(`- ${note}`));
    }

    return lines.join("\n");
  }

  // ---- Tool handlers ----

  private async handleDesignComponent(
    input: Record<string, unknown>,
    context: SkillContext,
  ): Promise<ToolExecutionResult> {
    try {
      const result = await this.designComponent(
        {
          description: input.description as string,
          designType: (input.designType as DesignType) || "component",
          tier: (input.tier as DesignTier) || "premium",
          responsive: (input.responsive as boolean) !== false,
          animated: (input.animated as boolean) !== false,
        },
        context,
      );

      return this.successResult(this.formatDesignResult(result), { result });
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : "Design generation failed",
      );
    }
  }

  private async handleReviewDesign(
    input: Record<string, unknown>,
    context: SkillContext,
  ): Promise<ToolExecutionResult> {
    try {
      let code = input.code as string;

      if (!code && input.filePath) {
        const content = await this.readFile(context, input.filePath as string);
        if (!content) {
          return this.errorResult(`Could not read file: ${input.filePath}`);
        }
        code = content;
      }

      if (!code) {
        return this.errorResult("Either code or filePath is required");
      }

      const review = await this.reviewDesign(code, context);

      const output = [
        `## Design Review — Score: ${review.score}/100\n`,
        review.summary,
        "",
        review.issues.length > 0 ? "### Issues" : "",
        ...review.issues.map(
          (i) => `- **[${i.severity}]** (${i.category}) ${i.message}`,
        ),
        "",
        "### Strengths",
        ...review.strengths.map((s) => `- ${s}`),
        "",
        `Theme compliant: ${review.themeCompliance ? "Yes" : "No"}`,
        `Accessibility score: ${review.accessibilityScore}/100`,
      ]
        .filter(Boolean)
        .join("\n");

      return this.successResult(output, { review });
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : "Design review failed",
      );
    }
  }

  private async handleEnhanceDesign(
    input: Record<string, unknown>,
    context: SkillContext,
  ): Promise<ToolExecutionResult> {
    try {
      let code = input.code as string;

      if (!code && input.filePath) {
        const content = await this.readFile(context, input.filePath as string);
        if (!content) {
          return this.errorResult(`Could not read file: ${input.filePath}`);
        }
        code = content;
      }

      if (!code) {
        return this.errorResult("Either code or filePath is required");
      }

      const enhanced = await this.enhanceDesign(
        code,
        input.focusAreas as string[] | undefined,
        context,
      );

      return this.successResult(enhanced);
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : "Design enhancement failed",
      );
    }
  }
}

export default new FrontendDesignerSkill();
