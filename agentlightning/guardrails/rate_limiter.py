# Copyright (c) Microsoft. All rights reserved.
# Extended by G-Rump team for rate limiting.

"""Rate limiting for AI agent APIs.

Provides token bucket and sliding window rate limiters
to prevent abuse and ensure fair resource allocation.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""
    
    # Requests per window
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    requests_per_day: int = 10000
    
    # Token/cost limits
    tokens_per_minute: int = 100000
    tokens_per_hour: int = 1000000
    tokens_per_day: int = 10000000
    
    # Burst allowance (multiplier for short bursts)
    burst_multiplier: float = 2.0
    
    # Cooldown after hitting limit (seconds)
    cooldown_seconds: int = 60
    
    # Whether to apply limits
    enabled: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "requests_per_minute": self.requests_per_minute,
            "requests_per_hour": self.requests_per_hour,
            "requests_per_day": self.requests_per_day,
            "tokens_per_minute": self.tokens_per_minute,
            "tokens_per_hour": self.tokens_per_hour,
            "tokens_per_day": self.tokens_per_day,
            "burst_multiplier": self.burst_multiplier,
            "cooldown_seconds": self.cooldown_seconds,
            "enabled": self.enabled,
        }


@dataclass
class RateLimitState:
    """Per-user rate limit state."""
    
    # Request counts
    minute_requests: int = 0
    hour_requests: int = 0
    day_requests: int = 0
    
    # Token counts
    minute_tokens: int = 0
    hour_tokens: int = 0
    day_tokens: int = 0
    
    # Window timestamps
    minute_window_start: float = 0.0
    hour_window_start: float = 0.0
    day_window_start: float = 0.0
    
    # Cooldown
    cooldown_until: float = 0.0
    
    # Total stats
    total_requests: int = 0
    total_tokens: int = 0
    total_rejections: int = 0


@dataclass
class RateLimitResult:
    """Result of a rate limit check."""
    
    allowed: bool
    reason: str = ""
    retry_after_seconds: int = 0
    remaining_requests: int = 0
    remaining_tokens: int = 0
    reset_at: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API headers."""
        return {
            "allowed": self.allowed,
            "reason": self.reason,
            "retry_after": self.retry_after_seconds,
            "remaining_requests": self.remaining_requests,
            "remaining_tokens": self.remaining_tokens,
            "reset_at": int(self.reset_at),
        }


