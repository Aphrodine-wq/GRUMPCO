# NVIDIA Golden Developer Award – G-Rump Submission

> One-pager and demo script for the NVIDIA Golden Developer Award. Use this for the written narrative, demo flow, and submission links.

## Written Narrative

### Problem

Teams need to go from natural language to production-ready applications without losing control. Requirements drift, specs go stale, and generated code often doesn’t meet standards. G-Rump addresses this with **Architecture-as-Code**: your diagram and spec are the source of truth; code generation is optional and guided by that design.

### Why Nemotron and NVIDIA NIM

G-Rump runs its **entire AI pipeline on NVIDIA Nemotron over NIM**—one stack for reasoning, code, RAG, swarm, and vision:

- **Reasoning and architecture:** Nemotron Ultra 253B for complex decisions and scientific-style reasoning.
- **Chat and default:** Nemotron Super 49B as the default model for demos and agentic use.
- **Long-context and RAG:** Nemotron 3 Nano 30B A3B with **1M token context** for whole-repo and document RAG.
- **Multi-agent swarm:** Nemotron Super 49B for task decomposition and specialist agents.
- **Vision:** Nemotron Nano 12B v2 VL for diagram and document understanding.

### What’s “Crazy Effective”

- **Nemotron 3 with 1M context** for RAG and long documents (vs. 128K elsewhere).
- **Swarm powered by Nemotron** for multi-agent codegen and orchestration.
- **Vision on Nemotron VL** for diagram-to-code and doc intelligence.
- **Single default:** Nemotron Super so every demo hits Nemotron first.

### Impact

- **Who:** Dev teams and enterprises that want NL → architecture → spec → code with one pipeline.
- **What they get:** Faster design and codegen, less drift, and a single NVIDIA stack (Nemotron + NIM) for all modalities.

---

## Demo Script (3–5 minutes)

Use this path so judges see Nemotron at each step. Note which model is used where (visible in UI or via `/metrics`).

1. **Describe → Architecture → Spec → Code (2 min)**  
   - Describe an app in natural language.  
   - Generate architecture (Mermaid). **Model:** reasoning path → Nemotron Ultra.  
   - Generate spec (PRD). **Model:** reasoning.  
   - Generate code (optional). **Model:** codegen / Nemotron Super or flagship.

2. **Ask docs / whole repo (1 min)**  
   - Use “Ask docs” or RAG with a large context.  
   - **Model:** Nemotron 3 Nano 30B A3B (1M context) when context > 100K.

3. **Swarm / multi-agent (1 min)**  
   - Run a swarm task (e.g. “Implement auth and tests”).  
   - **Model:** Nemotron Super 49B for orchestration and agents.

4. **Diagram → code (if available) (30 s)**  
   - Upload or draw a diagram; generate code from it.  
   - **Model:** Nemotron Vision (Nano 12B v2 VL).

**Fallback:** If live demo fails, use a short screen recording (2–5 min) of this script with voiceover. Upload as unlisted (e.g. YouTube) and add the link to the submission.

---

## Video (if required)

- **Content:** Screen recording of the demo script above, with voiceover naming each step and “Nemotron” where relevant.
- **Length:** 3–5 minutes.
- **Link:** Unlisted URL (e.g. YouTube/Vimeo) in the submission form.

---

## Checklist Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Cloud** | G-Rump deployed on GCP/AWS using NGC-certified VMs. See [deploy/ngc/](../deploy/ngc/) |
| **Data** | NeMo Curator synthetic data pipeline. See [services/nemo-curator/](../services/nemo-curator/) |
| **Framework** | NVIDIA NIM for LLMs and RAG (Nemotron) |
| **Training** | NeMo Framework fine-tuning example. See [services/nemo-training/](../services/nemo-training/) |
| **Inference** | NVIDIA NIM (Nemotron Super, Ultra, Nano) |
| **Observability** | Prometheus + OTEL, NIM-aligned metrics. See [NVIDIA_OBSERVABILITY.md](NVIDIA_OBSERVABILITY.md) |

## Model Fine-Tuning with NeMo

G-Rump includes a NeMo Framework fine-tuning example for domain adaptation:

```bash
cd services/nemo-training
pip install -r requirements.txt
export HF_TOKEN=your_token
python fine_tune_example.py --model meta-llama/Llama-3.2-1B --steps 100 --peft lora
```

Run on NGC GPU VM (see [deploy/ngc/](../deploy/ngc/)) for best results. Full instructions: [services/nemo-training/README.md](../services/nemo-training/README.md).

---

## Links for Submission

- **Live demo (if hosted):** [e.g. https://your-demo-url.example]  
- **Repo:** [e.g. https://github.com/Aphrodine-wq/G-rump.com]  
- **Docs:** [README](../README.md), [Getting Started](GETTING_STARTED.md), [Architecture](ARCHITECTURE.md)  
- **NVIDIA NIM:** Get your free API key at https://build.nvidia.com
