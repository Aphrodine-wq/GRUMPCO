# Analytics Metrics Reference

## Product Metrics

### Daily Active Users (DAU)
- **Definition**: Unique users who performed any action in the last 24 hours
- **Query**: Count unique `$distinct_id` where `timestamp >= now() - 1 day`
- **Target**: Growth rate > 10% week-over-week

### Weekly Active Users (WAU)
- **Definition**: Unique users who performed any action in the last 7 days
- **Query**: Count unique `$distinct_id` where `timestamp >= now() - 7 days`
- **Target**: Growth rate > 5% week-over-week

### User Retention
- **Definition**: Percentage of users who return after their first session
- **Formula**: `Users who return / Total signups`
- **Target**: Day-7 retention > 20%, Day-30 retention > 10%

### Conversion Funnel
1. **Intent Submitted** → **Architecture Viewed**: Target > 60%
2. **Architecture Viewed** → **Code Generated**: Target > 50%
3. **Code Generated** → **Project Shipped**: Target > 30%
4. **Overall Conversion** (Intent → Shipped): Target > 10%

### Time to First Value (TTFV)
- **Definition**: Time from signup to first successful code generation
- **Formula**: `avg(code_generated.timestamp - user_signed_up.timestamp)`
- **Target**: < 5 minutes

### Feature Adoption Rate
- **Definition**: Percentage of users who use a specific feature
- **Formula**: `Users who used feature / Total active users`
- **Target**: Core features > 50%, New features > 10% within 2 weeks

## Technical Metrics

### Generation Success Rate
- **Definition**: Percentage of generation requests that succeed
- **Formula**: `Successful generations / Total generation attempts`
- **Target**: > 95%

### Average Generation Time
- **Definition**: Time from request to response for code generation
- **Formula**: `avg(code_generated.duration_ms)`
- **Target**: < 10 seconds for simple, < 30 seconds for complex

### Error Rate
- **Definition**: Percentage of requests that result in errors
- **Formula**: `Error events / Total events`
- **Target**: < 1%

### Provider Performance
- **Metrics per provider**:
  - Average latency
  - Success rate
  - Error types
  - Cost per 1K tokens
- **Target**: Latency < 5s, Success rate > 99%

### Cache Hit Rate
- **Definition**: Percentage of requests served from cache
- **Formula**: `Cache hits / (Cache hits + Cache misses)`
- **Target**: > 70%

### Cost Per Generation
- **Definition**: Average cost to generate code
- **Formula**: `Total AI provider costs / Number of generations`
- **Target**: <$0.10 per generation

## Business Metrics

### Monthly Recurring Revenue (MRR)
- Track upgrades, downgrades, and churn
- Target: 10% month-over-month growth

### Customer Acquisition Cost (CAC)
- **Definition**: Cost to acquire a new user
- **Formula**: `Marketing spend / New signups`
- **Target**: Reduce over time as organic growth increases

### Lifetime Value (LTV)
- **Definition**: Expected revenue per user
- **Formula**: `Average revenue per user * Average user lifetime`
- **Target**: LTV/CAC ratio > 3

### Upgrade Conversion Rate
- **Definition**: Percentage of free users who upgrade
- **Formula**: `Upgrades / Free users`
- **Target**: > 5%

## Engagement Metrics

### Sessions per User
- **Definition**: Average number of sessions per user per week
- **Target**: > 3

### Average Session Duration
- **Definition**: Time spent per session
- **Formula**: `avg(session_ended.session_duration_ms)`
- **Target**: > 5 minutes

### Intent Complexity Distribution
- Track how users are distributed across simple/medium/complex intents
- **Target**: Balanced usage across all levels

### Chat Messages per Session
- **Definition**: Average number of chat messages per session
- **Target**: > 2 messages (indicates engagement)

## Alerts & Thresholds

### Critical Alerts (Immediate attention)
- Error rate > 5%
- Generation success rate < 90%
- Provider completely down

### Warning Alerts (Review within 24h)
- DAU drops > 20% from baseline
- Conversion funnel drops > 10%
- Average generation time > 60s

### Monitoring Alerts (Review weekly)
- Feature adoption declining
- Retention dropping
- Cost per generation increasing

## Dashboard URLs

After setting up PostHog, your dashboards will be available at:
- Product Overview: `https://app.posthog.com/project/{project_id}/dashboard/{dashboard_id}`
- Feature Adoption: `https://app.posthog.com/project/{project_id}/dashboard/{dashboard_id}`
- Technical Performance: `https://app.posthog.com/project/{project_id}/dashboard/{dashboard_id}`
- User Journey: `https://app.posthog.com/project/{project_id}/dashboard/{dashboard_id}`

## Exporting Data

PostHog allows data export via:
1. **UI**: Export insights as CSV/PNG
2. **API**: Use the PostHog API for custom reporting
3. **Warehouse**: Sync to BigQuery, Snowflake, etc.
