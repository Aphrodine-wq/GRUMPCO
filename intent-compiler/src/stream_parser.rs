//! Streaming / Incremental Intent Parser
//!
//! Accepts partial input and returns partial intent with confidence.
//! For sub-100ms perceived latency as the user types.

use crate::parse_intent;
use crate::types::IntentOutput;
use serde::{Deserialize, Serialize};

/// Partial intent result for streaming responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartialIntent {
    pub intent: IntentOutput,
    pub confidence: f32,
    pub is_complete: bool,
    pub processing_time_ms: u64,
}

/// Parse intent from potentially partial input.
/// Returns partial result with confidence; when input looks complete, is_complete=true.
pub fn parse_intent_stream(text: &str, constraints: serde_json::Value) -> PartialIntent {
    let start = std::time::Instant::now();
    let trimmed = text.trim();

    if trimmed.is_empty() {
        return PartialIntent {
            intent: empty_intent(""),
            confidence: 0.0,
            is_complete: false,
            processing_time_ms: start.elapsed().as_millis() as u64,
        };
    }

    let intent = parse_intent(trimmed, constraints);
    let verification = intent.verification.as_ref();
    let well_formed = verification.map(|v| v.well_formed).unwrap_or(true);

    let word_count = trimmed.split_whitespace().count();
    let is_complete = looks_complete(trimmed, word_count);
    let base_confidence = intent.confidence.overall;
    let confidence = if well_formed {
        base_confidence
    } else {
        base_confidence * 0.8
    };

    PartialIntent {
        intent,
        confidence,
        is_complete,
        processing_time_ms: start.elapsed().as_millis() as u64,
    }
}

fn looks_complete(text: &str, word_count: usize) -> bool {
    if word_count < 3 {
        return false;
    }
    let ends_with_punctuation = text.ends_with('.') || text.ends_with('!') || text.ends_with('?');
    let ends_with_newline = text.ends_with('\n');
    let has_verb = text.to_lowercase().contains("build")
        || text.to_lowercase().contains("create")
        || text.to_lowercase().contains("add")
        || text.to_lowercase().contains("implement");
    ends_with_punctuation || ends_with_newline || (has_verb && word_count >= 5)
}

fn empty_intent(raw: &str) -> IntentOutput {
    use crate::types::ConfidenceReport;
    IntentOutput {
        actors: vec![],
        features: vec![],
        data_flows: vec![],
        tech_stack_hints: vec![],
        constraints: serde_json::json!({}),
        raw: raw.to_string(),
        enriched_features: vec![],
        enriched_tech: vec![],
        project_type: "unknown".to_string(),
        architecture_pattern: "unknown".to_string(),
        complexity_score: 0.0,
        confidence: ConfidenceReport::default(),
        dependency_graph: vec![],
        sentences: vec![],
        verification: None,
    }
}
