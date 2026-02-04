# Security Guide

> **Version:** 2.1.0 | **Last Updated:** January 2026

This document covers security requirements, controls, and best practices for G-Rump deployments. Following these guidelines is essential for production environments.

## Security Philosophy

G-Rump handles sensitive operations: executing code, reading/writing files, making API calls. Our security approach is **defense in depth** — multiple layers of protection so that a failure in one layer doesn't compromise the system.

Key principles:
- **Least privilege** — Components only get the access they need
- **Secure by default** — Production settings are restrictive; you opt-in to openness
- **Fail closed** — When in doubt, deny access
- **Audit everything** — Log security-relevant events for review

---

## Quick Security Checklist

Before deploying to production, verify:

- [ ] All API keys and secrets are in environment variables (not in code)
- [ ] `NODE_ENV=production` is set
- [ ] HTTPS is enabled (no plain HTTP in production)
- [ ] `REQUIRE_AUTH_FOR_API=true` for authenticated endpoints
- [ ] `CORS_ORIGINS` is restricted to your domains
- [ ] Rate limiting is configured
- [ ] Webhook secrets are set (`GRUMP_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`)
- [ ] Metrics endpoint is protected (`METRICS_AUTH`)
- [ ] Security scanning is part of your CI pipeline

---

## Environment Variables

### Required for Production

| Variable | Purpose | Example |
|----------|---------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `NVIDIA_NIM_API_KEY` or `OPENROUTER_API_KEY` | AI provider credentials | `nvapi-xxx` |
| `SUPABASE_URL` | Auth provider URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase public key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key | `eyJ...` |

### Security Controls

