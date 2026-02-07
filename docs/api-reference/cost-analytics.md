# Cost & Analytics APIs

The Cost & Analytics APIs provide endpoints for tracking costs and getting optimization recommendations.

---

## GET `/api/cost/summary`

Get cost summary for current period.

**Response (200):**
```json
{
  "totalCost": 12.50,
  "currency": "USD",
  "period": "2026-01",
  "breakdown": {
    "chat": 5.20,
    "codegen": 4.80,
    "architecture": 2.50
  },
  "tokenUsage": {
    "prompt": 125000,
    "completion": 89000
  },
  "savings": {
    "fromCaching": 8.30,
    "fromRouting": 5.50
  }
}
```

---

## GET `/api/cost/recommendations`

Get optimization recommendations.

**Response (200):**
```json
{
  "recommendations": [
    {
      "type": "cache",
      "message": "Enable tiered caching to reduce costs by 40%",
      "potentialSavings": 15.00
    }
  ]
}
```
