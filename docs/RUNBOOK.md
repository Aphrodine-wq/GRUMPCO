# Runbooks

Quick recovery steps for common operational issues.

## Redis unavailable

**When:** `REDIS_HOST` is set but Redis is down or unreachable.

**Impact:** Rate limiting not shared across instances; L2 cache disabled. App keeps running with in-memory fallbacks.

**Recovery:** See [RUNBOOK_REDIS](RUNBOOK_REDIS.md).

## NIM / GPU down

**When:** NVIDIA NIM is configured (`NVIDIA_NIM_API_KEY` or `NVIDIA_NIM_URL`) but the NIM endpoint is unreachable.

**Impact:** RAG, embeddings, and NIM-backed chat/completions fail. Claude and other providers continue to work if configured.

**Recovery:**
1. Check NIM endpoint (e.g. `curl -s -o /dev/null -w "%{http_code}" $NVIDIA_NIM_URL/v1/health` or your NIM health URL).
2. Restart NIM container or fix network. For local GPU stack: `docker compose -f docker-compose.yml -f docker-compose.gpu.yml ps`, then `up -d` if needed.
3. Temporarily disable NIM by unsetting `NVIDIA_NIM_API_KEY` and using Claude/OpenRouter only.

## High error rate

**When:** Many 5xx or client-reported failures.

**Recovery:**
1. Check `/health/detailed` and logs for unhealthy components (DB, Redis, API, circuit breakers).
2. If circuit breakers are open: back off dependent traffic; allow half-open retries or restart once upstream is healthy.
3. Scale up or scale out if overloaded; check rate limits and upstream provider quotas.

## Cost spike

**When:** LLM or infrastructure costs spike.

**Recovery:**
1. Check cost dashboard: `GET /api/cost/summary`, `GET /api/cost/stats` (see [PERFORMANCE_GUIDE](PERFORMANCE_GUIDE.md)).
2. Review cost-aware routing and caching: ensure tiered cache and model router are enabled; tune thresholds if needed.
3. Set or tighten `POST /api/cost/budget` budgets and alerts.
4. Audit high-token routes (e.g. codegen, long conversations) and add caching or strict limits.

---

See also [PRODUCTION_CHECKLIST](PRODUCTION_CHECKLIST.md), [KNOWN_ISSUES](KNOWN_ISSUES.md).
