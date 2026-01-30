# Runbook: Redis Unavailable

When `REDIS_HOST` is set, the backend uses Redis for rate limiting, tiered cache L2, optional session storage, and BullMQ job queues. If Redis is down or unreachable, the app **continues to run** with in-memory fallbacks. Health can report **degraded** (see below).

## Behavior when Redis is unavailable

| Component | With Redis | When Redis down |
|-----------|------------|------------------|
| **Rate limiting** | Shared across instances/restarts | In-memory per process; **not shared** across replicas or restarts |
| **Tiered cache** | L1 (memory) + L2 (Redis) + L3 (disk) | L1 + L3 only; L2 skipped |
| **Session storage** | Redis when `SESSION_STORAGE=redis` | Falls back to in-memory (or configured alternative) |
| **Job queue (BullMQ)** | Redis-backed | BullMQ jobs fail; use alternative job mechanism or fix Redis |

## What to do

1. **Check connectivity**: `redis-cli -h $REDIS_HOST -p ${REDIS_PORT:-6379} ping`. Expect `PONG`.
2. **Check `/health/detailed`**: Redis check appears when `REDIS_HOST` is set. `status: 'degraded'` means Redis is configured but disconnected.
3. **Restore Redis**: Fix network, restart Redis, or switch to a healthy instance. Restart the backend if it cached connection failures.
4. **Temporary workaround**: Remove `REDIS_HOST` to run without Redis (rate limiting and L2 cache disabled, in-memory only). Not recommended for multi-instance production.

## Links

- [PRODUCTION_CHECKLIST](PRODUCTION_CHECKLIST.md) – Rate limiting and Redis configuration
- [CAPABILITIES](CAPABILITIES.md) – Redis usage
- [KNOWN_ISSUES](KNOWN_ISSUES.md) – Verification and troubleshooting
