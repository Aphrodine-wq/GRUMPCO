//! G-Rump Intent Compiler Library
//! Provides parsing functions for natural language intent extraction
//! and G-Agent task planning capabilities.
//!
//! Pipeline: tokenize → lexicon resolve → negation detect → verb classify →
//!           classify project/arch → infer deps → score → plan → assemble output

use once_cell::sync::Lazy;
use rustc_hash::FxHashSet;
use std::hash::{Hash, Hasher};

#[cfg(all(target_os = "linux", not(target_arch = "wasm32")))]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[cfg(not(target_arch = "wasm32"))]
use rayon::prelude::*;

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

// ============================================================================
// Global Intent Cache (3-tier LRU with predictive prefetching)
// ============================================================================

static INTENT_CACHE: Lazy<hyper_cache::HyperCache<IntentOutput>> = Lazy::new(|| {
    hyper_cache::HyperCache::new(hyper_cache::CacheConfig {
        l1_capacity: 512,
        l2_capacity: 4096,
        l3_capacity: 2048,
        ttl: std::time::Duration::from_secs(1800), // 30 min TTL
        prefetch_threshold: 0.7,
        adaptive_eviction: true,
    })
});

/// Hash text + constraints into a u64 cache key using FxHasher (fast, non-crypto).
fn intent_cache_key(text: &str, constraints: &serde_json::Value) -> u64 {
    let mut hasher = rustc_hash::FxHasher::default();
    text.hash(&mut hasher);
    let constraints_str = constraints.to_string();
    constraints_str.hash(&mut hasher);
    hasher.finish()
}

// Global parallel engine (auto-detects thread count)
static PARALLEL_ENGINE: Lazy<parallel_engine::ParallelEngine> =
    Lazy::new(|| parallel_engine::ParallelEngine::default());

// ============================================================================
// Module Declarations
// ============================================================================

// SIMD optimizations
#[cfg(not(target_arch = "wasm32"))]
pub mod simd_parser;
#[cfg(not(target_arch = "wasm32"))]
pub mod hyper_simd;

// Advanced engines
pub mod quantum_optimizer;
pub mod neural_pattern_engine;
pub mod hyper_cache;
pub mod parallel_engine;
pub mod hyper_parse;
pub mod gpu_accelerator;
pub mod jit_engine;
pub mod zero_copy;
pub mod model_compression;
pub mod ultimate_parse;
pub mod error_handling;
pub mod real_ai_optimizer;
pub mod production_parse;

// Core NLP modules
pub mod classifier;
pub mod dependencies;
pub mod lexicon;
pub mod negation;
pub mod scoring;
pub mod tokenizer;
pub mod types;
pub mod verb_actions;

// G-Agent Task Engine modules
pub mod planner;
pub mod semantics;
pub mod stream_parser;
pub mod tasks;

// Market Intelligence Engine — focused modules
pub mod market_analysis;
pub mod market_competitors;
pub mod market_engine;
pub mod market_revenue;
pub mod market_risks;
pub mod market_segments;

// Domain engines
pub mod context_engine;
pub mod moat_engine;
pub mod nlp_engine;
pub mod founder_data_engine;
pub mod market_data_feeds;
pub mod psych_profiling_engine;
pub mod accuracy_learning_engine;
pub mod ml_training_engine;
pub mod network_intelligence_engine;
pub mod ml_training_pipeline;

// Decomposed modules
pub mod keywords;
pub mod prelude;
pub mod extraction;
pub mod enrichment;
pub mod wasm_bindings;

use types::*;

// Re-export all commonly used items from prelude
pub use prelude::*;
pub use types::FullAnalysis;

// Re-export core extraction functions (public API)
pub use extraction::{extract_actors, extract_data_flows, extract_features, extract_tech_stack_hints};

// ============================================================================
// Main Parse Function
// ============================================================================

