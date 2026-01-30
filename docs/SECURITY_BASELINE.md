# Security Baseline (G-Rump)

This document defines the minimum security posture for production deployments of G-Rump.
It is enforced when `NODE_ENV=production` and `SECURITY_STRICT_PROD=true`.

## Core Principles

- **Zero trust by default**: Require auth for all high-cost endpoints.
- **Least privilege**: Restrict hosts, CORS, and file scan roots.
- **Data minimization**: Redact secrets and PII in outputs.
- **Defense in depth**: Rate limiting, validation, and allowlists.

## Required Production Controls

Set these in production before exposing the API to untrusted users:

- `SECURITY_STRICT_PROD=true`
- `CORS_ORIGINS` set to exact frontend origins (no wildcards)
- `ALLOWED_HOSTS` set to your production hostnames (comma-separated)
- `BLOCK_SUSPICIOUS_PROMPTS=true`
- `REQUIRE_AUTH_FOR_API=true`
- `OUTPUT_FILTER_PII=true`
- `OUTPUT_FILTER_HARMFUL=true`
- `STRICT_COMMAND_ALLOWLIST=true`
- `SECURITY_SCAN_ROOT=/absolute/path/to/allowed/root`
- `METRICS_AUTH=user:password` (Basic auth for `/metrics`)

## Recommended Controls

- Use Redis for shared rate limiting in production.
- Store secrets in your host's secret manager (never in `.env` committed to git).
- Use HTTPS-only in production (terminate TLS at your edge or platform).
- Restrict `/metrics` via firewall or VPC in addition to Basic auth.
- Configure frontend auth storage via `VITE_AUTH_STORAGE` (e.g., `session`) so access tokens are scoped to a browser session instead of living in long-running local storage.

## High-Risk Features

The following features should be enabled only if you have the appropriate secrets
and access controls in place:

- Webhooks (`/api/webhooks/*`)
- Messaging (Twilio inbound)
- Billing (Stripe)
- Security scans (filesystem access)

## Incident Response

If you suspect a security incident:

1. Rotate API keys and webhook secrets.
2. Disable external integrations.
3. Review logs and access patterns.
4. Notify users if their data may be impacted.

For disclosure details, see `SECURITY.md`.
