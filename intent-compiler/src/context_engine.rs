//! Unified Context Engine
//!
//! Synthesizes ALL insights (market, semantic, technical, psychological)
//! into ONE comprehensive analysis for founders.
//!
//! The missing piece between "what to build" and "what wins"

use crate::market_engine::MarketAnalysis;
use crate::semantics::{Contradiction, ImplicitRequirement, StyleSuggestion};
use serde::{Deserialize, Serialize};

/// THE UNIFIED CONTEXT ANALYSIS
/// This is what founders see. Period.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextAnalysis {
    pub project_idea: String,
    pub overall_score: f32,     // 0-100
    pub recommendation: String, // The honest take
    pub should_build: bool,

    // MARKET LAYER
    pub market: MarketInsights,

    // TECHNICAL LAYER
    pub technical: TechnicalInsights,

    // PRODUCT LAYER
    pub product: ProductInsights,

    // EXECUTION LAYER
    pub execution: ExecutionInsights,

    // THE VERDICT
    pub verdict: FinalVerdict,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketInsights {
    pub tam: String,
    pub competition: String,
    pub market_viability: f32,
    pub addressable_segments: Vec<String>,
    pub realistic_revenue_year_3: String,
    pub exit_potential: String,
    pub key_risks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalInsights {
    pub complexity_score: f32,
    pub implicit_requirements: Vec<ImplicitRequirement>,
    pub contradictions: Vec<Contradiction>,
    pub recommended_stack: Vec<String>,
    pub code_style_patterns: Vec<StyleSuggestion>,
    pub buildability: f32, // 0-1: how hard to actually build
    pub time_to_mvp_weeks: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductInsights {
    pub core_value_prop: String,
    pub ideal_customer_description: String,
    pub unit_economics_viable: bool,
    pub moat_strength: f32, // 0-1: how defensible is this?
    pub feature_overlap_with_competitors: String,
    pub differentiation_angle: String,
    pub retention_risk: f32, // 0-1: how likely is high churn?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionInsights {
    pub go_to_market_difficulty: f32, // 0-1
    pub team_requirements: Vec<String>,
    pub funding_requirements: String,
    pub months_to_profitability: u32,
    pub critical_success_factors: Vec<String>,
    pub top_failure_modes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinalVerdict {
    pub decision: VerdictType,
    pub rationale: String,
    pub best_case_scenario: String,
    pub worst_case_scenario: String,
    pub if_you_build_this_focus_on: Vec<String>,
    pub if_you_pivot_try_instead: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VerdictType {
    BuildNow,      // This is your ticket. Execute flawlessly.
    BuildButPivot, // Right idea, wrong angle. Adjust & build.
    Skip,          // Not a bad idea, just wrong time/market/fit.
    ThinkHarder,   // Needs more research before committing.
    DeadOnArrival, // Avoid entirely.
}

/// Synthesize all engines into one unified analysis
pub fn analyze_context(
    idea: &str,
    features: Vec<String>,
    complexity_score: f32,
    market_analysis: &MarketAnalysis,
    implicit_requirements: Vec<ImplicitRequirement>,
    contradictions: Vec<Contradiction>,
    style_suggestions: Vec<StyleSuggestion>,
) -> ContextAnalysis {
    // Calculate technical layer
    let tech_score = calculate_technical_viability(&features, complexity_score, &contradictions);
    let buildability = (100.0 - complexity_score * 20.0).max(20.0) / 100.0;

    // Calculate product layer
    let product_score = calculate_product_viability(&features, &contradictions);
    let moat_strength = if style_suggestions.len() > 2 {
        0.7
    } else {
        0.4
    };

    // Calculate execution layer
    let execution_score = calculate_execution_difficulty(&features);

    // Synthesis: weighted score from all angles
    let market_weight = 0.35;
    let tech_weight = 0.25;
    let product_weight = 0.25;
    let execution_weight = 0.15;

    let overall_score = (market_analysis.viability_score * market_weight
        + tech_score * tech_weight
        + product_score * product_weight
        + (100.0 - execution_score) * execution_weight)
        .min(100.0);

    // Make the decision
    let verdict = make_verdict(
        overall_score,
        market_analysis,
        tech_score,
        product_score,
        &contradictions,
    );

    let should_build = matches!(
        verdict.decision,
        VerdictType::BuildNow | VerdictType::BuildButPivot
    );

    let recommendation = match verdict.decision {
        VerdictType::BuildNow => format!(
            "This is a strong opportunity. {} is a real market. Build it.
             Focus on: {}",
            market_analysis.primary_opportunity.name,
            verdict.if_you_build_this_focus_on.join(", ")
        ),
        VerdictType::BuildButPivot => format!(
            "Your core idea is good, but you're targeting the wrong market.
             Build this instead: {}",
            verdict
                .if_you_pivot_try_instead
                .first()
                .cloned()
                .unwrap_or_default()
        ),
        VerdictType::Skip => {
            "Market is too saturated. Your effort is better spent elsewhere.".to_string()
        }
        VerdictType::ThinkHarder => "You need more data before committing 6+ months.".to_string(),
        VerdictType::DeadOnArrival => "This has structural issues. Don't build it.".to_string(),
    };

    ContextAnalysis {
        project_idea: idea.to_string(),
        overall_score,
        recommendation,
        should_build,

        market: MarketInsights {
            tam: market_analysis.primary_opportunity.tam.clone(),
            competition: format!(
                "{:?}",
                market_analysis.primary_opportunity.competition_level
            ),
            market_viability: market_analysis.viability_score,
            addressable_segments: market_analysis
                .alternative_opportunities
                .iter()
                .map(|s| s.name.clone())
                .collect(),
            realistic_revenue_year_3: market_analysis
                .revenue_model
                .year_3_revenue_projection
                .to_string(),
            exit_potential: market_analysis.primary_opportunity.exit_potential.clone(),
            key_risks: market_analysis
                .risk_factors
                .iter()
                .take(3)
                .map(|r| r.description.clone())
                .collect(),
        },

        technical: TechnicalInsights {
            complexity_score,
            implicit_requirements,
            contradictions: contradictions.clone(),
            recommended_stack: infer_stack(&features),
            code_style_patterns: style_suggestions,
            buildability,
            time_to_mvp_weeks: (8.0 + complexity_score * 4.0) as u32,
        },

        product: ProductInsights {
            core_value_prop: extract_value_prop(&features),
            ideal_customer_description: describe_ideal_customer(&features),
            unit_economics_viable: market_analysis.unit_economics.ltv_to_cac_ratio > 3.0,
            moat_strength,
            feature_overlap_with_competitors: assess_overlap(
                &features,
                &market_analysis.competitive_landscape,
            ),
            differentiation_angle: find_differentiation(&features, moat_strength),
            retention_risk: estimate_retention_risk(&features),
        },

        execution: ExecutionInsights {
            go_to_market_difficulty: market_analysis.go_to_market.initial_marketing_budget as f32
                / 100000.0,
            team_requirements: infer_team_requirements(&features, complexity_score),
            funding_requirements: estimate_funding(&features, complexity_score),
            months_to_profitability: market_analysis
                .primary_opportunity
                .time_to_profitability_months,
            critical_success_factors: identify_csfs(&features, &contradictions),
            top_failure_modes: identify_failure_modes(&features, &market_analysis.risk_factors),
        },

        verdict,
    }
}

// ============================================================================
// Helper functions
// ============================================================================

fn calculate_technical_viability(
    _features: &[String],
    complexity: f32,
    contradictions: &[Contradiction],
) -> f32 {
    let base_score = 100.0 - (complexity * 30.0);
    let contradiction_penalty = contradictions
        .iter()
        .map(|c| c.severity * 15.0)
        .sum::<f32>();
    (base_score - contradiction_penalty).max(20.0)
}

fn calculate_product_viability(features: &[String], contradictions: &[Contradiction]) -> f32 {
    let feature_clarity = if features.len() > 15 { 30.0 } else { 80.0 };
    let contradiction_impact = contradictions
        .iter()
        .map(|c| c.severity * 20.0)
        .sum::<f32>();
    (feature_clarity - contradiction_impact).max(20.0)
}

fn calculate_execution_difficulty(features: &[String]) -> f32 {
    // More features = harder to execute
    let feature_count_score = (features.len() as f32).min(20.0) * 3.0;
    let integration_complexity = if features
        .iter()
        .any(|f| f.contains("payment") || f.contains("external"))
    {
        30.0
    } else {
        10.0
    };
    (feature_count_score + integration_complexity).min(100.0)
}

fn make_verdict(
    overall_score: f32,
    market_analysis: &MarketAnalysis,
    tech_score: f32,
    product_score: f32,
    contradictions: &[Contradiction],
) -> FinalVerdict {
    let has_major_contradictions = contradictions.iter().any(|c| c.severity > 0.8);

    let decision = if overall_score > 70.0 && tech_score > 60.0 && !has_major_contradictions {
        VerdictType::BuildNow
    } else if overall_score > 55.0 && product_score > 50.0 {
        VerdictType::BuildButPivot
    } else if overall_score > 40.0 {
        VerdictType::ThinkHarder
    } else if overall_score < 30.0 {
        VerdictType::DeadOnArrival
    } else {
        VerdictType::Skip
    };

    FinalVerdict {
        decision,
        rationale: "Synthesized from market, technical, product, and execution analysis"
            .to_string(),
        best_case_scenario: format!(
            "Hit ${}M ARR by year 3, exit for ${}-${} billion",
            market_analysis.revenue_model.year_3_revenue_projection as i32 / 1_000_000,
            (overall_score * 0.5) as i32,
            (overall_score * 2.0) as i32
        ),
        worst_case_scenario: "Spend 18 months, reach $50K MRR, plateau and shut down".to_string(),
        if_you_build_this_focus_on: vec![
            "Unit economics first (CAC < LTV/3)".to_string(),
            "Retention over growth (keep users longer)".to_string(),
            "Moat building (defensibility)".to_string(),
        ],
        if_you_pivot_try_instead: market_analysis
            .alternative_opportunities
            .iter()
            .map(|s| format!("{} ({})", s.name, s.tam))
            .collect(),
    }
}

fn infer_stack(features: &[String]) -> Vec<String> {
    let mut stack = vec![];
    if features
        .iter()
        .any(|f| f.contains("user") || f.contains("profile"))
    {
        stack.push("React/Vue frontend".to_string());
        stack.push("Node.js/Python backend".to_string());
        stack.push("PostgreSQL database".to_string());
    }
    if features
        .iter()
        .any(|f| f.contains("realtime") || f.contains("notification"))
    {
        stack.push("WebSocket/Socket.io".to_string());
    }
    if features.iter().any(|f| f.contains("payment")) {
        stack.push("Stripe integration".to_string());
    }
    stack
}

fn extract_value_prop(features: &[String]) -> String {
    let primary = features.first().cloned().unwrap_or("unclear".to_string());
    format!("Help users with {}", primary)
}

fn describe_ideal_customer(features: &[String]) -> String {
    if features
        .iter()
        .any(|f| f.contains("business") || f.contains("enterprise"))
    {
        "Mid-market companies, $10M-$100M revenue".to_string()
    } else if features
        .iter()
        .any(|f| f.contains("creator") || f.contains("freelance"))
    {
        "Freelancers and creators earning $50K-$500K/year".to_string()
    } else {
        "Individual consumers, tech-savvy, early adopters".to_string()
    }
}

fn assess_overlap(
    _features: &[String],
    competitors: &[crate::market_engine::Competitor],
) -> String {
    if competitors.is_empty() {
        "No direct competitors identified".to_string()
    } else {
        format!(
            "High overlap with {}",
            competitors
                .first()
                .map(|c| &c.name)
                .unwrap_or(&"existing solutions".to_string())
        )
    }
}

fn find_differentiation(_features: &[String], moat_strength: f32) -> String {
    if moat_strength > 0.7 {
        "Strong differentiation via technology/network/data".to_string()
    } else if moat_strength > 0.4 {
        "Weak differentiation - execution-dependent".to_string()
    } else {
        "No clear differentiation - commodity market".to_string()
    }
}

fn estimate_retention_risk(features: &[String]) -> f32 {
    if features
        .iter()
        .any(|f| f.contains("habit") || f.contains("wellness"))
    {
        0.8 // High churn risk
    } else if features.iter().any(|f| f.contains("enterprise")) {
        0.2 // Low churn risk
    } else {
        0.5
    }
}

fn infer_team_requirements(features: &[String], complexity: f32) -> Vec<String> {
    let mut team = vec!["Founder/CEO (product + vision)".to_string()];

    if complexity > 0.5 {
        team.push("Senior engineer (architecture)".to_string());
        team.push("Full-stack developer".to_string());
    } else {
        team.push("Full-stack developer".to_string());
    }

    team.push("Growth/marketing person".to_string());

    if features
        .iter()
        .any(|f| f.contains("payment") || f.contains("financial"))
    {
        team.push("Ops/compliance specialist".to_string());
    }

    team
}

fn estimate_funding(_features: &[String], complexity: f32) -> String {
    let base_seed = 250000;
    let complexity_multiplier = complexity * 2.0;
    let total = (base_seed as f32 * complexity_multiplier) as i32;
    format!("${} seed (6-12 months runway)", total)
}

fn identify_csfs(_features: &[String], contradictions: &[Contradiction]) -> Vec<String> {
    let mut csfs = vec![
        "Product-market fit within 6 months".to_string(),
        "Unit economics > 3:1 LTV:CAC".to_string(),
        "10%+ month-over-month growth".to_string(),
    ];

    if contradictions.len() > 2 {
        csfs.push("Resolve feature contradictions early".to_string());
    }

    csfs
}

fn identify_failure_modes(
    features: &[String],
    risks: &[crate::market_engine::RiskFactor],
) -> Vec<String> {
    let mut modes = vec![];

    for risk in risks.iter().take(2) {
        modes.push(risk.description.clone());
    }

    if features.len() > 20 {
        modes.push("Feature creep paralyzes development".to_string());
    }

    modes
}
