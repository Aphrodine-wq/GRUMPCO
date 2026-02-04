//! G-Rump Intent Compiler Library
//! Provides parsing functions for natural language intent extraction
//! and G-Agent task planning capabilities.
//!
//! Pipeline: tokenize → lexicon resolve → negation detect → verb classify →
//!           classify project/arch → infer deps → score → plan → assemble output

use once_cell::sync::Lazy;
use regex::Regex;
use rustc_hash::FxHashSet;

#[cfg(all(target_os = "linux", not(target_arch = "wasm32")))]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[cfg(not(target_arch = "wasm32"))]
use rayon::prelude::*;

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

// SIMD optimizations
#[cfg(not(target_arch = "wasm32"))]
pub mod simd_parser;

// Hyper-optimized SIMD with AVX-512
#[cfg(not(target_arch = "wasm32"))]
pub mod hyper_simd;

// Quantum-inspired optimization
pub mod quantum_optimizer;

// Neural pattern matching
pub mod neural_pattern_engine;

// Hyper-advanced caching
pub mod hyper_cache;

// Ultra-parallel processing
pub mod parallel_engine;

// Hyper-optimized parse function
pub mod hyper_parse;

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

// Market Intelligence Engine
pub mod market_engine;

// Unified Context Engine
pub mod context_engine;

// Moat & Defensibility Engine
pub mod moat_engine;

// Advanced NLP Engine
pub mod nlp_engine;

// Founder Data Collection & Feedback Loop
pub mod founder_data_engine;

// Live Market Data Feeds Integration
pub mod market_data_feeds;

// Psychological Profiling Engine
pub mod psych_profiling_engine;

// Outcome Tracking & Accuracy Learning
pub mod accuracy_learning_engine;

// Proprietary ML Models Training
pub mod ml_training_engine;

// Network Intelligence Engine
pub mod network_intelligence_engine;

// ML Training Pipeline
pub mod ml_training_pipeline;

use types::*;

// Re-export G-Agent types for convenience
pub use planner::{Plan, PlanRiskAssessment, PlanStatus, PlanSummary};
pub use tasks::{RiskLevel, Task};

// Re-export semantic insight functions for advanced analysis
pub use semantics::{
    compose_intents, detect_contradictions, extract_implicit_requirements,
    suggest_code_style, verify_intent, Contradiction, ImplicitRequirement, StyleSuggestion, TypedIntent,
};

// Re-export market intelligence functions
pub use market_engine::{
    analyze_market, CompetitionLevel, CompetitiveMoat, Competitor, CustomerPsychographic,
    GoToMarketStrategy, MarketAnalysis, MarketSegment, RiskFactor, RevenueModel, UnitEconomics,
    Verdict,
};

// Re-export unified context engine
pub use context_engine::{
    analyze_context, ContextAnalysis, ExecutionInsights, FinalVerdict, MarketInsights,
    ProductInsights, TechnicalInsights, VerdictType,
};

// Re-export moat & defensibility engine
pub use moat_engine::{
    calculate_moat_strength, competitive_advantage_analysis, moat_revenue_model, AccuracyMoat,
    CompetitorUpdate, FounderComparison, FounderDNAMoat, FounderProfile, MarketIntelMoat,
    MoatRevenue, MoatSystem, NetworkMoat, NetworkIntelligence, PersonalityArchetype,
    ProprietaryMoat, VerdictAccuracy,
};

// Re-export advanced NLP engine
pub use nlp_engine::{
    parse_linguistically, interpret_contextually, LinguisticAnalysis, ContextualInterpretation,
    Entity, EntityType, IntentTree, IntentType, Sentence, Relationship,
};

// Re-export founder data & feedback loop engine
pub use founder_data_engine::{
    process_feedback_loop, analyze_verdict_cohort, aggregate_learning_signals,
    calculate_flywheel_metrics, AggregateLearningSignals, BusinessOutcomeEvent,
    CohortOutcomes, FounderCohort, FounderDecision, FounderDecisionEvent, FlywheelMetrics,
    OutcomeDetails, OutcomeEventType, ParsedIntent, VerdictAccuracyFeedback, VerdictCapture,
};

