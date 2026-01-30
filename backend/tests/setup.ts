/**
 * Vitest setup: set env required by services that check at import time.
 * Run before any test file so process.exit(1) is not triggered.
 * 
 * Note: The env.ts validation skips API key requirement when NODE_ENV=test,
 * but we still set these for any legacy code that might check directly.
 */
if (!process.env.NVIDIA_NIM_API_KEY && !process.env.OPENROUTER_API_KEY) {
  process.env.NVIDIA_NIM_API_KEY = 'test_key_for_unit_tests';
}
