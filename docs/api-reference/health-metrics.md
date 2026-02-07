# Health & Metrics APIs

The Health & Metrics APIs provide endpoints for checking the health of the application and exposing Prometheus metrics.

---

## GET `/health`

Basic health check.

**Response (200):**
```json
{
  "status": "healthy",
  "version": "2.1.0",
  "timestamp": "2026-01-31T12:00:00Z"
}
```

---

## GET `/health/quick`

Quick health check with key dependencies.

**Response (200):**
```json
{
  "status": "healthy",
  "checks": {
    "api_key_configured": true,
    "server_responsive": true,
    "database_connected": true,
    "redis_connected": false
  },
  "timestamp": "2026-01-31T12:00:00Z",
  "version": "2.1.0"
}
```

---

## GET `/health/detailed`

Detailed health check with all subsystems.

---

## GET `/metrics`

Prometheus metrics endpoint.

**Authentication:** Basic auth (if `METRICS_AUTH` configured)
