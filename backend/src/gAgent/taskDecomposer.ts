/**
 * Task Decomposer
 *
 * Analyzes task complexity and decomposes complex tasks into
 * manageable subtasks with dependency tracking.
 *
 * @fileoverview Extracted from powerExpansion.ts
 * @module gAgent/taskDecomposer
 */

import {
    calculateRiskLevel,
    RISK_FACTORS,
} from "./systemPrompt.js";
import type { AgentType } from "./types.js";
import type { TaskDecomposition, DecomposedTask } from "./powerExpansion.types.js";

// ============================================================================
// TASK DECOMPOSER
// ============================================================================

/**
 * Decomposes complex tasks into manageable subtasks
 */
export class TaskDecomposer {
    /**
     * Analyze task complexity
     */
    analyzeComplexity(taskDescription: string): number {
        const indicators = {
            length: taskDescription.length / 500,
            andCount: (taskDescription.match(/\band\b/gi) || []).length * 0.1,
            orCount: (taskDescription.match(/\bor\b/gi) || []).length * 0.1,
            conditionals:
                (taskDescription.match(/\bif\b|\bwhen\b|\bunless\b/gi) || []).length *
                0.15,
            lists: (taskDescription.match(/\d+\.\s|\*\s|-\s/g) || []).length * 0.05,
            techTerms: this.countTechTerms(taskDescription) * 0.1,
        };

        const total = Object.values(indicators).reduce((sum, val) => sum + val, 0);
        return Math.min(total, 1);
    }

    private countTechTerms(text: string): number {
        const techTerms = [
            "api",
            "database",
            "authentication",
            "authorization",
            "deployment",
            "microservice",
            "container",
            "kubernetes",
            "docker",
            "ci/cd",
            "webhook",
            "websocket",
            "graphql",
            "rest",
            "grpc",
            "component",
            "module",
            "service",
            "controller",
            "middleware",
        ];
        const lowerText = text.toLowerCase();
        return techTerms.filter((term) => lowerText.includes(term)).length;
    }

    /**
     * Decompose a complex task into subtasks
     */
    decompose(
        taskDescription: string,
        context?: { projectType?: string; techStack?: string[] },
    ): TaskDecomposition {
        const complexity = this.analyzeComplexity(taskDescription);
        const subtasks: DecomposedTask[] = [];
        const dependencies = new Map<string, string[]>();

        // Parse natural breakpoints in the description
        const segments = this.parseSegments(taskDescription);

        // Create subtasks from segments
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const subtaskId = `subtask_${i + 1}`;

            // Determine agent type based on segment content
            const agent = this.suggestAgent(segment, context);

            // Calculate risk
            const riskScore = this.calculateSegmentRisk(segment);

            subtasks.push({
                id: subtaskId,
                description: segment,
                suggestedAgent: agent,
                estimatedTokens: Math.ceil(segment.length * 10),
                riskLevel: calculateRiskLevel(riskScore),
                dependsOn: i > 0 ? [`subtask_${i}`] : [],
            });

            if (i > 0) {
                dependencies.set(subtaskId, [`subtask_${i}`]);
            }
        }

        // Check if tasks can be parallelized
        const parallelizable = this.canParallelize(subtasks);

        return {
            original: taskDescription,
            subtasks,
            dependencies,
            estimatedComplexity: complexity,
            parallelizable,
        };
    }

    private parseSegments(description: string): string[] {
        let segments: string[] = [];

        // First, try numbered or bulleted lists
        const listMatch = description.match(/(?:\d+\.\s|\*\s|-\s)([^\n]+)/g);
        if (listMatch && listMatch.length > 1) {
            segments = listMatch.map((s) =>
                s.replace(/^\d+\.\s|\*\s|-\s/, "").trim(),
            );
        } else {
            // Try splitting by sentence with "then" or sequential markers
            const sequenceMarkers =
                /[.;]\s*(?:then|next|after that|finally|first|second|third|lastly)/gi;
            if (sequenceMarkers.test(description)) {
                segments = description
                    .split(sequenceMarkers)
                    .map((s) => s.trim())
                    .filter((s) => s.length > 10);
            }
        }

        // If no segments found, treat as single task
        if (segments.length === 0) {
            segments = [description];
        }

        // Limit to reasonable number of subtasks
        if (segments.length > 10) {
            segments = segments.slice(0, 10);
        }

        return segments;
    }

    private suggestAgent(
        segment: string,
        context?: { projectType?: string; techStack?: string[] },
    ): AgentType {
        const lower = segment.toLowerCase();

        if (
            lower.includes("architect") ||
            lower.includes("design") ||
            lower.includes("structure")
        ) {
            return "architect";
        }
        if (
            lower.includes("ui") ||
            lower.includes("frontend") ||
            lower.includes("component") ||
            lower.includes("react") ||
            lower.includes("svelte") ||
            lower.includes("vue")
        ) {
            return "frontend";
        }
        if (
            lower.includes("api") ||
            lower.includes("backend") ||
            lower.includes("server") ||
            lower.includes("database") ||
            lower.includes("endpoint")
        ) {
            return "backend";
        }
        if (
            lower.includes("deploy") ||
            lower.includes("docker") ||
            lower.includes("ci") ||
            lower.includes("kubernetes") ||
            lower.includes("infrastructure")
        ) {
            return "devops";
        }
        if (
            lower.includes("test") ||
            lower.includes("spec") ||
            lower.includes("coverage")
        ) {
            return "test";
        }
        if (
            lower.includes("security") ||
            lower.includes("auth") ||
            lower.includes("permission")
        ) {
            return "security";
        }
        if (
            lower.includes("document") ||
            lower.includes("readme") ||
            lower.includes("guide")
        ) {
            return "docs";
        }

        // Default based on project context
        if (context?.projectType?.includes("frontend")) return "frontend";
        if (context?.projectType?.includes("backend")) return "backend";

        return "executor";
    }

    private calculateSegmentRisk(segment: string): number {
        const lower = segment.toLowerCase();
        let risk = 0;

        if (lower.includes("delete") || lower.includes("remove"))
            risk += RISK_FACTORS.file_delete;
        if (lower.includes("execute") || lower.includes("run"))
            risk += RISK_FACTORS.code_execute;
        if (lower.includes("database")) risk += RISK_FACTORS.database_write;
        if (lower.includes("deploy") || lower.includes("production"))
            risk += RISK_FACTORS.shell_command;

        return risk;
    }

    private canParallelize(subtasks: DecomposedTask[]): boolean {
        const agentTypes = new Set(subtasks.map((t) => t.suggestedAgent));
        return agentTypes.size > 1 && subtasks.length >= 2;
    }
}