pub fn parse_intent(text: &str, constraints: serde_json::Value) -> IntentOutput {
    // Check cache first
    let cache_key = intent_cache_key(text, &constraints);
    if let Some(cached) = INTENT_CACHE.get(cache_key) {
        return cached;
    }

    let actors = extract_actors(text);
    let regex_features = extract_features(text);
    let data_flows = extract_data_flows(text);
    let regex_tech = extract_tech_stack_hints(text);

    let enrichment = enrichment::run_enrichment_pipeline(text);

    // Merge regex features with lexicon features
    let mut merged_features = enrichment.flat_features.clone();
    let mut seen = FxHashSet::default();
    for f in &merged_features {
        seen.insert(f.clone());
    }
    for f in &regex_features {
        if seen.insert(f.clone()) {
            merged_features.push(f.clone());
        }
    }

    // Merge regex tech with lexicon tech
    let mut merged_tech = enrichment.flat_tech.clone();
    let mut seen_t = FxHashSet::default();
    for t in &merged_tech {
        seen_t.insert(t.clone());
    }
    for t in &regex_tech {
        if seen_t.insert(t.clone()) {
            merged_tech.push(t.clone());
        }
    }

    let confidence = scoring::compute_confidence(
        &actors,
        &enrichment.enriched_features,
        &enrichment.enriched_tech,
        enrichment.sentences.len(),
    );

    let output = IntentOutput {
        actors,
        features: merged_features,
        data_flows,
        tech_stack_hints: merged_tech,
        constraints,
        raw: text.to_string(),
        enriched_features: enrichment.enriched_features,
        enriched_tech: enrichment.enriched_tech,
        project_type: enrichment.project_type.as_str().to_string(),
        architecture_pattern: enrichment.architecture_pattern.as_str().to_string(),
        complexity_score: enrichment.complexity_score,
        confidence,
        dependency_graph: enrichment.dependency_graph,
        sentences: enrichment.sentences,
        verification: None,
    };
    let verification = semantics::verify_intent(&output);
    let final_output = IntentOutput {
        verification: Some(verification),
        ..output
    };

    INTENT_CACHE.put(cache_key, final_output.clone());
    final_output
}

/// Batch parse multiple intents using the adaptive parallel engine.
#[cfg(not(target_arch = "wasm32"))]
pub fn parse_intents_batch(texts: &[&str], constraints: serde_json::Value) -> Vec<IntentOutput> {
    let items: Vec<String> = texts.iter().map(|t| t.to_string()).collect();
    let constraints_clone = constraints.clone();

    let results = PARALLEL_ENGINE.process_adaptive(items, move |text| {
        parse_intent(text, constraints_clone.clone())
    });

    let mut sorted = results;
    sorted.sort_by_key(|r| r.item_id);
    sorted.into_iter().map(|r| r.result).collect()
}

#[cfg(target_arch = "wasm32")]
pub fn parse_intents_batch(texts: &[&str], constraints: serde_json::Value) -> Vec<IntentOutput> {
    texts
        .iter()
        .map(|text| parse_intent(text, constraints.clone()))
        .collect()
}

// ============================================================================
// SIMD Support Detection
// ============================================================================

#[cfg(not(target_arch = "wasm32"))]
pub fn get_simd_support() -> String {
    simd_parser::check_simd_support().to_string()
}

#[cfg(target_arch = "wasm32")]
pub fn get_simd_support() -> String {
    "WASM (no SIMD)".to_string()
}

// ============================================================================
// Cache Management API
// ============================================================================

pub fn get_cache_stats() -> hyper_cache::CacheStats {
    INTENT_CACHE.stats()
}

pub fn clear_cache() {
    INTENT_CACHE.clear();
}

pub fn get_cache_size_bytes() -> usize {
    INTENT_CACHE.size_bytes()
}

pub fn get_parallel_stats() -> parallel_engine::ProcessingStats {
    PARALLEL_ENGINE.stats()
}

// ============================================================================
// Full Analysis API (composes all engines)
// ============================================================================

