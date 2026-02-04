# Analytics & Tracking Setup

This document explains how to set up and use the analytics tracking system powered by PostHog.

## Overview

We use **PostHog** for product analytics because:
- Generous free tier (1M events/month)
- Open source and self-hostable
- Real-time analytics
- Session recording capabilities
- Funnel and retention analysis
- Good for startups

## Quick Start

### 1. Sign up for PostHog

1. Go to https://posthog.com/
2. Create a free account
3. Create a new project
4. Get your API key from Project Settings → API Keys

### 2. Configure Environment Variables

#### Backend (.env)

```bash
# PostHog Configuration
POSTHOG_API_KEY=phc_your_project_api_key
POSTHOG_HOST=https://us.i.posthog.com
ANALYTICS_ENABLED=true
ANALYTICS_DEBUG=false
ANALYTICS_FLUSH_INTERVAL=10000
```

#### Frontend (.env)

```bash
# PostHog Configuration
VITE_POSTHOG_API_KEY=phc_your_project_api_key
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

### 3. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Backend Usage

### Basic Tracking

```typescript
import { analytics } from './services/analytics';

// Track an event
analytics.track('intent_submitted', {
  intent_type: 'feature',
  complexity: 'high',
}, userId);

// Track user identification
analytics.identify(userId, {
  email: 'user@example.com',
  plan: 'pro',
});
```

### Using Middleware

```typescript
import express from 'express';
import { analyticsMiddleware, identifyMiddleware } from './middleware/analytics';

const app = express();

// Add analytics middleware
app.use(analyticsMiddleware());
app.use(identifyMiddleware());
```

### Specialized Tracking Methods

```typescript
// Track generation events (architecture, code, intent)
analytics.trackGeneration('architecture', true, 1500, userId, {
  model: 'claude-3-opus',
  tokens_used: 5000,
});

// Track project lifecycle
analytics.trackProjectLifecycle('created', projectId, userId, {
  template: 'react-app',
});

// Track errors
analytics.trackError('generation_failed', error, userId, {
  operation: 'code_generation',
});
```

## Frontend Usage

### Initialize in App

```svelte
<!-- App.svelte or +layout.svelte -->
<script>
  import { Analytics } from '$components/Analytics.svelte';
</script>

<Analytics />
```

### Track Events

```svelte
<script>
  import { analytics } from '$lib/analytics';
  import TrackButton from '$components/TrackButton.svelte';
  
  function handleSubmit() {
    // Track custom event
    analytics.track('intent_submitted', {
      complexity: 'high',
    });
  }
</script>

<!-- Or use the TrackButton component -->
<TrackButton 
  name="submit_intent" 
  on:click={handleSubmit}
  properties={{ feature: 'architecture' }}
>
  Submit Intent
</TrackButton>
```

### Page View Tracking

```svelte
<script>
  import { analytics } from '$lib/analytics';
  import { onMount } from 'svelte';
  
  onMount(() => {
    analytics.pageView('architecture_page', {
      project_id: projectId,
    });
  });
</script>
```

### Feature Discovery Tracking

```svelte
<script>
  import TrackFeature from '$components/TrackFeature.svelte';
</script>

<!-- Track when user sees the skills panel -->
<TrackFeature name="skills_panel" trigger="visible">
  <SkillsPanel />
</TrackFeature>

<!-- Track when user clicks on advanced options -->
<TrackFeature name="advanced_options" trigger="click">
  <button>Show Advanced Options</button>
