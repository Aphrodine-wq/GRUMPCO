//! Keyword constants for SIMD scanning and pattern matching

/// Keywords for detecting data flow patterns in text
pub const DATA_FLOW_KEYWORDS: &[&str] = &[
    "api",
    "rest",
    "graphql",
    "websocket",
    "real-time",
    "sync",
    "async",
    "request",
    "response",
    "webhook",
    "queue",
    "event",
    "stream",
];

/// Keywords for detecting technology stack mentions
pub const TECH_STACK_KEYWORDS: &[&str] = &[
    "vue",
    "react",
    "svelte",
    "node",
    "express",
    "python",
    "fastapi",
    "go",
    "postgres",
    "postgresql",
    "mongodb",
    "redis",
    "sqlite",
    "docker",
    "kubernetes",
    "aws",
    "vercel",
    "netlify",
    "typescript",
    "javascript",
    "rust",
    "java",
    "ruby",
    "rails",
    "nextjs",
    "nuxt",
    "angular",
    "tailwind",
    "prisma",
    "supabase",
];

/// Keywords for detecting project management features
pub const PROJECT_MANAGEMENT_KEYWORDS: &[&str] = &[
    "task",
    "project",
    "milestone",
    "deadline",
    "timeline",
    "sprint",
    "backlog",
    "kanban",
    "scrum",
    "agile",
];

/// Keywords for detecting authentication patterns
pub const AUTH_KEYWORDS: &[&str] = &[
    "auth",
    "authentication",
    "authorization",
    "login",
    "logout",
    "oauth",
    "jwt",
    "session",
    "password",
    "sso",
    "mfa",
    "2fa",
];

/// Keywords for detecting UI/UX patterns
pub const UI_UX_KEYWORDS: &[&str] = &[
    "ui",
    "ux",
    "interface",
    "design",
    "responsive",
    "mobile",
    "desktop",
    "layout",
    "component",
    "theme",
    "style",
];