/// Run a full analysis composing all engines: intent parsing, market intelligence,
/// unified context analysis, and advanced NLP linguistics.
pub fn analyze_intent_full(text: &str, constraints: serde_json::Value) -> types::FullAnalysis {
    let intent = parse_intent(text, constraints);

    let market = market_engine::analyze_market(
        text,
        intent.features.clone(),
        intent.tech_stack_hints.clone(),
    );

    let linguistic = nlp_engine::parse_linguistically(text);
    let interpretation = nlp_engine::interpret_contextually(text);

    let implicit_requirements = semantics::extract_implicit_requirements(&intent);
    let contradictions = semantics::detect_contradictions(&intent);
    let style_suggestions = semantics::suggest_code_style(&intent);

    let context = context_engine::analyze_context(
        text,
        intent.features.clone(),
        intent.complexity_score,
        &market,
        implicit_requirements,
        contradictions,
        style_suggestions,
    );

    types::FullAnalysis {
        intent,
        market,
        context,
        linguistic,
        interpretation,
    }
}

// ============================================================================
// G-Agent Plan Generation
// ============================================================================

/// Parse intent and generate an execution plan in one step.
pub fn generate_plan_from_text(goal: &str, constraints: serde_json::Value) -> Plan {
    let intent = parse_intent(goal, constraints);
    planner::generate_plan(&intent, goal)
}

/// Parse intent and generate a plan, returning both.
pub fn parse_and_plan(goal: &str, constraints: serde_json::Value) -> (IntentOutput, Plan) {
    let intent = parse_intent(goal, constraints);
    let plan = planner::generate_plan(&intent, goal);
    (intent, plan)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_actors_default() {
        let out = extract_actors("build a thing");
        assert!(!out.is_empty());
        assert!(out.contains(&"user".to_string()));
    }

    #[test]
    fn test_extract_actors_with_role() {
        let out = extract_actors("As an admin, I want to manage users");
        assert!(out.iter().any(|s| s.contains("admin")));
    }

    #[test]
    fn test_extract_tech_hints() {
        let out = extract_tech_stack_hints("Build a React app with Node and Postgres");
        assert!(out.iter().any(|s| s.contains("react")));
        assert!(out.iter().any(|s| s.contains("node")));
        assert!(out.iter().any(|s| s.contains("postgres")));
    }

    #[test]
    fn test_extract_data_flows() {
        let out = extract_data_flows("REST API with real-time websocket");
        assert!(out.iter().any(|s| s.contains("api") || s.contains("rest")));
        assert!(out.iter().any(|s| s.contains("real-time") || s.contains("websocket")));
    }

    #[test]
    fn test_intent_output_shape() {
        let raw = "Build a task manager with Vue and Express";
        let intent = parse_intent(raw, serde_json::json!({}));
        assert!(!intent.raw.is_empty());
        assert!(!intent.actors.is_empty());
        let json = serde_json::to_string(&intent).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed.get("actors").is_some());
        assert!(parsed.get("features").is_some());
        assert!(parsed.get("enriched_features").is_some());
        assert!(parsed.get("project_type").is_some());
        assert!(parsed.get("complexity_score").is_some());
        assert!(parsed.get("confidence").is_some());
    }

    #[test]
    fn test_batch_parsing() {
        let texts = vec!["Build a React app", "Create a Node API", "Make a Vue dashboard"];
        let results = parse_intents_batch(&texts, serde_json::json!({}));
        assert_eq!(results.len(), 3);
        assert!(results[0].tech_stack_hints.iter().any(|s| s.contains("react")));
        assert!(results[1].tech_stack_hints.iter().any(|s| s.contains("node")));
        assert!(results[2].tech_stack_hints.iter().any(|s| s.contains("vue")));
    }

    #[test]
    fn test_deduplication() {
        let out = extract_tech_stack_hints("React React React with Node Node");
        assert_eq!(out.iter().filter(|s| s.contains("react")).count(), 1);
        assert_eq!(out.iter().filter(|s| s.contains("node")).count(), 1);
    }

    #[test]
    fn test_simd_support() {
        let support = get_simd_support();
        assert!(!support.is_empty());
    }

    #[test]
    fn test_synonym_resolution() {
        let intent = parse_intent("Use pg database with k8s", serde_json::json!({}));
        assert!(intent.enriched_tech.iter().any(|t| t.canonical == "postgresql"));
        assert!(intent.enriched_tech.iter().any(|t| t.canonical == "kubernetes"));
    }

    #[test]
    fn test_negation_detection() {
        let intent = parse_intent("Don't use React, build with Vue", serde_json::json!({}));
        let react = intent.enriched_tech.iter().find(|t| t.canonical == "react");
        let vue = intent.enriched_tech.iter().find(|t| t.canonical == "vue");
        assert!(react.map_or(false, |r| r.negated), "react should be negated");
        assert!(vue.map_or(true, |v| !v.negated), "vue should not be negated");
    }

    #[test]
    fn test_complexity_scoring() {
        let intent = parse_intent(
            "Build an e-commerce platform with authentication, RBAC, dashboard, payments, \
             real-time chat, notifications using React, Node, PostgreSQL, Redis, Docker, Kubernetes",
            serde_json::json!({}),
        );
        assert!(intent.complexity_score > 0.7, "got {}", intent.complexity_score);
    }

    #[test]
    fn test_project_type_classification() {
        let intent = parse_intent("Build a REST API with Express and PostgreSQL", serde_json::json!({}));
        assert_eq!(intent.project_type, "api");
    }

    #[test]
    fn test_cache_hit_returns_same_result() {
        clear_cache();
        let text = "Build a React app with Node and authentication";
        let constraints = serde_json::json!({"budget": "low"});
        let result1 = parse_intent(text, constraints.clone());
        let result2 = parse_intent(text, constraints.clone());
        assert_eq!(result1.raw, result2.raw);
        assert_eq!(result1.actors, result2.actors);
        let stats = get_cache_stats();
        assert!(stats.l1_hits >= 1, "should have at least 1 L1 cache hit, got {}", stats.l1_hits);
    }

    #[test]
    fn test_analyze_intent_full() {
        let analysis = analyze_intent_full(
            "Build an e-commerce platform with React and Node for habit tracking",
            serde_json::json!({}),
        );
        assert!(!analysis.intent.raw.is_empty());
        assert!(!analysis.context.recommendation.is_empty());
        assert!(analysis.context.overall_score > 0.0);
        assert!(!analysis.linguistic.raw_input.is_empty());
        assert!(!analysis.interpretation.literal_meaning.is_empty());
    }
}

