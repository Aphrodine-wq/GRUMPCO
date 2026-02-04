use crate::types::TechCategory;
use phf::phf_map;

// ============================================================================
// Tech Synonym Map: alias → (canonical, category)
// ============================================================================

pub static TECH_SYNONYMS: phf::Map<&'static str, (&'static str, TechCategory)> = phf_map! {
    // Databases
    "pg" => ("postgresql", TechCategory::Database),
    "postgres" => ("postgresql", TechCategory::Database),
    "postgresql" => ("postgresql", TechCategory::Database),
    "mongo" => ("mongodb", TechCategory::Database),
    "mongodb" => ("mongodb", TechCategory::Database),
    "mysql" => ("mysql", TechCategory::Database),
    "mariadb" => ("mariadb", TechCategory::Database),
    "sqlite" => ("sqlite", TechCategory::Database),
    "sqlite3" => ("sqlite", TechCategory::Database),
    "redis" => ("redis", TechCategory::Database),
    "memcached" => ("memcached", TechCategory::Database),
    "dynamodb" => ("dynamodb", TechCategory::Database),
    "dynamo" => ("dynamodb", TechCategory::Database),
    "cassandra" => ("cassandra", TechCategory::Database),
    "couchdb" => ("couchdb", TechCategory::Database),
    "neo4j" => ("neo4j", TechCategory::Database),
    "elasticsearch" => ("elasticsearch", TechCategory::Database),
    "elastic" => ("elasticsearch", TechCategory::Database),
    "supabase" => ("supabase", TechCategory::Database),
    "firebase" => ("firebase", TechCategory::Database),
    "firestore" => ("firebase", TechCategory::Database),
    "cockroachdb" => ("cockroachdb", TechCategory::Database),
    "planetscale" => ("planetscale", TechCategory::Database),
    "neon" => ("neon", TechCategory::Database),
    "turso" => ("turso", TechCategory::Database),
    // Frontend frameworks
    "react" => ("react", TechCategory::Frontend),
    "reactjs" => ("react", TechCategory::Frontend),
    "react.js" => ("react", TechCategory::Frontend),
    "vue" => ("vue", TechCategory::Frontend),
    "vuejs" => ("vue", TechCategory::Frontend),
    "vue.js" => ("vue", TechCategory::Frontend),
    "svelte" => ("svelte", TechCategory::Frontend),
    "sveltekit" => ("sveltekit", TechCategory::Frontend),
    "angular" => ("angular", TechCategory::Frontend),
    "angularjs" => ("angular", TechCategory::Frontend),
    "nextjs" => ("nextjs", TechCategory::Frontend),
    "next.js" => ("nextjs", TechCategory::Frontend),
    "next" => ("nextjs", TechCategory::Frontend),
    "nuxt" => ("nuxt", TechCategory::Frontend),
    "nuxtjs" => ("nuxt", TechCategory::Frontend),
    "nuxt.js" => ("nuxt", TechCategory::Frontend),
    "gatsby" => ("gatsby", TechCategory::Frontend),
    "remix" => ("remix", TechCategory::Frontend),
    "solid" => ("solidjs", TechCategory::Frontend),
    "solidjs" => ("solidjs", TechCategory::Frontend),
    "preact" => ("preact", TechCategory::Frontend),
    "astro" => ("astro", TechCategory::Frontend),
    "htmx" => ("htmx", TechCategory::Frontend),
    "tailwind" => ("tailwindcss", TechCategory::Frontend),
    "tailwindcss" => ("tailwindcss", TechCategory::Frontend),
    "bootstrap" => ("bootstrap", TechCategory::Frontend),
    "material-ui" => ("material-ui", TechCategory::Frontend),
    "mui" => ("material-ui", TechCategory::Frontend),
    "chakra" => ("chakra-ui", TechCategory::Frontend),
    // Backend frameworks
    "express" => ("express", TechCategory::Backend),
    "expressjs" => ("express", TechCategory::Backend),
    "express.js" => ("express", TechCategory::Backend),
    "fastify" => ("fastify", TechCategory::Backend),
    "koa" => ("koa", TechCategory::Backend),
    "hapi" => ("hapi", TechCategory::Backend),
    "nestjs" => ("nestjs", TechCategory::Backend),
    "nest" => ("nestjs", TechCategory::Backend),
    "django" => ("django", TechCategory::Backend),
    "flask" => ("flask", TechCategory::Backend),
    "fastapi" => ("fastapi", TechCategory::Backend),
    "rails" => ("rails", TechCategory::Backend),
    "spring" => ("spring", TechCategory::Backend),
    "springboot" => ("spring-boot", TechCategory::Backend),
    "spring-boot" => ("spring-boot", TechCategory::Backend),
    "laravel" => ("laravel", TechCategory::Backend),
    "phoenix" => ("phoenix", TechCategory::Backend),
    "gin" => ("gin", TechCategory::Backend),
    "fiber" => ("fiber", TechCategory::Backend),
    "actix" => ("actix", TechCategory::Backend),
    "axum" => ("axum", TechCategory::Backend),
    "rocket" => ("rocket", TechCategory::Backend),
    "prisma" => ("prisma", TechCategory::Tool),
    "drizzle" => ("drizzle", TechCategory::Tool),
    // Languages
    "javascript" => ("javascript", TechCategory::Language),
    "js" => ("javascript", TechCategory::Language),
    "typescript" => ("typescript", TechCategory::Language),
    "ts" => ("typescript", TechCategory::Language),
    "python" => ("python", TechCategory::Language),
    "py" => ("python", TechCategory::Language),
    "rust" => ("rust", TechCategory::Language),
    "go" => ("go", TechCategory::Language),
    "golang" => ("go", TechCategory::Language),
    "java" => ("java", TechCategory::Language),
    "kotlin" => ("kotlin", TechCategory::Language),
    "ruby" => ("ruby", TechCategory::Language),
    "php" => ("php", TechCategory::Language),
    "swift" => ("swift", TechCategory::Language),
    "csharp" => ("csharp", TechCategory::Language),
    "c#" => ("csharp", TechCategory::Language),
    "elixir" => ("elixir", TechCategory::Language),
    "scala" => ("scala", TechCategory::Language),
    "dart" => ("dart", TechCategory::Language),
    // DevOps / Cloud
    "docker" => ("docker", TechCategory::DevOps),
    "k8s" => ("kubernetes", TechCategory::DevOps),
    "kubernetes" => ("kubernetes", TechCategory::DevOps),
    "kube" => ("kubernetes", TechCategory::DevOps),
    "terraform" => ("terraform", TechCategory::DevOps),
    "ansible" => ("ansible", TechCategory::DevOps),
    "jenkins" => ("jenkins", TechCategory::DevOps),
    "github-actions" => ("github-actions", TechCategory::DevOps),
    "ci/cd" => ("ci-cd", TechCategory::DevOps),
    "cicd" => ("ci-cd", TechCategory::DevOps),
    "nginx" => ("nginx", TechCategory::DevOps),
    "caddy" => ("caddy", TechCategory::DevOps),
    // Cloud providers
    "aws" => ("aws", TechCategory::Cloud),
    "gcp" => ("gcp", TechCategory::Cloud),
    "azure" => ("azure", TechCategory::Cloud),
    "vercel" => ("vercel", TechCategory::Cloud),
    "netlify" => ("netlify", TechCategory::Cloud),
    "heroku" => ("heroku", TechCategory::Cloud),
    "fly" => ("fly.io", TechCategory::Cloud),
    "fly.io" => ("fly.io", TechCategory::Cloud),
    "railway" => ("railway", TechCategory::Cloud),
    "cloudflare" => ("cloudflare", TechCategory::Cloud),
    "digitalocean" => ("digitalocean", TechCategory::Cloud),
    // Runtime
    "node" => ("nodejs", TechCategory::Backend),
    "nodejs" => ("nodejs", TechCategory::Backend),
    "node.js" => ("nodejs", TechCategory::Backend),
    "deno" => ("deno", TechCategory::Backend),
    "bun" => ("bun", TechCategory::Backend),
    // Tools
    "graphql" => ("graphql", TechCategory::Tool),
    "grpc" => ("grpc", TechCategory::Tool),
    "trpc" => ("trpc", TechCategory::Tool),
    "webpack" => ("webpack", TechCategory::Tool),
    "vite" => ("vite", TechCategory::Tool),
    "esbuild" => ("esbuild", TechCategory::Tool),
    "turbopack" => ("turbopack", TechCategory::Tool),
    "storybook" => ("storybook", TechCategory::Tool),
    "jest" => ("jest", TechCategory::Tool),
    "vitest" => ("vitest", TechCategory::Tool),
    "playwright" => ("playwright", TechCategory::Tool),
    "cypress" => ("cypress", TechCategory::Tool),
    "stripe" => ("stripe", TechCategory::Tool),
    "auth0" => ("auth0", TechCategory::Tool),
    "clerk" => ("clerk", TechCategory::Tool),
    "oauth" => ("oauth", TechCategory::Tool),
    "jwt" => ("jwt", TechCategory::Tool),
    "s3" => ("aws-s3", TechCategory::Cloud),
    "lambda" => ("aws-lambda", TechCategory::Cloud),
    "sqs" => ("aws-sqs", TechCategory::Cloud),
    "sns" => ("aws-sns", TechCategory::Cloud),
    "kafka" => ("kafka", TechCategory::Tool),
    "rabbitmq" => ("rabbitmq", TechCategory::Tool),
    "celery" => ("celery", TechCategory::Tool),
    "socket.io" => ("socket.io", TechCategory::Tool),
    "websocket" => ("websocket", TechCategory::Tool),
    "websockets" => ("websocket", TechCategory::Tool),
};

