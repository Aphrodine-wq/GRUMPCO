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
    pub exit_potential: String,                    // Series A, IPO, etc.
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
    pub strength: f32,     // 0.0 to 1.0
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
    pub viability: String,     // "Viable", "Marginal", "Unsustainable"
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
    GoldenTicket,   // Multi-billion TAM, low competition, you're uniquely positioned
    Viable,         // Real opportunity, execute well to win
    Pivot,          // Core idea is good but market position is wrong
    PassOnThis,     // Crowded market, low margins, unclear moat
    TooEarly,       // Right idea, wrong time
    BuildAsFeature, // Better as a feature in existing platform
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

    let viability_score = calculate_viability_score(&segment, &unit_econ, &moats);

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

/// Detect which market category best fits the idea + features.
fn detect_category(idea: &str, features: &[String]) -> &'static str {
    let combined: String = format!("{} {}", idea, features.join(" ").to_lowercase());
    let c = combined.as_str();

    // Order matters: more specific categories first
    if c.contains("health")
        || c.contains("medical")
        || c.contains("patient")
        || c.contains("telemedicine")
        || c.contains("wellness")
        || c.contains("fitness")
        || c.contains("clinic")
        || c.contains("pharma")
        || c.contains("diagnosis")
    {
        return "healthtech";
    }
    if c.contains("finance")
        || c.contains("fintech")
        || c.contains("banking")
        || c.contains("payment")
        || c.contains("crypto")
        || c.contains("blockchain")
        || c.contains("wallet")
        || c.contains("trading")
        || c.contains("invest")
        || c.contains("insurance")
        || c.contains("lending")
    {
        return "fintech";
    }
    if c.contains("education")
        || c.contains("edtech")
        || c.contains("e-learning")
        || c.contains("online learning")
        || c.contains("learning platform")
        || c.contains("learning management")
        || c.contains("course")
        || c.contains("tutoring")
        || c.contains("student")
        || c.contains("classroom")
        || c.contains("lms")
        || c.contains("quiz")
    {
        return "edtech";
    }
    if c.contains("ecommerce")
        || c.contains("e-commerce")
        || c.contains("shop")
        || c.contains("store")
        || c.contains("marketplace")
        || c.contains("cart")
        || c.contains("product catalog")
        || c.contains("inventory")
        || c.contains("checkout")
        || c.contains("retail")
    {
        return "ecommerce";
    }
    if c.contains("social")
        || c.contains("community")
        || c.contains("forum")
        || c.contains("chat")
        || c.contains("messaging")
        || c.contains("network")
        || c.contains("feed")
        || c.contains("follow")
        || c.contains("friend")
    {
        return "social";
    }
    if c.contains("developer")
        || c.contains("devtool")
        || c.contains("cli")
        || c.contains("sdk")
        || c.contains("api platform")
        || c.contains("ide")
        || c.contains("code editor")
        || c.contains("linter")
        || c.contains("compiler")
        || c.contains("devops")
        || c.contains("ci/cd")
        || c.contains("infrastructure")
    {
        return "devtools";
    }
    if c.contains("ai")
        || c.contains("machine learning")
        || c.contains("ml model")
        || c.contains("deep learning")
        || c.contains("neural")
        || c.contains("nlp")
        || c.contains("llm")
        || c.contains("generative")
        || c.contains("gpt")
        || c.contains("copilot")
        || c.contains("inference")
    {
        return "aiml";
    }
    if c.contains("saas")
        || c.contains("subscription")
        || c.contains("dashboard")
        || c.contains("analytics")
        || c.contains("crm")
        || c.contains("erp")
        || c.contains("project management")
        || c.contains("workflow")
        || c.contains("automation")
        || c.contains("collaboration")
    {
        return "saas";
    }
    if c.contains("habit") || c.contains("track") {
        return "habit";
    }

    "general"
}

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
            vec![
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
            ],
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
            vec![
                MarketSegment {
                    name: "Vertical SaaS (Industry-Specific)".to_string(),
                    tam: "$50B".to_string(),
                    sam: "$8B".to_string(),
                    som: "$400M".to_string(),
                    competition_level: CompetitionLevel::Medium,
                    your_fit_score: 0.72,
                    potential_revenue_range: ("$10M".to_string(), "$200M".to_string()),
                    exit_potential: "IPO or PE Buyout".to_string(),
                    time_to_profitability_months: 18,
                },
                MarketSegment {
                    name: "SMB Productivity Tools".to_string(),
                    tam: "$30B".to_string(),
                    sam: "$5B".to_string(),
                    som: "$200M".to_string(),
                    competition_level: CompetitionLevel::High,
                    your_fit_score: 0.50,
                    potential_revenue_range: ("$2M".to_string(), "$50M".to_string()),
                    exit_potential: "Series B or Acqui-hire".to_string(),
                    time_to_profitability_months: 20,
                },
            ],
        ),
        "ecommerce" => (
            MarketSegment {
                name: "E-Commerce Enablement".to_string(),
                tam: "$6.3T".to_string(),
                sam: "$120B".to_string(),
                som: "$1.5B".to_string(),
                competition_level: CompetitionLevel::Saturated,
                your_fit_score: 0.40,
                potential_revenue_range: ("$2M".to_string(), "$50M".to_string()),
                exit_potential: "Acquisition by Shopify/Amazon/Stripe".to_string(),
                time_to_profitability_months: 18,
            },
            vec![
                MarketSegment {
                    name: "Niche Marketplace (Vertical)".to_string(),
                    tam: "$500B".to_string(),
                    sam: "$20B".to_string(),
                    som: "$500M".to_string(),
                    competition_level: CompetitionLevel::Medium,
                    your_fit_score: 0.65,
                    potential_revenue_range: ("$10M".to_string(), "$200M".to_string()),
                    exit_potential: "Series C or IPO".to_string(),
                    time_to_profitability_months: 24,
                },
                MarketSegment {
                    name: "B2B Wholesale E-Commerce".to_string(),
                    tam: "$7.7T".to_string(),
                    sam: "$50B".to_string(),
                    som: "$800M".to_string(),
                    competition_level: CompetitionLevel::Low,
                    your_fit_score: 0.70,
                    potential_revenue_range: ("$20M".to_string(), "$500M".to_string()),
                    exit_potential: "IPO".to_string(),
                    time_to_profitability_months: 30,
                },
            ],
        ),
        "social" => (
            MarketSegment {
                name: "Social / Community Platform".to_string(),
                tam: "$230B".to_string(),
                sam: "$15B".to_string(),
                som: "$300M".to_string(),
                competition_level: CompetitionLevel::Saturated,
                your_fit_score: 0.35,
                potential_revenue_range: ("$500K".to_string(), "$20M".to_string()),
                exit_potential: "Acqui-hire or Shutdown (most fail)".to_string(),
                time_to_profitability_months: 48,
            },
            vec![
                MarketSegment {
                    name: "Creator Economy Platform".to_string(),
                    tam: "$100B".to_string(),
                    sam: "$10B".to_string(),
                    som: "$500M".to_string(),
                    competition_level: CompetitionLevel::High,
                    your_fit_score: 0.55,
                    potential_revenue_range: ("$5M".to_string(), "$100M".to_string()),
                    exit_potential: "Series B or Acquisition".to_string(),
                    time_to_profitability_months: 30,
                },
                MarketSegment {
                    name: "Professional Community (Niche)".to_string(),
                    tam: "$5B".to_string(),
                    sam: "$1B".to_string(),
                    som: "$100M".to_string(),
                    competition_level: CompetitionLevel::Medium,
                    your_fit_score: 0.68,
                    potential_revenue_range: ("$2M".to_string(), "$50M".to_string()),
                    exit_potential: "Acquisition by LinkedIn/Slack".to_string(),
                    time_to_profitability_months: 18,
                },
            ],
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
            vec![
                MarketSegment {
                    name: "Vertical AI (Industry-Specific)".to_string(),
                    tam: "$80B".to_string(),
                    sam: "$12B".to_string(),
                    som: "$800M".to_string(),
                    competition_level: CompetitionLevel::Medium,
                    your_fit_score: 0.75,
                    potential_revenue_range: ("$10M".to_string(), "$300M".to_string()),
                    exit_potential: "IPO or PE Buyout".to_string(),
                    time_to_profitability_months: 18,
                },
                MarketSegment {
                    name: "AI Developer Tools (MLOps)".to_string(),
                    tam: "$15B".to_string(),
                    sam: "$4B".to_string(),
                    som: "$400M".to_string(),
                    competition_level: CompetitionLevel::High,
                    your_fit_score: 0.65,
                    potential_revenue_range: ("$5M".to_string(), "$200M".to_string()),
                    exit_potential: "Series C or Acquisition".to_string(),
                    time_to_profitability_months: 24,
                },
            ],
        ),
        "healthtech" => (
            MarketSegment {
                name: "Digital Health & HealthTech".to_string(),
                tam: "$500B".to_string(),
                sam: "$60B".to_string(),
                som: "$1.5B".to_string(),
                competition_level: CompetitionLevel::High,
                your_fit_score: 0.55,
                potential_revenue_range: ("$5M".to_string(), "$200M".to_string()),
                exit_potential: "IPO or Acquisition by UnitedHealth/CVS".to_string(),
                time_to_profitability_months: 36,
            },
            vec![
                MarketSegment {
                    name: "Telemedicine & Remote Care".to_string(),
                    tam: "$185B".to_string(),
                    sam: "$25B".to_string(),
                    som: "$800M".to_string(),
                    competition_level: CompetitionLevel::Medium,
                    your_fit_score: 0.65,
                    potential_revenue_range: ("$10M".to_string(), "$300M".to_string()),
                    exit_potential: "IPO".to_string(),
                    time_to_profitability_months: 30,
                },
                MarketSegment {
                    name: "Mental Health & Wellness Tech".to_string(),
                    tam: "$20B".to_string(),
                    sam: "$5B".to_string(),
                    som: "$300M".to_string(),
                    competition_level: CompetitionLevel::Medium,
                    your_fit_score: 0.70,
                    potential_revenue_range: ("$5M".to_string(), "$100M".to_string()),
                    exit_potential: "Series C or Strategic Acquisition".to_string(),
                    time_to_profitability_months: 24,
                },
            ],
        ),
        "fintech" => (
            MarketSegment {
                name: "FinTech & Financial Services".to_string(),
                tam: "$310B".to_string(),
                sam: "$45B".to_string(),
                som: "$1.2B".to_string(),
                competition_level: CompetitionLevel::High,
                your_fit_score: 0.50,
                potential_revenue_range: ("$10M".to_string(), "$500M".to_string()),
                exit_potential: "IPO or Bank Acquisition".to_string(),
                time_to_profitability_months: 30,
            },
            vec![
                MarketSegment {
                    name: "Embedded Finance / BaaS".to_string(),
                    tam: "$138B".to_string(),
                    sam: "$20B".to_string(),
                    som: "$600M".to_string(),
                    competition_level: CompetitionLevel::Medium,
                    your_fit_score: 0.68,
                    potential_revenue_range: ("$10M".to_string(), "$300M".to_string()),
                    exit_potential: "IPO or Strategic Acquisition".to_string(),
                    time_to_profitability_months: 24,
                },
                MarketSegment {
                    name: "Personal Finance / Budgeting".to_string(),
                    tam: "$15B".to_string(),
                    sam: "$3B".to_string(),
                    som: "$200M".to_string(),
                    competition_level: CompetitionLevel::Saturated,
                    your_fit_score: 0.40,
                    potential_revenue_range: ("$2M".to_string(), "$30M".to_string()),
                    exit_potential: "Acqui-hire".to_string(),
                    time_to_profitability_months: 24,
                },
            ],
        ),
        "edtech" => (
            MarketSegment {
                name: "EdTech & Learning Platforms".to_string(),
                tam: "$400B".to_string(),
                sam: "$50B".to_string(),
                som: "$1B".to_string(),
                competition_level: CompetitionLevel::High,
                your_fit_score: 0.55,
                potential_revenue_range: ("$5M".to_string(), "$200M".to_string()),
                exit_potential: "IPO or Acquisition by Pearson/Chegg".to_string(),
                time_to_profitability_months: 24,
            },
            vec![
                MarketSegment {
                    name: "Corporate Training & Upskilling".to_string(),
                    tam: "$370B".to_string(),
                    sam: "$30B".to_string(),
                    som: "$800M".to_string(),
                    competition_level: CompetitionLevel::Medium,
                    your_fit_score: 0.70,
                    potential_revenue_range: ("$10M".to_string(), "$300M".to_string()),
                    exit_potential: "IPO or PE Buyout".to_string(),
                    time_to_profitability_months: 18,
                },
                MarketSegment {
                    name: "K-12 Tutoring & Test Prep".to_string(),
                    tam: "$50B".to_string(),
                    sam: "$8B".to_string(),
                    som: "$400M".to_string(),
                    competition_level: CompetitionLevel::High,
                    your_fit_score: 0.50,
                    potential_revenue_range: ("$3M".to_string(), "$80M".to_string()),
                    exit_potential: "Series B or Acquisition".to_string(),
                    time_to_profitability_months: 24,
                },
            ],
        ),
        "devtools" => (
            MarketSegment {
                name: "Developer Tools & Infrastructure".to_string(),
                tam: "$45B".to_string(),
                sam: "$10B".to_string(),
                som: "$500M".to_string(),
                competition_level: CompetitionLevel::Medium,
                your_fit_score: 0.70,
                potential_revenue_range: ("$5M".to_string(), "$200M".to_string()),
                exit_potential: "IPO or Acquisition by GitHub/Atlassian".to_string(),
                time_to_profitability_months: 18,
            },
            vec![
                MarketSegment {
                    name: "Cloud Infrastructure / DevOps".to_string(),
                    tam: "$180B".to_string(),
                    sam: "$25B".to_string(),
                    som: "$1B".to_string(),
                    competition_level: CompetitionLevel::High,
                    your_fit_score: 0.60,
                    potential_revenue_range: ("$10M".to_string(), "$500M".to_string()),
                    exit_potential: "IPO".to_string(),
                    time_to_profitability_months: 24,
                },
                MarketSegment {
                    name: "Low-Code / No-Code Platform".to_string(),
                    tam: "$30B".to_string(),
                    sam: "$8B".to_string(),
                    som: "$400M".to_string(),
                    competition_level: CompetitionLevel::High,
                    your_fit_score: 0.55,
                    potential_revenue_range: ("$5M".to_string(), "$150M".to_string()),
                    exit_potential: "Series C or Strategic Acquisition".to_string(),
                    time_to_profitability_months: 24,
                },
            ],
        ),
        _ => (
            // General / unrecognized
            MarketSegment {
                name: "General Consumer/B2B Market".to_string(),
                tam: "$50B (est.)".to_string(),
                sam: "$5B (est.)".to_string(),
                som: "$200M (est.)".to_string(),
                competition_level: CompetitionLevel::Medium,
                your_fit_score: 0.50,
                potential_revenue_range: ("$1M".to_string(), "$20M".to_string()),
                exit_potential: "Unclear — depends on execution".to_string(),
                time_to_profitability_months: 24,
            },
            vec![],
        ),
    }
}

