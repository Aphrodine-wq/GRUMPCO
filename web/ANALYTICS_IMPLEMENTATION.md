# G-Rump Analytics Implementation Plan

## Executive Summary

Comprehensive analytics and tracking implementation for the G-Rump web application. This system provides Google Analytics 4 integration, custom event tracking, performance monitoring, error tracking, and privacy-compliant consent management.

## Implementation Overview

### Files Created/Modified

1. **src/lib/analytics.ts** - Core analytics service module
2. **src/components/CookieConsent.svelte** - GDPR/CCPA-compliant consent banner
3. **index.html** - GA4 script integration and performance monitoring setup
4. **src/main.ts** - Analytics initialization
5. **src/App.svelte** - Route change tracking and CookieConsent integration
6. **src/routes/*.svelte** - Event tracking in all route components
7. **.env.example** - Configuration template

## 1. Google Analytics 4 Setup

### Configuration
- Measurement ID configured via `VITE_GA4_MEASUREMENT_ID` environment variable
- Consent Mode v2 implemented for privacy compliance
- SPA page view tracking via manual event dispatch
- Anonymized IP addresses enabled by default

### Key Features
- Automatic page view tracking on route changes
- User ID association after authentication
- Custom dimensions for user tier and session type
- Event parameters for detailed analytics

## 2. Event Tracking Implementation

### User Authentication Events
```typescript
trackAuthEvent('login' | 'register' | 'logout' | 'login_failed' | 'register_failed', metadata?)
```
- Login attempts and successes
- Registration funnel tracking
- Logout events
- Failed authentication tracking

### Workspace Events
```typescript
trackWorkspaceEvent('open' | 'design_mode' | 'code_mode' | 'generate', metadata?)
```
- Workspace entry tracking by mode
- Session duration monitoring
- Feature usage analytics

### Settings Events
```typescript
trackSettingsEvent('save_models' | 'save_accessibility' | 'view', metadata?)
```
- Model preference changes
- Accessibility setting updates
- Settings page engagement

### Billing Events
```typescript
trackBillingEvent('view' | 'upgrade' | 'downgrade', tier?)
```
- Billing page views
- Subscription conversion tracking
- Tier change events

### Conversion Tracking
- User registration completion
- Subscription upgrades
- Feature adoption milestones

## 3. Conversion Funnel Tracking

### Funnel Steps
1. **Landing** → Page view on public routes
2. **Registration Start** → Register page view
3. **Registration Complete** → Successful signup + conversion event
4. **First Workspace Entry** → Dashboard → Workspace navigation
5. **Feature Activation** → Design/Code mode usage

### Funnel Events
- `conversion` event type for key milestones
- Custom conversion values for revenue tracking
- Attribution via session ID and user ID

## 4. Performance Monitoring

### Core Web Vitals
- **LCP** (Largest Contentful Paint) - < 2.5s target
- **FID** (First Input Delay) - < 100ms target
- **CLS** (Cumulative Layout Shift) - < 0.1 target

### Custom Performance Metrics
- Application initialization time
- Route change duration
- API response times
- Time to First Byte (TTFB)
- First Contentful Paint (FCP)

### Implementation
```typescript
// Automatic tracking via PerformanceObserver
analytics.trackPerformance(metricName, value, rating?)
```

## 5. Error Tracking

### Global Error Handling
- Unhandled JavaScript errors
- Promise rejection tracking
- API error monitoring
- Contextual error data (URL, user agent, timestamp)

### Error Categories
- Authentication errors
- API failures
- Runtime JavaScript errors
- Network connectivity issues

### Error Reporting
```typescript
analytics.trackError(error, context?)
```

## 6. User Behavior Analytics

### Tracked Behaviors
- Page navigation patterns
- Feature discovery and usage
- Session duration and engagement
- Return visit tracking
- Device and browser information

### Behavioral Metrics
- Pages per session
- Average session duration
- Bounce rate by route
- Feature adoption rates

## 7. Privacy-Compliant Tracking

### GDPR/CCPA Compliance
- Granular consent management
- Consent storage in localStorage
- Analytics disabled by default until consent
- Opt-out functionality
- Data retention limits (14 months default)

### Consent Categories
1. **Essential** - Always enabled (site functionality)
2. **Analytics** - Optional (usage tracking)
3. **Marketing** - Optional (advertising)

### Consent Banner Features
- Clear explanation of data usage
- Granular control over categories
- Accept All / Necessary Only options
- Customize preferences option
- Link to Privacy Policy

## Configuration

### Environment Variables
```bash
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX    # GA4 Property ID
VITE_API_URL=http://localhost:3000      # API base URL
VITE_DEBUG_MODE=false                   # Console logging
VITE_ANALYTICS_RETENTION_MONTHS=14      # Data retention
VITE_TRACK_PERFORMANCE=true             # Performance monitoring
VITE_TRACK_ERRORS=true                  # Error tracking
VITE_TRACK_USER_BEHAVIOR=true           # Behavior analytics
VITE_REQUIRE_CONSENT=true               # Require consent
VITE_ANONYMIZE_IP=true                  # IP anonymization
```

## API Endpoints

The analytics service sends data to the following backend endpoints:

- `POST /api/analytics/events` - Custom events
- `POST /api/analytics/errors` - Error reports
- `POST /api/analytics/performance` - Performance metrics
- `POST /api/analytics/session` - Session summaries

## Usage Examples

### Track Custom Event
```typescript
import { analytics } from './lib/analytics'

analytics.trackEvent('feature', 'use', 'code-generation', 1, { 
  language: 'typescript',
  complexity: 'high'
})
```

### Track Page View
```typescript
analytics.trackPageView('/workspace', 'Workspace - G-Rump')
```

### Track Error
```typescript
try {
  await riskyOperation()
} catch (error) {
  analytics.trackError(error, { 
    operation: 'riskyOperation',
    userTier: 'pro'
  })
}
```

### Check Consent
```typescript
import { hasAnalyticsConsent } from './lib/analytics'

if ($hasAnalyticsConsent) {
  // Perform tracking
}
```

## Testing & Debugging

### Debug Mode
Enable `VITE_DEBUG_MODE=true` to see console logs of all tracking events.

### Testing Checklist
- [ ] Page views tracked on route changes
- [ ] Login events recorded correctly
- [ ] Registration funnel complete
- [ ] Workspace mode changes tracked
- [ ] Settings saves recorded
- [ ] Errors captured and reported
- [ ] Consent banner displays correctly
- [ ] Consent preferences saved
- [ ] Performance metrics collected
- [ ] No tracking without consent

## Future Enhancements

1. **A/B Testing** - Integration with Google Optimize
2. **Heatmaps** - Click and scroll tracking
3. **User Journey** - Funnel visualization
4. **Cohort Analysis** - User retention tracking
5. **Real-time Dashboard** - Live metrics display

## Compliance Notes

- All tracking respects user consent preferences
- Data anonymization enabled by default
- No PII collected without explicit consent
- Session data expires after 30 minutes of inactivity
- Users can revoke consent at any time
- Cookie lifetime limited to 90 days

## Support & Maintenance

### Monitoring
- Check analytics events in GA4 Realtime reports
- Monitor error tracking dashboard
- Review performance metrics weekly
- Audit consent rates monthly

### Updates
- Keep GA4 measurement ID secure
- Rotate API keys regularly
- Update consent banner copy as needed
- Review data retention policies annually
