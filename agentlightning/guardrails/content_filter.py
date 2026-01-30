# Copyright (c) Microsoft. All rights reserved.
# Extended by G-Rump team for content safety filtering.

"""Content filtering for AI agent inputs and outputs.

Provides multi-level content filtering to detect and block:
- Hate speech and harassment
- Violence and self-harm content
- Sexual content
- Illegal activities
- PII (Personally Identifiable Information)
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Pattern, Set, Tuple

logger = logging.getLogger(__name__)


class FilterLevel(Enum):
    """Content filter severity levels."""
    
    ALLOW = "allow"           # Content is safe
    WARN = "warn"             # Content is borderline, log warning
    BLOCK_SOFT = "block_soft" # Block but allow override
    BLOCK_HARD = "block_hard" # Always block, no override


@dataclass
class ContentFilterResult:
    """Result of content filtering operation."""
    
    level: FilterLevel
    categories: List[str] = field(default_factory=list)
    matched_patterns: List[str] = field(default_factory=list)
    confidence: float = 1.0
    message: str = ""
    sanitized_content: Optional[str] = None
    
    @property
    def is_blocked(self) -> bool:
        """Check if content should be blocked."""
        return self.level in (FilterLevel.BLOCK_SOFT, FilterLevel.BLOCK_HARD)
    
    @property
    def is_hard_blocked(self) -> bool:
        """Check if content is hard-blocked (no override)."""
        return self.level == FilterLevel.BLOCK_HARD
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/API responses."""
        return {
            "level": self.level.value,
            "categories": self.categories,
            "matched_patterns": self.matched_patterns,
            "confidence": self.confidence,
            "message": self.message,
            "is_blocked": self.is_blocked,
        }


