# ADR-010: Sentry for Error Tracking

**Status:** Accepted
**Date:** 2026-02-05
**Deciders:** G-Rump Core Team
**Tags:** monitoring, observability, error-tracking

## Context

In a production AI development platform, comprehensive error tracking is critical for:

1. **Rapid Issue Detection**: Identify errors before users report them
2. **Debug Context**: Capture full stack traces, user context, and environment
3. **Performance Monitoring**: Track slow operations and bottlenecks
4. **Release Heath**: Monitor error rates after deployments
5. **User Impact**: Understand which errors affect the most users

We needed a solution that:
- Works across Node.js backend and Electron frontend
- Captures context (user, request, AI provider, etc.)
- Integrates with our CI/CD pipeline
- Provides performance profiling
- Offers reasonable pricing

## Decision

Adopt **Sentry** as our primary error tracking and performance monitoring platform.

**Implementation:**
- Backend integration with `@sentry/node`
- Frontend integration with `@sentry/electron`
- Automatic source map upload via CI
- Custom context for AI operations
- Performance profiling with 10% sample rate in production
- Filtered errors (exclude 400/401/403 status codes)

**Configuration:**
```typescript
Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% in production
  profilesSampleRate: 0.1,
  integrations: [/* ... */],
  beforeSend: filterErrors, // Exclude validation errors
});
```

## Consequences

### Positive
- **Proactive Monitoring**: Catch errors before users report them
- **Rich Context**: Full stack traces, breadcrumbs, user sessions
- **Performance Insights**: Identify slow AI provider calls
- **Release Tracking**: Associate errors with specific deployments
- **Alerting**: Slack/email notifications for critical errors
- **Source Maps**: Readable stack traces in production
- **Team Features**: Assignment, comments, issue tracking
- **Free Tier**: 5,000 errors/month on free plan

### Negative
- **Cost**: Can become expensive at scale (> 5k errors/month)
- **Privacy**: Sending stack traces to third party
- **Dependency**: Reliance on external service
- **Noise**: Can generate alerts for non-critical issues
- **Performance Impact**: Small overhead from instrumentation

### Neutral
- **Learning Curve**: Team needs to learn Sentry UI/workflows
- **Configuration**: Requires DSN in environment variables
- **Integration Work**: Custom context for AI-specific errors

## Alternatives Considered

### Alternative 1: Self-Hosted Sentry
- **Pros**: Full control, no data leaves infrastructure, unlimited events
- **Cons**: Maintenance burden, hosting costs, need Postgres/Redis, complexity
- **Rejected**: Operational overhead not worth it at current scale

### Alternative 2: LogRocket
- **Pros**: Session replay, frontend focus, great UX insights
- **Cons**: More expensive, focused on frontend only, overkill for backend errors
- **Rejected**: Too frontend-focused, we need backend coverage

### Alternative 3: Bugsnag
- **Pros**: Good pricing, stability monitoring, release tracking
- **Cons**: Weaker performance monitoring, smaller community
- **Rejected**: Sentry has better Node.js/Electron support

### Alternative 4: Roll Our Own (Logs + Alerts)
- **Pros**: No cost, full control
- **Cons**: Massive engineering time, missing advanced features, no UI
- **Rejected**: Not a core competency, Sentry does this better

### Alternative 5: Datadog APM
- **Pros**: All-in-one observability, great for large enterprises
- **Cons**: Very expensive, overkill for error tracking alone
- **Rejected**: Cost prohibitive, we already use Prometheus/Grafana

## Implementation Details

**Backend** (`backend/src/config/sentry.ts`):
- Initialize with environment-specific config
- Capture AI provider errors with custom context
- Filter validation errors (400, 401, 403)
- Enrich with user ID, session ID, request data

**Frontend** (`frontend/src/lib/sentry.ts`):
- Electron-specific integration
- Capture renderer + main process errors
- User feedback dialog
- Offline queue for errors

**CI Integration** (`.github/workflows/release.yml`):
- Upload source maps on release
- Create Sentry release
- Associate commits with deploy

**Custom Context Example**:
```typescript
Sentry.withScope((scope) => {
  scope.setTag('ai_provider', 'nvidia-nim');
  scope.setContext('ai_request', {
    model: 'llama-3.3-nemotron',
    tokens: 1500,
    cost: 0.0003,
  });
  Sentry.captureException(error);
});
```

## Migration Plan

1. **Phase 1** (Week 1): Backend integration
   - Install `@sentry/node`
   - Add to error handler middleware
   - Configure DSN, upload source maps

2. **Phase 2** (Week 2): Frontend integration
   - Install `@sentry/electron`
   - Integrate in main/renderer processes
   - Test user feedback

3. **Phase 3** (Week 3): Enhanced context
   - Add AI provider context
   - Add user/session context
   - Fine-tune filters

4. **Phase 4** (Week 4): Alerting & workflows
   - Configure Slack alerts
   - Set up issue assignment rules
   - Train team on workflow

## Metrics for Success

- **Error Detection Time**: < 5 minutes from occurrence
- **Resolution Time**: Reduce by 50% with better context
- **User-Reported Bugs**: Decrease by 70% (catch proactively)
- **Production Incidents**: Zero undetected critical errors

## References

- [Sentry Configuration](../../backend/src/config/sentry.ts)
- [Sentry Docs](https://docs.sentry.io/platforms/node/)
- [Error Handler Middleware](../../backend/src/middleware/errorHandler.ts)
- [Release Workflow](../../.github/workflows/release.yml)

---

**Review Notes:**
- Approved 2026-02-05
- Free tier limits acceptable for initial launch
- Will re-evaluate pricing at 10k monthly active users
