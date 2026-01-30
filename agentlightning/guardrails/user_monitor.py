# Copyright (c) Microsoft. All rights reserved.
# Extended by G-Rump team for user behavior monitoring.

"""User behavior monitoring for AI safety.

Tracks user behavior patterns to identify:
- Potential abuse or exploitation attempts
- Unusual activity patterns
- Users who may need additional restrictions
"""

from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Deque, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class UserRiskLevel(Enum):
    """User risk classification levels."""
    
    LOW = "low"           # Normal user behavior
    MEDIUM = "medium"     # Some concerning patterns
    HIGH = "high"         # Multiple red flags
    CRITICAL = "critical" # Immediate action needed
    BLOCKED = "blocked"   # User is blocked


class UserBehaviorFlags(Enum):
    """Behavioral flags that can be assigned to users."""
    
    # Content-related
    REPEATED_BLOCKED_CONTENT = "repeated_blocked_content"
    PROMPT_INJECTION_ATTEMPTS = "prompt_injection_attempts"
    PII_SUBMISSION = "pii_submission"
    HARMFUL_CONTENT_REQUESTS = "harmful_content_requests"
    
    # Usage patterns
    EXCESSIVE_REQUESTS = "excessive_requests"
    UNUSUAL_HOURS = "unusual_hours"
    RAPID_FIRE_REQUESTS = "rapid_fire_requests"
    LONG_SESSIONS = "long_sessions"
    
    # Evasion attempts
    FILTER_CIRCUMVENTION = "filter_circumvention"
    MULTIPLE_ACCOUNTS_SUSPECTED = "multiple_accounts_suspected"
    VPN_OR_PROXY = "vpn_or_proxy"
    
    # Positive signals
    VERIFIED_USER = "verified_user"
    LONG_STANDING_ACCOUNT = "long_standing_account"
    GOOD_STANDING = "good_standing"


@dataclass
class BehaviorEvent:
    """Single behavior event."""
    
    timestamp: float
    event_type: str
    severity: int  # 0-10
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class UserProfile:
    """User behavior profile."""
    
    user_id: str
    risk_level: UserRiskLevel = UserRiskLevel.LOW
    flags: List[UserBehaviorFlags] = field(default_factory=list)
    
    # Counters
    total_requests: int = 0
    blocked_requests: int = 0
    injection_attempts: int = 0
    filter_violations: int = 0
    
    # Session info
    first_seen: float = 0.0
    last_seen: float = 0.0
    session_count: int = 0
    
    # Recent events (circular buffer)
    recent_events: Deque[BehaviorEvent] = field(default_factory=lambda: deque(maxlen=100))
    
    # Risk score (0-100)
    risk_score: float = 0.0
    
    def add_event(self, event_type: str, severity: int, details: Optional[Dict[str, Any]] = None) -> None:
        """Add a behavior event."""
        self.recent_events.append(BehaviorEvent(
            timestamp=time.time(),
            event_type=event_type,
            severity=severity,
            details=details or {},
        ))
    
    def get_recent_events(self, seconds: int = 3600) -> List[BehaviorEvent]:
        """Get events from the last N seconds."""
        cutoff = time.time() - seconds
        return [e for e in self.recent_events if e.timestamp > cutoff]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "user_id": self.user_id,
            "risk_level": self.risk_level.value,
            "flags": [f.value for f in self.flags],
            "total_requests": self.total_requests,
            "blocked_requests": self.blocked_requests,
            "injection_attempts": self.injection_attempts,
            "filter_violations": self.filter_violations,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "session_count": self.session_count,
            "risk_score": self.risk_score,
            "recent_event_count": len(self.recent_events),
        }


