#!/usr/bin/env python3
"""
NeMo Framework fine-tuning example for G-Rump.
Demonstrates SFT / LoRA fine-tuning on NGC GPU.

Usage (on NGC VM with GPU):
  export HF_TOKEN=your_huggingface_token   # for gated models
  python fine_tune_example.py [--model meta-llama/Llama-3.2-1B] [--steps 100]

Requires: nemo-automodel, nemo-run
See: https://docs.nvidia.com/nemo-framework/user-guide/latest/automodel/sft.html
"""

import argparse
import sys
from pathlib import Path

try:
    from nemo.collections import llm
    import nemo_run as run
except ImportError:
    print(
        "Install NeMo AutoModel: pip install nemo-automodel nemo-run",
        file=sys.stderr,
    )
    print(
        "Or run in NGC container: docker run --gpus all -it nvcr.io/nvidia/nemo:25.02.framework",
        file=sys.stderr,
    )
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="NeMo Framework fine-tuning for G-Rump")
    parser.add_argument(
        "--model",
        default="meta-llama/Llama-3.2-1B",
        help="Hugging Face model ID (e.g. meta-llama/Llama-3.2-1B)",
    )
    parser.add_argument(
        "--output-dir",
        default="./checkpoints/grump-sft",
        help="Output directory for checkpoints",
    )
    parser.add_argument(
        "--steps",
        type=int,
        default=100,
        help="Max training steps",
    )
    parser.add_argument(
        "--peft",
        choices=["lora", "none"],
        default="lora",
        help="PEFT scheme: lora or none (full SFT)",
    )
    parser.add_argument(
        "--gpus",
        type=int,
        default=1,
        help="GPUs per node",
    )
    parser.add_argument(
        "--precision",
        default="bf16-mixed",
        help="Trainer precision (e.g., bf16-mixed, 16-mixed)",
    )
    parser.add_argument(
        "--grad-accum",
        type=int,
        default=1,
        help="Gradient accumulation steps",
    )
    parser.add_argument(
        "--log-steps",
        type=int,
        default=10,
        help="Log every N steps",
    )
    parser.add_argument(
        "--val-check-interval",
        type=float,
        default=0.25,
        help="Validation check interval (0-1 for fraction, or steps)",
    )
    args = parser.parse_args()

    peft_scheme = None if args.peft == "none" else args.peft

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Fine-tuning {args.model} with NeMo Framework...")
    print(f"  Output: {output_dir}")
    print(f"  Steps: {args.steps}")
    print(f"  PEFT: {peft_scheme or 'full SFT'}")
    print(f"  Precision: {args.precision}")
    print(f"  Grad Accum: {args.grad_accum}")

    recipe = llm.hf_auto_model_for_causal_lm.finetune_recipe(
        model_name=args.model,
        dir=str(output_dir),
        name="grump_sft",
        num_nodes=1,
        num_gpus_per_node=args.gpus,
        peft_scheme=peft_scheme,
    )
    recipe.trainer.max_steps = args.steps
    recipe.trainer.precision = args.precision
    recipe.trainer.accumulate_grad_batches = args.grad_accum
    recipe.trainer.log_every_n_steps = args.log_steps
    recipe.trainer.val_check_interval = args.val_check_interval

    run.run(recipe)

    print(f"Checkpoint saved to {output_dir}")


if __name__ == "__main__":
    main()