// ============================================================================
// Feature Synonym Map: phrase → canonical feature name
// ============================================================================

pub static FEATURE_SYNONYMS: phf::Map<&'static str, &'static str> = phf_map! {
    // Authentication
    "auth" => "authentication",
    "authentication" => "authentication",
    "login" => "authentication",
    "signin" => "authentication",
    "sign-in" => "authentication",
    "signup" => "registration",
    "sign-up" => "registration",
    "register" => "registration",
    "registration" => "registration",
    "sso" => "single-sign-on",
    "single sign on" => "single-sign-on",
    "oauth" => "oauth-authentication",
    "2fa" => "two-factor-auth",
    "two factor" => "two-factor-auth",
    "mfa" => "multi-factor-auth",
    "password reset" => "password-reset",
    "forgot password" => "password-reset",
    // Authorization
    "rbac" => "role-based-access",
    "role based" => "role-based-access",
    "permissions" => "authorization",
    "authorization" => "authorization",
    "access control" => "access-control",
    "acl" => "access-control",
    // Data / CRUD
    "crud" => "crud-operations",
    "database" => "database",
    "db" => "database",
    "data model" => "data-modeling",
    "schema" => "data-modeling",
    "migration" => "database-migrations",
    "orm" => "orm",
    // API
    "api" => "api",
    "rest" => "rest-api",
    "rest api" => "rest-api",
    "restful" => "rest-api",
    "graphql" => "graphql-api",
    "grpc" => "grpc-api",
    "webhook" => "webhooks",
    "webhooks" => "webhooks",
    "rate limit" => "rate-limiting",
    "rate limiting" => "rate-limiting",
    "throttle" => "rate-limiting",
    // UI
    "dashboard" => "dashboard",
    "admin panel" => "admin-panel",
    "admin" => "admin-panel",
    "landing page" => "landing-page",
    "responsive" => "responsive-design",
    "dark mode" => "dark-mode",
    "theme" => "theming",
    "i18n" => "internationalization",
    "internationalization" => "internationalization",
    "localization" => "internationalization",
    "l10n" => "internationalization",
    // Real-time
    "real-time" => "real-time",
    "realtime" => "real-time",
    "real time" => "real-time",
    "live update" => "real-time",
    "live updates" => "real-time",
    "chat" => "chat",
    "messaging" => "messaging",
    "notifications" => "notifications",
    "push notifications" => "push-notifications",
    // Commerce
    "e-commerce" => "e-commerce",
    "ecommerce" => "e-commerce",
    "shopping cart" => "shopping-cart",
    "cart" => "shopping-cart",
    "checkout" => "checkout",
    "payment" => "payments",
    "payments" => "payments",
    "billing" => "billing",
    "subscription" => "subscriptions",
    "subscriptions" => "subscriptions",
    "pricing" => "pricing",
    // Content
    "cms" => "content-management",
    "blog" => "blog",
    "search" => "search",
    "full text search" => "full-text-search",
    "file upload" => "file-upload",
    "upload" => "file-upload",
    "image upload" => "image-upload",
    "media" => "media-management",
    // DevOps features
    "ci/cd" => "ci-cd",
    "cicd" => "ci-cd",
    "deployment" => "deployment",
    "monitoring" => "monitoring",
    "logging" => "logging",
    "analytics" => "analytics",
    "metrics" => "metrics",
    "caching" => "caching",
    "cache" => "caching",
    "queue" => "message-queue",
    "message queue" => "message-queue",
    "job queue" => "job-queue",
    "background jobs" => "background-jobs",
    "cron" => "scheduled-tasks",
    "scheduler" => "scheduled-tasks",
    // Testing
    "testing" => "testing",
    "unit test" => "unit-testing",
    "unit tests" => "unit-testing",
    "e2e" => "e2e-testing",
    "end to end" => "e2e-testing",
    // Security
    "encryption" => "encryption",
    "ssl" => "ssl-tls",
    "tls" => "ssl-tls",
    "https" => "ssl-tls",
    "cors" => "cors",
    "csrf" => "csrf-protection",
    "xss" => "xss-protection",
    "audit log" => "audit-logging",
    // Misc
    "email" => "email",
    "smtp" => "email",
    "pdf" => "pdf-generation",
    "export" => "data-export",
    "import" => "data-import",
    "csv" => "csv-support",
    "multi-tenant" => "multi-tenancy",
    "multitenancy" => "multi-tenancy",
    "multi tenant" => "multi-tenancy",
    "saas" => "saas",
    "booking" => "booking-system",
    "task management" => "task-management",
    "project management" => "project-management",
    "kanban" => "kanban-board",
    "calendar" => "calendar",
    "map" => "maps-integration",
    "geolocation" => "geolocation",
    "social login" => "social-login",
    "profile" => "user-profiles",
    "user profile" => "user-profiles",
    "settings" => "settings-panel",
    "onboarding" => "onboarding",
    "wizard" => "setup-wizard",
};

