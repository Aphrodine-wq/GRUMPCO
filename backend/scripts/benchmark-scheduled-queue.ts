import { Queue } from "bullmq";
import { performance } from "perf_hooks";

// Mock Queue
class MockQueue {
  async add(name: string, data: any, opts: any) {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 1));
    return { id: "1" };
  }

  async addBulk(jobs: any[]) {
    // Simulate network latency (1ms for the batch) + small processing time per job
    await new Promise((resolve) => setTimeout(resolve, 1 + jobs.length * 0.01));
    return jobs.map((j, i) => ({ id: String(i) }));
  }

  async close() {}
}

async function runBenchmark() {
  const queue = new MockQueue() as unknown as Queue;
  const JOB_COUNT = 1000;
  const BATCH_SIZE = 50;

  console.log(`Benchmarking with ${JOB_COUNT} jobs...`);

  // Scenario 1: Sequential
  {
    const start = performance.now();
    for (let i = 0; i < JOB_COUNT; i++) {
      await queue.add("run", { id: i }, {});
    }
    const end = performance.now();
    console.log(`Sequential: ${(end - start).toFixed(2)}ms`);
  }

  // Scenario 2: Concurrent (Promise.all with batching)
  {
    const start = performance.now();
    for (let i = 0; i < JOB_COUNT; i += BATCH_SIZE) {
      const batch = Array.from({ length: Math.min(BATCH_SIZE, JOB_COUNT - i) }, (_, k) => i + k);
      await Promise.all(batch.map(async (id) => {
        await queue.add("run", { id }, {});
      }));
    }
    const end = performance.now();
    console.log(`Concurrent (Batch ${BATCH_SIZE}): ${(end - start).toFixed(2)}ms`);
  }

  // Scenario 3: Bulk (addBulk)
  {
    const start = performance.now();
    for (let i = 0; i < JOB_COUNT; i += BATCH_SIZE) {
      const batch = Array.from({ length: Math.min(BATCH_SIZE, JOB_COUNT - i) }, (_, k) => i + k);
      const jobs = batch.map((id) => ({
        name: "run",
        data: { id },
        opts: {},
      }));
      await queue.addBulk(jobs);
    }
    const end = performance.now();
    console.log(`Bulk (Batch ${BATCH_SIZE}): ${(end - start).toFixed(2)}ms`);
  }
}

runBenchmark();
