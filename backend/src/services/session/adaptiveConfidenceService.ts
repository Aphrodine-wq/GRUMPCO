/**
 * Adaptive Confidence Model
 *
 * Replaces fixed confidenceThreshold with learned threshold based on historical parse accuracy.
 * A/B-able confidence calibration for tuning Rust-vs-LLM routing from telemetry.
 */

const DEFAULT_THRESHOLD = 0.7;
const MIN_THRESHOLD = 0.3;
const MAX_THRESHOLD = 0.95;
const WINDOW_SIZE = 100;

interface ParseOutcome {
  method: 'rust' | 'llm' | 'hybrid';
  confidence: number;
  /** Whether the parse was deemed successful (e.g., user proceeded). */
  success: boolean;
  timestamp: number;
}

const recentOutcomes: ParseOutcome[] = [];

/**
 * Record a parse outcome for learning.
 */
export function recordParseOutcome(
  method: 'rust' | 'llm' | 'hybrid',
  confidence: number,
  success: boolean
): void {
  recentOutcomes.push({
    method,
    confidence,
    success,
    timestamp: Date.now(),
  });
  if (recentOutcomes.length > WINDOW_SIZE) {
    recentOutcomes.shift();
  }
}

/**
 * Get the adaptive confidence threshold.
 * When RAG_ADAPTIVE_CONFIDENCE=true, learns from outcomes; else uses env or default.
 */
export function getConfidenceThreshold(): number {
  if (process.env.HYBRID_ADAPTIVE_CONFIDENCE !== 'true') {
    const envVal = process.env.HYBRID_CONFIDENCE_THRESHOLD;
    if (envVal) {
      const parsed = parseFloat(envVal);
      if (!Number.isNaN(parsed)) return Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, parsed));
    }
    return DEFAULT_THRESHOLD;
  }

  const recent = recentOutcomes.slice(-WINDOW_SIZE);
  if (recent.length < 10) return DEFAULT_THRESHOLD;

  const rustSuccesses = recent.filter((o) => o.method === 'rust' && o.success).length;
  const rustTotal = recent.filter((o) => o.method === 'rust').length;
  const llmSuccesses = recent.filter(
    (o) => (o.method === 'llm' || o.method === 'hybrid') && o.success
  ).length;
  const llmTotal = recent.filter((o) => o.method === 'llm' || o.method === 'hybrid').length;

  const rustAcc = rustTotal > 0 ? rustSuccesses / rustTotal : 0.5;
  const llmAcc = llmTotal > 0 ? llmSuccesses / llmTotal : 0.5;

  if (rustAcc > llmAcc + 0.1) {
    return Math.min(MAX_THRESHOLD, DEFAULT_THRESHOLD + 0.1);
  }
  if (llmAcc > rustAcc + 0.1) {
    return Math.max(MIN_THRESHOLD, DEFAULT_THRESHOLD - 0.1);
  }
  return DEFAULT_THRESHOLD;
}

/**
 * Get A/B experiment variant for confidence (e.g., 'control' vs 'treatment').
 */
export function getConfidenceExperimentVariant(): string {
  return process.env.HYBRID_CONFIDENCE_AB_VARIANT ?? 'control';
}
