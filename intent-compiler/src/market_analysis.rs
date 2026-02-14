//! Market Analysis Module
//!
//! Main market analysis structures and the analyze_market function.

use serde::{Deserialize, Serialize};

use crate::market_competitors::{
    identify_competitors, identify_potential_moats, CompetitiveMoat, Competitor,
};
use crate::market_revenue::{
    estimate_revenue_model, estimate_unit_economics, RevenueModel, UnitEconomics,
};
use crate::market_risks::{
    build_go_to_market_strategy, determine_verdict, identify_risks, GoToMarketStrategy, RiskFactor,
    Verdict,
};
use crate::market_segments::{detect_category, CompetitionLevel, MarketSegment};

/// Market Analysis Output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketAnalysis {
    pub project_idea: String,
    pub viability_score: f32, // 0-100
    pub primary_opportunity: MarketSegment,
    pub alternative_opportunities: Vec<MarketSegment>,
    pub total_addressable_market: String,
    pub competitive_landscape: Vec<Competitor>,
    pub your_potential_moats: Vec<CompetitiveMoat>,
    pub unit_economics: UnitEconomics,
    pub go_to_market: GoToMarketStrategy,
    pub risk_factors: Vec<RiskFactor>,
    pub revenue_model: RevenueModel,
    pub recommendation: String,
    pub verdict: Verdict,
}

/// Psychographic Profile of Ideal Customer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerPsychographic {
    pub archetype_name: String,
    pub pain_points: Vec<String>,
    pub desires: Vec<String>,
    pub values: Vec<String>,
    pub fears: Vec<String>,
    pub aspirations: Vec<String>,
    pub decision_criteria: Vec<(String, f32)>, // (criteria, weight)
    pub willingness_to_pay: WillingnessToPayRange,
    pub adoption_speed: String, // "Early adopter", "Mainstream", "Late"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WillingnessToPayRange {
    pub minimum: f32,
    pub comfortable: f32,
    pub maximum: f32,
}

/// Generate market analysis (main function)
pub fn analyze_market(
    project_idea: &str,
    features: Vec<String>,
    _tech_stack: Vec<String>,
) -> MarketAnalysis {
    let idea_lower = project_idea.to_lowercase();

    // Simplified logic (in production, this would use real market data APIs)
    let (segment, alternatives) = identify_segments(&idea_lower, &features);
    let competitors = identify_competitors(&idea_lower);
    let moats = identify_potential_moats(&idea_lower, &features);
    let unit_econ = estimate_unit_economics(&idea_lower);
    let gtm = build_go_to_market_strategy(&idea_lower);
    let risks = identify_risks(&idea_lower, &features);
    let revenue = estimate_revenue_model(&idea_lower);
    let verdict = determine_verdict(&idea_lower, &segment, &competitors, &moats);

    let viability_score = calculate_viability_score(&segment, &unit_econ, &moats);

    let total_addressable_market = segment.tam.clone();

    let recommendation = match verdict {
        Verdict::GoldenTicket => format!(
            "THIS IS YOUR BILLION-DOLLAR IDEA. Execute flawlessly. {}",
            segment.name
        ),
        Verdict::Viable => format!(
            "Strong market opportunity. Focus on {}. Differentiate on {}.",
            segment.name,
            moats
                .first()
                .map(|m| &m.moat_type)
                .unwrap_or(&"quality".to_string())
        ),
        Verdict::Pivot => format!(
            "Core idea is strong but position is wrong. Target {} instead of broad market.",
            alternatives
                .first()
                .map(|a| &a.name)
                .unwrap_or(&"niche segment".to_string())
        ),
        Verdict::PassOnThis => {
            "Market too saturated. Consider a different problem space.".to_string()
        }
        Verdict::TooEarly => {
            "Right idea, but market isn't ready. Revisit in 2-3 years.".to_string()
        }
        Verdict::BuildAsFeature => {
            "Build this as a feature in an existing platform, not standalone.".to_string()
        }
    };

    MarketAnalysis {
        project_idea: project_idea.to_string(),
        viability_score,
        primary_opportunity: segment,
        alternative_opportunities: alternatives,
        total_addressable_market,
        competitive_landscape: competitors,
        your_potential_moats: moats,
        unit_economics: unit_econ,
        go_to_market: gtm,
        risk_factors: risks,
        revenue_model: revenue,
        recommendation,
        verdict,
    }
}

