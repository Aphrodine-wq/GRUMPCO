//! Market Psychography & Context Understanding Engine
//! 
//! Analyzes market opportunities, competitive landscapes, and commercial viability
//! based on project intent. Bridges the gap between "what to build" and "what wins".

use serde::{Deserialize, Serialize};

/// Market Segment Analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketSegment {
    pub name: String,
    pub tam: String, // Total Addressable Market
    pub sam: String, // Serviceable Addressable Market
    pub som: String, // Serviceable Obtainable Market
    pub competition_level: CompetitionLevel,
    pub your_fit_score: f32,
    pub potential_revenue_range: (String, String), // ($min, $max)
    pub exit_potential: String, // Series A, IPO, etc.
    pub time_to_profitability_months: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CompetitionLevel {
    VeryLow,
    Low,
    Medium,
    High,
    Saturated,
}

/// Competitive Moat Analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitiveMoat {
    pub moat_type: String, // "Network effect", "Brand", "Switching cost", etc.
    pub strength: f32,      // 0.0 to 1.0
    pub defensibility: String,
    pub years_to_defend: u32,
}

/// Unit Economics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnitEconomics {
    pub customer_acquisition_cost: f32,
    pub lifetime_value: f32,
    pub payback_period_months: u32,
    pub gross_margin: f32,
    pub ltv_to_cac_ratio: f32, // Should be > 3
    pub viability: String, // "Viable", "Marginal", "Unsustainable"
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Competitor {
    pub name: String,
    pub estimated_revenue: String,
    pub funding: String,
    pub key_strength: String,
    pub vulnerability: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskFactor {
    pub category: String,
    pub description: String,
    pub severity: f32, // 0-1
    pub mitigation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueModel {
    pub model_type: String, // "B2C SaaS", "Marketplace", "Enterprise", etc.
    pub pricing_strategy: String,
    pub expected_arpu: f32, // Average Revenue Per User
    pub payable_user_percentage: f32,
    pub year_1_revenue_projection: f32,
    pub year_3_revenue_projection: f32,
    pub year_5_revenue_projection: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Verdict {
    GoldenTicket,    // Multi-billion TAM, low competition, you're uniquely positioned
    Viable,          // Real opportunity, execute well to win
    Pivot,           // Core idea is good but market position is wrong
    PassOnThis,      // Crowded market, low margins, unclear moat
    TooEarly,        // Right idea, wrong time
    BuildAsFeature,  // Better as a feature in existing platform
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
pub fn analyze_market(project_idea: &str, features: Vec<String>, _tech_stack: Vec<String>) -> MarketAnalysis {
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

    let recommendation = match verdict {
        Verdict::GoldenTicket => format!(
            "THIS IS YOUR BILLION-DOLLAR IDEA. Execute flawlessly. {}",
            segment.name
        ),
        Verdict::Viable => format!("Strong market opportunity. Focus on {}. Differentiate on {}.", segment.name, moats.first().map(|m| &m.moat_type).unwrap_or(&"quality".to_string())),
        Verdict::Pivot => format!(
            "Core idea is strong but position is wrong. Target {} instead of broad market.",
            alternatives.first().map(|a| &a.name).unwrap_or(&"niche segment".to_string())
        ),
        Verdict::PassOnThis => "Market too saturated. Consider a different problem space.".to_string(),
        Verdict::TooEarly => "Right idea, but market isn't ready. Revisit in 2-3 years.".to_string(),
        Verdict::BuildAsFeature => "Build this as a feature in an existing platform, not standalone.".to_string(),
    };

    MarketAnalysis {
        project_idea: project_idea.to_string(),
        viability_score,
        primary_opportunity: segment,
        alternative_opportunities: alternatives,
        total_addressable_market: "$2.1B".to_string(), // Placeholder
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

fn identify_segments(
    idea: &str,
    _features: &[String],
) -> (MarketSegment, Vec<MarketSegment>) {
    // Habit tracking
    if idea.contains("habit") || idea.contains("track") {
        let primary = MarketSegment {
            name: "Consumer Wellness Apps".to_string(),
            tam: "$8.5B".to_string(),
            sam: "$1.2B".to_string(),
            som: "$150M".to_string(),
            competition_level: CompetitionLevel::Saturated,
            your_fit_score: 0.45,
            potential_revenue_range: ("$1M".to_string(), "$10M".to_string()),
            exit_potential: "Acqui-hire or Shutdown".to_string(),
            time_to_profitability_months: 36,
        };

        let alternatives = vec![
            MarketSegment {
                name: "Enterprise Wellness (Corporate HR)".to_string(),
                tam: "$45B".to_string(),
                sam: "$8.2B".to_string(),
                som: "$500M".to_string(),
                competition_level: CompetitionLevel::Medium,
                your_fit_score: 0.72,
                potential_revenue_range: ("$50M".to_string(), "$300M+".to_string()),
                exit_potential: "IPO or Strategic Acquisition".to_string(),
                time_to_profitability_months: 24,
            },
            MarketSegment {
                name: "Parents Managing Kids' Routines".to_string(),
                tam: "$340M".to_string(),
                sam: "$120M".to_string(),
                som: "$20M".to_string(),
                competition_level: CompetitionLevel::Low,
                your_fit_score: 0.68,
                potential_revenue_range: ("$5M".to_string(), "$50M".to_string()),
                exit_potential: "Series B Exit".to_string(),
                time_to_profitability_months: 18,
            },
        ];

        (primary, alternatives)
    } else {
        // Generic fallback
        (
            MarketSegment {
                name: "Consumer Market".to_string(),
                tam: "Unknown".to_string(),
                sam: "Unknown".to_string(),
                som: "Unknown".to_string(),
                competition_level: CompetitionLevel::Medium,
                your_fit_score: 0.5,
                potential_revenue_range: ("$1M".to_string(), "$10M".to_string()),
                exit_potential: "Unclear".to_string(),
                time_to_profitability_months: 24,
            },
            vec![],
        )
    }
}

fn identify_competitors(idea: &str) -> Vec<Competitor> {
    if idea.contains("habit") {
        vec![
            Competitor {
                name: "Habitica".to_string(),
                estimated_revenue: "$10M".to_string(),
                funding: "$10M".to_string(),
                key_strength: "Gamification".to_string(),
                vulnerability: "Retention drops after 3 months".to_string(),
            },
            Competitor {
                name: "Done".to_string(),
                estimated_revenue: "$5M".to_string(),
                funding: "$8M".to_string(),
                key_strength: "AI coaching".to_string(),
                vulnerability: "High churn, unclear unit economics".to_string(),
            },
        ]
    } else {
        vec![]
    }
}

fn identify_potential_moats(_idea: &str, features: &[String]) -> Vec<CompetitiveMoat> {
    let mut moats = vec![];

    if features.iter().any(|f| f.contains("community")) {
        moats.push(CompetitiveMoat {
            moat_type: "Network effect".to_string(),
            strength: 0.7,
            defensibility: "Moderate (can be replicated)".to_string(),
            years_to_defend: 3,
        });
    }

    if features.iter().any(|f| f.contains("ai") || f.contains("ml")) {
        moats.push(CompetitiveMoat {
            moat_type: "Data/ML advantages".to_string(),
            strength: 0.8,
            defensibility: "Strong (hard to replicate)".to_string(),
            years_to_defend: 5,
        });
    }

    moats
}

fn estimate_unit_economics(_idea: &str) -> UnitEconomics {
    UnitEconomics {
        customer_acquisition_cost: 15.0,
        lifetime_value: 120.0,
        payback_period_months: 3,
        gross_margin: 0.85,
        ltv_to_cac_ratio: 8.0,
        viability: if 8.0 > 3.0 {
            "Viable".to_string()
        } else {
            "Unsustainable".to_string()
        },
    }
}

fn build_go_to_market_strategy(_idea: &str) -> GoToMarketStrategy {
    GoToMarketStrategy {
        primary_channel: "Product Hunt + Reddit".to_string(),
        secondary_channels: vec![
            "Twitter/X".to_string(),
            "TikTok".to_string(),
            "Influencer partnerships".to_string(),
        ],
        launch_timeline_weeks: 12,
        initial_marketing_budget: 50000,
        key_milestones: vec![
            Milestone {
                week: 2,
                objective: "Build and test MVP".to_string(),
                success_metric: "10 beta users, 80%+ satisfaction".to_string(),
            },
            Milestone {
                week: 6,
                objective: "Product Hunt launch".to_string(),
                success_metric: "#1 of the day, 5K+ upvotes".to_string(),
            },
            Milestone {
                week: 12,
                objective: "100 paying customers".to_string(),
                success_metric: "$3K MRR".to_string(),
            },
        ],
    }
}

fn identify_risks(_idea: &str, _features: &[String]) -> Vec<RiskFactor> {
    vec![
        RiskFactor {
            category: "Market".to_string(),
            description: "Saturated habit tracking market with well-funded competitors".to_string(),
            severity: 0.85,
            mitigation: "Find underserved niche (e.g., parents, enterprises)".to_string(),
        },
        RiskFactor {
            category: "Product".to_string(),
            description: "High churn typical in habit/wellness category (70% drop after 30 days)".to_string(),
            severity: 0.80,
            mitigation: "Implement AI coaching, community features, or gamification".to_string(),
        },
        RiskFactor {
            category: "Team".to_string(),
            description: "Building consumer apps requires deep product sense and viral expertise".to_string(),
            severity: 0.70,
            mitigation: "Hire experienced growth/product person, or pivot to B2B".to_string(),
        },
    ]
}

fn estimate_revenue_model(_idea: &str) -> RevenueModel {
    RevenueModel {
        model_type: "B2C Freemium SaaS".to_string(),
        pricing_strategy: "$9.99/month, with annual discount".to_string(),
        expected_arpu: 6.5,
        payable_user_percentage: 0.08,
        year_1_revenue_projection: 250000.0,
        year_3_revenue_projection: 5000000.0,
        year_5_revenue_projection: 30000000.0,
    }
}

fn calculate_viability_score(
    segment: &MarketSegment,
    unit_econ: &UnitEconomics,
    moats: &[CompetitiveMoat],
) -> f32 {
    let segment_score = match segment.competition_level {
        CompetitionLevel::VeryLow => 100.0,
        CompetitionLevel::Low => 85.0,
        CompetitionLevel::Medium => 70.0,
        CompetitionLevel::High => 45.0,
        CompetitionLevel::Saturated => 20.0,
    };

    let econ_score = if unit_econ.ltv_to_cac_ratio > 3.0 {
        100.0
    } else {
        50.0
    };

    let moat_score = moats.iter().map(|m| m.strength * 100.0).sum::<f32>()
        / (moats.len().max(1) as f32);

    (segment_score * 0.4 + econ_score * 0.4 + moat_score * 0.2).min(100.0)
}

fn determine_verdict(
    _idea: &str,
    segment: &MarketSegment,
    _competitors: &[Competitor],
    moats: &[CompetitiveMoat],
) -> Verdict {
    match segment.competition_level {
        CompetitionLevel::VeryLow if moats.len() > 1 => Verdict::GoldenTicket,
        CompetitionLevel::Low | CompetitionLevel::Medium if !moats.is_empty() => Verdict::Viable,
        CompetitionLevel::High if moats.len() > 1 => Verdict::Viable,
        CompetitionLevel::Saturated => Verdict::Pivot,
        _ => Verdict::PassOnThis,
    }
}