| Variable | Purpose | Default |
|----------|---------|---------|
| `REQUIRE_AUTH_FOR_API` | Require auth for /api/* routes | `false` |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `*` (dev only) |
| `BLOCK_SUSPICIOUS_PROMPTS` | Block prompt injection attempts | `false` |
| `AGENT_ACCESS_POLICY` | How to handle AI agents | `block` |
| `AGENT_ALLOWLIST` | Allowed agent identifiers | — |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

### Secrets

| Variable | Purpose |
|----------|---------|
| `GRUMP_WEBHOOK_SECRET` | Webhook authentication |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `TWILIO_WEBHOOK_SECRET` | Twilio webhook verification |
| `METRICS_AUTH` | Basic auth for /metrics (format: `user:pass`) |
| `JWT_SECRET` | JWT signing key (if not using Supabase) |

---

## Authentication

G-Rump supports Supabase authentication out of the box.

### How It Works

1. Frontend authenticates via Supabase (email, OAuth, etc.)
2. Supabase returns a JWT token
3. Frontend includes token in `Authorization: Bearer <token>` header
4. Backend validates JWT with Supabase

### Enabling Auth Requirement

Set `REQUIRE_AUTH_FOR_API=true` to require authentication for:
- `/api/chat/*`
- `/api/ship/*`
- `/api/codegen/*`

Without this, these endpoints are accessible without auth (suitable for local dev only).

### Token Validation

The backend validates:
- Token signature (using Supabase public key)
- Token expiration
- User existence in Supabase

---

## Rate Limiting

Rate limiting prevents abuse and ensures fair resource usage.

### Default Limits

| Endpoint | Limit |
|----------|-------|
| `/api/chat/*` | 10 requests/minute |
| `/api/codegen/*` | 5 requests/minute |
| `/api/ship/*` | 5 requests/minute |
| `/api/*` (global) | 100 requests/minute |
| `/auth/*` | 20 requests/minute |

### Redis-Backed Rate Limiting

For multi-instance deployments, configure Redis:

```env
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=your-password
```

This shares rate limit state across all instances.

---

## Agent Governance

G-Rump includes protection against automated AI agents that might attempt to use the platform.

### How It Works

The `agentGovernance` middleware detects:
- Known agent user-agents (Moltbot, OpenClaw, Clawdbot)
- Agent-like request patterns
- Missing or suspicious headers

### Policies

Set via `AGENT_ACCESS_POLICY`:

| Policy | Behavior |
|--------|----------|
| `block` (default) | Reject all detected agents |
| `allowlist` | Only allow agents in `AGENT_ALLOWLIST` |
| `audit_only` | Log but allow (for testing) |

### Approval Gate

Allowlisted agents hitting `/api/ship` or `/api/codegen` require human approval:

1. Agent makes request
2. Backend returns approval requirement
3. Human approves via `POST /api/approvals/:id/approve`
4. Agent retries with `X-Approval-Id` header

---

## Path Security

File and directory operations are restricted for safety.

### Workspace Scoping

All file operations in Code mode are scoped to the workspace root:
- User sets workspace via UI or `workspaceRoot` parameter
- Operations cannot escape the workspace
- Symlinks pointing outside workspace are blocked

### Path Policy Service

The `pathPolicyService` validates all file paths:
- Blocks path traversal (`../`)
- Blocks absolute paths outside workspace
- Blocks known sensitive paths (`.env`, `.git/config`, etc.)

### Security Scan Root

For `/api/security/scan`, paths must be under:
- `SECURITY_SCAN_ROOT` environment variable, OR
- Current working directory

---

## Content Security

### Input Validation

All user input is validated:
- Message length limits (prevents memory exhaustion)
- Message count limits (prevents context overflow)
- Character set validation (strips control characters)

### Suspicious Prompt Detection

When `BLOCK_SUSPICIOUS_PROMPTS=true`:
- Detects prompt injection patterns
- Blocks jailbreak attempts
- Logs suspicious requests

### Output Sanitization

- HTML in responses is sanitized via DOMPurify
- Mermaid diagrams are rendered in sandboxed iframes
- Code output is escaped before display

---

## HTTPS and Transport Security

### Production Requirements

- All production traffic must use HTTPS
- HTTP requests are redirected to HTTPS
- HSTS header enforces HTTPS for returning visitors

### Webhook Security

- Outbound webhook URLs must be HTTPS in production
- Inbound webhooks require secret verification
- Request signatures are validated (Stripe, Twilio)

---

## Headers and CSP

Helmet middleware sets security headers:

```javascript
// Content Security Policy (production)
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "wss:", "https:"],
    // ... more directives
  }
}
```

Additional headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## Electron Security

The desktop app follows Electron security best practices:

### BrowserWindow Configuration

```javascript
webPreferences: {
  contextIsolation: true,     // Renderer can't access Node
  nodeIntegration: false,     // No direct Node access
  sandbox: true,              // Process isolation
  webSecurity: true           // Same-origin policy
}
```

### IPC Security

- Preload scripts expose minimal API
- All IPC messages are validated
- No arbitrary code execution from renderer

---

## Secrets Management

### Best Practices

1. **Never commit secrets** — Use `.env` files (gitignored) or secret managers
2. **Rotate regularly** — Change API keys periodically
3. **Use least privilege** — Each key should have minimal required permissions
4. **Audit access** — Log who/what uses each secret

### Secure Storage (ADR 0007)

For API keys that users enter:
- Stored encrypted at rest
- Never logged or displayed in full
- Transmitted only over HTTPS

---

## CI Security Scanning

Add these to your CI pipeline:

```yaml
# Example GitHub Actions workflow
security-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - name: Run npm audit
      run: npm audit --audit-level=high
    
    - name: Run secret scanning
      uses: gitleaks/gitleaks-action@v2
    
    - name: Run SAST
      uses: github/codeql-action/analyze@v2
```

### Recommended Tools

| Tool | Purpose |
|------|---------|
| `npm audit` | Dependency vulnerability scanning |
| Gitleaks | Secret detection in code |
| CodeQL | Static analysis security testing |
| Snyk | Dependency and container scanning |
| Trivy | Container vulnerability scanning |

---

## Incident Response

### Detection

Monitor for:
- Unusual rate limit hits
- Authentication failures
- Suspicious prompts (if logging enabled)
- Unexpected file access patterns

### Response Steps

1. **Contain** — Block suspicious IPs or users
2. **Investigate** — Review logs with correlation IDs
3. **Remediate** — Patch vulnerability, rotate secrets
4. **Report** — Document incident and lessons learned

### Logging

Security events are logged with:
- Correlation ID for request tracing
- User ID (if authenticated)
- IP address
- Request path and method
- Event type and severity

---

## Compliance Considerations

G-Rump includes tools for compliance:

### Available Scans

| Endpoint | Purpose |
|----------|---------|
| `POST /api/security/scan` | Security vulnerability scan |
| `POST /api/security/sbom` | Software Bill of Materials |
| `POST /api/security/compliance` | Compliance report |
| `POST /api/security/secrets-audit` | Secret detection |

### Standards

The compliance scanner supports:
- SOC 2
- HIPAA (when applicable)
- GDPR considerations
- PCI DSS (when handling payments)

---

## Related Documentation

- **[PRODUCTION.md](./PRODUCTION.md)** — Production deployment guide
- **[API.md](./API.md)** — API reference including security endpoints
- **[adr/0007-secure-api-key-storage.md](./adr/0007-secure-api-key-storage.md)** — API key storage decision