class ContentFilter:
    """Multi-category content filter for AI safety.
    
    This filter checks content against multiple categories of harmful content
    and returns a filtering decision with confidence scores.
    
    Example:
        >>> filter = ContentFilter()
        >>> result = filter.check("How do I make a bomb?")
        >>> if result.is_blocked:
        ...     print(f"Blocked: {result.message}")
    """
    
    # Harmful content patterns (simplified - in production use ML models)
    VIOLENCE_PATTERNS: List[Pattern[str]] = [
        re.compile(r"\b(kill|murder|assassinate|bomb|explode|attack)\b.*\b(people|person|someone|them)\b", re.I),
        re.compile(r"\bhow\s+to\s+(make|build|create)\s+(a\s+)?(bomb|weapon|explosive)\b", re.I),
        re.compile(r"\b(hurt|harm|injure)\s+(myself|yourself|themselves)\b", re.I),
    ]
    
    HATE_PATTERNS: List[Pattern[str]] = [
        re.compile(r"\b(hate|kill|destroy)\s+all\s+\w+\b", re.I),
        re.compile(r"\b(racial|ethnic)\s+slurs?\b", re.I),
    ]
    
    ILLEGAL_PATTERNS: List[Pattern[str]] = [
        re.compile(r"\bhow\s+to\s+(hack|crack|break\s+into)\b", re.I),
        re.compile(r"\b(steal|fraud|scam)\s+(money|credit|identity)\b", re.I),
        re.compile(r"\b(buy|sell|make)\s+(drugs|meth|cocaine|heroin)\b", re.I),
    ]
    
    PII_PATTERNS: List[Pattern[str]] = [
        re.compile(r"\b\d{3}[-.]?\d{2}[-.]?\d{4}\b"),  # SSN
        re.compile(r"\b\d{16}\b"),  # Credit card (basic)
        re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),  # Email
    ]
    
    PROMPT_INJECTION_PATTERNS: List[Pattern[str]] = [
        re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions", re.I),
        re.compile(r"disregard\s+(all\s+)?(previous|prior|above)", re.I),
        re.compile(r"you\s+are\s+now\s+[a-z]+\s+(mode|persona)", re.I),
        re.compile(r"forget\s+(everything|all|your\s+instructions)", re.I),
        re.compile(r"new\s+instructions?:\s*", re.I),
        re.compile(r"system\s*:\s*you\s+are", re.I),
        re.compile(r"\[system\]|\[assistant\]|\[user\]", re.I),
    ]
    
    def __init__(
        self,
        enable_violence_filter: bool = True,
        enable_hate_filter: bool = True,
        enable_illegal_filter: bool = True,
        enable_pii_filter: bool = True,
        enable_injection_filter: bool = True,
        custom_patterns: Optional[Dict[str, List[Pattern[str]]]] = None,
        custom_blocklist: Optional[Set[str]] = None,
    ):
        """Initialize the content filter.
        
        Args:
            enable_violence_filter: Enable violence/self-harm detection.
            enable_hate_filter: Enable hate speech detection.
            enable_illegal_filter: Enable illegal activity detection.
            enable_pii_filter: Enable PII detection.
            enable_injection_filter: Enable prompt injection detection.
            custom_patterns: Additional regex patterns by category.
            custom_blocklist: Set of exact-match blocked terms.
        """
        self.enable_violence_filter = enable_violence_filter
        self.enable_hate_filter = enable_hate_filter
        self.enable_illegal_filter = enable_illegal_filter
        self.enable_pii_filter = enable_pii_filter
        self.enable_injection_filter = enable_injection_filter
        self.custom_patterns = custom_patterns or {}
        self.custom_blocklist = custom_blocklist or set()
        
        self._stats = {
            "total_checks": 0,
            "blocked": 0,
            "warned": 0,
            "allowed": 0,
        }
    
    def check(self, content: str, context: Optional[Dict[str, Any]] = None) -> ContentFilterResult:
        """Check content against all enabled filters.
        
        Args:
            content: The text content to check.
            context: Optional context (user_id, session_id, etc.).
        
        Returns:
            ContentFilterResult with filtering decision.
        """
        self._stats["total_checks"] += 1
        
        if not content or not content.strip():
            return ContentFilterResult(level=FilterLevel.ALLOW)
        
        categories: List[str] = []
        matched_patterns: List[str] = []
        highest_level = FilterLevel.ALLOW
        
        # Check blocklist first
        content_lower = content.lower()
        for blocked_term in self.custom_blocklist:
            if blocked_term.lower() in content_lower:
                categories.append("blocklist")
                matched_patterns.append(blocked_term)
                highest_level = FilterLevel.BLOCK_HARD
        
        # Check each category
        checks: List[Tuple[bool, str, List[Pattern[str]], FilterLevel]] = [
            (self.enable_violence_filter, "violence", self.VIOLENCE_PATTERNS, FilterLevel.BLOCK_HARD),
            (self.enable_hate_filter, "hate_speech", self.HATE_PATTERNS, FilterLevel.BLOCK_HARD),
            (self.enable_illegal_filter, "illegal_activity", self.ILLEGAL_PATTERNS, FilterLevel.BLOCK_SOFT),
            (self.enable_pii_filter, "pii_detected", self.PII_PATTERNS, FilterLevel.WARN),
            (self.enable_injection_filter, "prompt_injection", self.PROMPT_INJECTION_PATTERNS, FilterLevel.BLOCK_HARD),
        ]
        
        for enabled, category, patterns, level in checks:
            if not enabled:
                continue
            
            for pattern in patterns:
                match = pattern.search(content)
                if match:
                    categories.append(category)
                    matched_patterns.append(match.group())
                    if level.value > highest_level.value or highest_level == FilterLevel.ALLOW:
                        highest_level = level
                    break  # One match per category is enough
        
        # Check custom patterns
        for category, patterns in self.custom_patterns.items():
            for pattern in patterns:
                match = pattern.search(content)
                if match:
                    categories.append(f"custom:{category}")
                    matched_patterns.append(match.group())
                    if highest_level == FilterLevel.ALLOW:
                        highest_level = FilterLevel.WARN
        
        # Generate result message
        message = ""
        if highest_level == FilterLevel.BLOCK_HARD:
            message = f"Content blocked (hard): {', '.join(categories)}"
            self._stats["blocked"] += 1
        elif highest_level == FilterLevel.BLOCK_SOFT:
            message = f"Content blocked (soft): {', '.join(categories)}"
            self._stats["blocked"] += 1
        elif highest_level == FilterLevel.WARN:
            message = f"Content warning: {', '.join(categories)}"
            self._stats["warned"] += 1
        else:
            self._stats["allowed"] += 1
        
        result = ContentFilterResult(
            level=highest_level,
            categories=categories,
            matched_patterns=matched_patterns,
            confidence=0.85 if categories else 1.0,  # Lower confidence for pattern matches
            message=message,
        )
        
        # Log blocked content for review
        if result.is_blocked:
            user_id = context.get("user_id", "unknown") if context else "unknown"
            logger.warning(
                f"ContentFilter blocked content from user {user_id}: "
                f"categories={categories}, level={highest_level.value}"
            )
        
        return result
    
    def sanitize_pii(self, content: str) -> str:
        """Remove or mask PII from content.
        
        Args:
            content: Text that may contain PII.
        
        Returns:
            Content with PII masked.
        """
        result = content
        
        # Mask SSN
        result = re.sub(r"\b\d{3}[-.]?\d{2}[-.]?\d{4}\b", "[SSN REDACTED]", result)
        
        # Mask credit card
        result = re.sub(r"\b\d{16}\b", "[CC REDACTED]", result)
        
        # Mask email
        result = re.sub(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            "[EMAIL REDACTED]",
            result
        )
        
        return result
    
    def get_stats(self) -> Dict[str, int]:
        """Get filtering statistics."""
        return dict(self._stats)
    
    def reset_stats(self) -> None:
        """Reset filtering statistics."""
        self._stats = {
            "total_checks": 0,
            "blocked": 0,
            "warned": 0,
            "allowed": 0,
        }
