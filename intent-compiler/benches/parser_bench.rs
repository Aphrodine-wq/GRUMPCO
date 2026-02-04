//! Criterion benchmarks for G-Rump Intent Compiler
//! 
//! Run benchmarks: cargo bench
//! Generate HTML report: cargo bench -- --save-baseline main

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};

extern crate grump_intent;
extern crate serde_json;

use grump_intent::{extract_actors, extract_features, extract_data_flows, extract_tech_stack_hints, parse_intent, parse_intents_batch};

#[cfg(not(target_arch = "wasm32"))]
use grump_intent::simd_parser::{fast_keyword_scan, fast_lowercase_scan, check_simd_support};

// ============================================================================
// Actor Extraction Benchmarks
// ============================================================================

fn benchmark_extract_actors(c: &mut Criterion) {
    let test_cases = vec![
        ("simple", "Build a todo app for users"),
        ("medium", "As an admin, I want to manage users and customers with role-based access"),
        ("complex", "For developers and managers to collaborate on projects with stakeholders and guests accessing the dashboard"),
    ];

    let mut group = c.benchmark_group("extract_actors");
    for (name, input) in test_cases {
        group.throughput(Throughput::Bytes(input.len() as u64));
        group.bench_with_input(BenchmarkId::from_parameter(name), &input, |b, &text| {
            b.iter(|| extract_actors(black_box(text)));
        });
    }
    group.finish();
}

// ============================================================================
// Feature Extraction Benchmarks
// ============================================================================

fn benchmark_extract_features(c: &mut Criterion) {
    let test_cases = vec![
        ("simple", "Build a task management system"),
        ("medium", "Create an API with authentication and dashboard featuring real-time updates"),
        ("complex", "Build a comprehensive e-commerce platform with task management, auth, API, dashboard, booking system, and support for multiple payment methods"),
    ];

    let mut group = c.benchmark_group("extract_features");
    for (name, input) in test_cases {
        group.throughput(Throughput::Bytes(input.len() as u64));
        group.bench_with_input(BenchmarkId::from_parameter(name), &input, |b, &text| {
            b.iter(|| extract_features(black_box(text)));
        });
    }
    group.finish();
}

// ============================================================================
// Data Flow & Tech Stack Extraction (SIMD-accelerated)
// ============================================================================

fn benchmark_keyword_extraction(c: &mut Criterion) {
    let test_cases = vec![
        ("short", "REST API with GraphQL"),
        ("medium", "Build a REST API with WebSocket support, real-time sync, async processing, and event queues"),
        ("long", "Comprehensive backend with REST API, GraphQL, WebSocket for real-time updates, message queues, event streaming, async processing, sync patterns, request/response handling, and webhook integration"),
    ];

    let mut group = c.benchmark_group("data_flows");
    for (name, input) in test_cases {
        group.throughput(Throughput::Bytes(input.len() as u64));
        group.bench_with_input(BenchmarkId::from_parameter(name), &input, |b, &text| {
            b.iter(|| extract_data_flows(black_box(text)));
        });
    }
    group.finish();

    let mut group = c.benchmark_group("tech_stack");
    for (name, input) in &[
        ("simple", "Build with React and Node"),
        ("medium", "Use React, Node, Express, PostgreSQL, and Redis with Docker"),
        ("complex", "Full stack with React, Vue, Svelte, Node, Express, Python, FastAPI, Go, PostgreSQL, MongoDB, Redis, SQLite, Docker, Kubernetes, AWS, Vercel, TypeScript, JavaScript, Rust, Prisma, Supabase"),
    ] {
        group.throughput(Throughput::Bytes(input.len() as u64));
        group.bench_with_input(BenchmarkId::from_parameter(name), input, |b, &text| {
            b.iter(|| extract_tech_stack_hints(black_box(text)));
        });
    }
    group.finish();
}

// ============================================================================
// SIMD-specific Benchmarks (native only)
// ============================================================================