// ============================================================================
// Bi-gram phrase map: two-word phrases → canonical feature
// ============================================================================

pub static PHRASE_MAP: phf::Map<&'static str, &'static str> = phf_map! {
    "log in" => "authentication",
    "sign in" => "authentication",
    "sign up" => "registration",
    "log out" => "logout",
    "sign out" => "logout",
    "role based" => "role-based-access",
    "access control" => "access-control",
    "rate limit" => "rate-limiting",
    "rate limiting" => "rate-limiting",
    "real time" => "real-time",
    "live update" => "real-time",
    "live updates" => "real-time",
    "push notification" => "push-notifications",
    "push notifications" => "push-notifications",
    "shopping cart" => "shopping-cart",
    "admin panel" => "admin-panel",
    "admin dashboard" => "admin-panel",
    "landing page" => "landing-page",
    "dark mode" => "dark-mode",
    "file upload" => "file-upload",
    "image upload" => "image-upload",
    "full text" => "full-text-search",
    "text search" => "full-text-search",
    "message queue" => "message-queue",
    "job queue" => "job-queue",
    "background job" => "background-jobs",
    "background jobs" => "background-jobs",
    "unit test" => "unit-testing",
    "unit tests" => "unit-testing",
    "end to" => "e2e-testing",
    "audit log" => "audit-logging",
    "audit logs" => "audit-logging",
    "data model" => "data-modeling",
    "rest api" => "rest-api",
    "password reset" => "password-reset",
    "forgot password" => "password-reset",
    "single sign" => "single-sign-on",
    "two factor" => "two-factor-auth",
    "multi tenant" => "multi-tenancy",
    "task management" => "task-management",
    "project management" => "project-management",
    "user profile" => "user-profiles",
    "user profiles" => "user-profiles",
    "social login" => "social-login",
};

