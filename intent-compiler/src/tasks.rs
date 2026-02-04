//! G-Agent Task Decomposition Module
//!
//! Breaks high-level features into atomic executable tasks with tool mappings.

use crate::types::{DepEdge, FeatureEntry, TechHint, VerbAction};
use serde::{Deserialize, Serialize};

/// Risk level for a task
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum RiskLevel {
    Safe,     // Read-only, no external effects
    #[default]
    Moderate, // Reversible writes
    Risky,    // External effects, hard to reverse
}


/// A single atomic task that G-Agent can execute
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    /// Unique task ID within the plan
    pub id: String,
    /// Human-readable description
    pub description: String,
    /// Original feature this task implements
    pub feature: String,
    /// Action verb from parsing
    pub action: VerbAction,
    /// Tools required for this task
    pub tools: Vec<String>,
    /// Risk level assessment
    pub risk: RiskLevel,
    /// IDs of tasks this depends on
    pub depends_on: Vec<String>,
    /// Tasks that depend on this (populated during DAG building)
    pub blocks: Vec<String>,
    /// Estimated duration in seconds
    pub estimated_seconds: u32,
    /// Priority (1 = highest, 5 = lowest)
    pub priority: u8,
    /// Can this task run in parallel with siblings?
    pub parallelizable: bool,
}

/// Tool categories for mapping features to tools
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolCategory {
    FileRead,
    FileWrite,
    CodebaseSearch,
    Git,
    Bash,
    Docker,
    Database,
    Http,
    Memory,
    Planning,
}

/// Map a verb action + feature to required tools
fn map_feature_to_tools(feature: &str, action: VerbAction, tech: &[TechHint]) -> Vec<String> {
    let feature_lower = feature.to_lowercase();
    let mut tools = Vec::new();

    // Base tools based on action
    match action {
        VerbAction::Build | VerbAction::Integrate => {
            tools.push("file_write".to_string());
            tools.push("file_edit".to_string());
        }
        VerbAction::Migrate => {
            tools.push("file_read".to_string());
            tools.push("file_write".to_string());
            tools.push("bash_execute".to_string());
        }
        VerbAction::Remove => {
            tools.push("file_read".to_string());
            tools.push("file_write".to_string());
        }
        VerbAction::Configure => {
            tools.push("file_edit".to_string());
        }
        VerbAction::Deploy => {
            tools.push("bash_execute".to_string());
            tools.push("file_read".to_string());
        }
        VerbAction::Refactor => {
            tools.push("file_read".to_string());
            tools.push("file_edit".to_string());
            tools.push("codebase_search".to_string());
        }
        VerbAction::Test => {
            tools.push("bash_execute".to_string());
            tools.push("file_read".to_string());
        }
    }

    // Feature-specific tools
    if feature_lower.contains("database") || feature_lower.contains("schema") {
        tools.push("db_schema".to_string());
        tools.push("db_query".to_string());
    }
    if feature_lower.contains("api") || feature_lower.contains("endpoint") {
        tools.push("file_read".to_string());
        tools.push("file_write".to_string());
    }
    if feature_lower.contains("docker") || feature_lower.contains("container") {
        tools.push("docker_compose_up".to_string());
        tools.push("docker_exec".to_string());
    }
    if feature_lower.contains("git")
        || feature_lower.contains("version")
        || feature_lower.contains("commit")
    {
        tools.push("git_status".to_string());
        tools.push("git_commit".to_string());
    }
    if feature_lower.contains("test") {
        tools.push("bash_execute".to_string());
    }
    if feature_lower.contains("deploy")
        || feature_lower.contains("ci")
        || feature_lower.contains("cd")
    {
        tools.push("bash_execute".to_string());
        if tech
            .iter()
            .any(|t| t.canonical == "kubernetes" || t.canonical == "docker")
        {
            tools.push("k8s_deploy".to_string());
        }
    }
    if feature_lower.contains("auth") {
        tools.push("file_write".to_string());
        tools.push("file_edit".to_string());
    }

    // Deduplicate
    tools.sort();
    tools.dedup();
    tools
}

