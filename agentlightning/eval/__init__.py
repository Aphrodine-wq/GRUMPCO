# Copyright (c) Microsoft. All rights reserved.
# Extended by G-Rump team for agent evaluation.

"""AgentLightning Eval - Evaluation framework for AI agents.

This module provides evaluation tools to measure:
- Agent response quality
- Safety compliance
- Performance metrics
- Behavioral consistency
"""

from .evaluator import Evaluator, EvalResult, EvalMetrics
from .benchmarks import SafetyBenchmark, QualityBenchmark, PerformanceBenchmark
from .scorers import (
    BaseScorer,
    SafetyScorer,
    RelevanceScorer,
    CoherenceScorer,
    HelpfulnessScorer,
)
from .runner import EvalRunner, EvalConfig, EvalReport

__all__ = [
    # Core evaluation
    "Evaluator",
    "EvalResult",
    "EvalMetrics",
    # Benchmarks
    "SafetyBenchmark",
    "QualityBenchmark",
    "PerformanceBenchmark",
    # Scorers
    "BaseScorer",
    "SafetyScorer",
    "RelevanceScorer",
    "CoherenceScorer",
    "HelpfulnessScorer",
    # Runner
    "EvalRunner",
    "EvalConfig",
    "EvalReport",
]
