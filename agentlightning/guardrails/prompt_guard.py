# Copyright (c) Microsoft. All rights reserved.
# Extended by G-Rump team for prompt injection protection.

"""Prompt injection detection and prevention.

Detects and blocks prompt injection attacks including:
- Direct injection attempts
- Jailbreaking prompts
- Role hijacking attempts
- Instruction override attacks
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Pattern, Tuple

logger = logging.getLogger(__name__)


class InjectionType(Enum):
    """Types of prompt injection attacks."""
    
    DIRECT_INJECTION = "direct_injection"  # Explicit instruction override
    ROLE_HIJACK = "role_hijack"            # Attempt to change AI persona
    JAILBREAK = "jailbreak"                # Bypass safety guidelines
    CONTEXT_MANIPULATION = "context_manipulation"  # Fake system messages
    DATA_EXFILTRATION = "data_exfiltration"  # Extract system prompts


@dataclass
class InjectionDetectionResult:
    """Result of injection detection."""
    
    is_injection: bool
    injection_type: Optional[InjectionType] = None
    confidence: float = 0.0
    matched_pattern: str = ""
    explanation: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "is_injection": self.is_injection,
            "injection_type": self.injection_type.value if self.injection_type else None,
            "confidence": self.confidence,
            "matched_pattern": self.matched_pattern,
            "explanation": self.explanation,
        }


class InjectionDetector:
    """Detects prompt injection attempts.
    
    Uses pattern matching and heuristics to identify common
    prompt injection techniques.
    """
    
    # Pattern definitions with (pattern, type, confidence, description)
    INJECTION_PATTERNS: List[Tuple[Pattern[str], InjectionType, float, str]] = [
        # Direct injection
        (re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)", re.I),
         InjectionType.DIRECT_INJECTION, 0.95, "Ignore previous instructions"),
        (re.compile(r"disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|guidelines?)", re.I),
         InjectionType.DIRECT_INJECTION, 0.95, "Disregard instructions"),
        (re.compile(r"forget\s+(everything|all|your)\s+(instructions?|training|rules?)", re.I),
         InjectionType.DIRECT_INJECTION, 0.90, "Forget instructions"),
        (re.compile(r"new\s+(system\s+)?instructions?:\s*", re.I),
         InjectionType.DIRECT_INJECTION, 0.85, "New instructions marker"),
        (re.compile(r"override\s+(all\s+)?(safety|security|content)\s+(filters?|checks?)", re.I),
         InjectionType.DIRECT_INJECTION, 0.95, "Override safety filters"),
        
        # Role hijacking
        (re.compile(r"you\s+are\s+(now|no\s+longer)\s+(a|an)?\s*\w+\s*(mode|persona|character)?", re.I),
         InjectionType.ROLE_HIJACK, 0.85, "Role change attempt"),
        (re.compile(r"pretend\s+(you\s+are|to\s+be)\s+(a|an)?\s*\w+", re.I),
         InjectionType.ROLE_HIJACK, 0.75, "Pretend to be"),
        (re.compile(r"act\s+as\s+(if\s+you\s+are\s+)?(a|an)?\s*\w+\s*(without|with\s+no)\s*(restrictions?|limits?)", re.I),
         InjectionType.ROLE_HIJACK, 0.90, "Act without restrictions"),
        (re.compile(r"roleplay\s+as\s+(a|an)?\s*\w+\s*(that|who)\s*(can|will|does)", re.I),
         InjectionType.ROLE_HIJACK, 0.80, "Roleplay with capabilities"),
        
        # Jailbreak attempts  
        (re.compile(r"(DAN|do\s+anything\s+now)\s*(mode|prompt)?", re.I),
         InjectionType.JAILBREAK, 0.95, "DAN jailbreak"),
        (re.compile(r"(developer|debug|admin|god)\s+mode", re.I),
         InjectionType.JAILBREAK, 0.90, "Special mode request"),
        (re.compile(r"bypass\s+(all\s+)?(safety|security|ethical|content)\s*(guidelines?|filters?|restrictions?)?", re.I),
         InjectionType.JAILBREAK, 0.95, "Bypass safety"),
        (re.compile(r"(hypothetically|theoretically|in\s+fiction)\s*[,:]?\s*(how|what)\s+(would|could|can)", re.I),
         InjectionType.JAILBREAK, 0.60, "Hypothetical framing"),
        (re.compile(r"for\s+(educational|research|academic)\s+purposes?\s*[,:]?\s*(how|explain)", re.I),
         InjectionType.JAILBREAK, 0.55, "Educational framing"),
        
        # Context manipulation
        (re.compile(r"\[system\]|\[assistant\]|\[user\]|\[human\]", re.I),
         InjectionType.CONTEXT_MANIPULATION, 0.90, "Fake role markers"),
        (re.compile(r"<\|?(system|assistant|user|human)\|?>", re.I),
         InjectionType.CONTEXT_MANIPULATION, 0.90, "Fake role delimiters"),
        (re.compile(r"```(system|prompt|instructions?)\n", re.I),
         InjectionType.CONTEXT_MANIPULATION, 0.80, "Code block injection"),
        (re.compile(r"end\s+of\s+(system|user)\s+(prompt|message|input)", re.I),
         InjectionType.CONTEXT_MANIPULATION, 0.85, "Fake message boundary"),
        
        # Data exfiltration
        (re.compile(r"(repeat|show|reveal|print)\s+(your\s+)?(system\s+)?(prompt|instructions?|guidelines?)", re.I),
         InjectionType.DATA_EXFILTRATION, 0.85, "Reveal system prompt"),
        (re.compile(r"what\s+(are|were)\s+(your|the)\s+(original\s+)?(instructions?|prompt|guidelines?)", re.I),
         InjectionType.DATA_EXFILTRATION, 0.80, "Query instructions"),
        (re.compile(r"(output|display|echo)\s+(the\s+)?(entire|full|complete)\s+(context|prompt|instructions?)", re.I),
         InjectionType.DATA_EXFILTRATION, 0.90, "Output full context"),
    ]
    
    def __init__(
        self,
        sensitivity: float = 0.7,
        enable_heuristics: bool = True,
    ):
        """Initialize the injection detector.
        
        Args:
            sensitivity: Minimum confidence threshold (0.0-1.0).
            enable_heuristics: Enable additional heuristic checks.
        """
        self.sensitivity = sensitivity
        self.enable_heuristics = enable_heuristics
        self._detection_count = 0
    
    def detect(self, content: str, context: Optional[Dict[str, Any]] = None) -> InjectionDetectionResult:
        """Detect prompt injection in content.
        
        Args:
            content: User input to check.
            context: Optional context (previous messages, etc.).
        
        Returns:
            InjectionDetectionResult with detection details.
        """
        if not content or not content.strip():
            return InjectionDetectionResult(is_injection=False)
        
        # Check all patterns
        for pattern, injection_type, confidence, description in self.INJECTION_PATTERNS:
            match = pattern.search(content)
            if match and confidence >= self.sensitivity:
                self._detection_count += 1
                logger.warning(
                    f"Injection detected: type={injection_type.value}, "
                    f"confidence={confidence:.2f}, pattern='{match.group()}'"
                )
                return InjectionDetectionResult(
                    is_injection=True,
                    injection_type=injection_type,
                    confidence=confidence,
                    matched_pattern=match.group(),
                    explanation=description,
                )
        
        # Heuristic checks
        if self.enable_heuristics:
            heuristic_result = self._check_heuristics(content)
            if heuristic_result.is_injection:
                return heuristic_result
        
        return InjectionDetectionResult(is_injection=False, confidence=1.0 - self.sensitivity)
    
    def _check_heuristics(self, content: str) -> InjectionDetectionResult:
        """Apply heuristic checks for injection detection.
        
        Args:
            content: Text to analyze.
        
        Returns:
            Detection result from heuristics.
        """
        # Unusual character patterns that might indicate injection
        suspicious_chars = content.count("```") + content.count("'''")
        if suspicious_chars > 2:
            return InjectionDetectionResult(
                is_injection=True,
                injection_type=InjectionType.CONTEXT_MANIPULATION,
                confidence=0.70,
                matched_pattern=f"{suspicious_chars} code blocks",
                explanation="Excessive code block markers",
            )
        
        # Very long inputs with instruction-like language
        if len(content) > 2000:
            instruction_words = len(re.findall(r"\b(must|always|never|should|shall|will)\b", content, re.I))
            if instruction_words > 10:
                return InjectionDetectionResult(
                    is_injection=True,
                    injection_type=InjectionType.DIRECT_INJECTION,
                    confidence=0.65,
                    matched_pattern=f"{instruction_words} instruction words",
                    explanation="Long input with many instruction words",
                )
        
        return InjectionDetectionResult(is_injection=False)
    
    @property
    def detection_count(self) -> int:
        """Get total number of injections detected."""
        return self._detection_count


class PromptGuard:
    """High-level prompt security guard.
    
    Combines injection detection with input sanitization
    and provides a simple API for prompt protection.
    """
    
    def __init__(
        self,
        detector: Optional[InjectionDetector] = None,
        max_input_length: int = 10000,
        strip_special_tokens: bool = True,
    ):
        """Initialize prompt guard.
        
        Args:
            detector: Injection detector to use.
            max_input_length: Maximum allowed input length.
            strip_special_tokens: Remove potential role-hijacking tokens.
        """
        self.detector = detector or InjectionDetector()
        self.max_input_length = max_input_length
        self.strip_special_tokens = strip_special_tokens
    
    def protect(self, user_input: str, context: Optional[Dict[str, Any]] = None) -> Tuple[bool, str, Optional[str]]:
        """Check and sanitize user input.
        
        Args:
            user_input: Raw user input.
            context: Optional context for detection.
        
        Returns:
            Tuple of (is_safe, sanitized_input, error_message).
            If is_safe is False, error_message explains why.
        """
        # Length check
        if len(user_input) > self.max_input_length:
            return False, "", f"Input too long ({len(user_input)} > {self.max_input_length})"
        
        # Injection detection
        result = self.detector.detect(user_input, context)
        if result.is_injection:
            return False, "", f"Potential {result.injection_type.value}: {result.explanation}"
        
        # Sanitize
        sanitized = self.sanitize(user_input)
        
        return True, sanitized, None
    
    def sanitize(self, content: str) -> str:
        """Sanitize input while preserving legitimate content.
        
        Args:
            content: Raw input text.
        
        Returns:
            Sanitized text.
        """
        result = content
        
        if self.strip_special_tokens:
            # Remove common injection markers
            result = re.sub(r"\[/?system\]", "", result, flags=re.I)
            result = re.sub(r"\[/?assistant\]", "", result, flags=re.I)
            result = re.sub(r"\[/?user\]", "", result, flags=re.I)
            result = re.sub(r"<\|?(system|assistant|user|human)\|?>", "", result, flags=re.I)
        
        # Normalize whitespace
        result = re.sub(r"\n{3,}", "\n\n", result)
        result = result.strip()
        
        return result
