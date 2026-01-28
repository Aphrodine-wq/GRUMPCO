//! G-Rump Intent Compiler
//! Parses natural language intent + optional constraints into structured JSON.
//! Input: stdin or --input file; optional --constraints JSON.
//! Output: structured intent JSON to stdout.

use clap::Parser;
use serde::{Deserialize, Serialize};
use std::io::{self, Read};
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "grump-intent")]
#[command(about = "Parse NL intent into structured JSON")]
struct Args {
    /// Raw natural language input (or read from stdin)
    #[arg(short, long)]
    input: Option<String>,

    /// Path to input file (alternative to stdin / --input)
    #[arg(long)]
    input_file: Option<PathBuf>,

    /// Optional constraints as JSON object
    #[arg(short, long)]
    constraints: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct IntentOutput {
    actors: Vec<String>,
    features: Vec<String>,
    data_flows: Vec<String>,
    tech_stack_hints: Vec<String>,
    constraints: serde_json::Value,
    raw: String,
}

fn read_input(args: &Args) -> io::Result<String> {
    if let Some(ref s) = args.input {
        return Ok(s.clone());
    }
    if let Some(ref p) = args.input_file {
        return Ok(std::fs::read_to_string(p)?);
    }
    let mut buf = String::new();
    io::stdin().read_to_string(&mut buf)?;
    Ok(buf)
}

fn parse_constraints(raw: Option<&str>) -> serde_json::Value {
    let Some(s) = raw else {
        return serde_json::json!({});
    };
    serde_json::from_str(s).unwrap_or_else(|_| serde_json::json!({ "raw": s }))
}

/// Extract actors: "user", "admin", "developer", "customer", etc.
pub(crate) fn extract_actors(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let lower = text.to_lowercase();
    let patterns = [
        r"(?:as\s+an?\s+|as\s+a\s+)([a-z][a-z0-9\s\-]+?)(?:\s|,|\.|$)",
        r"(?:user|admin|developer|customer|manager|guest)s?\b",
        r"\b(actor|stakeholder)s?\b",
        r"(?:for\s+)([a-z][a-z0-9\s\-]+?)(?:\s+to\s|\.|$)",
    ];
    for p in patterns {
        if let Ok(re) = regex::Regex::new(p) {
            for cap in re.captures_iter(&lower) {
                let m = cap.get(1).map(|m| m.as_str().trim()).unwrap_or(&cap[0]);
                let clean = m.replace(['.', ','], "").trim().to_string();
                if clean.len() > 1 && !out.contains(&clean) {
                    out.push(clean);
                }
            }
        }
    }
    if out.is_empty() {
        out.push("user".to_string());
    }
    out
}

/// Extract feature-like phrases (build X, support Y, allow Z, etc.)
pub(crate) fn extract_features(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let lower = text.to_lowercase();
    let patterns = [
        r"(?:build|create|support|allow|enable|include|add|have)\s+([a-z0-9\s\-]+?)(?:\s+with\s|\s+that\s|,|\.|$)",
        r"(?:with|featuring)\s+([a-z0-9\s\-]+?)(?:\s+and\s|,|\.|$)",
        r"(?:task\s+management|auth|api|dashboard|e-?commerce|saas|booking)\b",
    ];
    for p in patterns {
        if let Ok(re) = regex::Regex::new(p) {
            for cap in re.captures_iter(&lower) {
                let m = cap.get(1).map(|m| m.as_str().trim()).unwrap_or(&cap[0]);
                let clean = m.replace(['.', ','], "").trim().to_string();
                if clean.len() > 2 && !out.contains(&clean) {
                    out.push(clean);
                }
            }
        }
    }
    out
}

/// Extract data-flow hints (API calls, requests, sync, etc.)
pub(crate) fn extract_data_flows(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let lower = text.to_lowercase();
    let keywords = [
        "api", "rest", "graphql", "websocket", "real-time", "sync", "async",
        "request", "response", "webhook", "queue", "event", "stream",
    ];
    for kw in keywords {
        if lower.contains(kw) && !out.contains(&kw.to_string()) {
            out.push(kw.to_string());
        }
    }
    out
}

/// Extract tech stack hints
pub(crate) fn extract_tech_stack_hints(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let lower = text.to_lowercase();
    let keywords = [
        "vue", "react", "svelte", "node", "express", "python", "fastapi", "go",
        "postgres", "postgresql", "mongodb", "redis", "sqlite",
        "docker", "kubernetes", "aws", "vercel", "netlify",
        "typescript", "javascript",
    ];
    for kw in keywords {
        if lower.contains(kw) && !out.contains(&kw.to_string()) {
            out.push(kw.to_string());
        }
    }
    out
}

fn main() -> io::Result<()> {
    let args = Args::parse();
    let raw = read_input(&args)?;
    let raw = raw.trim();
    if raw.is_empty() {
        eprintln!("grump-intent: empty input");
        std::process::exit(1);
    }

    let constraints = parse_constraints(args.constraints.as_deref());

    let intent = IntentOutput {
        actors: extract_actors(raw),
        features: extract_features(raw),
        data_flows: extract_data_flows(raw),
        tech_stack_hints: extract_tech_stack_hints(raw),
        constraints,
        raw: raw.to_string(),
    };

    println!("{}", serde_json::to_string_pretty(&intent).unwrap());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_actors_default() {
        let out = extract_actors("build a thing");
        assert!(!out.is_empty());
        assert!(out.contains(&"user".to_string()));
    }

    #[test]
    fn test_extract_tech_hints() {
        let out = extract_tech_stack_hints("Build a React app with Node and Postgres");
        assert!(out.iter().any(|s| s.contains("react")));
        assert!(out.iter().any(|s| s.contains("node")));
        assert!(out.iter().any(|s| s.contains("postgres")));
    }

    #[test]
    fn test_extract_data_flows() {
        let out = extract_data_flows("REST API with real-time websocket");
        assert!(out.iter().any(|s| s.contains("api")));
        assert!(out.iter().any(|s| s.contains("real-time") || s.contains("websocket")));
    }

    #[test]
    fn test_intent_output_shape() {
        let raw = "Build a task manager with Vue and Express";
        let intent = IntentOutput {
            actors: extract_actors(raw),
            features: extract_features(raw),
            data_flows: extract_data_flows(raw),
            tech_stack_hints: extract_tech_stack_hints(raw),
            constraints: serde_json::json!({}),
            raw: raw.to_string(),
        };
        assert!(!intent.raw.is_empty());
        assert!(!intent.actors.is_empty());
        let json = serde_json::to_string(&intent).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed.get("actors").is_some());
        assert!(parsed.get("features").is_some());
        assert!(parsed.get("data_flows").is_some());
        assert!(parsed.get("tech_stack_hints").is_some());
        assert!(parsed.get("constraints").is_some());
        assert!(parsed.get("raw").is_some());
    }
}
