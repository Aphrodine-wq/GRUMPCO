//! Formal Intent Semantics
//!
//! Typed intent algebra: Intent = Action × Target × Constraints
//! Well-formedness rules and intent composition.

use crate::types::{IntentOutput, IntentVerification, VerbAction};
use serde::{Deserialize, Serialize};

/// Typed intent schema: Action × Target × Constraints
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypedIntent {
    pub action: VerbAction,
    pub target: String,
    pub constraints: Vec<IntentConstraint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentConstraint {
    pub key: String,
    pub value: serde_json::Value,
}

/// Verify that parsed intent conforms to the typed schema
pub fn verify_intent(output: &IntentOutput) -> IntentVerification {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    if output.raw.trim().is_empty() {
        errors.push("Intent raw text is empty".into());
    }

    if output.enriched_features.is_empty() && output.features.is_empty() {
        warnings.push("No features extracted; intent may be underspecified".into());
    }

    for f in &output.enriched_features {
        if f.name.is_empty() {
            errors.push("Feature entry has empty name".into());
        }
        if f.confidence < 0.0 || f.confidence > 1.0 {
            warnings.push(format!(
                "Feature '{}' has out-of-range confidence {}",
                f.name, f.confidence
            ));
        }
    }

    for t in &output.enriched_tech {
        if t.canonical.is_empty() {
            errors.push("Tech hint has empty canonical form".into());
        }
    }

    if output.complexity_score < 0.0 || output.complexity_score > 1.0 {
        warnings.push(format!(
            "Complexity score {} is out of range [0,1]",
            output.complexity_score
        ));
    }

    let well_formed = errors.is_empty();
    IntentVerification {
        well_formed,
        errors,
        warnings,
    }
}

/// Compose two intents (merge semantics)
pub fn compose_intents(a: &IntentOutput, b: &IntentOutput) -> IntentOutput {
    let mut features = a.features.clone();
    for f in &b.features {
        if !features.contains(f) {
            features.push(f.clone());
        }
    }

    let mut actors = a.actors.clone();
    for x in &b.actors {
        if !actors.contains(x) {
            actors.push(x.clone());
        }
    }

    let mut data_flows = a.data_flows.clone();
    for d in &b.data_flows {
        if !data_flows.contains(d) {
            data_flows.push(d.clone());
        }
    }

    let mut tech_stack_hints = a.tech_stack_hints.clone();
    for t in &b.tech_stack_hints {
        if !tech_stack_hints.contains(t) {
            tech_stack_hints.push(t.clone());
        }
    }

    let mut enriched_features = a.enriched_features.clone();
    for ef in &b.enriched_features {
        if !enriched_features.iter().any(|e| e.name == ef.name) {
            enriched_features.push(ef.clone());
        }
    }

    let mut enriched_tech = a.enriched_tech.clone();
    for et in &b.enriched_tech {
        if !enriched_tech.iter().any(|e| e.canonical == et.canonical) {
            enriched_tech.push(et.clone());
        }
    }

    let constraints = merge_constraints(&a.constraints, &b.constraints);
    let complexity_score = (a.complexity_score + b.complexity_score) / 2.0_f32.min(1.0);
    let raw = if a.raw == b.raw {
        a.raw.clone()
    } else {
        format!("{}; {}", a.raw.trim(), b.raw.trim())
    };

    let composed = IntentOutput {
        actors,
        features,
        data_flows,
        tech_stack_hints,
        constraints,
        raw,
        enriched_features,
        enriched_tech,
        project_type: a.project_type.clone(),
        architecture_pattern: a.architecture_pattern.clone(),
        complexity_score,
        confidence: a.confidence.clone(),
        dependency_graph: a.dependency_graph.clone(),
        sentences: a.sentences.clone(),
        verification: None,
    };
    let verified = verify_intent(&composed);
    IntentOutput {
        verification: Some(verified),
        ..composed
    }
}

fn merge_constraints(a: &serde_json::Value, b: &serde_json::Value) -> serde_json::Value {
    let mut merged = serde_json::Map::new();
    if let Some(obj) = a.as_object() {
        for (k, v) in obj {
            merged.insert(k.clone(), v.clone());
        }
    }
    if let Some(obj) = b.as_object() {
        for (k, v) in obj {
            merged.insert(k.clone(), v.clone());
        }
    }
    serde_json::Value::Object(merged)
}

/// Semantic Insight: Extract implicit requirements from intent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImplicitRequirement {
    pub category: String,
    pub requirement: String,
    pub confidence: f32,
    pub reasoning: String,
}

