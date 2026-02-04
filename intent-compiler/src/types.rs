use serde::{Deserialize, Serialize};

// ============================================================================
// Enums
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum VerbAction {
    #[default]
    Build,
    Migrate,
    Remove,
    Integrate,
    Configure,
    Deploy,
    Refactor,
    Test,
}


#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum ProjectType {
    WebApp,
    Api,
    Cli,
    MobileApp,
    Library,
    Microservice,
    #[default]
    Unknown,
}


impl ProjectType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectType::WebApp => "web_app",
            ProjectType::Api => "api",
            ProjectType::Cli => "cli",
            ProjectType::MobileApp => "mobile_app",
            ProjectType::Library => "library",
            ProjectType::Microservice => "microservice",
            ProjectType::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum ArchitecturePattern {
    Monolith,
    Microservices,
    Serverless,
    EventDriven,
    Jamstack,
    #[default]
    Unknown,
}


impl ArchitecturePattern {
    pub fn as_str(&self) -> &'static str {
        match self {
            ArchitecturePattern::Monolith => "monolith",
            ArchitecturePattern::Microservices => "microservices",
            ArchitecturePattern::Serverless => "serverless",
            ArchitecturePattern::EventDriven => "event_driven",
            ArchitecturePattern::Jamstack => "jamstack",
            ArchitecturePattern::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TechCategory {
    Frontend,
    Backend,
    Database,
    DevOps,
    Language,
    Framework,
    Tool,
    Cloud,
}

// ============================================================================
// Confidence Scoring Types
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum ExtractionSource {
    /// Extracted via regex pattern matching
    Regex,
    /// Extracted via NLP/lexicon analysis
    Nlp,
    /// Combined/hybrid approach
    Hybrid,
    /// Fallback/default value
    #[default]
    Default,
}


/// A field extracted from natural language with confidence metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedField {
    /// The extracted value
    pub value: String,
    /// Confidence score 0.0-1.0 based on pattern match quality
    pub confidence: f32,
    /// Source of extraction
    pub source: ExtractionSource,
    /// Optional: original matched text (for debugging)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matched_text: Option<String>,
}

impl ExtractedField {
    /// Create a new extracted field
    pub fn new(value: impl Into<String>, confidence: f32, source: ExtractionSource) -> Self {
        Self {
            value: value.into(),
            confidence: confidence.clamp(0.0, 1.0),
            source,
            matched_text: None,
        }
    }

    /// Create with matched text for debugging
    pub fn with_match(
        value: impl Into<String>,
        confidence: f32,
        source: ExtractionSource,
        matched: impl Into<String>,
    ) -> Self {
        Self {
            value: value.into(),
            confidence: confidence.clamp(0.0, 1.0),
            source,
            matched_text: Some(matched.into()),
        }
    }

    /// Create a high-confidence regex match
    pub fn regex(value: impl Into<String>, confidence: f32) -> Self {
        Self::new(value, confidence, ExtractionSource::Regex)
    }

    /// Create an NLP-based extraction
    pub fn nlp(value: impl Into<String>, confidence: f32) -> Self {
        Self::new(value, confidence, ExtractionSource::Nlp)
    }

    /// Create a default/fallback value
    pub fn default_value(value: impl Into<String>) -> Self {
        Self::new(value, 0.5, ExtractionSource::Default)
    }
}

/// Cache statistics for monitoring
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CacheMetrics {
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub inserts: u64,
}

impl CacheMetrics {
    pub fn hit_rate(&self) -> f32 {
        let total = self.hits + self.misses;
        if total == 0 {
            0.0
        } else {
            self.hits as f32 / total as f32
        }
    }

    pub fn record_hit(&mut self) {
        self.hits += 1;
    }

    pub fn record_miss(&mut self) {
        self.misses += 1;
    }

    pub fn record_eviction(&mut self) {
        self.evictions += 1;
    }

    pub fn record_insert(&mut self) {
        self.inserts += 1;
    }
}

// ============================================================================
// Structs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureEntry {
    pub name: String,
    pub action: VerbAction,
    pub negated: bool,
    pub priority: u8,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechHint {
    pub canonical: String,
    pub matched_as: String,
    pub category: TechCategory,
    pub negated: bool,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfidenceReport {
    pub overall: f32,
    pub actors: f32,
    pub features: f32,
    pub tech_stack: f32,
}

impl Default for ConfidenceReport {
    fn default() -> Self {
        ConfidenceReport {
            overall: 0.0,
            actors: 0.0,
            features: 0.0,
            tech_stack: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepEdge {
    pub from: String,
    pub to: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentenceInfo {
    pub text: String,
    pub index: usize,
    pub features_found: Vec<String>,
    pub tech_found: Vec<String>,
}

// ============================================================================
// Enriched IntentOutput
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentVerification {
    pub well_formed: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentOutput {
    // Legacy fields (backward compatible)
    pub actors: Vec<String>,
    pub features: Vec<String>,
    pub data_flows: Vec<String>,
    pub tech_stack_hints: Vec<String>,
    pub constraints: serde_json::Value,
    pub raw: String,
    // New enriched fields
    pub enriched_features: Vec<FeatureEntry>,
    pub enriched_tech: Vec<TechHint>,
    pub project_type: String,
    pub architecture_pattern: String,
    pub complexity_score: f32,
    pub confidence: ConfidenceReport,
    pub dependency_graph: Vec<DepEdge>,
    pub sentences: Vec<SentenceInfo>,
    /// Formal semantics verification (well-formedness check)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verification: Option<IntentVerification>,
}
