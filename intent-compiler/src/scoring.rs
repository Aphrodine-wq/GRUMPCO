use crate::types::{ConfidenceReport, DepEdge, FeatureEntry, TechHint};

/// Compute complexity score (0.0 - 1.0) based on feature count, tech count, and dependencies.
pub fn compute_complexity(features: &[FeatureEntry], tech: &[TechHint], deps: &[DepEdge]) -> f32 {
    // Feature weight: each feature adds 0.08, capped contribution at 0.4
    let feature_score = (features.len() as f32 * 0.08).min(0.4);

    // Tech weight: each tech adds 0.05, capped at 0.3
    let tech_score = (tech.len() as f32 * 0.05).min(0.3);

    // Dependency weight: each dep edge adds 0.04, capped at 0.2
    let dep_score = (deps.len() as f32 * 0.04).min(0.2);

    // Base complexity 0.1 for any non-empty input
    let base = if !features.is_empty() || !tech.is_empty() {
        0.1
    } else {
        0.0
    };

    (base + feature_score + tech_score + dep_score).min(1.0)
}

/// Assign priority (1-5) to features based on position and dependency importance.
/// Earlier features get higher priority. Features that are depended upon get a boost.
pub fn assign_priorities(features: &mut [FeatureEntry], deps: &[DepEdge]) {
    let total = features.len();
    if total == 0 {
        return;
    }

    // Count how many features depend on each feature
    let dep_targets: Vec<String> = deps.iter().map(|d| d.to.clone()).collect();

    for (i, feature) in features.iter_mut().enumerate() {
        // Base priority from position (earlier = higher priority)
        let position_score = 1.0 - (i as f32 / total as f32);

        // Dependency boost: if many features depend on this one, boost priority
        let dep_count = dep_targets.iter().filter(|t| **t == feature.name).count();
        let dep_boost = (dep_count as f32 * 0.2).min(0.4);

        let raw = position_score + dep_boost;

        // Map to 1-5 scale
        feature.priority = match raw {
            r if r >= 0.9 => 1,
            r if r >= 0.7 => 2,
            r if r >= 0.5 => 3,
            r if r >= 0.3 => 4,
            _ => 5,
        };
    }
}

/// Compute confidence report.
pub fn compute_confidence(
    actors: &[String],
    features: &[FeatureEntry],
    tech: &[TechHint],
    sentence_count: usize,
) -> ConfidenceReport {
    // Actor confidence: higher if explicit actors found (not just default "user")
    let actors_conf = if actors.len() > 1 || (actors.len() == 1 && actors[0] != "user") {
        0.9
    } else {
        0.3
    };

    // Feature confidence: based on how many features had lexicon matches
    let matched_features = features.iter().filter(|f| f.confidence > 0.5).count();
    let features_conf = if features.is_empty() {
        0.1
    } else {
        (matched_features as f32 / features.len() as f32).max(0.2)
    };

    // Tech confidence: lexicon matches are high confidence
    let tech_conf = if tech.is_empty() {
        0.1
    } else {
        let avg: f32 = tech.iter().map(|t| t.confidence).sum::<f32>() / tech.len() as f32;
        avg
    };

    // Overall: weighted average
    let overall = (actors_conf * 0.2
        + features_conf * 0.4
        + tech_conf * 0.3
        + (sentence_count as f32 * 0.05).min(0.1))
    .min(1.0);

    ConfidenceReport {
        overall,
        actors: actors_conf,
        features: features_conf,
        tech_stack: tech_conf,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{TechCategory, VerbAction};

    fn feature(name: &str) -> FeatureEntry {
        FeatureEntry {
            name: name.into(),
            action: VerbAction::Build,
            negated: false,
            priority: 5,
            confidence: 0.8,
        }
    }

    fn tech(name: &str) -> TechHint {
        TechHint {
            canonical: name.into(),
            matched_as: name.into(),
            category: TechCategory::Backend,
            negated: false,
            confidence: 0.9,
        }
    }

    #[test]
    fn test_complexity_empty() {
        assert_eq!(compute_complexity(&[], &[], &[]), 0.0);
    }

    #[test]
    fn test_complexity_increases_with_features() {
        let f1 = vec![feature("auth")];
        let f5 = vec![
            feature("a"),
            feature("b"),
            feature("c"),
            feature("d"),
            feature("e"),
        ];
        let c1 = compute_complexity(&f1, &[], &[]);
        let c5 = compute_complexity(&f5, &[], &[]);
        assert!(c5 > c1);
    }

    #[test]
    fn test_complexity_high_for_complex_input() {
        let feats: Vec<_> = (0..8).map(|i| feature(&format!("f{}", i))).collect();
        let techs: Vec<_> = (0..5).map(|i| tech(&format!("t{}", i))).collect();
        let deps = vec![
            DepEdge {
                from: "a".into(),
                to: "b".into(),
                reason: "r".into(),
            },
            DepEdge {
                from: "c".into(),
                to: "d".into(),
                reason: "r".into(),
            },
        ];
        let c = compute_complexity(&feats, &techs, &deps);
        assert!(c > 0.7);
    }

    #[test]
    fn test_priority_assignment() {
        let deps = vec![
            DepEdge {
                from: "rbac".into(),
                to: "auth".into(),
                reason: "r".into(),
            },
            DepEdge {
                from: "admin".into(),
                to: "auth".into(),
                reason: "r".into(),
            },
        ];
        let mut feats = vec![
            feature("auth"),
            feature("rbac"),
            feature("admin"),
            feature("dashboard"),
        ];
        assign_priorities(&mut feats, &deps);
        // auth should get boosted priority (depended upon twice)
        assert!(feats[0].priority <= 2);
    }

    #[test]
    fn test_confidence_default_user() {
        let conf = compute_confidence(&["user".into()], &[], &[], 1);
        assert!(conf.actors < 0.5);
    }

    #[test]
    fn test_confidence_explicit_actors() {
        let conf = compute_confidence(
            &["admin".into(), "developer".into()],
            &[feature("auth")],
            &[tech("express")],
            2,
        );
        assert!(conf.overall > 0.5);
        assert!(conf.actors > 0.8);
    }
}
