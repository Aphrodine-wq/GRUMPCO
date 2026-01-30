# Credits & Pricing

G-Rump uses a credit-based pricing model that provides flexibility and transparency. This guide explains how credits work, pricing tiers, and how to manage your usage.

## Understanding Credits

### What Are Credits?

Credits are the currency used to access G-Rump's AI-powered features. Each API call, code generation, or AI interaction consumes credits based on complexity and resource usage.

### Credit Consumption

| Feature | Credits Used | Example |
|---------|--------------|---------|
| Simple chat message | 1 credit | "How do I use React hooks?" |
| Complex chat with tools | 2-3 credits | File analysis + code generation |
| SHIP workflow (design phase) | 5 credits | Architecture generation |
| SHIP workflow (full) | 20-50 credits | Complete project generation |
| Code review | 2 credits | Roast/review a file |
| Architecture diagram | 3 credits | Generate Mermaid diagram |
| PRD generation | 4 credits | Product requirements doc |

### Factors Affecting Credit Cost

1. **Model Used**
   - Kimi K2.5 (NVIDIA NIM): 1x base rate (most efficient)
   - OpenRouter models: 1-2x base rate
   - Premium models (Claude): 2-3x base rate

2. **Context Size**
   - Small (< 4K tokens): 1x
   - Medium (4K-16K): 1.5x
   - Large (16K-256K): 2x

3. **Response Length**
   - Short (< 500 tokens): 1x
   - Medium (500-2K): 1.2x
   - Long (> 2K): 1.5x

4. **Features Enabled**
   - Tool calling: +1 credit
   - Multi-agent mode: +2 credits
   - Streaming: No extra cost

## Pricing Tiers

### Free Tier

**Price:** $0/month

**Includes:**
- 50 credits/month
- Basic features
- Community support
- Standard models only
- 1 concurrent session

**Best for:**
- Evaluating G-Rump
- Small personal projects
- Learning the platform

### Pro Tier

**Price:** $29/month or $290/year (17% savings)

**Includes:**
- 1,000 credits/month
- All features
- Priority support
- All models including premium
- 5 concurrent sessions
- Usage analytics dashboard
- API access
- Custom configurations

**Best for:**
- Professional developers
- Freelancers
- Small teams

**Cost per credit:** ~$0.029

### Team Tier

**Price:** $99/month or $990/year (17% savings)

**Includes:**
- 5,000 credits/month
- Team collaboration features
- Shared projects
- Admin dashboard
- 20 concurrent sessions
- Priority queue access
- Custom model training (coming soon)
- Advanced security features
- SSO integration

**Best for:**
- Development teams
- Agencies
- Startups

**Cost per credit:** ~$0.020

### Enterprise Tier

**Price:** Custom pricing

**Includes:**
- Unlimited credits
- Dedicated support
- SLA guarantees
- Custom integrations
- On-premise deployment option
- Custom model fine-tuning
- Advanced analytics
- Audit logs
- Compliance features (SOC 2, GDPR)

**Best for:**
- Large organizations
- Enterprises
- Compliance-heavy industries

## Credit Management

### Checking Your Balance

**Via CLI:**
```bash
grump config get credits
# or
grump auth status
```

