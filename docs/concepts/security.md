# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: security@grump.dev (or create a private security advisory)
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days

### Security Measures in Place

#### Authentication & Authorization
- Supabase JWT verification for API authentication
- Role-based access control (user, admin)
- Timing-safe string comparison to prevent timing attacks
- Rate limiting with tier-based controls

#### Transport Security
- HTTPS enforced in production (HSTS enabled)
- Secure cookie settings (httpOnly, secure, sameSite=strict)
- CORS with strict origin validation

#### Input Validation
- Zod schema validation for all API inputs
- Request body size limits (100KB JSON, 64KB urlencoded)
- Host header allowlist in production

#### Content Security
- Content Security Policy (CSP) with strict directives
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Referrer-Policy: no-referrer

#### Monitoring & Detection
- CSP violation reporting endpoint
- Request logging with correlation IDs
- OpenTelemetry tracing
- Prometheus metrics for anomaly detection

#### Dependency Security
- Dependabot automated updates
- npm audit in CI pipeline
- Trivy vulnerability scanning
- Gitleaks secret detection
- CodeQL static analysis

### Security Headers

Production environments include:
```
Strict-Transport-Security: max-age=15552000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

### Environment Variables

Never commit secrets. Required security-related env vars:
- `SUPABASE_JWT_SECRET` - JWT verification
- `METRICS_AUTH` - Prometheus metrics authentication
- `ALLOWED_HOSTS` - Host header allowlist
- `CORS_ORIGINS` - Allowed CORS origins

### WAF Recommendations

For production deployments, we recommend:
- Cloudflare WAF or AWS WAF
- Rate limiting at edge
- Bot detection and mitigation
- DDoS protection
- Geographic restrictions if applicable


## Security Checklist for Contributors

- [ ] No secrets in code or commits
- [ ] Input validation on all user inputs
- [ ] Parameterized queries (no SQL injection)
- [ ] Output encoding for XSS prevention
- [ ] Authentication checks on protected routes
- [ ] Authorization checks for resource access
- [ ] Secure error handling (no stack traces in production)
- [ ] Dependencies updated and audited

## Bug Bounty

We currently do not have a formal bug bounty program, but we appreciate responsible disclosure and will acknowledge security researchers in our release notes.

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
