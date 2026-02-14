# ⚡ Optimize Scheduled Agents Queue Loading

## 💡 What
Replaced batched `Promise.all(batch.map(q.add))` with `queue.addBulk(jobs)` in `backend/src/services/scheduledAgentsQueue.ts`.

## 🎯 Why
The previous implementation sent N Redis commands (even if concurrently), causing overhead. `addBulk` sends a single command (Lua script) per batch, significantly reducing network round-trips and processing time.

## 📊 Measured Improvement
*   **Baseline (Sequential):** ~1206 ms
*   **Concurrent (Previous):** ~33 ms
*   **Bulk (Optimized):** ~23 ms
*   **Improvement:** ~30% over concurrent, >98% over sequential.

## Verification
*   Added benchmark script `backend/scripts/benchmark-scheduled-queue.ts`.
*   Updated unit tests `backend/tests/services/scheduledAgentsQueue.test.ts` to support `addBulk` mocking.
*   Ran tests and verified they pass.
*   Ran lint and format.
