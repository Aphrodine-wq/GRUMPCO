use crate::types::DepEdge;

/// Static dependency rules: (feature, depends_on, reason)
const DEPENDENCY_RULES: &[(&str, &str, &str)] = &[
    (
        "role-based-access",
        "authentication",
        "RBAC requires authentication",
    ),
    (
        "access-control",
        "authentication",
        "access control requires authentication",
    ),
    (
        "admin-panel",
        "authentication",
        "admin panel requires authentication",
    ),
    (
        "two-factor-auth",
        "authentication",
        "2FA requires base authentication",
    ),
    (
        "multi-factor-auth",
        "authentication",
        "MFA requires base authentication",
    ),
    (
        "single-sign-on",
        "authentication",
        "SSO requires base authentication",
    ),
    (
        "oauth-authentication",
        "authentication",
        "OAuth requires base authentication",
    ),
    (
        "social-login",
        "authentication",
        "social login requires authentication",
    ),
    (
        "password-reset",
        "authentication",
        "password reset requires authentication",
    ),
    (
        "user-profiles",
        "authentication",
        "user profiles require authentication",
    ),
    (
        "subscriptions",
        "payments",
        "subscriptions require payment processing",
    ),
    ("billing", "payments", "billing requires payment processing"),
    (
        "checkout",
        "shopping-cart",
        "checkout requires shopping cart",
    ),
    (
        "shopping-cart",
        "authentication",
        "shopping cart requires authentication",
    ),
    ("e-commerce", "payments", "e-commerce requires payments"),
    (
        "e-commerce",
        "authentication",
        "e-commerce requires authentication",
    ),
    (
        "push-notifications",
        "notifications",
        "push notifications extend notifications",
    ),
    (
        "audit-logging",
        "authentication",
        "audit logging requires authentication",
    ),
    (
        "data-export",
        "authentication",
        "data export requires authentication",
    ),
    (
        "settings-panel",
        "authentication",
        "settings require authentication",
    ),
    (
        "onboarding",
        "authentication",
        "onboarding requires authentication",
    ),
    (
        "real-time",
        "websocket",
        "real-time features typically use websockets",
    ),
    ("chat", "real-time", "chat requires real-time capabilities"),
    ("chat", "authentication", "chat requires authentication"),
    (
        "messaging",
        "authentication",
        "messaging requires authentication",
    ),
    (
        "full-text-search",
        "database",
        "full-text search requires a database",
    ),
    (
        "database-migrations",
        "database",
        "migrations require a database",
    ),
    ("orm", "database", "ORM requires a database"),
    (
        "caching",
        "database",
        "caching typically supplements a database",
    ),
    ("ci-cd", "testing", "CI/CD should include testing"),
];

/// Infer dependency edges from a set of canonical feature names.
pub fn infer_dependencies(features: &[String]) -> Vec<DepEdge> {
    let mut edges = Vec::new();

    for &(from, to, reason) in DEPENDENCY_RULES {
        let has_from = features.iter().any(|f| f == from);
        if has_from {
            edges.push(DepEdge {
                from: from.to_string(),
                to: to.to_string(),
                reason: reason.to_string(),
            });
        }
    }

    // Deduplicate
    edges.sort_by(|a, b| (&a.from, &a.to).cmp(&(&b.from, &b.to)));
    edges.dedup_by(|a, b| a.from == b.from && a.to == b.to);

    edges
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rbac_depends_on_auth() {
        let features = vec!["role-based-access".into(), "authentication".into()];
        let deps = infer_dependencies(&features);
        assert!(deps
            .iter()
            .any(|d| d.from == "role-based-access" && d.to == "authentication"));
    }

    #[test]
    fn test_ecommerce_deps() {
        let features = vec!["e-commerce".into()];
        let deps = infer_dependencies(&features);
        assert!(deps
            .iter()
            .any(|d| d.from == "e-commerce" && d.to == "payments"));
        assert!(deps
            .iter()
            .any(|d| d.from == "e-commerce" && d.to == "authentication"));
    }

    #[test]
    fn test_no_deps_for_simple() {
        let features = vec!["dashboard".into()];
        let deps = infer_dependencies(&features);
        assert!(deps.is_empty());
    }

    #[test]
    fn test_chat_chain() {
        let features = vec!["chat".into()];
        let deps = infer_dependencies(&features);
        assert!(deps.iter().any(|d| d.from == "chat" && d.to == "real-time"));
        assert!(deps
            .iter()
            .any(|d| d.from == "chat" && d.to == "authentication"));
    }
}
