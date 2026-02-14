//! Enriched NLP pipeline — runs lexicon resolution, negation detection,
//! verb classification, dependency inference, scoring, and sentence annotation.

use rustc_hash::FxHashSet;

#[cfg(not(target_arch = "wasm32"))]
use rayon::prelude::*;

use crate::types::*;
use crate::{classifier, dependencies, lexicon, negation, scoring, tokenizer, verb_actions};

// ============================================================================
// Enrichment Result
// ============================================================================

pub(crate) struct EnrichmentResult {
    pub enriched_features: Vec<FeatureEntry>,
    pub enriched_tech: Vec<TechHint>,
    pub flat_features: Vec<String>,
    pub flat_tech: Vec<String>,
    pub project_type: ProjectType,
    pub architecture_pattern: ArchitecturePattern,
    pub complexity_score: f32,
    pub dependency_graph: Vec<DepEdge>,
    pub sentences: Vec<SentenceInfo>,
    #[allow(dead_code)]
    pub all_words: Vec<String>,
}

// ============================================================================
// Enrichment Pipeline
// ============================================================================

/// Run the enriched NLP pipeline on text, producing enriched features, tech, etc.
pub(crate) fn run_enrichment_pipeline(text: &str) -> EnrichmentResult {
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