// Re-export market data feeds integration
pub use market_data_feeds::{
    MarketDataAggregator, CrunchbaseConnector, ProductHuntConnector, GitHubConnector,
    TwitterConnector, CompetitorData, FundingEvent, MarketTrendData, FounderProfile,
    CompetitiveLandscape, MarketOpportunity, FounderIntelligence, DeveloperMetrics,
    RepoMetrics, FounderSentiment, TwitterConversation, DetectedTrend,
};

// Re-export psychological profiling engine
pub use psych_profiling_engine::{
    build_psychological_profile, determine_founder_archetype, assess_psychological_risks,
    FounderPsychologicalProfile, FounderArchetype, ArchetypeScore, PsychologicalSignal,
    PsychologicalSignalType, PsychologicalRiskProfile, CommitData, TweetData,
    GitHubBehavioralAnalyzer, TwitterBehavioralAnalyzer,
};

// Re-export accuracy learning & outcome tracking engine
pub use accuracy_learning_engine::{
    measure_verdict_accuracy, calculate_accuracy_metrics, calibrate_confidence,
    aggregate_learning_signals, OutcomeTrackingEvent, OutcomeType, VerdictAccuracyMeasurement,
    AccuracyClassification, LearningSignal, FeatureAdjustment, AccuracyMetrics,
    VerdictMetrics, ConfidenceCalibration, AggregatedLearning, DiscoveredPattern,
};

// Re-export ML training & models engine
pub use ml_training_engine::{
    FeatureEngineer, TrainingDataPipeline, SuccessProbabilityModel, VerdictClassifierModel,
    PredictionEnsemble, ModelRegistry, FeatureVector, TrainingExample, TrainingLabel,
    DatasetQuality, ModelMetrics, ModelVersion, EnsemblePrediction, FeatureDefinition,
};

// Re-export network intelligence engine
pub use network_intelligence_engine::{
    FounderNetwork, NetworkNode, NetworkEdge, NodeType, RelationshipType,
    NetworkIntelligenceAnalyzer, NetworkIntelligenceSignals, CollectiveIntelligence,
    NetworkAdjustedVerdict, NetworkEffectsModel, assess_collective_intelligence,
    adjust_verdict_with_network_intelligence, model_network_effects,
};

// Re-export ML training pipeline
pub use ml_training_pipeline::{
    generate_synthetic_training_data, prepare_training_dataset, TrainingPipeline,
    TrainingDataset, TrainedModelCheckpoint, PipelineStatus, AutomatedImprovementLoop,
    ModelTrainingReport, run_improvement_cycle, generate_model_report, ProductionModelManager,
    ModelMonitoringMetrics, TrainingDataExample, DatasetStatistics,
};

// ============================================================================
// Cached Regex Patterns (compiled once at first use)
// ============================================================================

static ACTOR_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    [
        r"(?:as\s+an?\s+|as\s+a\s+)([a-z][a-z0-9\s\-]+?)(?:\s|,|\.|$)",
        r"(?:user|admin|developer|customer|manager|guest)s?\b",
        r"\b(actor|stakeholder)s?\b",
        r"(?:for\s+)([a-z][a-z0-9\s\-]+?)(?:\s+to\s|\.|$)",
    ]
    .iter()
    .filter_map(|p| Regex::new(p).ok())
    .collect()
});

static FEATURE_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    [
        r"(?:build|create|support|allow|enable|include|add|have)\s+([a-z0-9\s\-]+?)(?:\s+with\s|\s+that\s|,|\.|$)",
        r"(?:with|featuring)\s+([a-z0-9\s\-]+?)(?:\s+and\s|,|\.|$)",
        r"(?:task\s+management|auth|api|dashboard|e-?commerce|saas|booking)\b",
    ]
    .iter()
    .filter_map(|p| Regex::new(p).ok())
    .collect()
});

// ============================================================================
// Keyword Lists for SIMD scanning
// ============================================================================