fn identify_competitors(idea: &str) -> Vec<Competitor> {
    let idea_lower = idea.to_lowercase();
    let category = detect_category(&idea_lower, &[]);

    match category {
        "habit" => vec![
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
        ],
        "saas" => vec![
            Competitor {
                name: "Notion".to_string(),
                estimated_revenue: "$250M".to_string(),
                funding: "$343M".to_string(),
                key_strength: "All-in-one workspace, strong brand".to_string(),
                vulnerability: "Feature bloat, slow performance at scale".to_string(),
            },
            Competitor {
                name: "Monday.com".to_string(),
                estimated_revenue: "$600M".to_string(),
                funding: "$234M".to_string(),
                key_strength: "Enterprise sales, workflow automation".to_string(),
                vulnerability: "Complex pricing, SMB churn".to_string(),
            },
        ],
        "ecommerce" => vec![
            Competitor {
                name: "Shopify".to_string(),
                estimated_revenue: "$7B".to_string(),
                funding: "Public (IPO)".to_string(),
                key_strength: "Ecosystem, app store, brand".to_string(),
                vulnerability: "High fees, hard to customise".to_string(),
            },
            Competitor {
                name: "WooCommerce".to_string(),
                estimated_revenue: "$200M (est.)".to_string(),
                funding: "Automattic-backed".to_string(),
                key_strength: "WordPress ecosystem, open-source".to_string(),
                vulnerability: "Requires technical expertise, security burden".to_string(),
            },
        ],
        "social" => vec![
            Competitor {
                name: "Discord".to_string(),
                estimated_revenue: "$600M".to_string(),
                funding: "$995M".to_string(),
                key_strength: "Community-first, real-time".to_string(),
                vulnerability: "Monetisation challenges, moderation cost".to_string(),
            },
            Competitor {
                name: "Circle".to_string(),
                estimated_revenue: "$20M".to_string(),
                funding: "$30M".to_string(),
                key_strength: "Creator-focused community".to_string(),
                vulnerability: "Small scale, limited features vs Discord".to_string(),
            },
        ],
        "aiml" => vec![
            Competitor {
                name: "OpenAI".to_string(),
                estimated_revenue: "$3.4B".to_string(),
                funding: "$11B+".to_string(),
                key_strength: "State-of-art models, brand, distribution".to_string(),
                vulnerability: "High burn rate, regulatory risk".to_string(),
            },
            Competitor {
                name: "Hugging Face".to_string(),
                estimated_revenue: "$70M".to_string(),
                funding: "$395M".to_string(),
                key_strength: "Open-source community, model hub".to_string(),
                vulnerability: "Revenue model still maturing".to_string(),
            },
        ],
        "healthtech" => vec![
            Competitor {
                name: "Teladoc".to_string(),
                estimated_revenue: "$2.6B".to_string(),
                funding: "Public (IPO)".to_string(),
                key_strength: "Scale, insurance integrations".to_string(),
                vulnerability: "Post-COVID growth slowdown".to_string(),
            },
            Competitor {
                name: "Hims & Hers".to_string(),
                estimated_revenue: "$800M".to_string(),
                funding: "Public (IPO)".to_string(),
                key_strength: "D2C brand, telehealth".to_string(),
                vulnerability: "Regulatory risk, narrow product lines".to_string(),
            },
        ],
        "fintech" => vec![
            Competitor {
                name: "Stripe".to_string(),
                estimated_revenue: "$14B".to_string(),
                funding: "$2.3B".to_string(),
                key_strength: "Developer-first, payments infrastructure".to_string(),
                vulnerability: "Enterprise competition from Adyen".to_string(),
            },
            Competitor {
                name: "Plaid".to_string(),
                estimated_revenue: "$500M".to_string(),
                funding: "$734M".to_string(),
                key_strength: "Bank connectivity, API moat".to_string(),
                vulnerability: "Bank pushback, regulatory pressure".to_string(),
            },
        ],
        "edtech" => vec![
            Competitor {
                name: "Coursera".to_string(),
                estimated_revenue: "$500M".to_string(),
                funding: "Public (IPO)".to_string(),
                key_strength: "University partnerships, brand".to_string(),
                vulnerability: "Low completion rates, commoditised content".to_string(),
            },
            Competitor {
                name: "Duolingo".to_string(),
                estimated_revenue: "$500M".to_string(),
                funding: "Public (IPO)".to_string(),
                key_strength: "Gamification, retention".to_string(),
                vulnerability: "Language-only, hard to expand verticals".to_string(),
            },
        ],
        "devtools" => vec![
            Competitor {
                name: "Vercel".to_string(),
                estimated_revenue: "$200M".to_string(),
                funding: "$563M".to_string(),
                key_strength: "Next.js ecosystem, DX".to_string(),
                vulnerability: "Vendor lock-in pushback, AWS competition".to_string(),
            },
            Competitor {
                name: "Supabase".to_string(),
                estimated_revenue: "$50M".to_string(),
                funding: "$116M".to_string(),
                key_strength: "Open-source Firebase alternative".to_string(),
                vulnerability: "Limited enterprise features".to_string(),
            },
        ],
        _ => vec![],
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

    if features
        .iter()
        .any(|f| f.contains("ai") || f.contains("ml"))
    {
        moats.push(CompetitiveMoat {
            moat_type: "Data/ML advantages".to_string(),
            strength: 0.8,
            defensibility: "Strong (hard to replicate)".to_string(),
            years_to_defend: 5,
        });
    }

    moats
}

fn estimate_unit_economics(idea: &str) -> UnitEconomics {
    let category = detect_category(idea, &[]);

    let (cac, ltv, payback, margin) = match category {
        "saas" => (80.0, 1200.0, 4, 0.80),
        "ecommerce" => (25.0, 300.0, 3, 0.35),
        "social" => (5.0, 40.0, 6, 0.85),
        "aiml" => (150.0, 3000.0, 5, 0.75),
        "healthtech" => (200.0, 2400.0, 8, 0.70),
        "fintech" => (60.0, 800.0, 4, 0.65),
        "edtech" => (30.0, 360.0, 4, 0.80),
        "devtools" => (40.0, 600.0, 3, 0.85),
        _ => (15.0, 120.0, 3, 0.85),
    };

    let ratio = ltv / cac;
    let viability = if ratio > 5.0 {
        "Highly Viable".to_string()
    } else if ratio > 3.0 {
        "Viable".to_string()
    } else if ratio > 1.5 {
        "Marginal".to_string()
    } else {
        "Unsustainable".to_string()
    };

    UnitEconomics {
        customer_acquisition_cost: cac,
        lifetime_value: ltv,
        payback_period_months: payback,
        gross_margin: margin,
        ltv_to_cac_ratio: ratio,
        viability,
    }
}

fn build_go_to_market_strategy(idea: &str) -> GoToMarketStrategy {
    let category = detect_category(idea, &[]);

    match category {
        "saas" => GoToMarketStrategy {
            primary_channel: "Content Marketing + PLG".to_string(),
            secondary_channels: vec![
                "LinkedIn Ads".to_string(),
                "Partnerships / Integrations".to_string(),
                "Outbound Sales (Enterprise)".to_string(),
            ],
            launch_timeline_weeks: 16,
            initial_marketing_budget: 80_000,
            key_milestones: vec![
                Milestone {
                    week: 4,
                    objective: "Launch closed beta with 20 design partners".to_string(),
                    success_metric: "80%+ DAU/MAU ratio".to_string(),
                },
                Milestone {
                    week: 8,
                    objective: "Public launch on Product Hunt + Hacker News".to_string(),
                    success_metric: "500 signups in first week".to_string(),
                },
                Milestone {
                    week: 16,
                    objective: "Reach $10K MRR".to_string(),
                    success_metric: "200 paying teams".to_string(),
                },
            ],
        },
        "ecommerce" => GoToMarketStrategy {
            primary_channel: "Paid Social (Meta, Google Shopping)".to_string(),
            secondary_channels: vec![
                "SEO / Content".to_string(),
                "Influencer partnerships".to_string(),
                "Email marketing".to_string(),
            ],
            launch_timeline_weeks: 12,
            initial_marketing_budget: 100_000,
            key_milestones: vec![
                Milestone {
                    week: 2,
                    objective: "Launch store with 50+ SKUs".to_string(),
                    success_metric: "Store live, payment flow tested".to_string(),
                },
                Milestone {
                    week: 6,
                    objective: "First 100 orders".to_string(),
                    success_metric: "$5K GMV".to_string(),
                },
                Milestone {
                    week: 12,
                    objective: "Achieve profitable unit economics".to_string(),
                    success_metric: "ROAS > 3x on paid channels".to_string(),
                },
            ],
        },
        "social" => GoToMarketStrategy {
            primary_channel: "Community Seeding + Viral Loops".to_string(),
            secondary_channels: vec![
                "TikTok / Instagram".to_string(),
                "Referral program".to_string(),
                "Creator partnerships".to_string(),
            ],
            launch_timeline_weeks: 20,
            initial_marketing_budget: 30_000,
            key_milestones: vec![
                Milestone {
                    week: 4,
                    objective: "Seed 500 users from existing community".to_string(),
                    success_metric: "50%+ D7 retention".to_string(),
                },
                Milestone {
                    week: 10,
                    objective: "Launch viral invite feature".to_string(),
                    success_metric: "K-factor > 0.5".to_string(),
                },
                Milestone {
                    week: 20,
                    objective: "10K MAU".to_string(),
                    success_metric: "20%+ D30 retention".to_string(),
                },
            ],
        },
        "aiml" => GoToMarketStrategy {
            primary_channel: "Developer Relations + Open Source".to_string(),
            secondary_channels: vec![
                "Hacker News / Reddit".to_string(),
                "Conference talks / workshops".to_string(),
                "Enterprise outbound".to_string(),
            ],
            launch_timeline_weeks: 16,
            initial_marketing_budget: 60_000,
            key_milestones: vec![
                Milestone {
                    week: 4,
                    objective: "Public API beta + docs".to_string(),
                    success_metric: "100 API keys issued".to_string(),
                },
                Milestone {
                    week: 8,
                    objective: "Launch on Hacker News".to_string(),
                    success_metric: "1K GitHub stars or 500 API users".to_string(),
                },
                Milestone {
                    week: 16,
                    objective: "First enterprise pilot".to_string(),
                    success_metric: "$50K ACV signed".to_string(),
                },
            ],
        },
        "healthtech" => GoToMarketStrategy {
            primary_channel: "B2B2C via employer wellness programs".to_string(),
            secondary_channels: vec![
                "Health system partnerships".to_string(),
                "Physician referral network".to_string(),
                "D2C app store launch".to_string(),
            ],
            launch_timeline_weeks: 24,
            initial_marketing_budget: 100_000,
            key_milestones: vec![
                Milestone {
                    week: 6,
                    objective: "HIPAA compliance + security audit".to_string(),
                    success_metric: "SOC 2 Type I complete".to_string(),
                },
                Milestone {
                    week: 12,
                    objective: "Pilot with 3 employer groups".to_string(),
                    success_metric: "500 enrolled members".to_string(),
                },
                Milestone {
                    week: 24,
                    objective: "First revenue contract".to_string(),
                    success_metric: "$100K ACV".to_string(),
                },
            ],
        },
        "fintech" => GoToMarketStrategy {
            primary_channel: "Waitlist + Early Access".to_string(),
            secondary_channels: vec![
                "Personal finance influencers".to_string(),
                "App Store ASO".to_string(),
                "Referral bonus program".to_string(),
            ],
            launch_timeline_weeks: 20,
            initial_marketing_budget: 120_000,
            key_milestones: vec![
                Milestone {
                    week: 8,
                    objective: "Regulatory approvals + bank partnership".to_string(),
                    success_metric: "Licensed to operate".to_string(),
                },
                Milestone {
                    week: 14,
                    objective: "Closed beta with 200 users".to_string(),
                    success_metric: "$50K in deposits/transactions".to_string(),
                },
                Milestone {
                    week: 20,
                    objective: "Public launch".to_string(),
                    success_metric: "2K active accounts".to_string(),
                },
            ],
        },
        "edtech" => GoToMarketStrategy {
            primary_channel: "Content Marketing + SEO".to_string(),
            secondary_channels: vec![
                "YouTube / TikTok educational content".to_string(),
                "University partnerships".to_string(),
                "Corporate L&D outbound".to_string(),
            ],
            launch_timeline_weeks: 14,
            initial_marketing_budget: 50_000,
            key_milestones: vec![
                Milestone {
                    week: 4,
                    objective: "Launch beta with 5 courses / modules".to_string(),
                    success_metric: "200 beta learners".to_string(),
                },
                Milestone {
                    week: 8,
                    objective: "Improve completion rate with gamification".to_string(),
                    success_metric: "> 30% completion rate".to_string(),
                },
                Milestone {
                    week: 14,
                    objective: "Paid launch + first corporate client".to_string(),
                    success_metric: "$5K MRR".to_string(),
                },
            ],
        },
        "devtools" => GoToMarketStrategy {
            primary_channel: "Open Source + Developer Community".to_string(),
            secondary_channels: vec![
                "GitHub / Hacker News / Dev.to".to_string(),
                "Conference sponsorships".to_string(),
                "Enterprise sales team".to_string(),
            ],
            launch_timeline_weeks: 14,
            initial_marketing_budget: 40_000,
            key_milestones: vec![
                Milestone {
                    week: 2,
                    objective: "Open-source release".to_string(),
                    success_metric: "500 GitHub stars in week 1".to_string(),
                },
                Milestone {
                    week: 8,
                    objective: "Cloud hosted version launch".to_string(),
                    success_metric: "100 cloud signups".to_string(),
                },
                Milestone {
                    week: 14,
                    objective: "First enterprise customer".to_string(),
                    success_metric: "$20K ACV".to_string(),
                },
            ],
        },
        _ => GoToMarketStrategy {
            primary_channel: "Product Hunt + Reddit".to_string(),
            secondary_channels: vec![
                "Twitter/X".to_string(),
                "TikTok".to_string(),
                "Influencer partnerships".to_string(),
            ],
            launch_timeline_weeks: 12,
            initial_marketing_budget: 50_000,
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
        },
    }
}

fn identify_risks(idea: &str, features: &[String]) -> Vec<RiskFactor> {
    let category = detect_category(idea, features);
    let mut risks = Vec::new();

    // Category-specific risks
    match category {
        "habit" => {
            risks.push(RiskFactor {
                category: "Market".to_string(),
                description: "Saturated habit tracking market with well-funded competitors"
                    .to_string(),
                severity: 0.85,
                mitigation: "Find underserved niche (e.g., parents, enterprises)".to_string(),
            });
            risks.push(RiskFactor {
                category: "Product".to_string(),
                description:
                    "High churn typical in habit/wellness category (70% drop after 30 days)"
                        .to_string(),
                severity: 0.80,
                mitigation: "Implement AI coaching, community features, or gamification"
                    .to_string(),
            });
        }
        "saas" => {
            risks.push(RiskFactor {
                category: "Market".to_string(),
                description: "Horizontal SaaS is crowded; incumbents have distribution advantages"
                    .to_string(),
                severity: 0.70,
                mitigation: "Focus on a specific vertical or underserved workflow".to_string(),
            });
            risks.push(RiskFactor {
                category: "Product".to_string(),
                description: "Enterprise sales cycles are long (3-9 months) and capital-intensive"
                    .to_string(),
                severity: 0.65,
                mitigation:
                    "Start with PLG (product-led growth) for SMBs, layer on enterprise later"
                        .to_string(),
            });
        }
        "ecommerce" => {
            risks.push(RiskFactor {
                category: "Market".to_string(),
                description: "Shopify and Amazon dominate; marketplace take-rates under pressure"
                    .to_string(),
                severity: 0.80,
                mitigation: "Pick a niche vertical where generic solutions fall short".to_string(),
            });
            risks.push(RiskFactor {
                category: "Operations".to_string(),
                description: "Logistics, fraud prevention, and payments compliance are complex"
                    .to_string(),
                severity: 0.70,
                mitigation:
                    "Use Stripe, ShipStation, and fraud-detection APIs to reduce operational risk"
                        .to_string(),
            });
        }
        "social" => {
            risks.push(RiskFactor {
                category: "Product".to_string(),
                description: "Social apps require viral growth loops; cold-start problem is severe".to_string(),
                severity: 0.90,
                mitigation: "Seed with a specific community (e.g., a niche interest group) before broadening".to_string(),
            });
            risks.push(RiskFactor {
                category: "Revenue".to_string(),
                description:
                    "Monetisation via ads requires massive scale; subscriptions face low conversion"
                        .to_string(),
                severity: 0.75,
                mitigation: "Build premium features for creators or businesses as primary revenue"
                    .to_string(),
            });
        }
        "aiml" => {
            risks.push(RiskFactor {
                category: "Technology".to_string(),
                description: "Foundation model providers (OpenAI, Google) can commoditise your wrapper".to_string(),
                severity: 0.85,
                mitigation: "Build unique data moats or domain-specific fine-tuning that is hard to replicate".to_string(),
            });
            risks.push(RiskFactor {
                category: "Regulatory".to_string(),
                description: "AI regulation (EU AI Act, US executive orders) could impose compliance costs".to_string(),
                severity: 0.60,
                mitigation: "Design with compliance in mind from day 1; keep humans in the loop for critical decisions".to_string(),
            });
        }
        "healthtech" => {
            risks.push(RiskFactor {
                category: "Regulatory".to_string(),
                description: "FDA, HIPAA, and health data regulations create significant compliance burden".to_string(),
                severity: 0.90,
                mitigation: "Hire regulatory counsel early; use HIPAA-compliant infrastructure (e.g., AWS HIPAA BAA)".to_string(),
            });
            risks.push(RiskFactor {
                category: "Market".to_string(),
                description:
                    "Hospital / insurer sales cycles are 12-24 months with complex procurement"
                        .to_string(),
                severity: 0.80,
                mitigation:
                    "Start with D2C or employer wellness to build traction before enterprise health"
                        .to_string(),
            });
        }
        "fintech" => {
            risks.push(RiskFactor {
                category: "Regulatory".to_string(),
                description:
                    "Banking regulations (KYC, AML, state licenses) are expensive and slow"
                        .to_string(),
                severity: 0.90,
                mitigation:
                    "Partner with a licensed bank or use BaaS provider (e.g., Unit, Synapse)"
                        .to_string(),
            });
            risks.push(RiskFactor {
                category: "Trust".to_string(),
                description:
                    "Consumers are reluctant to trust startups with money; brand trust is critical"
                        .to_string(),
                severity: 0.75,
                mitigation:
                    "Get FDIC insurance branding via banking partner; invest heavily in security"
                        .to_string(),
            });
        }
        "edtech" => {
            risks.push(RiskFactor {
                category: "Product".to_string(),
                description: "Low completion rates plague online courses (5-15% typical)"
                    .to_string(),
                severity: 0.75,
                mitigation:
                    "Use cohort-based learning, gamification, or AI tutoring for engagement"
                        .to_string(),
            });
            risks.push(RiskFactor {
                category: "Market".to_string(),
                description:
                    "Institutional procurement is slow; individual willingness-to-pay is low"
                        .to_string(),
                severity: 0.70,
                mitigation:
                    "Target corporate training budgets or offer employer-sponsored learning"
                        .to_string(),
            });
        }
        "devtools" => {
            risks.push(RiskFactor {
                category: "Market".to_string(),
                description: "Developers expect free tools; monetisation requires enterprise tier"
                    .to_string(),
                severity: 0.65,
                mitigation: "Open-source core with commercial cloud offering (open-core model)"
                    .to_string(),
            });
            risks.push(RiskFactor {
                category: "Competition".to_string(),
                description:
                    "Cloud providers (AWS, GCP, Azure) can bundle competing features for free"
                        .to_string(),
                severity: 0.70,
                mitigation: "Be multi-cloud; build community moat that clouds can't replicate"
                    .to_string(),
            });
        }
        _ => {
            risks.push(RiskFactor {
                category: "Market".to_string(),
                description: "Market opportunity is unclear; further validation needed".to_string(),
                severity: 0.60,
                mitigation: "Conduct customer discovery interviews before building".to_string(),
            });
        }
    }

    // Universal risk
    risks.push(RiskFactor {
        category: "Team".to_string(),
        description: "Execution risk — building the right product with the right team".to_string(),
        severity: 0.65,
        mitigation: "Hire domain experts and iterate fast with real user feedback".to_string(),
    });

    risks
}

fn estimate_revenue_model(idea: &str) -> RevenueModel {
    let category = detect_category(idea, &[]);

    match category {
        "saas" => RevenueModel {
            model_type: "B2B SaaS (Seat-Based)".to_string(),
            pricing_strategy: "$15-$50/user/month with team tiers".to_string(),
            expected_arpu: 35.0,
            payable_user_percentage: 0.15,
            year_1_revenue_projection: 500_000.0,
            year_3_revenue_projection: 10_000_000.0,
            year_5_revenue_projection: 50_000_000.0,
        },
        "ecommerce" => RevenueModel {
            model_type: "Marketplace / Transaction Fee".to_string(),
            pricing_strategy: "5-15% take rate + optional subscription for sellers".to_string(),
            expected_arpu: 120.0,
            payable_user_percentage: 0.25,
            year_1_revenue_projection: 1_000_000.0,
            year_3_revenue_projection: 15_000_000.0,
            year_5_revenue_projection: 80_000_000.0,
        },
        "social" => RevenueModel {
            model_type: "Freemium + Creator Subscriptions".to_string(),
            pricing_strategy: "Free tier, $9.99/mo premium, creator tools $29/mo".to_string(),
            expected_arpu: 3.5,
            payable_user_percentage: 0.05,
            year_1_revenue_projection: 100_000.0,
            year_3_revenue_projection: 3_000_000.0,
            year_5_revenue_projection: 25_000_000.0,
        },
        "aiml" => RevenueModel {
            model_type: "Usage-Based API + Enterprise License".to_string(),
            pricing_strategy: "Pay-per-call API + $500-$5000/mo enterprise plans".to_string(),
            expected_arpu: 200.0,
            payable_user_percentage: 0.20,
            year_1_revenue_projection: 800_000.0,
            year_3_revenue_projection: 20_000_000.0,
            year_5_revenue_projection: 100_000_000.0,
        },
        "healthtech" => RevenueModel {
            model_type: "B2B2C / Enterprise Health".to_string(),
            pricing_strategy: "$5-$20 PMPM (per member per month) via employer/insurer".to_string(),
            expected_arpu: 12.0,
            payable_user_percentage: 0.30,
            year_1_revenue_projection: 600_000.0,
            year_3_revenue_projection: 15_000_000.0,
            year_5_revenue_projection: 80_000_000.0,
        },
        "fintech" => RevenueModel {
            model_type: "Transaction Fee + Interchange Revenue".to_string(),
            pricing_strategy: "0.5-2.9% per transaction + $10-$30/mo premium accounts".to_string(),
            expected_arpu: 45.0,
            payable_user_percentage: 0.35,
            year_1_revenue_projection: 1_500_000.0,
            year_3_revenue_projection: 30_000_000.0,
            year_5_revenue_projection: 150_000_000.0,
        },
        "edtech" => RevenueModel {
            model_type: "B2C Subscription + B2B Licensing".to_string(),
            pricing_strategy: "$15-$40/mo individual, $10K-$100K/yr institution".to_string(),
            expected_arpu: 25.0,
            payable_user_percentage: 0.10,
            year_1_revenue_projection: 400_000.0,
            year_3_revenue_projection: 8_000_000.0,
            year_5_revenue_projection: 40_000_000.0,
        },
        "devtools" => RevenueModel {
            model_type: "Open-Core / Cloud SaaS".to_string(),
            pricing_strategy: "Free OSS + $20-$100/dev/mo cloud, enterprise custom pricing"
                .to_string(),
            expected_arpu: 50.0,
            payable_user_percentage: 0.12,
            year_1_revenue_projection: 500_000.0,
            year_3_revenue_projection: 12_000_000.0,
            year_5_revenue_projection: 60_000_000.0,
        },
        _ => RevenueModel {
            model_type: "B2C Freemium SaaS".to_string(),
            pricing_strategy: "$9.99/month, with annual discount".to_string(),
            expected_arpu: 6.5,
            payable_user_percentage: 0.08,
            year_1_revenue_projection: 250_000.0,
            year_3_revenue_projection: 5_000_000.0,
            year_5_revenue_projection: 30_000_000.0,
        },
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

    let moat_score =
        moats.iter().map(|m| m.strength * 100.0).sum::<f32>() / (moats.len().max(1) as f32);

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_category_saas() {
        assert_eq!(detect_category("build a saas dashboard", &[]), "saas");
        assert_eq!(
            detect_category("project management tool with collaboration", &[]),
            "saas"
        );
    }

    #[test]
    fn test_detect_category_ecommerce() {
        assert_eq!(
            detect_category("build an e-commerce store", &[]),
            "ecommerce"
        );
        assert_eq!(
            detect_category("create a marketplace for handmade goods", &[]),
            "ecommerce"
        );
    }

    #[test]
    fn test_detect_category_social() {
        assert_eq!(detect_category("build a social network", &[]), "social");
        assert_eq!(detect_category("create a community forum", &[]), "social");
    }

    #[test]
    fn test_detect_category_aiml() {
        assert_eq!(detect_category("build an ai copilot", &[]), "aiml");
        assert_eq!(
            detect_category("create an llm inference platform", &[]),
            "aiml"
        );
    }

    #[test]
    fn test_detect_category_healthtech() {
        assert_eq!(
            detect_category("build a telemedicine platform", &[]),
            "healthtech"
        );
        assert_eq!(
            detect_category("create a patient management system", &[]),
            "healthtech"
        );
    }

    #[test]
    fn test_detect_category_fintech() {
        assert_eq!(
            detect_category("build a payment processing app", &[]),
            "fintech"
        );
        assert_eq!(
            detect_category("create a crypto trading platform", &[]),
            "fintech"
        );
    }

    #[test]
    fn test_detect_category_edtech() {
        assert_eq!(
            detect_category("build an online learning platform", &[]),
            "edtech"
        );
        assert_eq!(
            detect_category("create a tutoring marketplace", &[]),
            "edtech"
        );
    }

    #[test]
    fn test_detect_category_devtools() {
        assert_eq!(
            detect_category("build a cli tool for developers", &[]),
            "devtools"
        );
        assert_eq!(
            detect_category("create a ci/cd pipeline platform", &[]),
            "devtools"
        );
    }

    #[test]
    fn test_detect_category_from_features() {
        // Category comes from features, not just idea text
        let features = vec!["machine learning".to_string(), "nlp".to_string()];
        assert_eq!(detect_category("build an app", &features), "aiml");
    }

    #[test]
    fn test_analyze_market_saas() {
        let result = analyze_market(
            "Build a SaaS analytics dashboard",
            vec!["analytics".to_string(), "dashboard".to_string()],
            vec!["React".to_string()],
        );
        assert_eq!(result.primary_opportunity.name, "Horizontal B2B SaaS");
        assert!(!result.competitive_landscape.is_empty());
        assert!(!result.risk_factors.is_empty());
        assert!(result.viability_score > 0.0);
        assert!(result.unit_economics.ltv_to_cac_ratio > 3.0);
    }

    #[test]
    fn test_analyze_market_fintech() {
        let result = analyze_market(
            "Create a payment processing platform",
            vec!["payments".to_string()],
            vec!["Node.js".to_string()],
        );
        assert_eq!(
            result.primary_opportunity.name,
            "FinTech & Financial Services"
        );
        assert!(result
            .competitive_landscape
            .iter()
            .any(|c| c.name == "Stripe"));
        assert!(result
            .risk_factors
            .iter()
            .any(|r| r.category == "Regulatory"));
    }

    #[test]
    fn test_analyze_market_devtools() {
        let result = analyze_market(
            "Build a developer CLI tool",
            vec!["cli".to_string()],
            vec!["Rust".to_string()],
        );
        assert_eq!(
            result.primary_opportunity.name,
            "Developer Tools & Infrastructure"
        );
        assert!(!result.alternative_opportunities.is_empty());
        assert!(result.revenue_model.model_type.contains("Open-Core"));
    }

    #[test]
    fn test_analyze_market_habit_still_works() {
        let result = analyze_market(
            "Build a habit tracker app",
            vec!["tracking".to_string()],
            vec!["React Native".to_string()],
        );
        assert_eq!(result.primary_opportunity.name, "Consumer Wellness Apps");
        assert!(result
            .competitive_landscape
            .iter()
            .any(|c| c.name == "Habitica"));
    }

    #[test]
    fn test_unit_economics_vary_by_category() {
        let saas = estimate_unit_economics("build a saas tool");
        let social = estimate_unit_economics("build a social network");
        let fintech = estimate_unit_economics("build a payment app");

        // SaaS should have higher LTV than social
        assert!(saas.lifetime_value > social.lifetime_value);
        // FinTech should have higher CAC than social
        assert!(fintech.customer_acquisition_cost > social.customer_acquisition_cost);
    }

    #[test]
    fn test_competitors_exist_for_all_categories() {
        let categories = vec![
            "habit tracker",
            "saas dashboard",
            "e-commerce shop",
            "social community",
            "ai copilot",
            "health clinic app",
            "payment fintech",
            "education learning",
            "developer cli tool",
        ];
        for idea in categories {
            let competitors = identify_competitors(idea);
            assert!(
                !competitors.is_empty(),
                "Expected competitors for '{}' but got none",
                idea
            );
        }
    }
}
