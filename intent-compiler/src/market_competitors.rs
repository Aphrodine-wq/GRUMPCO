//! Market Competitors Module
//!
//! Competitive analysis and moat identification.

use serde::{Deserialize, Serialize};

/// Competitor Analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Competitor {
    pub name: String,
    pub estimated_revenue: String,
    pub funding: String,
    pub key_strength: String,
    pub vulnerability: String,
}

/// Competitive Moat Analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitiveMoat {
    pub moat_type: String, // "Network effect", "Brand", "Switching cost", etc.
    pub strength: f32,     // 0.0 to 1.0
    pub defensibility: String,
    pub years_to_defend: u32,
}

/// Identify competitors based on project idea
pub fn identify_competitors(idea: &str) -> Vec<Competitor> {
    let idea_lower = idea.to_lowercase();

    // Return relevant competitors based on keywords
    if idea_lower.contains("habit") || idea_lower.contains("tracking") {
        vec![
            Competitor {
                name: "Todoist".to_string(),
                estimated_revenue: "$30M".to_string(),
                funding: "Bootstrapped".to_string(),
                key_strength: "Simple, reliable task management".to_string(),
                vulnerability: "Limited habit-specific features".to_string(),
            },
            Competitor {
                name: "Notion".to_string(),
                estimated_revenue: "$100M".to_string(),
                funding: "$343M Series C".to_string(),
                key_strength: "All-in-one workspace".to_string(),
                vulnerability: "Complexity for simple habits".to_string(),
            },
        ]
    } else if idea_lower.contains("code") || idea_lower.contains("developer") {
        vec![
            Competitor {
                name: "GitHub Copilot".to_string(),
                estimated_revenue: "$100M+".to_string(),
                funding: "Microsoft".to_string(),
                key_strength: "AI-powered code completion".to_string(),
                vulnerability: "Requires IDE integration".to_string(),
            },
            Competitor {
                name: "Cursor".to_string(),
                estimated_revenue: "$10M".to_string(),
                funding: "$8M".to_string(),
                key_strength: "AI-native code editor".to_string(),
                vulnerability: "Limited IDE support".to_string(),
            },
        ]
    } else {
        vec![Competitor {
            name: "Established Players".to_string(),
            estimated_revenue: "$1M-$100M".to_string(),
            funding: "Series A-C".to_string(),
            key_strength: "Brand recognition, existing users".to_string(),
            vulnerability: "Legacy tech, slow to adapt".to_string(),
        }]
    }
}

/// Identify potential competitive moats
pub fn identify_potential_moats(idea: &str, _features: &[String]) -> Vec<CompetitiveMoat> {
    let idea_lower = idea.to_lowercase();
    let mut moats = vec![];

    if idea_lower.contains("data") || idea_lower.contains("ml") {
        moats.push(CompetitiveMoat {
            moat_type: "Data Network Effects".to_string(),
            strength: 0.85,
            defensibility: "High".to_string(),
            years_to_defend: 5,
        });
    }

    if idea_lower.contains("community") || idea_lower.contains("social") {
        moats.push(CompetitiveMoat {
            moat_type: "Network Effects".to_string(),
            strength: 0.90,
            defensibility: "Very High".to_string(),
            years_to_defend: 7,
        });
    }

    moats.push(CompetitiveMoat {
        moat_type: "Execution Speed".to_string(),
        strength: 0.60,
        defensibility: "Medium".to_string(),
        years_to_defend: 2,
    });

    moats
}
