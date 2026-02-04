#!/usr/bin/env python3
"""
NeMo Curator synthetic data generation for G-Rump.
Uses NVIDIA NIM (OpenAI-compatible API) with Nemotron for Q&A generation.
Output: JSONL suitable for RAG indexing or fine-tuning.

Usage:
  export NVIDIA_NIM_API_KEY=your_key
  python generate_synthetic.py [--config config.yaml] [--output data/synthetic_qa.jsonl]
"""

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Install openai: pip install openai", file=sys.stderr)
    sys.exit(1)

try:
    import yaml
except ImportError:
    print("Install pyyaml: pip install pyyaml", file=sys.stderr)
    sys.exit(1)


def load_config(path: str) -> dict:
    with open(path, "r") as f:
        return yaml.safe_load(f)


def normalize_text(text: str) -> str:
    return " ".join(text.strip().lower().split())


def is_valid_pair(
    question: str,
    answer: str,
    min_q: int,
    min_a: int,
    max_a: int,
) -> bool:
    if not question or not answer:
        return False
    if len(question) < min_q:
        return False
    if len(answer) < min_a:
        return False
    if max_a > 0 and len(answer) > max_a:
        return False
    return True


def generate_qa_pairs(
    client: OpenAI,
    model: str,
    topics: list[str],
    samples_per_topic: int,
    max_tokens: int,
    temperature: float,
    top_p: float,
    min_question_chars: int,
    min_answer_chars: int,
    max_answer_chars: int,
    max_retries: int,
    retry_backoff_ms: int,
) -> list[dict]:
    """Generate Q&A pairs using NIM (Nemotron) via OpenAI-compatible client."""
    results: list[dict] = []
    seen_questions: set[str] = set()

    for topic in topics:
        for _ in range(samples_per_topic):
            prompt = f"""Generate one concise question and answer pair about "{topic}".
Format as JSON: {{"question": "...", "answer": "..."}}
Keep the question focused and the answer factual (2-4 sentences)."""

            found = False
            for attempt in range(1, max_retries + 1):
                try:
                    resp = client.chat.completions.create(
                        model=model,
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=max_tokens,
                        temperature=temperature,
                        top_p=top_p,
                    )
                    text = resp.choices[0].message.content or ""
                    # Try to parse JSON from response
                    for line in text.strip().split("\n"):
                        line = line.strip()
                        if line.startswith("{"):
                            obj = json.loads(line)
                            question = str(obj.get("question", "")).strip()
                            answer = str(obj.get("answer", "")).strip()
                            if not is_valid_pair(question, answer, min_question_chars, min_answer_chars, max_answer_chars):
                                continue
                            normalized = normalize_text(question)
                            if normalized in seen_questions:
                                continue
                            seen_questions.add(normalized)
                            obj["question"] = question
                            obj["answer"] = answer
                            obj["topic"] = topic
                            results.append(obj)
                            found = True
                            break
                    if found:
                        break
                except Exception as e:
                    if attempt >= max_retries:
                        print(f"Warning: {e}", file=sys.stderr)
                        break
                    sleep_ms = retry_backoff_ms * attempt + random.randint(0, 250)
                    time.sleep(sleep_ms / 1000)
                    continue
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="NeMo Curator synthetic data for G-Rump")
    parser.add_argument("--config", default="config.yaml", help="Config YAML path")
    parser.add_argument("--output", help="Output JSONL path (overrides config)")
    args = parser.parse_args()

    config_path = Path(__file__).parent / args.config
    if not config_path.exists():
        print(f"Config not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    cfg = load_config(str(config_path))
    nim_cfg = cfg.get("nim", {})
    out_cfg = cfg.get("output", {})
    gen_cfg = cfg.get("generation", {})

    api_key = os.environ.get(
        nim_cfg.get("api_key_env", "NVIDIA_NIM_API_KEY"),
        os.environ.get("NVIDIA_NIM_API_KEY"),
    )
    if not api_key:
        print("Set NVIDIA_NIM_API_KEY (get key at https://build.nvidia.com)", file=sys.stderr)
        sys.exit(1)

    base_url = nim_cfg.get("base_url", "https://integrate.api.nvidia.com/v1")
    model = nim_cfg.get("model", "nvidia/llama-3.3-nemotron-super-49b-v1.5")
    topics = gen_cfg.get("topics", ["software architecture", "code generation"])
    samples = gen_cfg.get("samples_per_topic", 3)
    max_tokens = gen_cfg.get("max_tokens", 512)
    temperature = gen_cfg.get("temperature", 0.7)
    top_p = gen_cfg.get("top_p", 0.95)
    min_question_chars = gen_cfg.get("min_question_chars", 12)
    min_answer_chars = gen_cfg.get("min_answer_chars", 40)
    max_answer_chars = gen_cfg.get("max_answer_chars", 800)
    max_retries = gen_cfg.get("max_retries", 3)
    retry_backoff_ms = gen_cfg.get("retry_backoff_ms", 500)

    client = OpenAI(base_url=base_url, api_key=api_key)

    print("Generating synthetic Q&A via NVIDIA NIM (Nemotron)...")
    pairs = generate_qa_pairs(
        client,
        model,
        topics,
        samples,
        max_tokens,
        temperature,
        top_p,
        min_question_chars,
        min_answer_chars,
        max_answer_chars,
        max_retries,
        retry_backoff_ms,
    )

    out_path = args.output or out_cfg.get("path", "data/synthetic_qa.jsonl")
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w") as f:
        for item in pairs:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"Wrote {len(pairs)} Q&A pairs to {out_path}")


if __name__ == "__main__":
    main()