/// Calculate risk level based on tools
fn calculate_risk(tools: &[String]) -> RiskLevel {
    // Risky tools
    const RISKY_TOOLS: &[&str] = &[
        "git_push",
        "bash_execute",
        "terminal_execute",
        "docker_exec",
        "docker_compose_up",
        "docker_compose_down",
        "db_migrate",
        "http_post",
        "http_put",
        "http_delete",
        "webhook_send",
        "k8s_deploy",
        "k8s_scale",
        "k8s_rollback",
        "pipeline_trigger",
        "release_create",
    ];

    // Moderate tools
    const MODERATE_TOOLS: &[&str] = &[
        "file_write",
        "file_edit",
        "git_commit",
        "git_branch",
        "memory_store",
        "skill_create",
        "skill_edit",
        "webhook_register",
        "heartbeat_create",
    ];

    for tool in tools {
        if RISKY_TOOLS.contains(&tool.as_str()) {
            return RiskLevel::Risky;
        }
    }

    for tool in tools {
        if MODERATE_TOOLS.contains(&tool.as_str()) {
            return RiskLevel::Moderate;
        }
    }

    RiskLevel::Safe
}

/// Estimate task duration based on complexity
fn estimate_duration(feature: &str, tools: &[String]) -> u32 {
    let feature_lower = feature.to_lowercase();
    let mut seconds = 10u32; // Base time

    // Complex features take longer
    if feature_lower.contains("authentication") || feature_lower.contains("auth") {
        seconds += 60;
    }
    if feature_lower.contains("database") || feature_lower.contains("migration") {
        seconds += 45;
    }
    if feature_lower.contains("api") || feature_lower.contains("endpoint") {
        seconds += 30;
    }
    if feature_lower.contains("test") {
        seconds += 20;
    }
    if feature_lower.contains("deploy") {
        seconds += 90;
    }

    // More tools = more time
    seconds += (tools.len() as u32) * 5;

    seconds
}

/// Decompose enriched features into atomic tasks
pub fn decompose_features(
    features: &[FeatureEntry],
    tech: &[TechHint],
    deps: &[DepEdge],
) -> Vec<Task> {
    let mut tasks = Vec::with_capacity(features.len() * 2);
    let mut task_id = 0;

    // Map feature names to task IDs for dependency resolution
    let mut feature_to_task_id: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();

    for feature in features {
        // Skip negated features
        if feature.negated {
            continue;
        }

        let id = format!("task_{}", task_id);
        task_id += 1;

        let tools = map_feature_to_tools(&feature.name, feature.action, tech);
        let risk = calculate_risk(&tools);
        let estimated_seconds = estimate_duration(&feature.name, &tools);

        // Description based on action
        let description = match feature.action {
            VerbAction::Build => format!("Build {}", feature.name),
            VerbAction::Migrate => format!("Migrate {}", feature.name),
            VerbAction::Remove => format!("Remove {}", feature.name),
            VerbAction::Integrate => format!("Integrate {}", feature.name),
            VerbAction::Configure => format!("Configure {}", feature.name),
            VerbAction::Deploy => format!("Deploy {}", feature.name),
            VerbAction::Refactor => format!("Refactor {}", feature.name),
            VerbAction::Test => format!("Test {}", feature.name),
        };

        feature_to_task_id.insert(feature.name.clone(), id.clone());

        tasks.push(Task {
            id,
            description,
            feature: feature.name.clone(),
            action: feature.action,
            tools,
            risk,
            depends_on: Vec::new(), // Populated below
            blocks: Vec::new(),
            estimated_seconds,
            priority: feature.priority,
            parallelizable: true, // Adjusted below based on deps
        });
    }

    // Resolve dependencies from the dependency graph
    for task in &mut tasks {
        for dep in deps {
            if dep.from == task.feature {
                if let Some(dep_task_id) = feature_to_task_id.get(&dep.to) {
                    task.depends_on.push(dep_task_id.clone());
                    task.parallelizable = false; // Has deps, not parallelizable
                }
            }
        }
    }

    // Populate 'blocks' (reverse of depends_on)
    let task_deps: Vec<(String, Vec<String>)> = tasks
        .iter()
        .map(|t| (t.id.clone(), t.depends_on.clone()))
        .collect();

    for task in &mut tasks {
        for (other_id, other_deps) in &task_deps {
            if other_deps.contains(&task.id) {
                task.blocks.push(other_id.clone());
            }
        }
    }

    // Sort by priority (ascending = higher priority first)
    tasks.sort_by_key(|t| t.priority);

    tasks
}