#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn parse_intent_never_panics(s in "\\PC{0,500}") {
            let _ = super::parse_intent(&s, serde_json::json!({}));
        }

        #[test]
        fn extract_actors_deterministic(s in "[a-zA-Z ]{0,200}") {
            let r1 = super::extract_actors(&s);
            let r2 = super::extract_actors(&s);
            assert_eq!(r1, r2);
        }

        #[test]
        fn extract_features_deterministic(s in "[a-zA-Z ]{0,200}") {
            let r1 = super::extract_features(&s);
            let r2 = super::extract_features(&s);
            assert_eq!(r1, r2);
        }

        #[test]
        fn parse_intent_batch_equals_sequential(texts in proptest::collection::vec("[a-zA-Z ]{0,100}", 1..10)) {
            let constraints = serde_json::json!({});
            let text_refs: Vec<&str> = texts.iter().map(|s| s.as_str()).collect();

            #[cfg(not(target_arch = "wasm32"))]
            {
                let batch_results = super::parse_intents_batch(&text_refs, constraints.clone());
                let sequential_results: Vec<_> = text_refs.iter()
                    .map(|text| super::parse_intent(text, constraints.clone()))
                    .collect();

                assert_eq!(batch_results.len(), sequential_results.len());
                for (batch, seq) in batch_results.iter().zip(sequential_results.iter()) {
                    assert_eq!(batch.raw, seq.raw);
                    assert_eq!(batch.actors, seq.actors);
                }
            }
        }
    }
}