**Via Dashboard:**
Visit [https://grump.dev/dashboard/billing](https://grump.dev/dashboard/billing)

**Via API:**
```bash
curl https://api.grump.dev/api/billing/usage \
  -H "Authorization: Bearer <token>"
```

### Usage Notifications

We send notifications at:
- 50% of monthly limit
- 80% of monthly limit
- 95% of monthly limit (with recommendation to upgrade)

Configure notification preferences in your dashboard.

### Auto-Top Up

Enable automatic credit purchase when running low:

```bash
# Enable via CLI
grump config set autoTopUp true
grump config set autoTopUpThreshold 100
grump config set autoTopUpAmount 500
```

Or in dashboard: Settings → Billing → Auto-Top Up

## Optimizing Credit Usage

### Tips to Save Credits

1. **Use Kimi K2.5 (Default)**
   ```bash
   # Most cost-effective model
   grump config set defaultModel moonshotai/kimi-k2.5
   ```

2. **Batch Operations**
   ```bash
   # Instead of multiple small requests
   grump ship "Build full-stack app" 
   # Rather than separate calls for each component
   ```

3. **Use Caching**
   ```bash
   # Enable response caching
   grump config set cacheEnabled true
   ```

4. **Optimize Context**
   - Provide clear, concise descriptions
   - Use existing code as context instead of regenerating
   - Leverage the workspace feature

5. **Choose Right Mode**
   ```bash
   # Use specific modes for better efficiency
   grump chat "question" --mode normal     # 1 credit
   grump chat "plan" --mode plan           # 2 credits
   grump ship "project"                    # 20-50 credits
   ```

### Credit-Saving Commands

```bash
# Get free morale boost (no credits!)
grump fortune
grump coffee
grump vibes

# Check status (no credits)
grump status <session-id>
grump list
grump config list
```

## Billing & Payments

### Payment Methods

We accept:
- Credit/Debit cards (Visa, Mastercard, Amex)
- PayPal
- Apple Pay (iOS/macOS)
- Google Pay (Android)
- Bank transfer (Enterprise only)
- Cryptocurrency (BTC, ETH) - Contact support

### Billing Cycle

- Monthly: Billed on the same day each month
- Annual: Billed yearly with 17% discount
- Prorated upgrades available

### Invoices

Access invoices:
- Dashboard: Billing → Invoices
- Email: Sent monthly to billing contact
- API: `GET /api/billing/invoices`

### Refund Policy

- **Unused credits:** Refundable within 30 days of purchase
- **Subscription cancellation:** Prorated refund for unused days
- **Technical issues:** Credits automatically refunded for failed requests

## Enterprise Billing

### Custom Contracts

Enterprise customers receive:
- Volume discounts
- Custom credit pricing
- Annual/bi-annual billing options
- Dedicated account manager
- Custom payment terms (Net 30, Net 60)
- PO/Invoice workflow

### Usage-Based Pricing

Alternative to tier-based:
- Pay only for what you use
- $0.015 per credit (minimum $500/month)
- Monthly billing
- No commitment

Contact sales@grump.dev for custom pricing.

## Cost Estimation

### Project Cost Calculator

Estimate costs for typical projects:

| Project Type | Estimated Credits | Pro Tier | Team Tier |
|--------------|-------------------|----------|-----------|
| Simple landing page | 15-25 | Covered | Covered |
| CRUD API backend | 50-100 | Covered | Covered |
| Full-stack web app | 200-400 | Covered | Covered |
| Mobile app (React Native) | 300-500 | Covered | Covered |
| E-commerce platform | 500-1000 | $15-43 | Covered |
| Enterprise SaaS | 1000+ | $29+ | $20+ |

### Usage Monitoring

Track usage in real-time:

```bash
# Daily usage summary
grump config get dailyUsage

# Monthly breakdown
grump config get monthlyUsage
```

Dashboard provides:
- Daily/weekly/monthly charts
- Feature usage breakdown
- Cost per project
- Trend analysis

## Comparing to Alternatives

### G-Rump vs. Other AI Coding Tools

| Tool | Monthly Cost | Credits/API Calls | Notes |
|------|--------------|-------------------|-------|
| **G-Rump Free** | $0 | 50 | Great for evaluation |
| **G-Rump Pro** | $29 | 1,000 | Best value for devs |
| **G-Rump Team** | $99 | 5,000 | Team features |
| GitHub Copilot | $10 | Unlimited | Code completion only |
| Cursor | $20 | Unlimited | Editor-based |
| Codeium | $0-$12 | Unlimited | Basic features |
| ChatGPT Plus | $20 | ~80 msgs | General purpose |
| Claude Pro | $20 | ~100 msgs | General purpose |

**G-Rump advantages:**
- Purpose-built for software development
- SHIP workflow methodology
- Multi-agent system
- Desktop + CLI + API access
- Architecture generation
- Code review & roasting

## FAQ

### What happens when I run out of credits?

Your account continues to work but requests will fail with "Insufficient credits" error. You can:
1. Upgrade to a higher tier
2. Purchase additional credits
3. Wait for monthly reset (free tier only resets partially)

### Do credits expire?

- Free tier: Monthly credits expire at month end
- Paid tiers: Credits roll over for 3 months
- Purchased credits: Valid for 12 months

### Can I share credits with my team?

Team tier includes shared credit pools. Enterprise tier supports multiple teams with separate budgets.

### Is there a free trial for paid tiers?

Yes! 14-day free trial of Pro tier with 500 credits. No credit card required.

### How do I cancel my subscription?

```bash
# Via CLI
grump config set subscription cancel

# Or visit dashboard
# Settings → Billing → Cancel Subscription
```

Prorated refund issued for unused days.

### Can I get credits for open source work?

Yes! Apply for our Open Source Program:
- Free Team tier for maintainers
- 2,000 bonus credits/month
- Apply at: oss@grump.dev

### What about educational use?

Student and educator discounts available:
- 50% off all tiers
- Free for verified students
- Contact: edu@grump.dev

## Support

For billing questions:
- Email: billing@grump.dev
- Dashboard: Help → Contact Support
- Response time: Within 24 hours (Pro/Team), 4 hours (Enterprise)

## Next Steps

- [API Reference](/guide/api-reference) - Start using credits
- [CLI Reference](/guide/cli-reference) - Maximize efficiency
- [Upgrade Now](https://grump.dev/dashboard/billing) - Choose your tier
