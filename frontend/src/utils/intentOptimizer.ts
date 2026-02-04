/**
 * Intent Optimizer UI utilities
 * Helpers for building description text from optimized intent results
 */

import type { IntentOptimizerResult } from '../stores/featuresStore.js';

/**
 * Build a project description string from an optimized intent result.
 * Combines original text with features, constraints, NFRs, and reasoning.
 */
export function buildOptimizedDescription(result: IntentOptimizerResult): string {
  const o = result.optimized;
  const parts: string[] = [result.original];
  if (o.features?.length) {
    parts.push('\n\nFeatures: ' + o.features.join(', '));
  }
  if (o.constraints?.length) {
    parts.push('\nConstraints: ' + o.constraints.map((c) => c.description).join('; '));
  }
  if (o.nonFunctionalRequirements?.length) {
    parts.push('\nNFRs: ' + o.nonFunctionalRequirements.map((n) => n.requirement).join('; '));
  }
  if (o.reasoning) {
    parts.push('\n\n' + o.reasoning);
  }
  return parts.join('');
}