const DATA_FLOW_KEYWORDS: &[&str] = &[
    "api",
    "rest",
    "graphql",
    "websocket",
    "real-time",
    "sync",
    "async",
    "request",
    "response",
    "webhook",
    "queue",
    "event",
    "stream",
];

const TECH_STACK_KEYWORDS: &[&str] = &[
    "vue",
    "react",
    "svelte",
    "node",
    "express",
    "python",
    "fastapi",
    "go",
    "postgres",
    "postgresql",
    "mongodb",
    "redis",
    "sqlite",
    "docker",
    "kubernetes",
    "aws",
    "vercel",
    "netlify",
    "typescript",
    "javascript",
    "rust",
    "java",
    "ruby",
    "rails",
    "nextjs",
    "nuxt",
    "angular",
    "tailwind",
    "prisma",
    "supabase",
];

// ============================================================================
// Legacy Data Structure (kept for backward compat re-export)
// ============================================================================

// IntentOutput is now in types.rs — re-exported here

// ============================================================================
// Core Extraction Functions (unchanged for backward compat)
// ============================================================================

fn lowercase_text(text: &str) -> String {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let bytes = simd_parser::fast_lowercase_scan(text.as_bytes());
        String::from_utf8_lossy(&bytes).into_owned()
    }
    #[cfg(target_arch = "wasm32")]
    {
        text.to_lowercase()
    }
}

pub fn extract_actors(text: &str) -> Vec<String> {
    let lower = lowercase_text(text);

    #[cfg(not(target_arch = "wasm32"))]
    let mut out: Vec<String> = ACTOR_PATTERNS
        .par_iter()
        .flat_map(|re| {
            re.captures_iter(&lower)
                .map(|cap| {
                    let m = cap.get(1).map(|m| m.as_str().trim()).unwrap_or(&cap[0]);
                    m.replace(['.', ','], "").trim().to_string()
                })
                .filter(|s| s.len() > 1)
                .collect::<Vec<_>>()
        })
        .collect();

    #[cfg(target_arch = "wasm32")]
    let mut out: Vec<String> = ACTOR_PATTERNS
        .iter()
        .flat_map(|re| {
            re.captures_iter(&lower)
                .map(|cap| {
                    let m = cap.get(1).map(|m| m.as_str().trim()).unwrap_or(&cap[0]);
                    m.replace(['.', ','], "").trim().to_string()
                })
                .filter(|s| s.len() > 1)
                .collect::<Vec<_>>()
        })
        .collect();

    let mut seen = FxHashSet::default();
    out.retain(|x| seen.insert(x.clone()));

    if out.is_empty() {
        out.push("user".to_string());
    }
    out
}

pub fn extract_features(text: &str) -> Vec<String> {
    let lower = lowercase_text(text);

    #[cfg(not(target_arch = "wasm32"))]
    let mut out: Vec<String> = FEATURE_PATTERNS
        .par_iter()
        .flat_map(|re| {
            re.captures_iter(&lower)
                .map(|cap| {
                    let m = cap.get(1).map(|m| m.as_str().trim()).unwrap_or(&cap[0]);
                    m.replace(['.', ','], "").trim().to_string()
                })
                .filter(|s| s.len() > 2)
                .collect::<Vec<_>>()
        })
        .collect();

    #[cfg(target_arch = "wasm32")]
    let mut out: Vec<String> = FEATURE_PATTERNS
        .iter()
        .flat_map(|re| {
            re.captures_iter(&lower)
                .map(|cap| {
                    let m = cap.get(1).map(|m| m.as_str().trim()).unwrap_or(&cap[0]);
                    m.replace(['.', ','], "").trim().to_string()
                })
                .filter(|s| s.len() > 2)
                .collect::<Vec<_>>()
        })
        .collect();

    let mut seen = FxHashSet::default();
    out.retain(|x| seen.insert(x.clone()));

    out
}

