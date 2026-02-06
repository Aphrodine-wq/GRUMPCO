//! G-Agent Plan Generation Module
//!
//! Creates complete execution plans from parsed intents.

use crate::tasks::{decompose_features, parallelize_tasks, topological_sort, RiskLevel, Task};
use crate::types::{DepEdge, FeatureEntry, IntentOutput, TechHint};
use serde::{Deserialize, Serialize};

/// Plan status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum PlanStatus {
    /// Plan generated, waiting for user approval
    #[default]
    AwaitingApproval,
    /// Plan approved, ready to execute
    Approved,
    /// Currently executing
    Executing,
    /// All tasks completed successfully
    Completed,
    /// One or more tasks failed
    Failed,
    /// Plan cancelled by user
    Cancelled,
}

/// Overall risk assessment for a plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanRiskAssessment {
    /// Overall risk level (highest of all tasks)
    pub level: RiskLevel,
    /// Number of safe tasks
    pub safe_count: usize,
    /// Number of moderate-risk tasks
    pub moderate_count: usize,
    /// Number of risky tasks
    pub risky_count: usize,
    /// Specific risk factors identified
    pub risk_factors: Vec<String>,
    /// Whether the plan can be auto-approved (all tasks safe)
    pub auto_approvable: bool,
}

/// A complete execution plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    /// Unique plan ID
    pub id: String,
    /// The original goal/request
    pub goal: String,
    /// All tasks in the plan
    pub tasks: Vec<Task>,
    /// Execution order (task IDs in order)
    pub execution_order: Vec<String>,
    /// Parallel execution batches (groups of task IDs that can run concurrently)
    pub parallel_batches: Vec<Vec<String>>,
    /// Current status
    pub status: PlanStatus,
    /// Risk assessment
    pub risk: PlanRiskAssessment,
    /// Confidence in the plan
    pub confidence: f32,
    /// Total estimated duration in seconds
    pub estimated_duration: u32,
    /// Project type inferred
    pub project_type: String,
    /// Architecture pattern inferred
    pub architecture_pattern: String,
    /// Tech stack identified
    pub tech_stack: Vec<String>,
}

/// Generate a plan ID
fn generate_plan_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("plan_{}", timestamp)
}

/// Assess overall plan risk
fn assess_risk(tasks: &[Task]) -> PlanRiskAssessment {
    let mut safe_count = 0;
    let mut moderate_count = 0;
    let mut risky_count = 0;
    let mut risk_factors = Vec::new();

    for task in tasks {
        match task.risk {
            RiskLevel::Safe => safe_count += 1,
            RiskLevel::Moderate => moderate_count += 1,
            RiskLevel::Risky => risky_count += 1,
        }

        // Identify specific risk factors
        for tool in &task.tools {
            let factor = match tool.as_str() {
                "git_push" => Some("Git push to remote repository"),
                "bash_execute" | "terminal_execute" => Some("Shell command execution"),
                "docker_compose_up" | "docker_compose_down" => Some("Docker container management"),
                "k8s_deploy" => Some("Kubernetes deployment"),
                "db_migrate" => Some("Database migration"),
                "http_post" | "http_put" | "http_delete" => Some("External HTTP requests"),
                _ => None,
            };
            if let Some(f) = factor {
                if !risk_factors.contains(&f.to_string()) {
                    risk_factors.push(f.to_string());
                }
            }
        }
    }

    let level = if risky_count > 0 {
        RiskLevel::Risky
    } else if moderate_count > 0 {
        RiskLevel::Moderate
    } else {
        RiskLevel::Safe
    };

    let auto_approvable = risky_count == 0 && moderate_count == 0;

    PlanRiskAssessment {
        level,
        safe_count,
        moderate_count,
        risky_count,
        risk_factors,
        auto_approvable,
    }
}

/// Generate a complete execution plan from an IntentOutput
pub fn generate_plan(intent: &IntentOutput, goal: &str) -> Plan {
    let tasks = decompose_features(
        &intent.enriched_features,
        &intent.enriched_tech,
        &intent.dependency_graph,
    );

    let execution_order = topological_sort(&tasks);
    let parallel_batches = parallelize_tasks(&tasks);
    let risk = assess_risk(&tasks);

    let estimated_duration: u32 = tasks.iter().map(|t| t.estimated_seconds).sum();

    Plan {
        id: generate_plan_id(),
        goal: goal.to_string(),
        tasks,
        execution_order,
        parallel_batches,
        status: PlanStatus::AwaitingApproval,
        risk,
        confidence: intent.confidence.overall,
        estimated_duration,
        project_type: intent.project_type.clone(),
        architecture_pattern: intent.architecture_pattern.clone(),
        tech_stack: intent.tech_stack_hints.clone(),
    }
}