class UserMonitor:
    """Monitors user behavior for safety concerns.
    
    Tracks user activity patterns and maintains risk profiles
    to identify potentially abusive users.
    
    Example:
        >>> monitor = UserMonitor()
        >>> await monitor.record_request("user123", was_blocked=False)
        >>> await monitor.record_injection_attempt("user123")
        >>> profile = await monitor.get_profile("user123")
        >>> if profile.risk_level == UserRiskLevel.HIGH:
        ...     # Apply additional restrictions
    """
    
    # Risk score thresholds
    MEDIUM_RISK_THRESHOLD = 25
    HIGH_RISK_THRESHOLD = 50
    CRITICAL_RISK_THRESHOLD = 75
    
    # Event severity weights
    SEVERITY_WEIGHTS = {
        "request": 0,
        "blocked_content": 5,
        "injection_attempt": 15,
        "filter_circumvention": 20,
        "pii_submission": 3,
        "harmful_request": 10,
        "rapid_fire": 5,
    }
    
    def __init__(
        self,
        risk_decay_rate: float = 0.1,  # Points per hour
        event_retention_hours: int = 24,
        auto_block_threshold: int = 100,
    ):
        """Initialize user monitor.
        
        Args:
            risk_decay_rate: How fast risk score decays per hour.
            event_retention_hours: How long to keep events.
            auto_block_threshold: Risk score that triggers auto-block.
        """
        self.risk_decay_rate = risk_decay_rate
        self.event_retention_hours = event_retention_hours
        self.auto_block_threshold = auto_block_threshold
        self._profiles: Dict[str, UserProfile] = {}
    
    async def get_profile(self, user_id: str) -> UserProfile:
        """Get or create user profile.
        
        Args:
            user_id: User identifier.
        
        Returns:
            User's behavior profile.
        """
        if user_id not in self._profiles:
            now = time.time()
            self._profiles[user_id] = UserProfile(
                user_id=user_id,
                first_seen=now,
                last_seen=now,
            )
        
        profile = self._profiles[user_id]
        self._apply_risk_decay(profile)
        self._update_risk_level(profile)
        
        return profile
    
    async def record_request(
        self,
        user_id: str,
        was_blocked: bool = False,
        block_reason: str = "",
        tokens_used: int = 0,
    ) -> UserProfile:
        """Record a request from a user.
        
        Args:
            user_id: User identifier.
            was_blocked: Whether the request was blocked.
            block_reason: Reason for blocking (if blocked).
            tokens_used: Tokens consumed.
        
        Returns:
            Updated user profile.
        """
        profile = await self.get_profile(user_id)
        now = time.time()
        
        profile.total_requests += 1
        profile.last_seen = now
        
        if was_blocked:
            profile.blocked_requests += 1
            profile.filter_violations += 1
            profile.add_event("blocked_content", severity=5, details={"reason": block_reason})
            profile.risk_score += self.SEVERITY_WEIGHTS["blocked_content"]
            
            if UserBehaviorFlags.REPEATED_BLOCKED_CONTENT not in profile.flags:
                if profile.blocked_requests >= 3:
                    profile.flags.append(UserBehaviorFlags.REPEATED_BLOCKED_CONTENT)
        else:
            profile.add_event("request", severity=0, details={"tokens": tokens_used})
        
        # Check for rapid fire requests
        recent = profile.get_recent_events(60)  # Last minute
        if len(recent) > 30:
            if UserBehaviorFlags.RAPID_FIRE_REQUESTS not in profile.flags:
                profile.flags.append(UserBehaviorFlags.RAPID_FIRE_REQUESTS)
            profile.add_event("rapid_fire", severity=5)
            profile.risk_score += self.SEVERITY_WEIGHTS["rapid_fire"]
        
        self._update_risk_level(profile)
        return profile
    
    async def record_injection_attempt(
        self,
        user_id: str,
        injection_type: str = "",
        content_sample: str = "",
    ) -> UserProfile:
        """Record a prompt injection attempt.
        
        Args:
            user_id: User identifier.
            injection_type: Type of injection detected.
            content_sample: Sample of the content (truncated).
        
        Returns:
            Updated user profile.
        """
        profile = await self.get_profile(user_id)
        
        profile.injection_attempts += 1
        profile.add_event("injection_attempt", severity=15, details={
            "type": injection_type,
            "sample": content_sample[:100] if content_sample else "",
        })
        profile.risk_score += self.SEVERITY_WEIGHTS["injection_attempt"]
        
        if UserBehaviorFlags.PROMPT_INJECTION_ATTEMPTS not in profile.flags:
            if profile.injection_attempts >= 2:
                profile.flags.append(UserBehaviorFlags.PROMPT_INJECTION_ATTEMPTS)
        
        self._update_risk_level(profile)
        
        logger.warning(
            f"Injection attempt recorded for {user_id}: "
            f"attempts={profile.injection_attempts}, risk={profile.risk_score:.1f}"
        )
        
        return profile
    
    async def record_filter_circumvention(
        self,
        user_id: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> UserProfile:
        """Record a filter circumvention attempt.
        
        Args:
            user_id: User identifier.
            details: Additional details about the attempt.
        
        Returns:
            Updated user profile.
        """
        profile = await self.get_profile(user_id)
        
        profile.add_event("filter_circumvention", severity=20, details=details or {})
        profile.risk_score += self.SEVERITY_WEIGHTS["filter_circumvention"]
        
        if UserBehaviorFlags.FILTER_CIRCUMVENTION not in profile.flags:
            profile.flags.append(UserBehaviorFlags.FILTER_CIRCUMVENTION)
        
        self._update_risk_level(profile)
        
        logger.warning(
            f"Filter circumvention by {user_id}: risk={profile.risk_score:.1f}"
        )
        
        return profile
    
    async def add_positive_flag(
        self,
        user_id: str,
        flag: UserBehaviorFlags,
    ) -> UserProfile:
        """Add a positive behavior flag.
        
        Args:
            user_id: User identifier.
            flag: Positive flag to add.
        
        Returns:
            Updated user profile.
        """
        profile = await self.get_profile(user_id)
        
        positive_flags = [
            UserBehaviorFlags.VERIFIED_USER,
            UserBehaviorFlags.LONG_STANDING_ACCOUNT,
            UserBehaviorFlags.GOOD_STANDING,
        ]
        
        if flag in positive_flags and flag not in profile.flags:
            profile.flags.append(flag)
            # Positive flags reduce risk score
            profile.risk_score = max(0, profile.risk_score - 10)
        
        self._update_risk_level(profile)
        return profile
    
    async def block_user(
        self,
        user_id: str,
        reason: str = "",
    ) -> UserProfile:
        """Block a user.
        
        Args:
            user_id: User identifier.
            reason: Reason for blocking.
        
        Returns:
            Updated user profile.
        """
        profile = await self.get_profile(user_id)
        
        profile.risk_level = UserRiskLevel.BLOCKED
        profile.add_event("blocked", severity=10, details={"reason": reason})
        
        logger.warning(f"User {user_id} blocked: {reason}")
        
        return profile
    
    async def unblock_user(self, user_id: str) -> UserProfile:
        """Unblock a user and reset their risk.
        
        Args:
            user_id: User identifier.
        
        Returns:
            Updated user profile.
        """
        profile = await self.get_profile(user_id)
        
        profile.risk_level = UserRiskLevel.MEDIUM
        profile.risk_score = self.MEDIUM_RISK_THRESHOLD  # Start at medium, not low
        profile.add_event("unblocked", severity=0)
        
        logger.info(f"User {user_id} unblocked")
        
        return profile
    
    async def get_high_risk_users(self) -> List[UserProfile]:
        """Get all high-risk or above users.
        
        Returns:
            List of high-risk user profiles.
        """
        high_risk = []
        for profile in self._profiles.values():
            self._apply_risk_decay(profile)
            self._update_risk_level(profile)
            if profile.risk_level in (UserRiskLevel.HIGH, UserRiskLevel.CRITICAL, UserRiskLevel.BLOCKED):
                high_risk.append(profile)
        
        return sorted(high_risk, key=lambda p: p.risk_score, reverse=True)
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get monitoring statistics.
        
        Returns:
            Dictionary with stats.
        """
        risk_counts = {level.value: 0 for level in UserRiskLevel}
        total_requests = 0
        total_blocked = 0
        total_injections = 0
        
        for profile in self._profiles.values():
            self._apply_risk_decay(profile)
            self._update_risk_level(profile)
            risk_counts[profile.risk_level.value] += 1
            total_requests += profile.total_requests
            total_blocked += profile.blocked_requests
            total_injections += profile.injection_attempts
        
        return {
            "total_users": len(self._profiles),
            "risk_distribution": risk_counts,
            "total_requests": total_requests,
            "total_blocked": total_blocked,
            "total_injections": total_injections,
            "block_rate": total_blocked / total_requests if total_requests > 0 else 0,
        }
    
    def _apply_risk_decay(self, profile: UserProfile) -> None:
        """Apply time-based risk decay."""
        if profile.risk_level == UserRiskLevel.BLOCKED:
            return  # Blocked users don't decay
        
        hours_since_last = (time.time() - profile.last_seen) / 3600
        decay = hours_since_last * self.risk_decay_rate
        profile.risk_score = max(0, profile.risk_score - decay)
    
    def _update_risk_level(self, profile: UserProfile) -> None:
        """Update risk level based on score."""
        if profile.risk_level == UserRiskLevel.BLOCKED:
            return  # Manual unblock required
        
        # Check for auto-block
        if profile.risk_score >= self.auto_block_threshold:
            profile.risk_level = UserRiskLevel.BLOCKED
            logger.warning(f"User {profile.user_id} auto-blocked: score={profile.risk_score:.1f}")
            return
        
        # Update based on score thresholds
        if profile.risk_score >= self.CRITICAL_RISK_THRESHOLD:
            profile.risk_level = UserRiskLevel.CRITICAL
        elif profile.risk_score >= self.HIGH_RISK_THRESHOLD:
            profile.risk_level = UserRiskLevel.HIGH
        elif profile.risk_score >= self.MEDIUM_RISK_THRESHOLD:
            profile.risk_level = UserRiskLevel.MEDIUM
        else:
            profile.risk_level = UserRiskLevel.LOW
