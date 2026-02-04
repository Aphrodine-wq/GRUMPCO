/**
 * Output filters – redact secrets, optional PII, and flag harmful code before streaming/storing.
 * Used in chat stream (text deltas, tool results).
 */

const REDACTED = "[REDACTED]";

// Common secret patterns (heuristic; may have false positives)
const SECRET_PATTERNS: Array<{ pattern: RegExp; replace: string }> = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replace: REDACTED },
  { pattern: /sk-ant-[a-zA-Z0-9-]{10,}/g, replace: REDACTED },
  {
    pattern: /api[_-]?key['"]?\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}/gi,
    replace: `api_key=${REDACTED}`,
  },
  { pattern: /bearer\s+[a-zA-Z0-9_.-]{20,}/gi, replace: `Bearer ${REDACTED}` },
  {
    pattern: /['"]?password['"]?\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi,
    replace: `password=${REDACTED}`,
  },
  {
    pattern: /['"]?secret['"]?\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi,
    replace: `secret=${REDACTED}`,
  },
  {
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    replace: REDACTED,
  },
];

// Optional PII patterns
const PII_PATTERNS: Array<{ pattern: RegExp; replace: string }> = [
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replace: "[EMAIL]",
  },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replace: "[SSN]" },
];

// Harmful code patterns – conservative; we flag but don't strip by default
const HARMFUL_PATTERNS: RegExp[] = [
  /\brm\s+-rf\s+\/(?:\s|$)/,
  /\beval\s*\(\s*['"`]/,
  /child_process\.exec\s*\(\s*['"`].*['"`]\s*\)/,
  /\b(?:curl|wget)\s+.*\|\s*sh\s*(?:\s|$)/,
];

function applyPatterns(
  text: string,
  patterns: Array<{ pattern: RegExp; replace: string }>,
): string {
  let out = text;
  for (const { pattern, replace } of patterns) {
    out = out.replace(pattern, replace);
  }
  return out;
}

/**
 * Redact likely secrets (API keys, tokens, passwords, private keys) in text.
 */
export function redactSecrets(text: string): string {
  return applyPatterns(text, SECRET_PATTERNS);
}

/**
 * Redact PII (emails, SSN-like) when OUTPUT_FILTER_PII=true.
 */
export function redactPii(text: string): string {
  if (process.env.OUTPUT_FILTER_PII !== "true") return text;
  return applyPatterns(text, PII_PATTERNS);
}

/**
 * Check for harmful code patterns. When OUTPUT_FILTER_HARMFUL=true, returns { filtered, flagged }.
 * filtered: if flagged, suspicious substrings are replaced with [FLAGGED]; else unchanged.
 */
export function filterHarmfulCode(text: string): {
  filtered: string;
  flagged: boolean;
} {
  if (process.env.OUTPUT_FILTER_HARMFUL !== "true")
    return { filtered: text, flagged: false };
  let flagged = false;
  let out = text;
  for (const p of HARMFUL_PATTERNS) {
    const before = out;
    out = out.replace(p, () => "[FLAGGED]");
    if (out !== before) flagged = true;
  }
  return { filtered: out, flagged };
}

/**
 * Run all filters: secrets, PII, harmful. Use for assistant text and tool output before streaming.
 */
export function filterOutput(text: string): string {
  let out = redactSecrets(text);
  out = redactPii(out);
  const { filtered } = filterHarmfulCode(out);
  return filtered;
}