#[cfg(not(target_arch = "wasm32"))]
fn benchmark_simd_functions(c: &mut Criterion) {
    // Report SIMD support level
    let simd_support = check_simd_support();
    println!("\n[SIMD Support: {}]\n", simd_support);

    let test_text = "Build a comprehensive REST API with GraphQL, WebSocket support for real-time updates, async message queues, event streaming, and webhook integration. Use React, Node, Express, PostgreSQL, Redis, Docker, and Kubernetes.";
    let text_bytes = test_text.as_bytes();

    let keywords = &[
        "api", "rest", "graphql", "websocket", "react", "node", "express",
        "postgresql", "redis", "docker", "kubernetes", "async", "event",
    ];

    let mut group = c.benchmark_group("simd_operations");
    
    // Lowercase conversion
    group.throughput(Throughput::Bytes(text_bytes.len() as u64));
    group.bench_function("fast_lowercase_scan", |b| {
        b.iter(|| fast_lowercase_scan(black_box(text_bytes)));
    });

    // Keyword scanning
    group.bench_function("fast_keyword_scan", |b| {
        b.iter(|| fast_keyword_scan(black_box(text_bytes), black_box(keywords)));
    });

    // Compare with std lowercase
    group.bench_function("std_lowercase", |b| {
        b.iter(|| black_box(test_text).to_lowercase());
    });

    // Compare with std contains
    group.bench_function("std_contains_keywords", |b| {
        b.iter(|| {
            let lower = test_text.to_lowercase();
            keywords.iter().filter(|kw| lower.contains(*kw)).count()
        });
    });

    group.finish();
}

// ============================================================================
// Full Parse Benchmark
// ============================================================================

fn benchmark_full_parse(c: &mut Criterion) {
    let complex_intent = "As an admin and developer, I want to build a comprehensive SaaS platform \
                          with task management, authentication, REST API, real-time dashboard, \
                          e-commerce capabilities, booking system, and support for websocket \
                          connections. The system should use React, Node, Express, and PostgreSQL \
                          with Redis for caching.";

    c.bench_function("parse_intent_full", |b| {
        b.iter(|| {
            parse_intent(black_box(complex_intent), serde_json::json!({}))
        });
    });
}

// ============================================================================
// Batch Processing Benchmark
// ============================================================================

fn benchmark_batch_parsing(c: &mut Criterion) {
    let intents: Vec<&str> = vec![
        "Build a React app with Node backend",
        "Create a Vue dashboard with Express API",
        "Make a Svelte e-commerce site with PostgreSQL",
        "Develop a Python FastAPI with Redis cache",
        "Build a Go microservice with MongoDB",
        "Create a TypeScript API with Prisma ORM",
        "Design a Ruby on Rails application with PostgreSQL",
        "Implement a Rust backend with SQLite",
    ];

    let mut group = c.benchmark_group("batch_parsing");
    
    for batch_size in [1, 4, 8].iter() {
        let batch: Vec<&str> = intents.iter().cycle().take(*batch_size).copied().collect();
        
        group.throughput(Throughput::Elements(*batch_size as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("batch_{}", batch_size)),
            &batch,
            |b, texts| {
                b.iter(|| parse_intents_batch(black_box(texts), serde_json::json!({})));
            },
        );
    }
    
    group.finish();
}

// ============================================================================
// Enrichment Pipeline Benchmarks
// ============================================================================

fn benchmark_enrichment_pipeline(c: &mut Criterion) {
    let test_cases = vec![
        ("simple", "Build a React app with auth"),
        ("medium", "Build an e-commerce platform with authentication, RBAC, dashboard, payments using React, Node, PostgreSQL"),
        ("complex", "As an admin, build a comprehensive SaaS platform with authentication, RBAC, e-commerce, real-time chat, \
                      notifications, dashboard, task management, billing, subscriptions, file upload, search, analytics, \
                      monitoring, logging using React, Node, Express, PostgreSQL, Redis, Docker, Kubernetes, AWS"),
    ];

    let mut group = c.benchmark_group("enrichment_pipeline");
    for (name, input) in test_cases {
        group.throughput(Throughput::Bytes(input.len() as u64));
        group.bench_with_input(BenchmarkId::from_parameter(name), &input, |b, &text| {
            b.iter(|| parse_intent(black_box(text), serde_json::json!({})));
        });
    }
    group.finish();
}

// ============================================================================
// Criterion Groups
// ============================================================================

#[cfg(not(target_arch = "wasm32"))]
criterion_group!(
    benches,
    benchmark_extract_actors,
    benchmark_extract_features,
    benchmark_keyword_extraction,
    benchmark_simd_functions,
    benchmark_full_parse,
    benchmark_batch_parsing,
    benchmark_enrichment_pipeline,
);

#[cfg(target_arch = "wasm32")]
criterion_group!(
    benches,
    benchmark_extract_actors,
    benchmark_extract_features,
    benchmark_keyword_extraction,
    benchmark_full_parse,
    benchmark_batch_parsing,
    benchmark_enrichment_pipeline,
);

criterion_main!(benches);
