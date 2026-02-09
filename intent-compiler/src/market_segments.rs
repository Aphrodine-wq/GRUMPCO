//! Market Segments Module
//!
//! Defines market segment structures and competition levels.

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

impl CompetitionLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            CompetitionLevel::VeryLow => "Very Low",
            CompetitionLevel::Low => "Low",
            CompetitionLevel::Medium => "Medium",
            CompetitionLevel::High => "High",
            CompetitionLevel::Saturated => "Saturated",
        }
    }
}

/// Detect which market category best fits the idea + features.
pub fn detect_category(idea: &str, features: &[String]) -> &'static str {
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