/// Look up a word or phrase in the tech synonyms map.
pub fn resolve_tech(token: &str) -> Option<(&'static str, TechCategory)> {
    TECH_SYNONYMS.get(token).copied()
}

/// Look up a word or phrase in the feature synonyms map.
pub fn resolve_feature(token: &str) -> Option<&'static str> {
    FEATURE_SYNONYMS.get(token).copied()
}

/// Look up a bi-gram phrase in the phrase map.
pub fn resolve_phrase(bigram: &str) -> Option<&'static str> {
    PHRASE_MAP.get(bigram).copied()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tech_synonym_pg() {
        let (canonical, _cat) = resolve_tech("pg").unwrap();
        assert_eq!(canonical, "postgresql");
    }

    #[test]
    fn test_tech_synonym_k8s() {
        let (canonical, cat) = resolve_tech("k8s").unwrap();
        assert_eq!(canonical, "kubernetes");
        assert!(matches!(cat, TechCategory::DevOps));
    }

    #[test]
    fn test_feature_synonym() {
        assert_eq!(resolve_feature("auth"), Some("authentication"));
        assert_eq!(resolve_feature("rbac"), Some("role-based-access"));
        assert_eq!(resolve_feature("ecommerce"), Some("e-commerce"));
    }

    #[test]
    fn test_phrase_map() {
        assert_eq!(resolve_phrase("log in"), Some("authentication"));
        assert_eq!(resolve_phrase("shopping cart"), Some("shopping-cart"));
    }

    #[test]
    fn test_unknown_returns_none() {
        assert!(resolve_tech("foobarxyz").is_none());
        assert!(resolve_feature("foobarxyz").is_none());
    }
}
