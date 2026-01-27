/**
 * Vitest setup: set env required by services that check at import time.
 * Run before any test file so process.exit(1) is not triggered.
 */
if (!process.env.ANTHROPIC_API_KEY) {
  process.env.ANTHROPIC_API_KEY = 'test_key_for_unit_tests';
}