pub fn extract_data_flows(text: &str) -> Vec<String> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let lower = simd_parser::fast_lowercase_scan(text.as_bytes());
        let matches = simd_parser::fast_keyword_scan(&lower, DATA_FLOW_KEYWORDS);
        let mut seen = FxHashSet::default();
        let mut out = Vec::with_capacity(matches.len());
        for (_, keyword) in matches {
            if seen.insert(keyword.clone()) {
                out.push(keyword);
            }
        }
        out
    }
    #[cfg(target_arch = "wasm32")]
    {
        let lower = text.to_lowercase();
        let mut out = Vec::new();
        let mut seen = FxHashSet::default();
        for kw in DATA_FLOW_KEYWORDS {
            if lower.contains(kw) && seen.insert(kw.to_string()) {
                out.push(kw.to_string());
            }
        }
        out
    }
}

pub fn extract_tech_stack_hints(text: &str) -> Vec<String> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let lower = simd_parser::fast_lowercase_scan(text.as_bytes());
        let matches = simd_parser::fast_keyword_scan(&lower, TECH_STACK_KEYWORDS);
        let mut seen = FxHashSet::default();
        let mut out = Vec::with_capacity(matches.len());
        for (_, keyword) in matches {
            if seen.insert(keyword.clone()) {
                out.push(keyword);
            }
        }
        out
    }
    #[cfg(target_arch = "wasm32")]
    {
        let lower = text.to_lowercase();
        let mut out = Vec::new();
        let mut seen = FxHashSet::default();
        for kw in TECH_STACK_KEYWORDS {
            if lower.contains(kw) && seen.insert(kw.to_string()) {
                out.push(kw.to_string());
            }
        }
        out
    }
}

// ============================================================================
// Enriched Pipeline
// ============================================================================

