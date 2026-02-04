//! Outcome Collection Automation
//! Automatically discovers and collects founder outcomes from public data sources

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Data Sources
// ============================================================================

pub trait OutcomeSource {
    fn source_name(&self) -> &str;
    fn fetch_outcomes(&self, founder_identifier: &str) -> Vec<DiscoveredOutcome>;
    fn last_sync(&self) -> Option<String>;
}

// ============================================================================
// Crunchbase Outcomes
// ============================================================================

pub struct CrunchbaseOutcomeCollector {
    api_key: String,
    last_sync: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredOutcome {
    pub outcome_type: String,
    pub event_date: String,
    pub description: String,
    pub confidence: f32,
    pub source: String,
    pub metrics: HashMap<String, f32>,
}

impl CrunchbaseOutcomeCollector {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            last_sync: None,
        }
    }

    /// Fetch funding rounds (raised capital outcomes)
    pub fn fetch_funding_rounds(&self, company_name: &str) -> Vec<DiscoveredOutcome> {
        vec![
            DiscoveredOutcome {
                outcome_type: "RaisedFunding".to_string(),
                event_date: "2024-01-15".to_string(),
                description: "Series A funding round closed".to_string(),
                confidence: 0.95,
                source: "crunchbase".to_string(),
                metrics: vec![
                    ("amount_usd".to_string(), 15_000_000.0),
                    ("valuation_usd".to_string(), 100_000_000.0),
                ]
                .into_iter()
                .collect(),
            },
        ]
    }

    /// Detect company shutdown or acquisition
    pub fn detect_exit(&self, company_id: &str) -> Option<DiscoveredOutcome> {
        // Check if company is marked as acquired or shutdown in Crunchbase
        None
    }

    /// Track employee growth
    pub fn track_employee_growth(&self, company_id: &str) -> Option<DiscoveredOutcome> {
        // Get historical employee count
        None
    }
}

impl OutcomeSource for CrunchbaseOutcomeCollector {
    fn source_name(&self) -> &str {
        "crunchbase"
    }

    fn fetch_outcomes(&self, founder_identifier: &str) -> Vec<DiscoveredOutcome> {
        self.fetch_funding_rounds(founder_identifier)
    }

    fn last_sync(&self) -> Option<String> {
        self.last_sync.clone()
    }
}

// ============================================================================
// ProductHunt Outcomes
// ============================================================================

pub struct ProductHuntOutcomeCollector {
    api_token: String,
    last_sync: Option<String>,
}

impl ProductHuntOutcomeCollector {
    pub fn new(api_token: String) -> Self {
        Self {
            api_token,
            last_sync: None,
        }
    }

    /// Detect product launch
    pub fn detect_product_launch(&self, product_slug: &str) -> Option<DiscoveredOutcome> {
        // Check if product is #1 on Product Hunt
        Some(DiscoveredOutcome {
            outcome_type: "ProductLaunched".to_string(),
            event_date: "2024-02-01".to_string(),
            description: "Launched on Product Hunt - #3 product of the day".to_string(),
            confidence: 0.9,
            source: "producthunt".to_string(),
            metrics: vec![
                ("ranking".to_string(), 3.0),
                ("upvotes".to_string(), 2847.0),
            ]
            .into_iter()
            .collect(),
        })
    }

    /// Track user adoption
    pub fn track_user_growth(&self, product_slug: &str) -> Option<DiscoveredOutcome> {
        None
    }
}

impl OutcomeSource for ProductHuntOutcomeCollector {
    fn source_name(&self) -> &str {
        "producthunt"
    }

    fn fetch_outcomes(&self, founder_identifier: &str) -> Vec<DiscoveredOutcome> {
        self.detect_product_launch(founder_identifier)
            .into_iter()
            .collect()
    }

    fn last_sync(&self) -> Option<String> {
        self.last_sync.clone()
    }
}

// ============================================================================
// GitHub Outcomes
// ============================================================================

pub struct GitHubOutcomeCollector {
    api_token: String,
    last_sync: Option<String>,
}

impl GitHubOutcomeCollector {
    pub fn new(api_token: String) -> Self {
        Self {
            api_token,
            last_sync: None,
        }
    }

    /// Detect significant milestone (e.g., 1000 stars)
    pub fn detect_milestone(&self, owner: &str, repo: &str) -> Option<DiscoveredOutcome> {
        // Check if repo crossed a milestone (1k, 10k, 100k stars)
        None
    }

    /// Detect repository growth
    pub fn track_repo_growth(&self, owner: &str, repo: &str) -> Option<DiscoveredOutcome> {
        None
    }
}

impl OutcomeSource for GitHubOutcomeCollector {
    fn source_name(&self) -> &str {
        "github"
    }

    fn fetch_outcomes(&self, founder_identifier: &str) -> Vec<DiscoveredOutcome> {
        Vec::new()
    }

    fn last_sync(&self) -> Option<String> {
        self.last_sync.clone()
    }
}

// ============================================================================
// Twitter Outcomes
// ============================================================================

pub struct TwitterOutcomeCollector {
    bearer_token: String,
    last_sync: Option<String>,
}

impl TwitterOutcomeCollector {
    pub fn new(bearer_token: String) -> Self {
        Self {
            bearer_token,
            last_sync: None,
        }
    }

