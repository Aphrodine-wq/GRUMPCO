# NVIDIA Observability – G-Rump

G-Rump emits NVIDIA NIM-aligned observability metrics and OpenTelemetry traces for MLOps monitoring, supporting integration with Prometheus, Grafana, Datadog, Zipkin, and Jaeger.

## Overview

| Component | Implementation |
|-----------|----------------|
| Metrics | Prometheus at `/metrics` |
| Tracing | OpenTelemetry OTLP (HTTP) |
| NIM Alignment | TTFB, tokens/sec, model labels |

## NVIDIA NIM-Aligned Metrics

G-Rump exposes metrics that align with [NVIDIA NIM Observability](https://docs.nvidia.com/nim/large-language-models/latest/observability.html):

| Metric | Type | Description |
|--------|------|-------------|
| `llm_time_to_first_token_seconds` | Histogram | Time from request start to first token received |
| `llm_tokens_per_second` | Histogram | Output tokens per second during generation |
| `llm_stream_duration_seconds` | Histogram | End-to-end stream duration |
| `llm_tokens_total` | Counter | Input/output tokens by provider and model |

All LLM metrics use `provider` and `model` labels (e.g. `provider="nvidia-nim"`, `model="nvidia/llama-3.3-nemotron-super-49b-v1.5"`).

## OpenTelemetry Configuration

### Environment Variables

```env
# NVIDIA Observability - OpenTelemetry (NIM-compatible)
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-collector:4318
OTEL_METRICS_EXPORTER=otlp
OTEL_TRACES_EXPORTER=otlp
OTEL_SERVICE_NAME=grump-backend
```

Legacy `OTLP_ENDPOINT` is also supported.

### Span Attributes

LLM spans include NVIDIA NIM attributes:

- `nvidia.nim.provider` – Provider identifier (e.g. `nvidia-nim`)
- `nvidia.nim.model` – Model ID

### Supported Backends

- **Datadog** – Set `OTEL_EXPORTER_OTLP_ENDPOINT` to Datadog OTLP ingest
- **Grafana Tempo / Loki** – Use OTLP collector and configure exporter
- **Zipkin** – Run OTLP-to-Zipkin collector
- **Jaeger** – Use Jaeger OTLP receiver

## Prometheus + Grafana

1. Configure Prometheus to scrape `http://backend:3000/metrics`
2. Import or create a dashboard with:
   - `llm_time_to_first_token_seconds` (p50, p95, p99)
   - `llm_tokens_per_second` (avg, histogram)
   - `llm_tokens_total` (by model)
3. Optional: Run OTLP collector to forward traces to Grafana Tempo

## Docker Compose Observability Stack

With `deploy/docker-compose.observability.yml`:

```bash
# Set OTEL env for backend (or in .env)
export OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318

docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.observability.yml up -d
```

Ensure `observability/` contains Prometheus and Grafana configs (see `docs/PRODUCTION.md`).

## Related

- [PRODUCTION.md](./PRODUCTION.md) – Full deployment and observability setup
- [NVIDIA NIM Observability](https://docs.nvidia.com/nim/large-language-models/latest/observability.html)
