use crate::types::{ArchitecturePattern, ProjectType, TechCategory, TechHint};

/// Classify project type from features and tech hints.
pub fn classify_project_type(
    features: &[String],
    tech: &[TechHint],
    words: &[String],
) -> ProjectType {
    let text = words.join(" ");
    let has_frontend = tech
        .iter()
        .any(|t| matches!(t.category, TechCategory::Frontend));
    let has_backend = tech
        .iter()
        .any(|t| matches!(t.category, TechCategory::Backend));
    let has_db = tech
        .iter()
        .any(|t| matches!(t.category, TechCategory::Database));

    // Explicit keywords
    if text.contains("microservice") || text.contains("micro-service") {
        return ProjectType::Microservice;
    }
    if text.contains("cli") || text.contains("command line") || text.contains("command-line") {
        return ProjectType::Cli;
    }
    if text.contains("mobile")
        || text.contains("ios")
        || text.contains("android")
        || text.contains("react native")
        || text.contains("flutter")
    {
        return ProjectType::MobileApp;
    }
    if text.contains("library") || text.contains("package") || text.contains("sdk") {
        return ProjectType::Library;
    }

    // API-only (backend + db, no frontend)
    if has_backend
        && has_db
        && !has_frontend
        && !features
            .iter()
            .any(|f| f.contains("dashboard") || f.contains("landing") || f.contains("ui"))
    {
        return ProjectType::Api;
    }

    // Web app (has frontend or UI features)
    if has_frontend
        || features.iter().any(|f| {
            f.contains("dashboard")
                || f.contains("landing")
                || f.contains("e-commerce")
                || f.contains("ui")
                || f.contains("page")
        })
    {
        return ProjectType::WebApp;
    }

    if has_backend || has_db {
        return ProjectType::Api;
    }

    ProjectType::Unknown
}

/// Classify architecture pattern from tech and features.
pub fn classify_architecture(
    features: &[String],
    tech: &[TechHint],
    words: &[String],
) -> ArchitecturePattern {
    let text = words.join(" ");

    if text.contains("microservice") || text.contains("micro-service") {
        return ArchitecturePattern::Microservices;
    }
    if text.contains("serverless") || text.contains("lambda") || text.contains("cloud function") {
        return ArchitecturePattern::Serverless;
    }
    if text.contains("event driven")
        || text.contains("event-driven")
        || text.contains("event sourcing")
        || text.contains("cqrs")
    {
        return ArchitecturePattern::EventDriven;
    }
    if text.contains("jamstack") || text.contains("jam stack") {
        return ArchitecturePattern::Jamstack;
    }

    // Infer from tech
    let has_lambda = tech.iter().any(|t| t.canonical == "aws-lambda");
    let has_k8s = tech.iter().any(|t| t.canonical == "kubernetes");
    let has_kafka = tech
        .iter()
        .any(|t| t.canonical == "kafka" || t.canonical == "rabbitmq");
    let has_static_host = tech.iter().any(|t| {
        t.canonical == "vercel" || t.canonical == "netlify" || t.canonical == "cloudflare"
    });
    let has_frontend_framework = tech
        .iter()
        .any(|t| matches!(t.category, TechCategory::Frontend));

    if has_lambda {
        return ArchitecturePattern::Serverless;
    }
    if has_kafka
        || features
            .iter()
            .any(|f| f.contains("message-queue") || f.contains("event"))
    {
        return ArchitecturePattern::EventDriven;
    }
    if has_k8s {
        return ArchitecturePattern::Microservices;
    }
    if has_static_host
        && has_frontend_framework
        && !tech
            .iter()
            .any(|t| matches!(t.category, TechCategory::Backend))
    {
        return ArchitecturePattern::Jamstack;
    }

    ArchitecturePattern::Monolith
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::TechHint;

    fn hint(canonical: &str, cat: TechCategory) -> TechHint {
        TechHint {
            canonical: canonical.into(),
            matched_as: canonical.into(),
            category: cat,
            negated: false,
            confidence: 1.0,
        }
    }

    fn words(s: &str) -> Vec<String> {
        s.split_whitespace().map(|w| w.to_lowercase()).collect()
    }

    #[test]
    fn test_web_app() {
        let tech = vec![
            hint("react", TechCategory::Frontend),
            hint("express", TechCategory::Backend),
        ];
        let features = vec!["dashboard".into()];
        assert_eq!(
            classify_project_type(&features, &tech, &words("build a web app")),
            ProjectType::WebApp
        );
    }

    #[test]
    fn test_api_only() {
        let tech = vec![
            hint("express", TechCategory::Backend),
            hint("postgresql", TechCategory::Database),
        ];
        let features = vec!["rest-api".into()];
        assert_eq!(
            classify_project_type(&features, &tech, &words("build a rest api")),
            ProjectType::Api
        );
    }

    #[test]
    fn test_microservice_keyword() {
        let pt = classify_project_type(&[], &[], &words("build a microservice"));
        assert_eq!(pt, ProjectType::Microservice);
    }

    #[test]
    fn test_serverless_arch() {
        let tech = vec![hint("aws-lambda", TechCategory::Cloud)];
        assert_eq!(
            classify_architecture(&[], &tech, &words("deploy functions")),
            ArchitecturePattern::Serverless
        );
    }

    #[test]
    fn test_event_driven_arch() {
        let tech = vec![hint("kafka", TechCategory::Tool)];
        assert_eq!(
            classify_architecture(&[], &tech, &words("process events")),
            ArchitecturePattern::EventDriven
        );
    }

    #[test]
    fn test_default_monolith() {
        let tech = vec![hint("express", TechCategory::Backend)];
        assert_eq!(
            classify_architecture(&[], &tech, &words("build an app")),
            ArchitecturePattern::Monolith
        );
    }
}
