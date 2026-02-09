/**
 * Pattern Matcher
 *
 * Matches tasks against known successful patterns and learns
 * from execution results to improve future matching.
 *
 * @fileoverview Extracted from powerExpansion.ts
 * @module gAgent/patternMatcher
 */

import { EventEmitter } from "events";
import type { Pattern, PatternTask } from "./types.js";

// ============================================================================
// PATTERN MATCHER
// ============================================================================

/**
 * Matches tasks to known successful patterns
 */
export class PatternMatcher extends EventEmitter {
    private patterns: Map<string, Pattern> = new Map();

    /**
     * Add a pattern to the matcher
     */
    addPattern(pattern: Pattern): void {
        this.patterns.set(pattern.id, pattern);
    }

    /**
     * Find matching pattern for a task
     */
    findMatch(
        taskDescription: string,
    ): { pattern: Pattern; confidence: number } | null {
        let bestMatch: { pattern: Pattern; confidence: number } | null = null;

        for (const pattern of this.patterns.values()) {
            const confidence = this.calculateMatchConfidence(
                taskDescription,
                pattern,
            );

            if (
                confidence > 0.6 &&
                (!bestMatch || confidence > bestMatch.confidence)
            ) {
                bestMatch = { pattern, confidence };
            }
        }

        if (bestMatch) {
            this.emit("power", {
                type: "pattern_matched",
                pattern: bestMatch.pattern,
                confidence: bestMatch.confidence,
            });
        }

        return bestMatch;
    }

    private calculateMatchConfidence(
        taskDescription: string,
        pattern: Pattern,
    ): number {
        const taskLower = taskDescription.toLowerCase();
        const patternLower = pattern.goal.toLowerCase();

        // Word overlap
        const taskWords = new Set(
            taskLower.split(/\W+/).filter((w) => w.length > 3),
        );
        const patternWords = new Set(
            patternLower.split(/\W+/).filter((w) => w.length > 3),
        );

        let overlap = 0;
        for (const word of taskWords) {
            if (patternWords.has(word)) overlap++;
        }

        const overlapScore = overlap / Math.max(taskWords.size, patternWords.size);

        // Boost for high success rate patterns
        const successRate =
            pattern.successCount / (pattern.successCount + pattern.failureCount);
        const successBoost = successRate * 0.2;

        // Confidence boost
        const confidenceBoost = pattern.confidence * 0.1;

        return Math.min(1, overlapScore + successBoost + confidenceBoost);
    }

    /**
     * Record pattern execution result
     */
    recordResult(patternId: string, success: boolean, durationMs: number): void {
        const pattern = this.patterns.get(patternId);
        if (!pattern) return;

        if (success) {
            pattern.successCount++;
        } else {
            pattern.failureCount++;
        }

        // Update average duration
        const totalRuns = pattern.successCount + pattern.failureCount;
        pattern.avgDurationMs = Math.round(
            (pattern.avgDurationMs * (totalRuns - 1) + durationMs) / totalRuns,
        );

        // Update confidence based on success rate
        const successRate = pattern.successCount / totalRuns;
        pattern.confidence = successRate * 0.8 + 0.2;

        pattern.updatedAt = new Date().toISOString();
    }

    /**
     * Create a pattern from a successful execution
     */
    createPattern(params: {
        name: string;
        description: string;
        goal: string;
        tasks: PatternTask[];
        tools: string[];
    }): Pattern {
        const pattern: Pattern = {
            id: crypto.randomUUID(),
            name: params.name,
            description: params.description,
            goal: params.goal,
            tasks: params.tasks,
            tools: params.tools,
            successCount: 1,
            failureCount: 0,
            avgDurationMs: 0,
            confidence: 0.5,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        this.patterns.set(pattern.id, pattern);
        this.emit("power", { type: "pattern_learned", patternId: pattern.id });

        return pattern;
    }

    /**
     * Get all patterns
     */
    getAllPatterns(): Pattern[] {
        return Array.from(this.patterns.values());
    }

    /**
     * Get top patterns by success
     */
    getTopPatterns(limit: number = 10): Pattern[] {
        return Array.from(this.patterns.values())
            .sort((a, b) => {
                const aRate = a.successCount / (a.successCount + a.failureCount);
                const bRate = b.successCount / (b.successCount + b.failureCount);
                return bRate - aRate;
            })
            .slice(0, limit);
    }
}