/// Run the enriched NLP pipeline on text, producing enriched features, tech, etc.
fn run_enrichment_pipeline(text: &str) -> EnrichmentResult {
    let mut sentences = tokenizer::segment_sentences(text);
    let all_words = tokenizer::tokenize_words(text);
    let bigrams = tokenizer::bigrams(&all_words);

    // Pre-compute negation ranges once for O(1) lookups
    let negation_ranges = negation::compute_negation_ranges(&all_words);

    // --- Lexicon-based tech extraction ---
    let mut enriched_tech: Vec<TechHint> = Vec::new();
    let mut seen_tech = FxHashSet::default();

    for (i, word) in all_words.iter().enumerate() {
        if let Some((canonical, category)) = lexicon::resolve_tech(word) {
            if seen_tech.insert(canonical.to_string()) {
                let negated = negation::is_negated_with_ranges(&all_words, i, &negation_ranges);
                enriched_tech.push(TechHint {
                    canonical: canonical.to_string(),
                    matched_as: word.clone(),
                    category,
                    negated,
                    confidence: 0.95,
                });
            }
        }
    }

    // --- Lexicon-based feature extraction (single words + bigrams) ---
    let mut enriched_features: Vec<FeatureEntry> = Vec::new();
    let mut seen_features = FxHashSet::default();

    // Single-word features
    for (i, word) in all_words.iter().enumerate() {
        if let Some(canonical) = lexicon::resolve_feature(word) {
            if seen_features.insert(canonical.to_string()) {
                let negated = negation::is_negated_with_ranges(&all_words, i, &negation_ranges);
                let action = verb_actions::classify_verb_at(&all_words, i);
                enriched_features.push(FeatureEntry {
                    name: canonical.to_string(),
                    action,
                    negated,
                    priority: 5, // will be assigned later
                    confidence: 0.9,
                });
            }
        }
    }

    // Bi-gram phrase features
    for bigram in &bigrams {
        if let Some(canonical) = lexicon::resolve_phrase(bigram) {
            if seen_features.insert(canonical.to_string()) {
                enriched_features.push(FeatureEntry {
                    name: canonical.to_string(),
                    action: verb_actions::classify_verb_action(&all_words),
                    negated: false,
                    priority: 5,
                    confidence: 0.85,
                });
            }
        }
    }

    // --- Flat feature names for legacy compat ---
    let flat_features: Vec<String> = enriched_features
        .iter()
        .filter(|f| !f.negated)
        .map(|f| f.name.clone())
        .collect();

    // --- Flat tech names for legacy compat ---
    let flat_tech: Vec<String> = enriched_tech
        .iter()
        .filter(|t| !t.negated)
        .map(|t| t.canonical.clone())
        .collect();

    // --- Dependencies ---
    let dependency_graph = dependencies::infer_dependencies(&flat_features);

    // --- Classification ---
    let project_type =
        classifier::classify_project_type(&flat_features, &enriched_tech, &all_words);
    let architecture_pattern =
        classifier::classify_architecture(&flat_features, &enriched_tech, &all_words);

    // --- Scoring ---
    let complexity_score =
        scoring::compute_complexity(&enriched_features, &enriched_tech, &dependency_graph);
    scoring::assign_priorities(&mut enriched_features, &dependency_graph);

    // --- Annotate sentences (parallel on native, sequential on WASM) ---
    #[cfg(not(target_arch = "wasm32"))]
    {
        sentences.par_iter_mut().for_each(|sentence| {
            let s_words = tokenizer::tokenize_words(&sentence.text);
            for w in &s_words {
                if let Some((canonical, _)) = lexicon::resolve_tech(w) {
                    sentence.tech_found.push(canonical.to_string());
                }
                if let Some(canonical) = lexicon::resolve_feature(w) {
                    sentence.features_found.push(canonical.to_string());
                }
            }
            // Dedup
            sentence.tech_found.sort();
            sentence.tech_found.dedup();
            sentence.features_found.sort();
            sentence.features_found.dedup();
        });
    }

    #[cfg(target_arch = "wasm32")]
    {
        for sentence in &mut sentences {
            let s_words = tokenizer::tokenize_words(&sentence.text);
            for w in &s_words {
                if let Some((canonical, _)) = lexicon::resolve_tech(w) {
                    sentence.tech_found.push(canonical.to_string());
                }
                if let Some(canonical) = lexicon::resolve_feature(w) {
                    sentence.features_found.push(canonical.to_string());
                }
            }
            // Dedup
            sentence.tech_found.sort();
            sentence.tech_found.dedup();
            sentence.features_found.sort();
            sentence.features_found.dedup();
        }
    }

    EnrichmentResult {
        enriched_features,
        enriched_tech,
        flat_features,
        flat_tech,
        project_type,
        architecture_pattern,
        complexity_score,
        dependency_graph,
        sentences,
        all_words,
    }
}

struct EnrichmentResult {
    enriched_features: Vec<FeatureEntry>,
    enriched_tech: Vec<TechHint>,
    flat_features: Vec<String>,
    flat_tech: Vec<String>,
    project_type: ProjectType,
    architecture_pattern: ArchitecturePattern,
    complexity_score: f32,
    dependency_graph: Vec<DepEdge>,
    sentences: Vec<SentenceInfo>,
    #[allow(dead_code)]
    all_words: Vec<String>,
}

// ============================================================================
// Main Parse Function
// ============================================================================

pub fn parse_intent(text: &str, constraints: serde_json::Value) -> IntentOutput {
    let actors = extract_actors(text);
    let regex_features = extract_features(text);
    let data_flows = extract_data_flows(text);
    let regex_tech = extract_tech_stack_hints(text);

    let enrichment = run_enrichment_pipeline(text);

    // Merge regex features with lexicon features for the flat list
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

    // Merge regex tech with lexicon tech for the flat list
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
    IntentOutput {
        verification: Some(verification),
        ..output
    }
}

