# Copyright (c) Microsoft. All rights reserved.
# Extended by G-Rump team for user safety guardrails.

"""AgentLightning Guardrails - Safety and moderation for AI agents.

This module provides safety guardrails to prevent agents from:
- Processing harmful or malicious user inputs
- Generating unsafe or inappropriate outputs
- Being exploited through prompt injection attacks
- Exceeding rate limits or resource quotas
"""

from .content_filter import ContentFilter, ContentFilterResult, FilterLevel
from .prompt_guard import PromptGuard, InjectionDetector
from .rate_limiter import RateLimiter, RateLimitConfig
from .user_monitor import UserMonitor, UserBehaviorFlags, UserRiskLevel

# SafetyHook requires the full agentlightning package to be properly installed
# Import it lazily to allow standalone use of guardrails components
try:
    from .safety_hooks import SafetyHook, SafetyCheckResult
    _SAFETY_HOOK_AVAILABLE = True
except ImportError:
    _SAFETY_HOOK_AVAILABLE = False
    SafetyHook = None  # type: ignore
    SafetyCheckResult = None  # type: ignore

__all__ = [
    # Content filtering
    "ContentFilter",
    "ContentFilterResult", 
    "FilterLevel",
    # Prompt injection protection
    "PromptGuard",
    "InjectionDetector",
    # Rate limiting
    "RateLimiter",
    "RateLimitConfig",
    # User behavior monitoring
    "UserMonitor",
    "UserBehaviorFlags",
    "UserRiskLevel",
    # Integration hooks (may be None if agentlightning not fully installed)
    "SafetyHook",
    "SafetyCheckResult",
]