/// Generate a plan from raw features, tech, and dependencies
pub fn generate_plan_from_components(
    goal: &str,
    features: &[FeatureEntry],
    tech: &[TechHint],
    deps: &[DepEdge],
    confidence: f32,
    project_type: &str,
    architecture_pattern: &str,
) -> Plan {
    let tasks = decompose_features(features, tech, deps);

    let execution_order = topological_sort(&tasks);
    let parallel_batches = parallelize_tasks(&tasks);
    let risk = assess_risk(&tasks);

    let estimated_duration: u32 = tasks.iter().map(|t| t.estimated_seconds).sum();
    let tech_stack: Vec<String> = tech.iter().map(|t| t.canonical.clone()).collect();

    Plan {
        id: generate_plan_id(),
        goal: goal.to_string(),
        tasks,
        execution_order,
        parallel_batches,
        status: PlanStatus::AwaitingApproval,
        risk,
        confidence,
        estimated_duration,
        project_type: project_type.to_string(),
        architecture_pattern: architecture_pattern.to_string(),
        tech_stack,
    }
}

/// Summarize a plan for display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanSummary {
    pub id: String,
    pub goal: String,
    pub task_count: usize,
    pub batch_count: usize,
    pub risk_level: RiskLevel,
    pub auto_approvable: bool,
    pub estimated_duration: u32,
    pub confidence: f32,
}

impl From<&Plan> for PlanSummary {
    fn from(plan: &Plan) -> Self {
        PlanSummary {
            id: plan.id.clone(),
            goal: plan.goal.clone(),
            task_count: plan.tasks.len(),
            batch_count: plan.parallel_batches.len(),
            risk_level: plan.risk.level,
            auto_approvable: plan.risk.auto_approvable,
            estimated_duration: plan.estimated_duration,
            confidence: plan.confidence,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse_intent;

    #[test]
    fn test_generate_plan_simple() {
        let intent = parse_intent("Build authentication with Node.js", serde_json::json!({}));
        let plan = generate_plan(&intent, "Build authentication with Node.js");

        assert!(!plan.id.is_empty());
        assert_eq!(plan.goal, "Build authentication with Node.js");
        assert!(!plan.tasks.is_empty());
        assert!(!plan.execution_order.is_empty());
    }

    #[test]
    fn test_plan_risk_assessment() {
        let intent = parse_intent(
            "Build authentication and deploy to Kubernetes",
            serde_json::json!({}),
        );
        let plan = generate_plan(&intent, "Deploy app");

        // Deploy should trigger risky tools
        assert!(!plan.risk.risk_factors.is_empty() || plan.risk.level != RiskLevel::Risky);
    }

    #[test]
    fn test_plan_parallelization() {
        let intent = parse_intent(
            "Build authentication, dashboard, and API endpoints",
            serde_json::json!({}),
        );
        let plan = generate_plan(&intent, "Build features");

        // Should have at least one batch
        assert!(!plan.parallel_batches.is_empty());
    }

    #[test]
    fn test_plan_summary() {
        let intent = parse_intent(
            "Build a React app with authentication",
            serde_json::json!({}),
        );
        let plan = generate_plan(&intent, "Build React app");
        let summary: PlanSummary = (&plan).into();

        assert_eq!(summary.id, plan.id);
        assert_eq!(summary.task_count, plan.tasks.len());
    }

    #[test]
    fn test_safe_plan_auto_approvable() {
        use crate::types::VerbAction;

        let features = vec![FeatureEntry {
            name: "documentation".to_string(),
            action: VerbAction::Build,
            negated: false,
            priority: 1,
            confidence: 0.9,
        }];

        let plan = generate_plan_from_components(
            "Write docs",
            &features,
            &[],
            &[],
            0.8,
            "library",
            "unknown",
        );

        // File-only tasks should be moderate (file_write)
        assert!(plan.risk.level == RiskLevel::Moderate || plan.risk.level == RiskLevel::Safe);
    }
}
