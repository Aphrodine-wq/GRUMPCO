# Copyright (c) Microsoft. All rights reserved.
# Extended by G-Rump team for AgentLightning integration.

"""Safety hooks for AgentLightning runner integration.

Provides hooks that integrate guardrails directly into
the AgentLightning runner lifecycle.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Union, TYPE_CHECKING

from opentelemetry.sdk.trace import ReadableSpan

from ..agtypes import Rollout, Hook, Span

if TYPE_CHECKING:
    from agentlightning.litagent import LitAgent
    from agentlightning.runner.base import Runner
    from agentlightning.tracer.base import Tracer

from .content_filter import ContentFilter, ContentFilterResult
from .prompt_guard import InjectionDetector, InjectionDetectionResult, PromptGuard
from .rate_limiter import RateLimiter, RateLimitResult
from .user_monitor import UserMonitor, UserRiskLevel

logger = logging.getLogger(__name__)


@dataclass
class SafetyCheckResult:
    """Combined result of all safety checks."""
    
    passed: bool
    content_filter_result: Optional[ContentFilterResult] = None
    injection_result: Optional[InjectionDetectionResult] = None
    rate_limit_result: Optional[RateLimitResult] = None
    user_risk_level: Optional[UserRiskLevel] = None
    
    # Failure details
    failure_reason: str = ""
    failure_category: str = ""
    
    # Recommendations
    should_block: bool = False
    should_warn: bool = False
    should_rate_limit: bool = False
    should_escalate: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "passed": self.passed,
            "content_filter": self.content_filter_result.to_dict() if self.content_filter_result else None,
            "injection": self.injection_result.to_dict() if self.injection_result else None,
            "rate_limit": self.rate_limit_result.to_dict() if self.rate_limit_result else None,
            "user_risk_level": self.user_risk_level.value if self.user_risk_level else None,
            "failure_reason": self.failure_reason,
            "failure_category": self.failure_category,
            "should_block": self.should_block,
            "should_warn": self.should_warn,
            "should_rate_limit": self.should_rate_limit,
            "should_escalate": self.should_escalate,
        }


class SafetyHook(Hook):
    """AgentLightning hook that enforces safety guardrails.
    
    This hook integrates with the LitAgentRunner to check inputs
    before rollouts and monitor outputs after completion.
    
    Example:
        >>> from agentlightning import LitAgentRunner
        >>> from agentlightning.guardrails import SafetyHook
        >>> 
        >>> safety_hook = SafetyHook()
        >>> runner = LitAgentRunner(tracer=tracer)
        >>> runner.init(agent, hooks=[safety_hook])
    """
    
    def __init__(
        self,
        content_filter: Optional[ContentFilter] = None,
        prompt_guard: Optional[PromptGuard] = None,
        rate_limiter: Optional[RateLimiter] = None,
        user_monitor: Optional[UserMonitor] = None,
        block_on_content_violation: bool = True,
        block_on_injection: bool = True,
        block_on_rate_limit: bool = True,
        block_high_risk_users: bool = True,
        log_all_checks: bool = False,
    ):
        """Initialize safety hook.
        
        Args:
            content_filter: Content filter instance.
            prompt_guard: Prompt injection guard.
            rate_limiter: Rate limiter instance.
            user_monitor: User behavior monitor.
            block_on_content_violation: Block on content filter violations.
            block_on_injection: Block on injection detection.
            block_on_rate_limit: Block on rate limit exceeded.
            block_high_risk_users: Block users with HIGH/CRITICAL risk.
            log_all_checks: Log all safety checks (verbose).
        """
        self.content_filter = content_filter or ContentFilter()
        self.prompt_guard = prompt_guard or PromptGuard()
        self.rate_limiter = rate_limiter or RateLimiter()
        self.user_monitor = user_monitor or UserMonitor()
        
        self.block_on_content_violation = block_on_content_violation
        self.block_on_injection = block_on_injection
        self.block_on_rate_limit = block_on_rate_limit
        self.block_high_risk_users = block_high_risk_users
        self.log_all_checks = log_all_checks
        
        self._stats: Dict[str, Any] = {
            "total_checks": 0,
            "passed": 0,
            "blocked_content": 0,
            "blocked_injection": 0,
            "blocked_rate_limit": 0,
            "blocked_high_risk": 0,
        }
    
    async def check_safety(
        self,
        content: str,
        user_id: str = "anonymous",
        estimated_tokens: int = 0,
    ) -> SafetyCheckResult:
        """Run all safety checks on content.
        
        Args:
            content: Content to check.
            user_id: User identifier.
            estimated_tokens: Estimated token usage.
        
        Returns:
            Combined safety check result.
        """
        self._stats["total_checks"] += 1
        
        context = {"user_id": user_id}
        
        # Get user profile for risk check
        profile = await self.user_monitor.get_profile(user_id)
        
        # Check if user is blocked
        if profile.risk_level == UserRiskLevel.BLOCKED:
            return SafetyCheckResult(
                passed=False,
                user_risk_level=profile.risk_level,
                failure_reason="User is blocked",
                failure_category="user_blocked",
                should_block=True,
            )
        
        # Check if high-risk user should be blocked
        if self.block_high_risk_users and profile.risk_level in (UserRiskLevel.HIGH, UserRiskLevel.CRITICAL):
            self._stats["blocked_high_risk"] += 1
            return SafetyCheckResult(
                passed=False,
                user_risk_level=profile.risk_level,
                failure_reason=f"User risk level too high: {profile.risk_level.value}",
                failure_category="high_risk_user",
                should_block=True,
                should_escalate=True,
            )
        
        # Rate limit check
        rate_result = await self.rate_limiter.check(user_id, estimated_tokens)
        if not rate_result.allowed and self.block_on_rate_limit:
            self._stats["blocked_rate_limit"] += 1
            return SafetyCheckResult(
                passed=False,
                rate_limit_result=rate_result,
                user_risk_level=profile.risk_level,
                failure_reason=rate_result.reason,
                failure_category="rate_limited",
                should_rate_limit=True,
            )
        
        # Content filter check
        content_result = self.content_filter.check(content, context)
        if content_result.is_blocked and self.block_on_content_violation:
            self._stats["blocked_content"] += 1
            await self.user_monitor.record_request(user_id, was_blocked=True, block_reason=content_result.message)
            return SafetyCheckResult(
                passed=False,
                content_filter_result=content_result,
                user_risk_level=profile.risk_level,
                failure_reason=content_result.message,
                failure_category="content_blocked",
                should_block=content_result.is_hard_blocked,
                should_warn=not content_result.is_hard_blocked,
            )
        
        # Injection detection check
        injection_result = self.prompt_guard.detector.detect(content, context)
        if injection_result.is_injection and self.block_on_injection:
            self._stats["blocked_injection"] += 1
            await self.user_monitor.record_injection_attempt(
                user_id, 
                injection_type=injection_result.injection_type.value if injection_result.injection_type else "",
                content_sample=content[:200],
            )
            return SafetyCheckResult(
                passed=False,
                injection_result=injection_result,
                user_risk_level=profile.risk_level,
                failure_reason=f"Injection detected: {injection_result.explanation}",
                failure_category="injection_detected",
                should_block=True,
            )
        
        # All checks passed
        self._stats["passed"] += 1
        if self.log_all_checks:
            logger.debug(f"Safety checks passed for user {user_id}")
        
        return SafetyCheckResult(
            passed=True,
            content_filter_result=content_result if content_result.categories else None,
            injection_result=injection_result if injection_result.matched_pattern else None,
            rate_limit_result=rate_result,
            user_risk_level=profile.risk_level,
        )
    
    async def on_rollout_start(
        self,
        *,
        agent: Any,
        runner: Any,
        rollout: Rollout,
    ) -> None:
        """Hook called before rollout execution.
        
        Checks the rollout input for safety violations.
        
        Args:
            agent: The LitAgent instance.
            runner: The LitAgentRunner instance.
            rollout: The rollout about to be executed.
        """
        # Extract input content for checking
        input_content = ""
        rollout_input = rollout.input if hasattr(rollout, 'input') else None
        
        if isinstance(rollout_input, str):
            input_content = rollout_input
        elif isinstance(rollout_input, dict):
            # Try common keys for user input
            for key in ["content", "message", "prompt", "query", "text", "input"]:
                if key in rollout_input:
                    input_content = str(rollout_input[key])
                    break
            if not input_content:
                input_content = str(rollout_input)
        elif rollout_input is not None:
            input_content = str(rollout_input)
        
        # Extract user_id if available
        user_id = "anonymous"
        if isinstance(rollout_input, dict):
            user_id = rollout_input.get("user_id", rollout_input.get("userId", "anonymous"))
        
        # Run safety check
        result = await self.check_safety(input_content, user_id)
        
        rollout_id = getattr(rollout, 'rollout_id', 'unknown')
        if not result.passed:
            logger.warning(
                f"Safety check failed for rollout {rollout_id}: "
                f"category={result.failure_category}, reason={result.failure_reason}"
            )
            # Note: In a full implementation, we would raise an exception here
            # to prevent the rollout from executing. For now we just log.
    
    async def on_rollout_end(
        self,
        *,
        agent: Any,
        runner: Any,
        rollout: Rollout,
        spans: Union[List[ReadableSpan], Sequence[Span]],
    ) -> None:
        """Hook called after rollout completion.
        
        Records the request and updates user monitoring.
        
        Args:
            agent: The LitAgent instance.
            runner: The LitAgentRunner instance.
            rollout: The completed rollout.
            spans: Spans generated during rollout.
        """
        # Extract user_id
        user_id = "anonymous"
        rollout_input = rollout.input if hasattr(rollout, 'input') else None
        if isinstance(rollout_input, dict):
            user_id = rollout_input.get("user_id", rollout_input.get("userId", "anonymous"))
        
        # Estimate tokens from spans
        tokens_used: int = 0
        for span in spans:
            if hasattr(span, "attributes") and span.attributes is not None:
                token_value = span.attributes.get("tokens", 0)
                if isinstance(token_value, (int, float)):
                    tokens_used += int(token_value)
        
        # Record the request
        await self.user_monitor.record_request(user_id, was_blocked=False, tokens_used=tokens_used)
        await self.rate_limiter.record(user_id, tokens_used)
    
    async def on_trace_start(
        self,
        *,
        agent: Any,
        runner: Any,
        tracer: Any,
        rollout: Rollout,
    ) -> None:
        """Hook called when trace starts (no-op for safety)."""
        pass
    
    async def on_trace_end(
        self,
        *,
        agent: Any,
        runner: Any,
        tracer: Any,
        rollout: Rollout,
    ) -> None:
        """Hook called when trace ends (no-op for safety)."""
        pass
    
    def get_stats(self) -> Dict[str, Any]:
        """Get safety hook statistics.
        
        Returns:
            Dictionary with check statistics.
        """
        stats = dict(self._stats)
        stats["content_filter_stats"] = self.content_filter.get_stats()
        stats["injection_detections"] = self.prompt_guard.detector.detection_count
        return stats