/// Batch parse multiple intents in parallel (native only)
#[cfg(not(target_arch = "wasm32"))]
pub fn parse_intents_batch(texts: &[&str], constraints: serde_json::Value) -> Vec<IntentOutput> {
    texts
        .par_iter()
        .map(|text| parse_intent(text, constraints.clone()))
        .collect()
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
        assert!(out
            .iter()
            .any(|s| s.contains("real-time") || s.contains("websocket")));
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
        assert!(parsed.get("data_flows").is_some());
        assert!(parsed.get("tech_stack_hints").is_some());
        assert!(parsed.get("constraints").is_some());
        assert!(parsed.get("raw").is_some());
        // New fields
        assert!(parsed.get("enriched_features").is_some());
        assert!(parsed.get("enriched_tech").is_some());
        assert!(parsed.get("project_type").is_some());
        assert!(parsed.get("architecture_pattern").is_some());
        assert!(parsed.get("complexity_score").is_some());
        assert!(parsed.get("confidence").is_some());
        assert!(parsed.get("dependency_graph").is_some());
        assert!(parsed.get("sentences").is_some());
    }

    #[test]
    fn test_batch_parsing() {
        let texts = vec![
            "Build a React app",
            "Create a Node API",
            "Make a Vue dashboard",
        ];
        let results = parse_intents_batch(&texts, serde_json::json!({}));
        assert_eq!(results.len(), 3);
        assert!(results[0]
            .tech_stack_hints
            .iter()
            .any(|s| s.contains("react")));
        assert!(results[1]
            .tech_stack_hints
            .iter()
            .any(|s| s.contains("node")));
        assert!(results[2]
            .tech_stack_hints
            .iter()
            .any(|s| s.contains("vue")));
    }

    #[test]
    fn test_deduplication() {
        let out = extract_tech_stack_hints("React React React with Node Node");
        let react_count = out.iter().filter(|s| s.contains("react")).count();
        let node_count = out.iter().filter(|s| s.contains("node")).count();
        assert_eq!(react_count, 1);
        assert_eq!(node_count, 1);
    }

    #[test]
    fn test_simd_support() {
        let support = get_simd_support();
        assert!(!support.is_empty());
    }

    // ========== New enrichment tests ==========

    #[test]
    fn test_synonym_resolution() {
        let intent = parse_intent("Use pg database with k8s", serde_json::json!({}));
        assert!(intent
            .enriched_tech
            .iter()
            .any(|t| t.canonical == "postgresql"));
        assert!(intent
            .enriched_tech
            .iter()
            .any(|t| t.canonical == "kubernetes"));
    }

    #[test]
    fn test_negation_detection() {
        let intent = parse_intent("Don't use React, build with Vue", serde_json::json!({}));
        let react = intent.enriched_tech.iter().find(|t| t.canonical == "react");
        let vue = intent.enriched_tech.iter().find(|t| t.canonical == "vue");
        assert!(
            react.map_or(false, |r| r.negated),
            "react should be negated"
        );
        assert!(
            vue.map_or(true, |v| !v.negated),
            "vue should not be negated"
        );
    }

    #[test]
    fn test_complexity_scoring() {
        let intent = parse_intent(
            "Build an e-commerce platform with authentication, RBAC, dashboard, payments, \
             real-time chat, notifications using React, Node, PostgreSQL, Redis, Docker, Kubernetes",
            serde_json::json!({}),
        );
        assert!(
            intent.complexity_score > 0.7,
            "complex input should have high complexity score, got {}",
            intent.complexity_score
        );
    }

    #[test]
    fn test_dependency_inference() {
        let intent = parse_intent(
            "Build RBAC with OAuth authentication",
            serde_json::json!({}),
        );
        let has_auth_dep = intent
            .dependency_graph
            .iter()
            .any(|d| d.to == "authentication");
        assert!(has_auth_dep, "RBAC should depend on authentication");
    }

    #[test]
    fn test_project_type_classification() {
        let intent = parse_intent(
            "Build a REST API with Express and PostgreSQL",
            serde_json::json!({}),
        );
        assert_eq!(intent.project_type, "api");
    }

    #[test]
    fn test_architecture_classification() {
        let intent = parse_intent(
            "Deploy serverless functions with AWS Lambda",
            serde_json::json!({}),
        );
        assert_eq!(intent.architecture_pattern, "serverless");
    }

    #[test]
    fn test_feature_priority() {
        let intent = parse_intent(
            "Build authentication, RBAC, dashboard, and billing",
            serde_json::json!({}),
        );
        // Auth should have high priority since others depend on it
        if let Some(auth) = intent
            .enriched_features
            .iter()
            .find(|f| f.name == "authentication")
        {
            assert!(
                auth.priority <= 3,
                "auth priority should be high (1-3), got {}",
                auth.priority
            );
        }
    }

    #[test]
    fn test_sentences_annotation() {
        let intent = parse_intent(
            "Build auth with React. Deploy to AWS.",
            serde_json::json!({}),
        );
        assert!(intent.sentences.len() >= 2);
    }

    #[test]
    fn test_verb_action_classification() {
        let intent = parse_intent("Migrate the database to PostgreSQL", serde_json::json!({}));
        // The dominant verb should be migrate
        if let Some(db_feature) = intent
            .enriched_features
            .iter()
            .find(|f| f.name == "database")
        {
            assert!(
                matches!(db_feature.action, types::VerbAction::Migrate),
                "database feature should have migrate action, got {:?}",
                db_feature.action
            );
        }
    }

    #[test]
    fn test_confidence_report() {
        let intent = parse_intent(
            "As an admin, build authentication with React and Express",
            serde_json::json!({}),
        );
        assert!(intent.confidence.overall > 0.3);
        assert!(intent.confidence.actors > 0.5);
    }

    #[test]
    fn test_phrase_matching() {
        let intent = parse_intent(
            "Add real time updates and task management",
            serde_json::json!({}),
        );
        let has_realtime = intent
            .enriched_features
            .iter()
            .any(|f| f.name == "real-time");
        let has_task_mgmt = intent
            .enriched_features
            .iter()
            .any(|f| f.name == "task-management");
        assert!(
            has_realtime || has_task_mgmt,
            "should match bi-gram phrases"
        );
    }
}