/// Get tasks that can execute immediately (no unresolved dependencies)
pub fn get_ready_tasks<'a>(tasks: &'a [Task], completed: &[String]) -> Vec<&'a Task> {
    tasks
        .iter()
        .filter(|t| {
            !completed.contains(&t.id) && t.depends_on.iter().all(|dep| completed.contains(dep))
        })
        .collect()
}

/// Topologically sort tasks for execution order
pub fn topological_sort(tasks: &[Task]) -> Vec<String> {
    let mut result = Vec::with_capacity(tasks.len());
    let mut visited = std::collections::HashSet::new();
    let mut temp_mark = std::collections::HashSet::new();

    fn visit(
        task_id: &str,
        tasks: &[Task],
        visited: &mut std::collections::HashSet<String>,
        temp_mark: &mut std::collections::HashSet<String>,
        result: &mut Vec<String>,
    ) {
        if visited.contains(task_id) {
            return;
        }
        if temp_mark.contains(task_id) {
            // Cycle detected - skip to avoid infinite loop
            return;
        }

        temp_mark.insert(task_id.to_string());

        if let Some(task) = tasks.iter().find(|t| t.id == task_id) {
            for dep in &task.depends_on {
                visit(dep, tasks, visited, temp_mark, result);
            }
        }

        temp_mark.remove(task_id);
        visited.insert(task_id.to_string());
        result.push(task_id.to_string());
    }

    for task in tasks {
        visit(&task.id, tasks, &mut visited, &mut temp_mark, &mut result);
    }

    result
}

