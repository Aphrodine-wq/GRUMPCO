# NeMo Curator Synthetic Data – G-Rump

Generate synthetic Q&A data using NVIDIA Nemotron over NIM for RAG indexing and fine-tuning. Aligns with NVIDIA Golden Developer Award data curation requirement.

## Overview

This pipeline uses NVIDIA NIM (OpenAI-compatible API) with Nemotron to generate synthetic question-answer pairs. Output is JSONL suitable for:

- RAG index ingestion (via `backend/scripts/rag-index.ts` or custom ingestion)
- NeMo Framework fine-tuning datasets
- Evaluation and comprehension datasets

## Prerequisites

- Python 3.10+
- `NVIDIA_NIM_API_KEY` (get at https://build.nvidia.com)

## Installation

```bash
cd services/nemo-curator
pip install -r requirements.txt
```

## Usage

```bash
export NVIDIA_NIM_API_KEY=your_key
python generate_synthetic.py
```

Options:

- `--config config.yaml` – Config path (default: config.yaml)
- `--output data/synthetic_qa.jsonl` – Output path (overrides config)

## Configuration

Edit `config.yaml`:

- `nim.base_url` – NIM API base (default: https://integrate.api.nvidia.com/v1)
- `nim.model` – Model ID (e.g. Nemotron Super 49B)
- `generation.topics` – Topics for Q&A generation
- `generation.samples_per_topic` – Samples per topic
- `generation.temperature` / `generation.top_p` – Sampling controls
- `generation.min_question_chars` / `generation.min_answer_chars` – Quality filters
- `generation.max_answer_chars` – Answer length cap
- `generation.max_retries` / `generation.retry_backoff_ms` – Resilience controls

## Integration with G-Rump

1. **RAG indexing**: Convert JSONL to documents and run `npm run rag:index` from backend
2. **NeMo training**: Use output as SFT dataset in `services/nemo-training/`

## NeMo Curator Reference

- [NeMo Curator Synthetic Data](https://docs.nvidia.com/nemo-framework/user-guide/latest/datacuration/syntheticdata.html)
- [NeMo Curator](https://github.com/NVIDIA/NeMo-Curator)
