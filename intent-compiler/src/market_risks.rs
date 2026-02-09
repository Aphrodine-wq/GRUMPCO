//! Market Risks Module
//!
//! Risk factor analysis and go-to-market strategy.

use serde::{Deserialize, Serialize};

/// Risk Factor Analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskFactor {
    pub category: String,
    pub description: String,
    pub severity: f32, // 0-1
    pub mitigation: String,
}

/// Go-to-Market Strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoToMarketStrategy {
    pub primary_channel: String,
    pub secondary_channels: Vec<String>,
    pub launch_timeline_weeks: u32,
    pub initial_marketing_budget: u32,
    pub key_milestones: Vec<Milestone>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    pub week: u32,
    pub objective: String,
    pub success_metric: String,
}

/// Market Verdict
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Verdict {
    GoldenTicket,   // Multi-billion TAM, low competition, you're uniquely positioned
    Viable,         // Real opportunity, execute well to win
    Pivot,          // Core idea is good but market position is wrong
    PassOnThis,     // Crowded market, low margins, unclear moat
    TooEarly,       // Right idea, wrong time
    BuildAsFeature, // Better as a feature in existing platform
}

/// Identify risks based on project idea and features
pub fn identify_risks(idea: &str, _features: &[String]) -> Vec<RiskFactor> {
    let mut risks = vec![];

    if idea.to_lowercase().contains("social") {
        risks.push(RiskFactor {
            category: "Market Saturation".to_string(),
            description: "Social apps have extremely high failure rates".to_string(),
            severity: 0.9,
            mitigation: "Focus on niche community or unique mechanic".to_string(),
        });
    }

    risks.push(RiskFactor {
        category: "Execution".to_string(),
        description: "Building is easy, distribution is hard".to_string(),
        severity: 0.7,
        mitigation: "Start marketing before building".to_string(),
    });

    risks.push(RiskFactor {
        category: "Technical".to_string(),
        description: "Feature creep can delay launch".to_string(),
        severity: 0.5,
        mitigation: "Build MVP in 4-6 weeks, launch fast".to_string(),
    });

    risks
}

/// Build go-to-market strategy based on project idea
pub fn build_go_to_market_strategy(idea: &str) -> GoToMarketStrategy {
    let idea_lower = idea.to_lowercase();

    if idea_lower.contains("b2b") || idea_lower.contains("enterprise") {
        GoToMarketStrategy {
            primary_channel: "Direct sales + LinkedIn outreach".to_string(),
            secondary_channels: vec![
                "Content marketing".to_string(),
                "Product-led growth".to_string(),
            ],
            launch_timeline_weeks: 12,
            initial_marketing_budget: 10_000,
            key_milestones: vec![
                Milestone {
                    week: 4,
                    objective: "Beta with 5 design partners".to_string(),
                    success_metric: "5 active users".to_string(),
                },
                Milestone {
                    week: 8,
                    objective: "Public launch".to_string(),
                    success_metric: "50 signups".to_string(),
                },
            ],
        }
    } else {
        GoToMarketStrategy {
            primary_channel: "Social media + Product Hunt".to_string(),
            secondary_channels: vec![
                "Content marketing".to_string(),
                "App store optimization".to_string(),
            ],
            launch_timeline_weeks: 8,
            initial_marketing_budget: 2_000,
            key_milestones: vec![
                Milestone {
                    week: 4,
                    objective: "Beta launch".to_string(),
                    success_metric: "100 beta users".to_string(),
                },
                Milestone {
                    week: 8,
                    objective: "Product Hunt launch".to_string(),
                    success_metric: "500 upvotes".to_string(),
                },
            ],
        }
    }
}

/// Determine verdict based on market analysis
pub fn determine_verdict(
    idea: &str,
    segment: &super::market_segments::MarketSegment,
    competitors: &[super::market_competitors::Competitor],
    moats: &[super::market_competitors::CompetitiveMoat],
) -> Verdict {
    let idea_lower = idea.to_lowercase();

    // Golden ticket criteria
    if segment.your_fit_score > 0.8
        && matches!(
            segment.competition_level,
            super::market_segments::CompetitionLevel::Low
                | super::market_segments::CompetitionLevel::VeryLow
        )
        && moats.len() >= 2
    {
        return Verdict::GoldenTicket;
    }

    // Pass criteria
    if matches!(
        segment.competition_level,
        super::market_segments::CompetitionLevel::Saturated
    ) && competitors.len() > 3
    {
        return Verdict::PassOnThis;
    }

    // Too early criteria
    if idea_lower.contains("vr") || idea_lower.contains("ar") || idea_lower.contains("web3") {
        return Verdict::TooEarly;
    }

    // Build as feature criteria
    if idea_lower.contains("plugin") || idea_lower.contains("extension") {
        return Verdict::BuildAsFeature;
    }

    // Default to viable
    Verdict::Viable
}