/// Group tasks into parallel execution batches
pub fn parallelize_tasks(tasks: &[Task]) -> Vec<Vec<String>> {
    let order = topological_sort(tasks);
    let mut batches: Vec<Vec<String>> = Vec::new();
    let mut task_batch: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

    for task_id in &order {
        if let Some(task) = tasks.iter().find(|t| t.id == *task_id) {
            // Batch index is max of dependency batches + 1
            let batch_idx = if task.depends_on.is_empty() {
                0
            } else {
                task.depends_on
                    .iter()
                    .filter_map(|dep| task_batch.get(dep))
                    .max()
                    .map(|m| m + 1)
                    .unwrap_or(0)
            };

            // Ensure batch exists
            while batches.len() <= batch_idx {
                batches.push(Vec::new());
            }

            batches[batch_idx].push(task_id.clone());
            task_batch.insert(task_id.clone(), batch_idx);
        }
    }

    batches
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::VerbAction;

    fn make_feature(name: &str, action: VerbAction, priority: u8) -> FeatureEntry {
        FeatureEntry {
            name: name.to_string(),
            action,
            negated: false,
            priority,
            confidence: 0.9,
        }
    }

    #[test]
    fn test_decompose_simple() {
        let features = vec![
            make_feature("authentication", VerbAction::Build, 1),
            make_feature("dashboard", VerbAction::Build, 2),
        ];
        let tasks = decompose_features(&features, &[], &[]);
        assert_eq!(tasks.len(), 2);
        assert!(tasks[0].tools.contains(&"file_write".to_string()));
    }

    #[test]
    fn test_risk_assessment() {
        let risky_tools = vec!["bash_execute".to_string()];
        let safe_tools = vec!["file_read".to_string()];

        assert_eq!(calculate_risk(&risky_tools), RiskLevel::Risky);
        assert_eq!(calculate_risk(&safe_tools), RiskLevel::Safe);
    }

    #[test]
    fn test_dependency_resolution() {
        let features = vec![
            make_feature("authentication", VerbAction::Build, 1),
            make_feature("role-based-access", VerbAction::Build, 2),
        ];
        let deps = vec![DepEdge {
            from: "role-based-access".to_string(),
            to: "authentication".to_string(),
            reason: "RBAC requires auth".to_string(),
        }];

        let tasks = decompose_features(&features, &[], &deps);
        let rbac_task = tasks
            .iter()
            .find(|t| t.feature == "role-based-access")
            .unwrap();
        let auth_task = tasks
            .iter()
            .find(|t| t.feature == "authentication")
            .unwrap();

        assert!(rbac_task.depends_on.contains(&auth_task.id));
        assert!(!rbac_task.parallelizable);
    }

    #[test]
    fn test_topological_sort() {
        let features = vec![
            make_feature("a", VerbAction::Build, 1),
            make_feature("b", VerbAction::Build, 2),
            make_feature("c", VerbAction::Build, 3),
        ];
        let deps = vec![
            DepEdge {
                from: "b".to_string(),
                to: "a".to_string(),
                reason: "b deps a".to_string(),
            },
            DepEdge {
                from: "c".to_string(),
                to: "b".to_string(),
                reason: "c deps b".to_string(),
            },
        ];

        let tasks = decompose_features(&features, &[], &deps);
        let order = topological_sort(&tasks);

        // a should come before b, b before c
        let a_pos = order.iter().position(|id| {
            tasks
                .iter()
                .find(|t| t.id == *id)
                .map(|t| t.feature == "a")
                .unwrap_or(false)
        });
        let b_pos = order.iter().position(|id| {
            tasks
                .iter()
                .find(|t| t.id == *id)
                .map(|t| t.feature == "b")
                .unwrap_or(false)
        });
        let c_pos = order.iter().position(|id| {
            tasks
                .iter()
                .find(|t| t.id == *id)
                .map(|t| t.feature == "c")
                .unwrap_or(false)
        });

        assert!(a_pos < b_pos);
        assert!(b_pos < c_pos);
    }

    #[test]
    fn test_parallel_batches() {
        // a, b independent; c depends on both
        let tasks = vec![
            Task {
                id: "t0".to_string(),
                description: "a".to_string(),
                feature: "a".to_string(),
                action: VerbAction::Build,
                tools: vec![],
                risk: RiskLevel::Safe,
                depends_on: vec![],
                blocks: vec!["t2".to_string()],
                estimated_seconds: 10,
                priority: 1,
                parallelizable: true,
            },
            Task {
                id: "t1".to_string(),
                description: "b".to_string(),
                feature: "b".to_string(),
                action: VerbAction::Build,
                tools: vec![],
                risk: RiskLevel::Safe,
                depends_on: vec![],
                blocks: vec!["t2".to_string()],
                estimated_seconds: 10,
                priority: 1,
                parallelizable: true,
            },
            Task {
                id: "t2".to_string(),
                description: "c".to_string(),
                feature: "c".to_string(),
                action: VerbAction::Build,
                tools: vec![],
                risk: RiskLevel::Safe,
                depends_on: vec!["t0".to_string(), "t1".to_string()],
                blocks: vec![],
                estimated_seconds: 10,
                priority: 2,
                parallelizable: false,
            },
        ];

        let batches = parallelize_tasks(&tasks);

        assert_eq!(batches.len(), 2);
        assert!(batches[0].contains(&"t0".to_string()) && batches[0].contains(&"t1".to_string()));
        assert!(batches[1].contains(&"t2".to_string()));
    }

    #[test]
    fn test_negated_features_skipped() {
        let features = vec![
            FeatureEntry {
                name: "react".to_string(),
                action: VerbAction::Build,
                negated: true,
                priority: 1,
                confidence: 0.9,
            },
            make_feature("vue", VerbAction::Build, 2),
        ];

        let tasks = decompose_features(&features, &[], &[]);
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].feature, "vue");
    }
}
