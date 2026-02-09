//! Market Revenue Module
//!
//! Revenue modeling and unit economics calculations.

use serde::{Deserialize, Serialize};

/// Revenue Model Definition
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

/// Unit Economics Analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnitEconomics {
    pub customer_acquisition_cost: f32,
    pub lifetime_value: f32,
    pub payback_period_months: u32,
    pub gross_margin: f32,
    pub ltv_to_cac_ratio: f32, // Should be > 3
    pub viability: String,     // "Viable", "Marginal", "Unsustainable"
}

/// Estimate revenue model based on project idea
pub fn estimate_revenue_model(idea: &str) -> RevenueModel {
    let idea_lower = idea.to_lowercase();

    if idea_lower.contains("b2b") || idea_lower.contains("enterprise") {
        RevenueModel {
            model_type: "B2B SaaS".to_string(),
            pricing_strategy: "Tiered per-seat ($29-$99/month)".to_string(),
            expected_arpu: 600.0,
            payable_user_percentage: 0.15,
            year_1_revenue_projection: 500_000.0,
            year_3_revenue_projection: 5_000_000.0,
            year_5_revenue_projection: 25_000_000.0,
        }
    } else if idea_lower.contains("marketplace") {
        RevenueModel {
            model_type: "Marketplace".to_string(),
            pricing_strategy: "Take rate (10-20%)".to_string(),
            expected_arpu: 120.0,
            payable_user_percentage: 0.25,
            year_1_revenue_projection: 100_000.0,
            year_3_revenue_projection: 2_000_000.0,
            year_5_revenue_projection: 10_000_000.0,
        }
    } else {
        RevenueModel {
            model_type: "B2C SaaS".to_string(),
            pricing_strategy: "Freemium ($4.99-$19.99/month)".to_string(),
            expected_arpu: 60.0,
            payable_user_percentage: 0.05,
            year_1_revenue_projection: 50_000.0,
            year_3_revenue_projection: 500_000.0,
            year_5_revenue_projection: 2_500_000.0,
        }
    }
}

/// Estimate unit economics based on project idea
pub fn estimate_unit_economics(idea: &str) -> UnitEconomics {
    let idea_lower = idea.to_lowercase();

    let (cac, ltv) = if idea_lower.contains("b2b") || idea_lower.contains("enterprise") {
        (500.0, 3000.0) // Higher CAC, much higher LTV
    } else if idea_lower.contains("marketplace") {
        (200.0, 800.0)
    } else {
        (50.0, 180.0) // Consumer apps: lower CAC, lower LTV
    };

    let ratio = ltv / cac;
    let viability = if ratio >= 3.0 {
        "Viable"
    } else if ratio >= 2.0 {
        "Marginal"
    } else {
        "Unsustainable"
    };

    UnitEconomics {
        customer_acquisition_cost: cac,
        lifetime_value: ltv,
        payback_period_months: ((cac / (ltv / 12.0)).ceil() as u32).max(6),
        gross_margin: 0.75,
        ltv_to_cac_ratio: ratio,
        viability: viability.to_string(),
    }
}
