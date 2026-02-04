//! G-Rump Intent Compiler & G-Agent Task Engine
//! Parses natural language intent + optional constraints into structured JSON.
//! Can also generate execution plans for G-Agent.
//!
//! Input: stdin or --input file; optional --constraints JSON.
//! Output: structured intent JSON (or plan JSON with --plan) to stdout.

use clap::{Parser, Subcommand};
use grump_intent::{generate_plan_from_text, parse_and_plan, parse_intent, stream_parser};
use std::io::{self, Read};
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "grump-intent")]
#[command(about = "Parse NL intent into structured JSON or generate G-Agent execution plans")]
#[command(version = "0.2.0")]
struct Args {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Raw natural language input (or read from stdin)
    #[arg(short, long, global = true)]
    input: Option<String>,

    /// Path to input file (alternative to stdin / --input)
    #[arg(long, global = true)]
    input_file: Option<PathBuf>,

    /// Optional constraints as JSON object
    #[arg(short, long, global = true)]
    constraints: Option<String>,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Parse intent only (default behavior)
    Parse,
    /// Streaming parse for partial input (returns partial intent with confidence)
    Stream,
    /// Generate an execution plan for G-Agent
    Plan,
    /// Parse intent and generate plan together
    Full,
}

fn read_input(args: &Args) -> io::Result<String> {
    if let Some(ref s) = args.input {
        return Ok(s.clone());
    }
    if let Some(ref p) = args.input_file {
        return std::fs::read_to_string(p);
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

fn main() -> io::Result<()> {
    let args = Args::parse();
    let raw = read_input(&args)?;
    let raw = raw.trim();
    if raw.is_empty() {
        eprintln!("grump-intent: empty input");
        std::process::exit(1);
    }

    let constraints = parse_constraints(args.constraints.as_deref());

    match args.command.unwrap_or(Commands::Parse) {
        Commands::Parse => {
            let intent = parse_intent(raw, constraints);
            println!("{}", serde_json::to_string_pretty(&intent).unwrap());
            eprintln!(
                "grump-intent: {} features, {} tech, type={}, arch={}, complexity={:.2}",
                intent.enriched_features.len(),
                intent.enriched_tech.len(),
                intent.project_type,
                intent.architecture_pattern,
                intent.complexity_score,
            );
        }
        Commands::Stream => {
            let partial = stream_parser::parse_intent_stream(raw, constraints);
            println!("{}", serde_json::to_string_pretty(&partial).unwrap());
            eprintln!(
                "grump-intent stream: confidence={:.2}, complete={}, {}ms",
                partial.confidence,
                partial.is_complete,
                partial.processing_time_ms,
            );
        }
        Commands::Plan => {
            let plan = generate_plan_from_text(raw, constraints);
            println!("{}", serde_json::to_string_pretty(&plan).unwrap());
            eprintln!(
                "grump-intent plan: {} tasks, {} batches, risk={:?}, est={}s, confidence={:.2}",
                plan.tasks.len(),
                plan.parallel_batches.len(),
                plan.risk.level,
                plan.estimated_duration,
                plan.confidence,
            );
        }
        Commands::Full => {
            let (intent, plan) = parse_and_plan(raw, constraints);
            let output = serde_json::json!({
                "intent": intent,
                "plan": plan
            });
            println!("{}", serde_json::to_string_pretty(&output).unwrap());
            eprintln!(
                "grump-intent full: {} features, {} tasks, risk={:?}, confidence={:.2}",
                intent.enriched_features.len(),
                plan.tasks.len(),
                plan.risk.level,
                plan.confidence,
            );
        }
    }

    Ok(())
}