</TrackFeature>
```

## Tracked Events

### Onboarding Events

| Event | Description | Properties |
|-------|-------------|------------|
| `user_signed_up` | New user registration | `source`, `referrer` |
| `tour_started` | User started onboarding tour | `step` |
| `tour_completed` | User completed tour | `step`, `duration_ms` |
| `first_project_created` | User created their first project | `project_id`, `template` |

### Core Usage Events

| Event | Description | Properties |
|-------|-------------|------------|
| `intent_submitted` | User submitted an intent | `complexity`, `intent_type` |
| `architecture_viewed` | Architecture diagram viewed | `generation_time_ms` |
| `code_generated` | Code generation completed | `lines_of_code`, `language` |
| `project_downloaded` | User downloaded project | `format` |
| `project_shipped` | Project deployed/shipped | `platform`, `method` |

### Feature Events

| Event | Description | Properties |
|-------|-------------|------------|
| `skill_used` | User used a skill/tool | `skill`, `context` |
| `chat_message_sent` | Chat message sent | `message_type`, `length` |
| `diagram_exported` | Architecture diagram exported | `format`, `size` |
| `feature_discovered` | User discovered a feature | `feature`, `trigger` |

### Error Events

| Event | Description | Properties |
|-------|-------------|------------|
| `generation_failed` | Code/architecture generation failed | `error_type`, `retry_count` |
| `timeout_occurred` | Request timed out | `timeout_ms`, `operation` |
| `provider_error` | AI provider error | `provider`, `error_code` |
| `error_occurred` | General error | `error_message`, `context` |

### Business Events

| Event | Description | Properties |
|-------|-------------|------------|
| `user_upgraded` | User upgraded plan | `from_plan`, `to_plan` |
| `payment_processed` | Payment completed | `amount`, `plan` |

## Dashboard Configuration

### PostHog Dashboard Setup

See `docs/analytics/dashboards.json` for pre-configured dashboard templates.

#### Key Metrics to Track

1. **Product Metrics**
   - Daily/Weekly Active Users (DAU/WAU)
   - New user signups
   - Projects created per user
   - Conversion funnel: Intent → Architecture → Code → Shipped
   - Time to first value
   - Feature adoption rates

2. **Technical Metrics**
   - Generation success rates
   - Average generation time
   - Provider performance (latency, errors)
   - Cache hit rates
   - Cost per generation

3. **User Journey**
   - Onboarding completion rate
   - Time spent on each stage
   - Drop-off points
   - Feature discovery patterns

### Creating a Funnel

In PostHog:
1. Go to Insights → Funnels
2. Add steps:
   - `$pageview` (or `session_started`)
   - `intent_submitted`
   - `architecture_viewed`
   - `code_generated`
   - `project_shipped`
3. Set conversion window to 7 days
4. Save as "Core User Journey"

### Setting up Retention

1. Go to Insights → Retention
2. Select `user_signed_up` as the target event
3. Select `intent_submitted` as the returning event
4. Group by week
5. Save as "User Retention"

## Privacy & Compliance

### GDPR Compliance

- PostHog respects Do Not Track headers (enabled by default)
- Users can opt-out: `analytics.optOut()`
- IP addresses are not stored by default

### PII Handling

- Never track sensitive user data (passwords, API keys)
- Use `userId` consistently for identification
- Sanitize properties that might contain PII

### Example: Opt-out Banner

```svelte
<script>
  import { analytics } from '$lib/analytics';
  
  function handleOptOut() {
    analytics.optOut();
    localStorage.setItem('analytics_opt_out', 'true');
  }
</script>

{#if !analytics.hasOptedOut()}
  <div class="cookie-banner">
    <p>We use analytics to improve your experience.</p>
    <button on:click={handleOptOut}>Opt Out</button>
  </div>
{/if}
```

## Testing

### Backend Tests

```bash
cd backend
npm test -- analytics.test.ts
```

### Frontend Tests

```typescript
// Mock analytics in tests
vi.mock('$lib/analytics', () => ({
  analytics: {
    track: vi.fn(),
    identify: vi.fn(),
    pageView: vi.fn(),
  },
  isAnalyticsReady: writable(true),
}));
```

## Troubleshooting

### Events Not Showing Up

1. Check API key is correct
2. Verify `ANALYTICS_ENABLED=true`
3. Check browser console for errors
4. Look at PostHog Live Events
5. Enable debug mode: `ANALYTICS_DEBUG=true`

### Performance Issues

- Events are batched by default (10s interval)
- Frontend uses localStorage for persistence
- Backend flushes on shutdown

### Missing User Identification

- Ensure `identify()` is called after login
- Use consistent `userId` format
- Check that middleware is applied correctly

## Resources

- [PostHog Documentation](https://posthog.com/docs)
- [PostHog JS SDK](https://posthog.com/docs/libraries/js)
- [PostHog Node SDK](https://posthog.com/docs/libraries/node)
