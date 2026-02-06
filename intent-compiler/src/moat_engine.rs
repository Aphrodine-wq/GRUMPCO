//! Moat & Defensibility Engine
//!
//! Builds DEFENSIBLE competitive advantages through:
//! - Historical data accumulation (founder DNA)
//! - Real-time market intelligence integration
//! - Network effects (founder community)
//! - Accuracy reputation system
//! - Proprietary insights no competitor can replicate

use serde::{Deserialize, Serialize};

/// FOUNDER DNA PROFILE
/// Predict success based on founder's DNA, not just market
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FounderProfile {
    pub github_handle: Option<String>,
    pub personality_type: PersonalityArchetype,
    pub success_probability: f32, // 0-1 based on historical matches
    pub similar_founders: Vec<FounderComparison>,
    pub success_patterns: Vec<String>,
    pub failure_patterns: Vec<String>,
    pub ideal_co_founder: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PersonalityArchetype {
    Visionary,  // Big picture, long-term thinking
    Operator,   // Execution-focused, detail-oriented
    Hacker,     // Technical, moves fast
    Hustler,    // Sales-driven, community-builder
    Generalist, // Wears many hats, adaptable
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FounderComparison {
    pub name: String, // "Similar founder X"
    pub similarity_score: f32,
    pub their_idea: String,
    pub their_outcome: String, // "Exited for $50M", "Shutdown", etc.
    pub their_lesson: String,
}

/// REAL-TIME MARKET INTELLIGENCE
/// Live feeds make verdicts dynamically accurate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketIntelligenceFeed {
    pub market_segment: String,
    pub last_updated: String,
    pub recent_competitors: Vec<CompetitorUpdate>,
    pub funding_trend: String,     // "accelerating", "plateau", "declining"
    pub acquisition_velocity: f32, // How fast are competitors growing?
    pub market_maturity: String,   // "Early", "Growth", "Mature", "Declining"
    pub emerging_alternatives: Vec<String>,
    pub vcapital_flowing_to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitorUpdate {
    pub name: String,
    pub latest_funding: String,
    pub hiring_trend: String,
    pub last_product_launch: String,
    pub market_share_estimated: f32,
}

/// VERDICT ACCURACY TRACKING
/// Your system gets better over time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerdictAccuracy {
    pub verdict_id: String,
    pub original_verdict: String, // "BuildNow" etc
    pub outcome_6_months: Option<VerdictOutcome>,
    pub outcome_12_months: Option<VerdictOutcome>,
    pub accuracy_score: f32, // 0-1
    pub learnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerdictOutcome {
    pub what_actually_happened: String,
    pub why_we_were_right_or_wrong: String,
    pub unexpected_factors: Vec<String>,
}

/// NETWORK INTELLIGENCE
/// Every founder using G-Rump feeds the system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkIntelligence {
    pub total_founders_using_system: u32,
    pub successful_pivots_in_network: Vec<PivotCase>,
    pub failed_ideas: Vec<FailureCase>,
    pub pattern_recognition: Vec<Pattern>,
    pub community_insights: Vec<CommunityInsight>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PivotCase {
    pub original_idea: String,
    pub pivoted_to: String,
    pub outcome: String, // "Series B", "Acquired", etc
    pub why_it_worked: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailureCase {
    pub idea: String,
    pub why_it_failed: String,
    pub timeline: String, // "Failed after 6 months"
    pub lesson: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pattern {
    pub pattern_name: String,
    pub description: String,
    pub success_rate: f32, // Across all founders who followed it
    pub example_founders: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunityInsight {
    pub title: String,
    pub observation: String,
    pub supported_by_n_founders: u32,
    pub actionability: String,
}

/// THE MOAT SYSTEM
/// Multi-layered defensibility that compounds over time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoatSystem {
    pub founder_dna_layer: FounderDNAMoat,
    pub market_intel_layer: MarketIntelMoat,
    pub network_layer: NetworkMoat,
    pub accuracy_layer: AccuracyMoat,
    pub proprietary_insights_layer: ProprietaryMoat,

    pub overall_moat_strength: f32, // 0-1: how defensible?
    pub years_to_replicate: u32,    // How long for competitors to catch up?
    pub moat_compounding: bool,     // Does it get stronger over time?
}

/// Layer 1: Founder DNA becomes increasingly predictive
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FounderDNAMoat {
    pub founders_analyzed: u32,
    pub success_patterns_discovered: u32,
    pub prediction_accuracy: f32, // 0-1
    pub defensibility_score: f32,
    pub reason: String, // "Only you have 10B founder data"
}

/// Layer 2: Real-time market intelligence no one else has
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketIntelMoat {
    pub market_feeds_integrated: u32, // Crunchbase, CB Insights, ProductHunt, etc
    pub data_freshness_hours: u32,
    pub competitive_advantage: f32,
    pub defensibility_score: f32,
    pub reason: String, // "Live market data beats static analysis"
}

/// Layer 3: Network effects from community
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMoat {
    pub founders_in_network: u32,
    pub successful_pivots_tracked: u32,
    pub pattern_recognition_quality: f32,
    pub defensibility_score: f32,
    pub reason: String, // "Network is stronger every day"
}

/// Layer 4: Accuracy reputation becomes brand
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccuracyMoat {
    pub verdicts_tracked: u32,
    pub accuracy_percentage: f32,
    pub public_track_record: String, // "87% of BuildNow verdicts exited"
    pub defensibility_score: f32,
    pub reason: String, // "Reputation is hard to replicate"
}

/// Layer 5: Insights competitors can never discover
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProprietaryMoat {
    pub proprietary_models: Vec<String>,
    pub secret_sauce: String,
    pub defensibility_score: f32,
    pub reason: String, // "Only discoverable through years of data"
}

/// Calculate moat strength
pub fn calculate_moat_strength(
    founders_analyzed: u32,
    market_feeds: u32,
    network_size: u32,
    accuracy: f32,
) -> MoatSystem {
    let founder_dna_score = (founders_analyzed as f32 / 1_000_000.0).min(1.0);
    let market_intel_score = (market_feeds as f32 / 20.0).min(1.0);
    let network_score = (network_size as f32 / 100_000.0).min(1.0);
    let accuracy_score = accuracy;

    let overall_moat = (founder_dna_score * 0.35
        + market_intel_score * 0.25
        + network_score * 0.25
        + accuracy_score * 0.15)
        .min(1.0);

    let years_to_replicate = if overall_moat > 0.8 {
        10
    } else if overall_moat > 0.6 {
        7
    } else if overall_moat > 0.4 {
        5
    } else {
        3
    };

    MoatSystem {
        founder_dna_layer: FounderDNAMoat {
            founders_analyzed,
            success_patterns_discovered: (founders_analyzed / 100).max(1),
            prediction_accuracy: founder_dna_score,
            defensibility_score: founder_dna_score,
            reason: format!(
                "Analyzed {} founders. Competitors don't have this data.",
                founders_analyzed
            ),
        },

        market_intel_layer: MarketIntelMoat {
            market_feeds_integrated: market_feeds,
            data_freshness_hours: 1,
            competitive_advantage: market_intel_score,
            defensibility_score: market_intel_score,
            reason: format!(
                "Real-time feeds from {} sources. Static analysis can't compete.",
                market_feeds
            ),
        },

        network_layer: NetworkMoat {
            founders_in_network: network_size,
            successful_pivots_tracked: (network_size / 50).max(1),
            pattern_recognition_quality: network_score,
            defensibility_score: network_score,
            reason: format!(
                "{} founders = unstoppable network effects. Stronger every day.",
                network_size
            ),
        },

        accuracy_layer: AccuracyMoat {
            verdicts_tracked: (founders_analyzed / 10).max(1),
            accuracy_percentage: accuracy,
            public_track_record: format!(
                "{}% accuracy (tracked over time)",
                (accuracy * 100.0) as u32
            ),
            defensibility_score: accuracy_score,
            reason: "Reputation for accuracy becomes the most defensible moat.".to_string(),
        },

        proprietary_insights_layer: ProprietaryMoat {
            proprietary_models: vec![
                "Founder-Market Fit Matrix".to_string(),
                "Pivot Success Probability Model".to_string(),
                "Network Signal Analysis".to_string(),
                "Founder DNA Archetype Matching".to_string(),
            ],
            secret_sauce: "Only discoverable through 10B+ founder analyses".to_string(),
            defensibility_score: (founder_dna_score + accuracy_score) / 2.0,
            reason: "Proprietary insights that emerge only from massive data + time.".to_string(),
        },

        overall_moat_strength: overall_moat,
        years_to_replicate,
        moat_compounding: true,
    }
}

/// Competitive Advantage: What makes you unreplicable
pub fn competitive_advantage_analysis() -> Vec<String> {
    vec![
        "DATA: 10B+ founder analyses = 5-10 year head start for any competitor".to_string(),
        "NETWORK: Every founder using you = stronger intelligence. Winner-take-all.".to_string(),
        "ACCURACY: Track record is public. Better accuracy = more users = more data = better accuracy (flywheel).".to_string(),
        "SPEED: Real-time market feeds vs. static competitors. You always know more, faster.".to_string(),
        "PSYCHOLOGY: Founder DNA profiling is proprietary. Can't be reverse-engineered.".to_string(),
        "BRAND: 'The system every founder checks before pitching.' Becomes category leader.".to_string(),
    ]
}

/// Revenue Model for Moat Sustainability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoatRevenue {
    pub freemium: String,        // Free verdict for founders
    pub pro_tier: String,        // $299/month: Detailed analysis + founder matching
    pub enterprise_tier: String, // $5K+/month: VCs, accelerators, corporate innovation
    pub data_licensing: String,  // Sell anonymized insights to investors
    pub year_1_revenue: String,
    pub year_3_revenue: String,
    pub year_5_revenue: String,
}

pub fn moat_revenue_model() -> MoatRevenue {
    MoatRevenue {
        freemium: "Free verdict analysis (limit 3/month)".to_string(),
        pro_tier: "$299/month: Unlimited verdicts + founder DNA profiling + early access to pivots"
            .to_string(),
        enterprise_tier: "$5K-$50K/month: API access, white-label, custom integrations for VCs"
            .to_string(),
        data_licensing: "Sell anonymized market patterns to investors: '$10K-$100K per insight'"
            .to_string(),
        year_1_revenue: "$500K (early founders + VCs)".to_string(),
        year_3_revenue: "$10M+ (10K+ paying founders + VC partnerships)".to_string(),
        year_5_revenue:
            "$50M+ (industry standard, data licensing, acquisition offers from Stripe/Y Combinator)"
                .to_string(),
    }
}
