import { EnrichedIntent } from './intentCompilerService.js';
import { getProjectContext } from './contextService.js'; // Assuming this exists or similar

export interface VerificationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    clarification?: {
        reason: string;
        questions: string[];
    };
}

/**
 * Verify that the enriched intent matches the project constraints and is clear enough to proceed.
 */
export async function verifyIntent(intent: EnrichedIntent): Promise<VerificationResult> {
    const result: VerificationResult = {
        valid: true,
        errors: [],
        warnings: [],
    };

    // 1. Ambiguity Check
    if (intent.enriched?.ambiguity_analysis) {
        const { score, reason, clarification_questions } = intent.enriched.ambiguity_analysis;
        if (score > 0.6) {
            result.valid = false;
            result.clarification = {
                reason: reason || 'Intent is too ambiguous',
                questions: clarification_questions || ['Can you be more specific?'],
            };
            return result;
        }
        if (score > 0.3) {
            result.warnings.push(`Intent is slightly ambiguous: ${reason}`);
        }
    }

    // 2. Feature Check
    if (!intent.features?.length && !intent.enriched?.features?.length) {
        // It might be a purely conversational intent, but if we expect a task...
        // We'll just warn for now.
        result.warnings.push('No specific features identified.');
    }

    // 3. Tech Stack Compatibility (Simple heuristic)
    // In a real implementation, we would check package.json
    const stack = intent.enriched?.tech_stack || intent.tech_stack_hints || [];
    if (stack.some(s => s.toLowerCase().includes('react'))) {
        // Check if we are in a Svelte project (hardcoded check for now based on file existence, or passed in context)
        // For this mvp, we'll just log a warning if we see React in the intent but the user is "Walt" (custom rule example)
        // Actually, let's keep it generic.
        result.warnings.push('Intent mentions React, but verify if this project supports it.');
    }

    return result;
}
