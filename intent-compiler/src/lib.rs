//! G-Rump Intent Compiler Library
//! Provides parsing functions for natural language intent extraction
//! 
//! Optimizations:
//! - Cached regex patterns using once_cell (compiled once, reused)
//! - SIMD-accelerated keyword scanning (AVX2/AVX-512 on supported CPUs)
//! - FxHashSet for faster deduplication
//! - Parallel processing with rayon (native only)
//! - Batch parsing API for multiple intents

use once_cell::sync::Lazy;
use regex::Regex;
use rustc_hash::FxHashSet;
use serde::{Deserialize, Serialize};

#[cfg(all(target_os = "linux", not(target_arch = "wasm32")))]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

// Use rayon for parallel processing on native targets only
#[cfg(not(target_arch = "wasm32"))]
use rayon::prelude::*;

// WASM bindings
#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

// SIMD optimizations
#[cfg(not(target_arch = "wasm32"))]
pub mod simd_parser;

// ============================================================================
// Cached Regex Patterns (compiled once at first use)
// ============================================================================

/// Cached actor extraction patterns
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

/// Cached feature extraction patterns
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

/// Data flow keywords for SIMD scanning
const DATA_FLOW_KEYWORDS: &[&str] = &[
    "api", "rest", "graphql", "websocket", "real-time", "sync", "async",
    "request", "response", "webhook", "queue", "event", "stream",
];

/// Tech stack keywords for SIMD scanning
const TECH_STACK_KEYWORDS: &[&str] = &[
    "vue", "react", "svelte", "node", "express", "python", "fastapi", "go",
    "postgres", "postgresql", "mongodb", "redis", "sqlite",
    "docker", "kubernetes", "aws", "vercel", "netlify",
    "typescript", "javascript", "rust", "java", "ruby", "rails",
    "nextjs", "nuxt", "angular", "tailwind", "prisma", "supabase",
];

// ============================================================================
// Data Structures
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IntentOutput {
    pub actors: Vec<String>,
    pub features: Vec<String>,
    pub data_flows: Vec<String>,
    pub tech_stack_hints: Vec<String>,
    pub constraints: serde_json::Value,
    pub raw: String,
}

// ============================================================================
// Core Extraction Functions
// ============================================================================

/// Extract actors: "user", "admin", "developer", "customer", etc.
/// Uses cached regex patterns and FxHashSet for deduplication
pub fn extract_actors(text: &str) -> Vec<String> {
    #[cfg(not(target_arch = "wasm32"))]
    let lower = {
        let bytes = simd_parser::fast_lowercase_scan(text.as_bytes());
        String::from_utf8_lossy(&bytes).into_owned()
    };
    
    #[cfg(target_arch = "wasm32")]
    let lower = text.to_lowercase();

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

    // Deduplicate with FxHashSet (faster than std HashSet)
    let mut seen = FxHashSet::default();
    out.retain(|x| seen.insert(x.clone()));

    if out.is_empty() {
        out.push("user".to_string());
    }
    out
}

/// Extract feature-like phrases (build X, support Y, allow Z, etc.)
/// Uses cached regex patterns and FxHashSet for deduplication
pub fn extract_features(text: &str) -> Vec<String> {
    #[cfg(not(target_arch = "wasm32"))]
    let lower = {
        let bytes = simd_parser::fast_lowercase_scan(text.as_bytes());
        String::from_utf8_lossy(&bytes).into_owned()
    };
    
    #[cfg(target_arch = "wasm32")]
    let lower = text.to_lowercase();

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

    // Deduplicate with FxHashSet
    let mut seen = FxHashSet::default();
    out.retain(|x| seen.insert(x.clone()));

    out
}

/// Extract data-flow hints using SIMD-accelerated keyword scanning
pub fn extract_data_flows(text: &str) -> Vec<String> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let lower = simd_parser::fast_lowercase_scan(text.as_bytes());
        let matches = simd_parser::fast_keyword_scan(&lower, DATA_FLOW_KEYWORDS);
        
        // Deduplicate while preserving order
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

/// Extract tech stack hints using SIMD-accelerated keyword scanning
pub fn extract_tech_stack_hints(text: &str) -> Vec<String> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let lower = simd_parser::fast_lowercase_scan(text.as_bytes());
        let matches = simd_parser::fast_keyword_scan(&lower, TECH_STACK_KEYWORDS);
        
        // Deduplicate while preserving order
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
// Parsing Functions
// ============================================================================

/// Parse full intent from text
pub fn parse_intent(text: &str, constraints: serde_json::Value) -> IntentOutput {
    IntentOutput {
        actors: extract_actors(text),
        features: extract_features(text),
        data_flows: extract_data_flows(text),
        tech_stack_hints: extract_tech_stack_hints(text),
        constraints,
        raw: text.to_string(),
    }
}

/// Batch parse multiple intents in parallel (native only)
/// Falls back to sequential processing on WASM
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

/// Get SIMD support level for diagnostics
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
        assert!(parsed.get("data_flows").is_some());
        assert!(parsed.get("tech_stack_hints").is_some());
        assert!(parsed.get("constraints").is_some());
        assert!(parsed.get("raw").is_some());
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
        assert!(results[0].tech_stack_hints.iter().any(|s| s.contains("react")));
        assert!(results[1].tech_stack_hints.iter().any(|s| s.contains("node")));
        assert!(results[2].tech_stack_hints.iter().any(|s| s.contains("vue")));
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
}

// ============================================================================
// WASM bindings
// ============================================================================

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn parse_intent_wasm(text: &str, constraints_json: &str) -> Result<JsValue, JsValue> {
    let constraints: serde_json::Value = serde_json::from_str(constraints_json)
        .unwrap_or_else(|_| serde_json::json!({}));

    let intent = parse_intent(text, constraints);

    serde_wasm_bindgen::to_value(&intent)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn parse_intents_batch_wasm(texts: Vec<String>, constraints_json: &str) -> Result<JsValue, JsValue> {
    let constraints: serde_json::Value = serde_json::from_str(constraints_json)
        .unwrap_or_else(|_| serde_json::json!({}));

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