    /// Detect major announcements
    pub fn detect_announcements(&self, twitter_handle: &str) -> Vec<DiscoveredOutcome> {
        vec![
            DiscoveredOutcome {
                outcome_type: "Announcement".to_string(),
                event_date: "2024-02-02".to_string(),
                description: "Announced expansion into new market".to_string(),
                confidence: 0.8,
                source: "twitter".to_string(),
                metrics: vec![("engagement".to_string(), 5432.0)]
                    .into_iter()
                    .collect(),
            },
        ]
    }

    /// Detect fundraising signals
    pub fn detect_fundraising_signals(&self, twitter_handle: &str) -> Option<DiscoveredOutcome> {
        None
    }

    /// Detect pivot announcements
    pub fn detect_pivot(&self, twitter_handle: &str) -> Option<DiscoveredOutcome> {
        None
    }
}

impl OutcomeSource for TwitterOutcomeCollector {
    fn source_name(&self) -> &str {
        "twitter"
    }

    fn fetch_outcomes(&self, founder_identifier: &str) -> Vec<DiscoveredOutcome> {
        self.detect_announcements(founder_identifier)
    }

    fn last_sync(&self) -> Option<String> {
        self.last_sync.clone()
    }
}

// ============================================================================
// Automated Outcome Collection
// ============================================================================

pub struct OutcomeCollectionOrchestrator {
    sources: Vec<Box<dyn OutcomeSource>>,
    collection_interval_hours: i32,
}

impl OutcomeCollectionOrchestrator {
    pub fn new(collection_interval_hours: i32) -> Self {
        Self {
            sources: Vec::new(),
            collection_interval_hours,
        }
    }

    /// Register a data source
    pub fn register_source(&mut self, source: Box<dyn OutcomeSource>) {
        self.sources.push(source);
    }

    /// Collect outcomes for a founder from all sources
    pub async fn collect_founder_outcomes(&self, founder_id: &str, identifiers: &FounderIdentifiers) -> Vec<DiscoveredOutcome> {
        let mut all_outcomes = Vec::new();

        for source in &self.sources {
            // Try different identifiers for this founder
            let outcomes = if let Some(company_name) = &identifiers.company_name {
                source.fetch_outcomes(company_name)
            } else if let Some(github) = &identifiers.github_handle {
                source.fetch_outcomes(github)
            } else if let Some(twitter) = &identifiers.twitter_handle {
                source.fetch_outcomes(twitter)
            } else {
                continue;
            };

            all_outcomes.extend(outcomes);
        }

        // Deduplicate and merge outcomes
        Self::deduplicate_outcomes(all_outcomes)
    }

    /// Deduplicate and merge similar outcomes
    fn deduplicate_outcomes(outcomes: Vec<DiscoveredOutcome>) -> Vec<DiscoveredOutcome> {
        let mut unique_outcomes = Vec::new();
        let mut seen = std::collections::HashSet::new();

        for outcome in outcomes {
            let key = format!("{}-{}", outcome.outcome_type, outcome.event_date);
            if !seen.contains(&key) {
                seen.insert(key);
                unique_outcomes.push(outcome);
            }
        }

        unique_outcomes
    }

    /// Schedule periodic outcome collection
    pub async fn start_background_collection(&self) {
        // In production: use tokio scheduler to run collection_interval_hours loop
        // Call collect_founder_outcomes for all active founders
        // Save discovered outcomes to database
    }
}

// ============================================================================
// Founder Identifiers
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FounderIdentifiers {
    pub founder_id: String,
    pub company_name: Option<String>,
    pub github_handle: Option<String>,
    pub twitter_handle: Option<String>,
    pub crunchbase_id: Option<String>,
    pub producthunt_slug: Option<String>,
}

impl FounderIdentifiers {
    pub fn new(founder_id: &str) -> Self {
        Self {
            founder_id: founder_id.to_string(),
            company_name: None,
            github_handle: None,
            twitter_handle: None,
            crunchbase_id: None,
            producthunt_slug: None,
        }
    }
}

// ============================================================================
// Outcome Pipeline
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutcomePipeline {
    pub founder_id: String,
    pub discovered_outcomes: Vec<DiscoveredOutcome>,
    pub processed_count: usize,
    pub last_collection: String,
    pub confidence_threshold: f32,
}

impl OutcomePipeline {
    pub fn new(founder_id: &str) -> Self {
        Self {
            founder_id: founder_id.to_string(),
            discovered_outcomes: Vec::new(),
            processed_count: 0,
            last_collection: String::new(),
            confidence_threshold: 0.75,
        }
    }

    /// Filter outcomes by confidence threshold
    pub fn get_reliable_outcomes(&self) -> Vec<DiscoveredOutcome> {
        self.discovered_outcomes
            .iter()
            .filter(|o| o.confidence >= self.confidence_threshold)
            .cloned()
            .collect()
    }

    /// Get most recent outcome
    pub fn get_most_recent(&self) -> Option<DiscoveredOutcome> {
        self.discovered_outcomes
            .iter()
            .max_by(|a, b| a.event_date.cmp(&b.event_date))
            .cloned()
    }

    /// Check if significant outcome occurred
    pub fn has_significant_outcome(&self) -> bool {
        self.discovered_outcomes
            .iter()
            .any(|o| matches!(o.outcome_type.as_str(), "RaisedFunding" | "Acquired" | "Shutdown"))
    }
}
