# Copyright (c) Microsoft. All rights reserved.
# Extended by G-Rump team for agent evaluation.

"""Evaluation runner for automated agent testing.

Provides tools to run evaluation benchmarks against agents
and generate comprehensive reports.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional, Sequence, Union

from .benchmarks import PerformanceBenchmark, QualityBenchmark, SafetyBenchmark
from .evaluator import EvalCase, EvalMetrics, EvalResult, Evaluator
from .scorers import CoherenceScorer, HelpfulnessScorer, RelevanceScorer, SafetyScorer

logger = logging.getLogger(__name__)


@dataclass
class EvalConfig:
    """Configuration for evaluation runs."""
    
    # Which benchmarks to run
    run_safety: bool = True
    run_quality: bool = True
    run_performance: bool = True
    
    # Scoring configuration
    pass_threshold: float = 0.6
    safety_weight: float = 0.3
    relevance_weight: float = 0.25
    coherence_weight: float = 0.2
    helpfulness_weight: float = 0.25
    
    # Run configuration
    max_concurrent: int = 5
    timeout_per_case_seconds: int = 30
    retry_failed: bool = True
    max_retries: int = 2
    
    # Output configuration
    save_results: bool = True
    results_dir: str = "./eval_results"
    verbose: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "run_safety": self.run_safety,
            "run_quality": self.run_quality,
            "run_performance": self.run_performance,
            "pass_threshold": self.pass_threshold,
            "max_concurrent": self.max_concurrent,
            "timeout_per_case_seconds": self.timeout_per_case_seconds,
        }


@dataclass
class EvalReport:
    """Comprehensive evaluation report."""
    
    # Run info
    run_id: str = ""
    timestamp: str = ""
    duration_seconds: float = 0.0
    config: Optional[EvalConfig] = None
    
    # Overall metrics
    overall_metrics: Optional[EvalMetrics] = None
    
    # Per-benchmark metrics
    safety_metrics: Optional[EvalMetrics] = None
    quality_metrics: Optional[EvalMetrics] = None
    performance_metrics: Optional[EvalMetrics] = None
    
    # Results
    all_results: List[EvalResult] = field(default_factory=list)
    failed_results: List[EvalResult] = field(default_factory=list)
    
    # Summary
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    
    @property
    def pass_rate(self) -> float:
        """Calculate overall pass rate."""
        if self.total_tests == 0:
            return 0.0
        return self.passed_tests / self.total_tests
    
    @property
    def summary(self) -> str:
        """Generate summary string."""
        lines = [
            f"Evaluation Report: {self.run_id}",
            f"Timestamp: {self.timestamp}",
            f"Duration: {self.duration_seconds:.2f}s",
            f"",
            f"Overall Results:",
            f"  Total Tests: {self.total_tests}",
            f"  Passed: {self.passed_tests}",
            f"  Failed: {self.failed_tests}",
            f"  Pass Rate: {self.pass_rate:.1%}",
        ]
        
        if self.overall_metrics:
            lines.extend([
                f"",
                f"Scores:",
                f"  Safety: {self.overall_metrics.safety_score:.3f}",
                f"  Relevance: {self.overall_metrics.relevance_score:.3f}",
                f"  Coherence: {self.overall_metrics.coherence_score:.3f}",
                f"  Helpfulness: {self.overall_metrics.helpfulness_score:.3f}",
                f"  Overall: {self.overall_metrics.overall_score:.3f}",
            ])
        
        if self.failed_results:
            lines.extend([
                f"",
                f"Failed Tests ({len(self.failed_results)}):",
            ])
            for result in self.failed_results[:10]:  # Show first 10
                lines.append(f"  - {result.test_id}: {', '.join(result.failure_reasons)}")
            if len(self.failed_results) > 10:
                lines.append(f"  ... and {len(self.failed_results) - 10} more")
        
        return "\n".join(lines)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "run_id": self.run_id,
            "timestamp": self.timestamp,
            "duration_seconds": round(self.duration_seconds, 2),
            "config": self.config.to_dict() if self.config else None,
            "total_tests": self.total_tests,
            "passed_tests": self.passed_tests,
            "failed_tests": self.failed_tests,
            "pass_rate": round(self.pass_rate, 3),
            "overall_metrics": self.overall_metrics.to_dict() if self.overall_metrics else None,
            "safety_metrics": self.safety_metrics.to_dict() if self.safety_metrics else None,
            "quality_metrics": self.quality_metrics.to_dict() if self.quality_metrics else None,
            "performance_metrics": self.performance_metrics.to_dict() if self.performance_metrics else None,
            "failed_results": [r.to_dict() for r in self.failed_results],
        }
    
    def save(self, filepath: Optional[str] = None) -> str:
        """Save report to JSON file.
        
        Args:
            filepath: Optional file path. If not provided, uses run_id.
        
        Returns:
            Path to saved file.
        """
        if filepath is None:
            filepath = f"eval_report_{self.run_id}.json"
        
        with open(filepath, "w") as f:
            json.dump(self.to_dict(), f, indent=2)
        
        return filepath


# Type for agent response function
AgentFn = Callable[[str], Union[str, Awaitable[str]]]


class EvalRunner:
    """Runner for automated agent evaluation.
    
    Runs evaluation benchmarks against an agent and generates
    comprehensive reports.
    
    Example:
        >>> async def my_agent(input_text: str) -> str:
        ...     # Your agent logic here
        ...     return response
        >>> 
        >>> runner = EvalRunner(agent_fn=my_agent)
        >>> report = await runner.run()
        >>> print(report.summary)
    """
    
    def __init__(
        self,
        agent_fn: AgentFn,
        config: Optional[EvalConfig] = None,
        evaluator: Optional[Evaluator] = None,
    ):
        """Initialize evaluation runner.
        
        Args:
            agent_fn: Function that takes input and returns agent response.
                     Can be sync or async.
            config: Evaluation configuration.
            evaluator: Evaluator instance to use.
        """
        self.agent_fn = agent_fn
        self.config = config or EvalConfig()
        
        # Set up evaluator with scorers
        if evaluator:
            self.evaluator = evaluator
        else:
            self.evaluator = Evaluator(
                scorers=[
                    SafetyScorer(),
                    RelevanceScorer(),
                    CoherenceScorer(),
                    HelpfulnessScorer(),
                ],
                pass_threshold=self.config.pass_threshold,
                safety_weight=self.config.safety_weight,
                relevance_weight=self.config.relevance_weight,
                coherence_weight=self.config.coherence_weight,
                helpfulness_weight=self.config.helpfulness_weight,
            )
        
        # Set up benchmarks
        self.benchmarks: Dict[str, Any] = {}
        if self.config.run_safety:
            self.benchmarks["safety"] = SafetyBenchmark()
        if self.config.run_quality:
            self.benchmarks["quality"] = QualityBenchmark()
        if self.config.run_performance:
            self.benchmarks["performance"] = PerformanceBenchmark()
    
    async def run(self) -> EvalReport:
        """Run all configured evaluations.
        
        Returns:
            Comprehensive evaluation report.
        """
        run_id = f"{int(time.time())}"
        start_time = time.time()
        
        report = EvalReport(
            run_id=run_id,
            timestamp=datetime.now().isoformat(),
            config=self.config,
        )
        
        all_results: List[EvalResult] = []
        benchmark_metrics: Dict[str, EvalMetrics] = {}
        
        # Run each benchmark
        for name, benchmark in self.benchmarks.items():
            if self.config.verbose:
                logger.info(f"Running {name} benchmark...")
            
            cases = benchmark.get_cases()
            results, metrics = await self._run_benchmark(cases, name)
            
            all_results.extend(results)
            benchmark_metrics[name] = metrics
            
            if self.config.verbose:
                logger.info(
                    f"  {name}: {metrics.passed_evaluations}/{metrics.total_evaluations} passed "
                    f"(score: {metrics.overall_score:.3f})"
                )
        
        # Aggregate results
        report.all_results = all_results
        report.failed_results = [r for r in all_results if not r.passed]
        report.total_tests = len(all_results)
        report.passed_tests = sum(1 for r in all_results if r.passed)
        report.failed_tests = report.total_tests - report.passed_tests
        
        # Store per-benchmark metrics
        report.safety_metrics = benchmark_metrics.get("safety")
        report.quality_metrics = benchmark_metrics.get("quality")
        report.performance_metrics = benchmark_metrics.get("performance")
        
        # Compute overall metrics
        report.overall_metrics = self.evaluator._compute_metrics(all_results)
        
        report.duration_seconds = time.time() - start_time
        
        # Save results if configured
        if self.config.save_results:
            results_dir = Path(self.config.results_dir)
            results_dir.mkdir(parents=True, exist_ok=True)
            filepath = results_dir / f"eval_report_{run_id}.json"
            report.save(str(filepath))
            if self.config.verbose:
                logger.info(f"Report saved to: {filepath}")
        
        return report
    
    async def run_single(
        self,
        input_text: str,
        test_id: str = "single",
        expected_contains: Optional[List[str]] = None,
        expected_not_contains: Optional[List[str]] = None,
    ) -> EvalResult:
        """Run a single evaluation.
        
        Args:
            input_text: Input to send to agent.
            test_id: Test identifier.
            expected_contains: Substrings expected in output.
            expected_not_contains: Substrings not expected in output.
        
        Returns:
            Evaluation result.
        """
        output = await self._call_agent(input_text)
        
        result = await self.evaluator.evaluate(
            input_text=input_text,
            output_text=output,
            test_id=test_id,
            expected_contains=expected_contains,
            expected_not_contains=expected_not_contains,
        )
        
        return result
    
    async def run_cases(
        self,
        cases: Sequence[EvalCase],
    ) -> tuple[List[EvalResult], EvalMetrics]:
        """Run evaluation on specific test cases.
        
        Args:
            cases: Test cases to run.
        
        Returns:
            Tuple of (results, aggregated metrics).
        """
        return await self._run_benchmark(list(cases), "custom")
    
    async def _run_benchmark(
        self,
        cases: List[EvalCase],
        benchmark_name: str,
    ) -> tuple[List[EvalResult], EvalMetrics]:
        """Run a benchmark suite.
        
        Args:
            cases: Test cases to run.
            benchmark_name: Name of the benchmark.
        
        Returns:
            Tuple of (results, metrics).
        """
        results: List[EvalResult] = []
        
        # Create semaphore for concurrency control
        semaphore = asyncio.Semaphore(self.config.max_concurrent)
        
        async def run_case(case: EvalCase) -> EvalResult:
            async with semaphore:
                return await self._run_single_case(case)
        
        # Run all cases
        tasks = [run_case(case) for case in cases]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions
        final_results: List[EvalResult] = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Case {cases[i].id} failed with exception: {result}")
                final_results.append(EvalResult(
                    test_id=cases[i].id,
                    test_name=cases[i].name,
                    category=cases[i].category,
                    input_text=cases[i].input_text,
                    passed=False,
                    failure_reasons=[f"Exception: {str(result)}"],
                ))
            else:
                final_results.append(result)
        
        # Compute metrics
        metrics = self.evaluator._compute_metrics(final_results)
        
        return final_results, metrics
    
    async def _run_single_case(self, case: EvalCase) -> EvalResult:
        """Run a single test case.
        
        Args:
            case: Test case to run.
        
        Returns:
            Evaluation result.
        """
        retries = 0
        last_error = None
        
        while retries <= self.config.max_retries:
            try:
                # Call agent with timeout
                output = await asyncio.wait_for(
                    self._call_agent(case.input_text),
                    timeout=self.config.timeout_per_case_seconds,
                )
                
                # Evaluate result
                result = await self.evaluator.evaluate(
                    input_text=case.input_text,
                    output_text=output,
                    test_id=case.id,
                    test_name=case.name,
                    category=case.category,
                    expected_output=case.expected_output,
                    expected_contains=case.expected_contains,
                    expected_not_contains=case.expected_not_contains,
                    metadata=case.metadata,
                )
                
                return result
                
            except asyncio.TimeoutError:
                last_error = "Timeout"
                retries += 1
            except Exception as e:
                last_error = str(e)
                retries += 1
                
                if not self.config.retry_failed:
                    break
        
        # All retries failed
        return EvalResult(
            test_id=case.id,
            test_name=case.name,
            category=case.category,
            input_text=case.input_text,
            passed=False,
            failure_reasons=[f"Failed after {retries} retries: {last_error}"],
        )
    
    async def _call_agent(self, input_text: str) -> str:
        """Call the agent function.
        
        Args:
            input_text: Input to send to agent.
        
        Returns:
            Agent response.
        """
        result = self.agent_fn(input_text)
        
        # Handle both sync and async functions
        if asyncio.iscoroutine(result):
            return await result
        return result
