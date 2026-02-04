#!/usr/bin/env node
/**
 * check-release-env.js
 * Warns when NODE_ENV=production but required production env vars are missing.
 * Run from repo root: node scripts/check-release-env.js
 * Optional: use before deploy or in CI to catch config gaps.
 */

const path = require('path');
const fs = require('fs');

// Load backend/.env if present
const envPath = path.resolve(process.cwd(), 'backend', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match && !process.env[match[1]]) {
      const value = match[2].replace(/^["']|["']$/g, '').trim();
      if (value !== '') process.env[match[1]] = value;
    }
  });
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

let hasError = false;

function warn(msg) {
  console.warn('[check-release-env]', msg);
}

function fail(msg) {
  console.error('[check-release-env] ERROR:', msg);
  hasError = true;
}

if (!isProd) {
  console.log('[check-release-env] NODE_ENV is not production; skipping production checks.');
  process.exit(0);
}

// Production checklist (from PRODUCTION.md)
if (!process.env.CORS_ORIGINS) {
  fail('CORS_ORIGINS is not set. Set to exact origins (no wildcards) for production.');
} else if (process.env.CORS_ORIGINS.includes('*')) {
  fail('CORS_ORIGINS must not contain * in production.');
}

if (process.env.BLOCK_SUSPICIOUS_PROMPTS !== 'true') {
  warn('BLOCK_SUSPICIOUS_PROMPTS is not true. Recommended for production when API is reachable by untrusted users.');
}

if (process.env.SECURITY_STRICT_PROD === 'true' && !process.env.ALLOWED_HOSTS) {
  fail('SECURITY_STRICT_PROD is true but ALLOWED_HOSTS is not set.');
}

if (process.env.REQUIRE_AUTH_FOR_API !== 'true') {
  warn('REQUIRE_AUTH_FOR_API is not true. Consider enabling if the backend is public.');
}

// At least one AI provider
if (!process.env.NVIDIA_NIM_API_KEY && !process.env.OPENROUTER_API_KEY) {
  warn('Neither NVIDIA_NIM_API_KEY nor OPENROUTER_API_KEY is set; AI features may fail.');
}

if (hasError) {
  process.exit(1);
}
console.log('[check-release-env] Production env checks passed (with optional warnings above).');
process.exit(0);