// ============================================================================
// WASM bindings
// ============================================================================

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn parse_intent_wasm(text: &str, constraints_json: &str) -> Result<JsValue, JsValue> {
    let constraints: serde_json::Value =
        serde_json::from_str(constraints_json).unwrap_or_else(|_| serde_json::json!({}));

    let intent = parse_intent(text, constraints);

    serde_wasm_bindgen::to_value(&intent)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn parse_intents_batch_wasm(
    texts: Vec<String>,
    constraints_json: &str,
) -> Result<JsValue, JsValue> {
    let constraints: serde_json::Value =
        serde_json::from_str(constraints_json).unwrap_or_else(|_| serde_json::json!({}));

    let text_refs: Vec<&str> = texts.iter().map(|s| s.as_str()).collect();
    let results = parse_intents_batch(&text_refs, constraints);

    serde_wasm_bindgen::to_value(&results)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn extract_actors_wasm(text: &str) -> Vec<String> {
    extract_actors(text)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn extract_features_wasm(text: &str) -> Vec<String> {
    extract_features(text)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn extract_data_flows_wasm(text: &str) -> Vec<String> {
    extract_data_flows(text)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn extract_tech_stack_hints_wasm(text: &str) -> Vec<String> {
    extract_tech_stack_hints(text)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn get_simd_support_wasm() -> String {
    get_simd_support()
}

// ============================================================================
// G-Agent Plan Generation
// ============================================================================

/// Parse intent and generate an execution plan in one step.
/// This is the main entry point for G-Agent task planning.
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

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn generate_plan_wasm(goal: &str, constraints_json: &str) -> Result<JsValue, JsValue> {
    let constraints: serde_json::Value =
        serde_json::from_str(constraints_json).unwrap_or_else(|_| serde_json::json!({}));

    let plan = generate_plan_from_text(goal, constraints);

    serde_wasm_bindgen::to_value(&plan)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn parse_and_plan_wasm(goal: &str, constraints_json: &str) -> Result<JsValue, JsValue> {
    let constraints: serde_json::Value =
        serde_json::from_str(constraints_json).unwrap_or_else(|_| serde_json::json!({}));

    let (intent, plan) = parse_and_plan(goal, constraints);

    // Return as a combined object
    let result = serde_json::json!({
        "intent": intent,
        "plan": plan
    });

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
