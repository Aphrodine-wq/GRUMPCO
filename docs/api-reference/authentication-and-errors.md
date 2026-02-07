# Authentication & Error Handling

This document describes the authentication and error handling mechanisms for the G-Rump API.

## Authentication

### Bearer Token (JWT)

When `REQUIRE_AUTH_FOR_API=true`, protected endpoints require a valid Bearer token:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/ship/start
```

### Webhook Secrets

Webhook endpoints require secret validation:

```bash
curl -H "X-Webhook-Secret: <secret>" http://localhost:3000/api/webhooks/trigger
```

## Error Handling

All errors follow a standardized format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "field": "projectDescription"
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
