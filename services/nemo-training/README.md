# NeMo Framework Fine-Tuning – G-Rump

Fine-tune language models with NVIDIA NeMo Framework for G-Rump domain adaptation. Aligns with NVIDIA Golden Developer Award training requirement.

## Overview

This example demonstrates SFT (Supervised Fine-Tuning) and LoRA (Parameter-Efficient Fine-Tuning) using NeMo AutoModel. Run on NGC GPU VM for best results.

## Prerequisites

- **GPU**: NVIDIA GPU (A100, T4, or similar) – required for training
- **NGC VM**: Provision with `deploy/ngc/gcp/provision.sh --gpu` or `deploy/ngc/aws/provision.sh --gpu`
- **Hugging Face**: `HF_TOKEN` for gated models (e.g. Llama)

## Installation

### Option 1: pip (on NGC VM)

```bash
cd services/nemo-training
pip install -r requirements.txt
```

### Option 2: NGC Container (recommended)

```bash
docker run --gpus all -it -v $(pwd):/workspace nvcr.io/nvidia/nemo:25.02.framework
cd /workspace/services/nemo-training
```

## Usage

```bash
export HF_TOKEN=your_huggingface_token   # for gated models
python fine_tune_example.py --model meta-llama/Llama-3.2-1B --steps 100 --peft lora
```

Options:

- `--model` – Hugging Face model ID (default: meta-llama/Llama-3.2-1B)
- `--output-dir` – Checkpoint output path (default: ./checkpoints/grump-sft)
- `--steps` – Max training steps (default: 100)
- `--peft` – `lora` or `none` (full SFT)
- `--gpus` – GPUs per node (default: 1)
- `--precision` – Trainer precision (default: bf16-mixed)
- `--grad-accum` – Gradient accumulation steps (default: 1)
- `--log-steps` – Log every N steps (default: 10)
- `--val-check-interval` – Validation check interval (default: 0.25)

## Data

- Default: SQuAD dataset (rajpurkar/squad)
- Custom: Use synthetic Q&A from `services/nemo-curator/data/synthetic_qa.jsonl` (convert to HF format)

## Export for NIM or Inference

After fine-tuning, the checkpoint is in Hugging Face format. To deploy:

1. **Hugging Face inference**:
   ```python
   from transformers import AutoModelForCausalLM, AutoTokenizer
   model = AutoModelForCausalLM.from_pretrained("./checkpoints/grump-sft")
   tokenizer = AutoTokenizer.from_pretrained("./checkpoints/grump-sft")
   ```

2. **vLLM**: Use `vLLMHFExporter` from NeMo to export for vLLM deployment.

3. **NIM**: Upload checkpoint to NGC or convert for NIM deployment.

## Reference

- [NeMo Framework SFT](https://docs.nvidia.com/nemo-framework/user-guide/latest/automodel/sft.html)
- [NeMo Framework Installation](https://docs.nvidia.com/nemo-framework/user-guide/latest/installation.html)
- [NGC NeMo Container](https://catalog.ngc.nvidia.com/orgs/nvidia/containers/nemo)
