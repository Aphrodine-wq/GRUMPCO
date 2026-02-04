use crate::types::VerbAction;
use phf::phf_map;

static VERB_MAP: phf::Map<&'static str, VerbAction> = phf_map! {
    // Build
    "build" => VerbAction::Build,
    "create" => VerbAction::Build,
    "make" => VerbAction::Build,
    "develop" => VerbAction::Build,
    "implement" => VerbAction::Build,
    "add" => VerbAction::Build,
    "design" => VerbAction::Build,
    "set up" => VerbAction::Build,
    "setup" => VerbAction::Build,
    "construct" => VerbAction::Build,
    "generate" => VerbAction::Build,
    "write" => VerbAction::Build,
    "scaffold" => VerbAction::Build,
    // Migrate
    "migrate" => VerbAction::Migrate,
    "convert" => VerbAction::Migrate,
    "port" => VerbAction::Migrate,
    "move" => VerbAction::Migrate,
    "transfer" => VerbAction::Migrate,
    "upgrade" => VerbAction::Migrate,
    "switch" => VerbAction::Migrate,
    "transition" => VerbAction::Migrate,
    // Remove
    "remove" => VerbAction::Remove,
    "delete" => VerbAction::Remove,
    "drop" => VerbAction::Remove,
    "eliminate" => VerbAction::Remove,
    "deprecate" => VerbAction::Remove,
    "strip" => VerbAction::Remove,
    // Integrate
    "integrate" => VerbAction::Integrate,
    "connect" => VerbAction::Integrate,
    "hook" => VerbAction::Integrate,
    "link" => VerbAction::Integrate,
    "plug" => VerbAction::Integrate,
    "sync" => VerbAction::Integrate,
    "wire" => VerbAction::Integrate,
    // Configure
    "configure" => VerbAction::Configure,
    "config" => VerbAction::Configure,
    "customize" => VerbAction::Configure,
    "adjust" => VerbAction::Configure,
    "tune" => VerbAction::Configure,
    "optimize" => VerbAction::Configure,
    "tweak" => VerbAction::Configure,
    // Deploy
    "deploy" => VerbAction::Deploy,
    "ship" => VerbAction::Deploy,
    "release" => VerbAction::Deploy,
    "publish" => VerbAction::Deploy,
    "launch" => VerbAction::Deploy,
    "push" => VerbAction::Deploy,
    "host" => VerbAction::Deploy,
    // Refactor
    "refactor" => VerbAction::Refactor,
    "restructure" => VerbAction::Refactor,
    "reorganize" => VerbAction::Refactor,
    "clean" => VerbAction::Refactor,
    "simplify" => VerbAction::Refactor,
    "modernize" => VerbAction::Refactor,
    // Test
    "test" => VerbAction::Test,
    "verify" => VerbAction::Test,
    "validate" => VerbAction::Test,
    "check" => VerbAction::Test,
    "audit" => VerbAction::Test,
    "benchmark" => VerbAction::Test,
};

/// Classify the dominant verb action from a list of words.
/// Returns the first matched verb action, or Build as default.
pub fn classify_verb_action(words: &[String]) -> VerbAction {
    for word in words {
        if let Some(&action) = VERB_MAP.get(word.as_str()) {
            return action;
        }
    }
    VerbAction::Build
}

/// Classify verb action for a specific feature context.
/// Looks at the verb immediately preceding the feature keyword position.
pub fn classify_verb_at(words: &[String], feature_idx: usize) -> VerbAction {
    // Look backwards from feature_idx for the nearest verb
    for i in (0..feature_idx).rev() {
        if let Some(&action) = VERB_MAP.get(words[i].as_str()) {
            return action;
        }
        // Don't look back more than 3 words
        if feature_idx - i > 3 {
            break;
        }
    }
    classify_verb_action(words)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn words(s: &str) -> Vec<String> {
        s.split_whitespace().map(|w| w.to_lowercase()).collect()
    }

    #[test]
    fn test_build_verbs() {
        assert_eq!(
            classify_verb_action(&words("build an api")),
            VerbAction::Build
        );
        assert_eq!(
            classify_verb_action(&words("create a dashboard")),
            VerbAction::Build
        );
    }

    #[test]
    fn test_migrate_verbs() {
        assert_eq!(
            classify_verb_action(&words("migrate to postgres")),
            VerbAction::Migrate
        );
    }

    #[test]
    fn test_remove_verbs() {
        assert_eq!(
            classify_verb_action(&words("remove the old api")),
            VerbAction::Remove
        );
    }

    #[test]
    fn test_deploy_verbs() {
        assert_eq!(
            classify_verb_action(&words("deploy to aws")),
            VerbAction::Deploy
        );
    }

    #[test]
    fn test_default_is_build() {
        assert_eq!(
            classify_verb_action(&words("something unknown")),
            VerbAction::Build
        );
    }

    #[test]
    fn test_classify_at_position() {
        let w = words("build auth and migrate the database");
        assert_eq!(classify_verb_at(&w, 1), VerbAction::Build); // auth near build
        assert_eq!(classify_verb_at(&w, 5), VerbAction::Migrate); // database near migrate
    }
}