class RateLimiter:
    """Sliding window rate limiter with token counting.
    
    Tracks both request counts and token usage across
    multiple time windows (minute, hour, day).
    
    Example:
        >>> limiter = RateLimiter()
        >>> result = await limiter.check("user123")
        >>> if result.allowed:
        ...     # Process request
        ...     await limiter.record("user123", tokens_used=500)
        ... else:
        ...     print(f"Rate limited: {result.reason}")
    """
    
    def __init__(
        self,
        config: Optional[RateLimitConfig] = None,
        cleanup_interval: int = 300,
    ):
        """Initialize rate limiter.
        
        Args:
            config: Rate limit configuration.
            cleanup_interval: Seconds between cleanup of expired states.
        """
        self.config = config or RateLimitConfig()
        self.cleanup_interval = cleanup_interval
        self._states: Dict[str, RateLimitState] = {}
        self._last_cleanup = time.time()
        self._lock = asyncio.Lock()
    
    async def check(
        self,
        user_id: str,
        estimated_tokens: int = 0,
    ) -> RateLimitResult:
        """Check if request should be allowed.
        
        Args:
            user_id: User identifier.
            estimated_tokens: Estimated token usage for this request.
        
        Returns:
            RateLimitResult indicating if request is allowed.
        """
        if not self.config.enabled:
            return RateLimitResult(allowed=True, remaining_requests=999999)
        
        async with self._lock:
            # Cleanup old states periodically
            now = time.time()
            if now - self._last_cleanup > self.cleanup_interval:
                await self._cleanup()
                self._last_cleanup = now
            
            # Get or create state
            state = self._states.get(user_id)
            if state is None:
                state = RateLimitState(
                    minute_window_start=now,
                    hour_window_start=now,
                    day_window_start=now,
                )
                self._states[user_id] = state
            
            # Check cooldown
            if state.cooldown_until > now:
                return RateLimitResult(
                    allowed=False,
                    reason="In cooldown period",
                    retry_after_seconds=int(state.cooldown_until - now),
                    reset_at=state.cooldown_until,
                )
            
            # Reset windows if expired
            self._reset_expired_windows(state, now)
            
            # Check limits
            result = self._check_limits(state, estimated_tokens, now)
            
            if not result.allowed:
                state.total_rejections += 1
                logger.warning(
                    f"Rate limit exceeded for {user_id}: {result.reason}"
                )
            
            return result
    
    async def record(
        self,
        user_id: str,
        tokens_used: int = 0,
    ) -> None:
        """Record a completed request.
        
        Args:
            user_id: User identifier.
            tokens_used: Actual tokens used.
        """
        if not self.config.enabled:
            return
        
        async with self._lock:
            state = self._states.get(user_id)
            if state is None:
                return
            
            now = time.time()
            self._reset_expired_windows(state, now)
            
            # Increment counts
            state.minute_requests += 1
            state.hour_requests += 1
            state.day_requests += 1
            state.minute_tokens += tokens_used
            state.hour_tokens += tokens_used
            state.day_tokens += tokens_used
            state.total_requests += 1
            state.total_tokens += tokens_used
    
    async def set_cooldown(self, user_id: str, seconds: Optional[int] = None) -> None:
        """Put a user in cooldown.
        
        Args:
            user_id: User identifier.
            seconds: Cooldown duration (uses config default if None).
        """
        async with self._lock:
            state = self._states.get(user_id)
            if state is None:
                state = RateLimitState()
                self._states[user_id] = state
            
            duration = seconds if seconds is not None else self.config.cooldown_seconds
            state.cooldown_until = time.time() + duration
            logger.info(f"User {user_id} in cooldown for {duration}s")
    
    async def get_usage(self, user_id: str) -> Dict[str, Any]:
        """Get current usage stats for a user.
        
        Args:
            user_id: User identifier.
        
        Returns:
            Dictionary with usage statistics.
        """
        async with self._lock:
            state = self._states.get(user_id)
            if state is None:
                return {
                    "requests": {"minute": 0, "hour": 0, "day": 0, "total": 0},
                    "tokens": {"minute": 0, "hour": 0, "day": 0, "total": 0},
                    "rejections": 0,
                }
            
            now = time.time()
            self._reset_expired_windows(state, now)
            
            return {
                "requests": {
                    "minute": state.minute_requests,
                    "hour": state.hour_requests,
                    "day": state.day_requests,
                    "total": state.total_requests,
                },
                "tokens": {
                    "minute": state.minute_tokens,
                    "hour": state.hour_tokens,
                    "day": state.day_tokens,
                    "total": state.total_tokens,
                },
                "rejections": state.total_rejections,
                "in_cooldown": state.cooldown_until > now,
            }
    
    def _reset_expired_windows(self, state: RateLimitState, now: float) -> None:
        """Reset expired time windows."""
        # Minute window
        if now - state.minute_window_start >= 60:
            state.minute_requests = 0
            state.minute_tokens = 0
            state.minute_window_start = now
        
        # Hour window
        if now - state.hour_window_start >= 3600:
            state.hour_requests = 0
            state.hour_tokens = 0
            state.hour_window_start = now
        
        # Day window
        if now - state.day_window_start >= 86400:
            state.day_requests = 0
            state.day_tokens = 0
            state.day_window_start = now
    
    def _check_limits(
        self,
        state: RateLimitState,
        estimated_tokens: int,
        now: float,
    ) -> RateLimitResult:
        """Check all rate limits."""
        config = self.config
        burst = config.burst_multiplier
        
        # Check request limits
        if state.minute_requests >= int(config.requests_per_minute * burst):
            return RateLimitResult(
                allowed=False,
                reason="Requests per minute exceeded",
                retry_after_seconds=int(60 - (now - state.minute_window_start)),
                remaining_requests=0,
                reset_at=state.minute_window_start + 60,
            )
        
        if state.hour_requests >= config.requests_per_hour:
            return RateLimitResult(
                allowed=False,
                reason="Requests per hour exceeded",
                retry_after_seconds=int(3600 - (now - state.hour_window_start)),
                remaining_requests=0,
                reset_at=state.hour_window_start + 3600,
            )
        
        if state.day_requests >= config.requests_per_day:
            return RateLimitResult(
                allowed=False,
                reason="Requests per day exceeded",
                retry_after_seconds=int(86400 - (now - state.day_window_start)),
                remaining_requests=0,
                reset_at=state.day_window_start + 86400,
            )
        
        # Check token limits
        if state.minute_tokens + estimated_tokens > int(config.tokens_per_minute * burst):
            return RateLimitResult(
                allowed=False,
                reason="Tokens per minute exceeded",
                retry_after_seconds=int(60 - (now - state.minute_window_start)),
                remaining_tokens=max(0, config.tokens_per_minute - state.minute_tokens),
                reset_at=state.minute_window_start + 60,
            )
        
        if state.hour_tokens + estimated_tokens > config.tokens_per_hour:
            return RateLimitResult(
                allowed=False,
                reason="Tokens per hour exceeded",
                retry_after_seconds=int(3600 - (now - state.hour_window_start)),
                remaining_tokens=max(0, config.tokens_per_hour - state.hour_tokens),
                reset_at=state.hour_window_start + 3600,
            )
        
        # All checks passed
        return RateLimitResult(
            allowed=True,
            remaining_requests=min(
                config.requests_per_minute - state.minute_requests,
                config.requests_per_hour - state.hour_requests,
                config.requests_per_day - state.day_requests,
            ),
            remaining_tokens=min(
                config.tokens_per_minute - state.minute_tokens,
                config.tokens_per_hour - state.hour_tokens,
            ),
        )
    
    async def _cleanup(self) -> None:
        """Remove expired state entries."""
        now = time.time()
        expired = []
        
        for user_id, state in self._states.items():
            # Remove if no activity in 24 hours and not in cooldown
            if (now - state.day_window_start > 86400 and 
                state.cooldown_until < now and
                state.day_requests == 0):
                expired.append(user_id)
        
        for user_id in expired:
            del self._states[user_id]
        
        if expired:
            logger.debug(f"Cleaned up {len(expired)} expired rate limit states")
