//! G-Rump Intent Compiler
//! Parses natural language intent + optional constraints into structured JSON.
//! Input: stdin or --input file; optional --constraints JSON.
//! Output: structured intent JSON to stdout.

use clap::Parser;
use std::io::{self, Read};
use std::path::PathBuf;
use grump_intent::{parse_intent, IntentOutput};

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

fn main() -> io::Result<()> {
    let args = Args::parse();
    let raw = read_input(&args)?;
    let raw = raw.trim();
    if raw.is_empty() {
        eprintln!("grump-intent: empty input");
        std::process::exit(1);
    }

    let constraints = parse_constraints(args.constraints.as_deref());
    let intent = parse_intent(raw, constraints);

    println!("{}", serde_json::to_string_pretty(&intent).unwrap());
    Ok(())
}