/// Calculate overall viability score
fn calculate_viability_score(
    segment: &MarketSegment,
    unit_econ: &UnitEconomics,
    moats: &[CompetitiveMoat],
) -> f32 {
    let competition_score = match segment.competition_level {
        CompetitionLevel::VeryLow => 25.0,
        CompetitionLevel::Low => 20.0,
        CompetitionLevel::Medium => 15.0,
        CompetitionLevel::High => 10.0,
        CompetitionLevel::Saturated => 5.0,
    };

    let economics_score = if unit_econ.ltv_to_cac_ratio >= 3.0 {
        25.0
    } else if unit_econ.ltv_to_cac_ratio >= 2.0 {
        15.0
    } else {
        5.0
    };

    let moat_score = (moats.len() as f32 * 10.0).min(25.0);
    let fit_score = segment.your_fit_score * 25.0;

    competition_score + economics_score + moat_score + fit_score
}

/// Identify market segments based on category
fn identify_segments(idea: &str, features: &[String]) -> (MarketSegment, Vec<MarketSegment>) {
    let category = detect_category(idea, features);

    match category {
        "habit" => (
            MarketSegment {
                name: "Consumer Wellness Apps".to_string(),
                tam: "$8.5B".to_string(),
                sam: "$1.2B".to_string(),
                som: "$150M".to_string(),
                competition_level: CompetitionLevel::Saturated,
                your_fit_score: 0.45,
                potential_revenue_range: ("$1M".to_string(), "$10M".to_string()),
                exit_potential: "Acqui-hire or Shutdown".to_string(),
                time_to_profitability_months: 36,
            },
            vec![MarketSegment {
                name: "Enterprise Wellness (Corporate HR)".to_string(),
                tam: "$45B".to_string(),
                sam: "$8.2B".to_string(),
                som: "$500M".to_string(),
                competition_level: CompetitionLevel::Medium,
                your_fit_score: 0.72,
                potential_revenue_range: ("$50M".to_string(), "$300M+".to_string()),
                exit_potential: "IPO or Strategic Acquisition".to_string(),
                time_to_profitability_months: 24,
            }],
        ),
        "saas" => (
            MarketSegment {
                name: "Horizontal B2B SaaS".to_string(),
                tam: "$195B".to_string(),
                sam: "$25B".to_string(),
                som: "$800M".to_string(),
                competition_level: CompetitionLevel::High,
                your_fit_score: 0.55,
                potential_revenue_range: ("$5M".to_string(), "$100M".to_string()),
                exit_potential: "Series C or Strategic Acquisition".to_string(),
                time_to_profitability_months: 24,
            },
            vec![MarketSegment {
                name: "Vertical SaaS (Industry-Specific)".to_string(),
                tam: "$50B".to_string(),
                sam: "$8B".to_string(),
                som: "$400M".to_string(),
                competition_level: CompetitionLevel::Medium,
                your_fit_score: 0.72,
                potential_revenue_range: ("$10M".to_string(), "$200M".to_string()),
                exit_potential: "IPO or PE Buyout".to_string(),
                time_to_profitability_months: 18,
            }],
        ),
        "aiml" => (
            MarketSegment {
                name: "AI/ML Tools & Infrastructure".to_string(),
                tam: "$305B".to_string(),
                sam: "$40B".to_string(),
                som: "$2B".to_string(),
                competition_level: CompetitionLevel::High,
                your_fit_score: 0.60,
                potential_revenue_range: ("$5M".to_string(), "$500M".to_string()),
                exit_potential: "IPO or Strategic Acquisition by FAANG".to_string(),
                time_to_profitability_months: 24,
            },
            vec![],
        ),
        _ => (
            MarketSegment {
                name: "General Software".to_string(),
                tam: "$500B".to_string(),
                sam: "$50B".to_string(),
                som: "$1B".to_string(),
                competition_level: CompetitionLevel::High,
                your_fit_score: 0.50,
                potential_revenue_range: ("$1M".to_string(), "$50M".to_string()),
                exit_potential: "Acquisition".to_string(),
                time_to_profitability_months: 24,
            },
            vec![],
        ),
    }
}

// Re-export everything for convenience
pub use crate::market_competitors::*;
pub use crate::market_revenue::*;
pub use crate::market_risks::*;
pub use crate::market_segments::*;
