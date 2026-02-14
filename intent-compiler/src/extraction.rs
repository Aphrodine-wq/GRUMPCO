//! Core extraction functions for actors, features, data flows, and tech stack hints.
//!
//! These functions operate on raw text and produce flat lists of extracted items.

use once_cell::sync::Lazy;
use regex::Regex;
use rustc_hash::FxHashSet;

#[cfg(not(target_arch = "wasm32"))]
use rayon::prelude::*;

use crate::keywords::{DATA_FLOW_KEYWORDS, TECH_STACK_KEYWORDS};

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
// Text Normalization
// ============================================================================

pub(crate) fn lowercase_text(text: &str) -> String {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let bytes = crate::simd_parser::fast_lowercase_scan(text.as_bytes());
        String::from_utf8_lossy(&bytes).into_owned()
    }
    #[cfg(target_arch = "wasm32")]
    {
        text.to_lowercase()
    }
}

// ============================================================================
// Core Extraction Functions
// ============================================================================

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
        let lower = crate::simd_parser::fast_lowercase_scan(text.as_bytes());
        let matches = crate::simd_parser::fast_keyword_scan(&lower, DATA_FLOW_KEYWORDS);
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
        let lower = crate::simd_parser::fast_lowercase_scan(text.as_bytes());
        let matches = crate::simd_parser::fast_keyword_scan(&lower, TECH_STACK_KEYWORDS);
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