/// Extract implicit requirements based on features and tech stack
pub fn extract_implicit_requirements(output: &IntentOutput) -> Vec<ImplicitRequirement> {
    let mut requirements = Vec::new();

    // Database implicit requirement
    if output
        .features
        .iter()
        .any(|f| f.contains("user") || f.contains("persist") || f.contains("store"))
    {
        requirements.push(ImplicitRequirement {
            category: "database".to_string(),
            requirement: "Database persistence".to_string(),
            confidence: 0.85,
            reasoning: "Features mention user data or persistence".to_string(),
        });
    }

    // Authentication implicit requirement
    if output
        .features
        .iter()
        .any(|f| f.contains("user") || f.contains("auth") || f.contains("login"))
    {
        requirements.push(ImplicitRequirement {
            category: "auth".to_string(),
            requirement: "Authentication system".to_string(),
            confidence: 0.90,
            reasoning: "User management features detected".to_string(),
        });
    }

    // API implicit requirement
    if output
        .tech_stack_hints
        .iter()
        .any(|t| t.contains("React") || t.contains("Vue") || t.contains("Angular"))
    {
        requirements.push(ImplicitRequirement {
            category: "api".to_string(),
            requirement: "REST or GraphQL API".to_string(),
            confidence: 0.80,
            reasoning: "Frontend framework detected; backend API needed".to_string(),
        });
    }

    // Testing implicit requirement
    if output.complexity_score > 0.5 {
        requirements.push(ImplicitRequirement {
            category: "testing".to_string(),
            requirement: "Unit and integration tests".to_string(),
            confidence: 0.75,
            reasoning: "Project complexity warrants automated testing".to_string(),
        });
    }

    // Security implicit requirement
    if output
        .features
        .iter()
        .any(|f| f.contains("payment") || f.contains("sensitive") || f.contains("api"))
    {
        requirements.push(ImplicitRequirement {
            category: "security".to_string(),
            requirement: "Security hardening (HTTPS, input validation, rate limiting)".to_string(),
            confidence: 0.85,
            reasoning: "Project handles sensitive data or external access".to_string(),
        });
    }

    requirements
}

/// Contradiction: Two features/constraints that conflict
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contradiction {
    pub entity_a: String,
    pub entity_b: String,
    pub conflict_type: String,
    pub severity: f32,
    pub recommendation: String,
}

/// Detect contradictions in requirements
pub fn detect_contradictions(output: &IntentOutput) -> Vec<Contradiction> {
    let mut contradictions = Vec::new();

    let tech_str = output.tech_stack_hints.join(" ").to_lowercase();

    // Check for framework conflicts
    if tech_str.contains("react") && tech_str.contains("vue") {
        contradictions.push(Contradiction {
            entity_a: "React".to_string(),
            entity_b: "Vue".to_string(),
            conflict_type: "mutually_exclusive_frameworks".to_string(),
            severity: 0.95,
            recommendation:
                "Choose one frontend framework. React for large apps, Vue for lightweight UIs"
                    .to_string(),
        });
    }

    // Check for language conflicts
    if tech_str.contains("python") && tech_str.contains("rust") && tech_str.contains("node") {
        contradictions.push(Contradiction {
            entity_a: "Multiple backend languages".to_string(),
            entity_b: "Complexity".to_string(),
            conflict_type: "over_complex_stack".to_string(),
            severity: 0.70,
            // Using recommendation field instead of reasoning as per struct definition
            recommendation: "Consolidate to 1-2 backend languages for maintainability".to_string(),
        });
    }

    // Check for scale contradictions
    if output
        .constraints
        .get("scale")
        .is_some_and(|v| v.as_str() == Some("minimal"))
        && output.features.len() > 10
    {
        contradictions.push(Contradiction {
            entity_a: "Minimal scale requirement".to_string(),
            entity_b: "10+ features".to_string(),
            conflict_type: "scope_mismatch".to_string(),
            severity: 0.65,
            recommendation:
                "Clarify scope: either reduce features for minimal setup or increase scale"
                    .to_string(),
        });
    }

    contradictions
}

/// Context-aware code style suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StyleSuggestion {
    pub language: String,
    pub pattern: String,
    pub rationale: String,
}

pub fn suggest_code_style(output: &IntentOutput) -> Vec<StyleSuggestion> {
    let mut suggestions = Vec::new();

    let tech_str = output.tech_stack_hints.join(" ").to_lowercase();

    // TypeScript suggestions for Node/React
    if (tech_str.contains("react") || tech_str.contains("node")) && !tech_str.contains("typescript")
    {
        suggestions.push(StyleSuggestion {
            language: "TypeScript".to_string(),
            pattern: "strict type safety".to_string(),
            rationale: "Modern Node/React projects benefit from static typing".to_string(),
        });
    }

    // Async/await for JavaScript
    if tech_str.contains("node") || tech_str.contains("javascript") {
        suggestions.push(StyleSuggestion {
            language: "JavaScript".to_string(),
            pattern: "async/await pattern".to_string(),
            rationale: "Cleaner than callbacks/promises for asynchronous code".to_string(),
        });
    }

    // Functional programming for backend
    if output.architecture_pattern.contains("microservice") {
        suggestions.push(StyleSuggestion {
            language: "Backend".to_string(),
            pattern: "pure functions & immutability".to_string(),
            rationale: "Microservices benefit from functional patterns for reliability".to_string(),
        });
    }

    suggestions
}
