import { performance } from "perf_hooks";

// Mock implementation of BullMQ Queue to simulate latency
class MockQueue {
  name: string;
  constructor(name: string) {
    this.name = name;
  }

  // Simulate network roundtrip + processing
  async add(name: string, data: any, opts: any) {
    await new Promise((resolve) => setTimeout(resolve, 2)); // 2ms latency per call
    return { id: opts.jobId || "123" };
  }

  // Simulate single network roundtrip for bulk
  async addBulk(jobs: any[]) {
    await new Promise((resolve) => setTimeout(resolve, 2)); // 2ms latency for the whole batch
    return jobs.map(j => ({ id: j.opts?.jobId || "123" }));
  }

  async obliterate() {}
  async close() {}
}

const JOB_COUNT = 1000;
const BATCH_SIZE = 50;

async function runBenchmark() {
  const queue = new MockQueue("benchmark");
  console.log(`Starting benchmark with ${JOB_COUNT} jobs (simulated 2ms latency)...`);

  // --- Method A: Current Implementation (Promise.all in batches) ---
  const jobsA = Array.from({ length: JOB_COUNT }, (_, i) => ({
    id: `sched_A_${i}`,
    cron: "*/5 * * * *",
    action: "ship",
    params: { test: true }
  }));

  const startA = performance.now();
  for (let i = 0; i < jobsA.length; i += BATCH_SIZE) {
    const batch = jobsA.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (job) => {
        await queue.add(
          "run",
          { scheduleId: job.id, action: job.action, params: job.params },
          { jobId: job.id, repeat: { pattern: job.cron } },
        );
      })
    );
  }
  const endA = performance.now();
  console.log(`Method A (Promise.all batching): ${(endA - startA).toFixed(2)} ms`);

  // --- Method B: Optimization (addBulk) ---
  const jobsB = Array.from({ length: JOB_COUNT }, (_, i) => ({
    id: `sched_B_${i}`,
    cron: "*/5 * * * *",
    action: "ship",
    params: { test: true }
  }));

  const startB = performance.now();
  for (let i = 0; i < jobsB.length; i += BATCH_SIZE) {
    const batch = jobsB.slice(i, i + BATCH_SIZE);
    await queue.addBulk(
      batch.map((job) => ({
        name: "run",
        data: { scheduleId: job.id, action: job.action, params: job.params },
        opts: { jobId: job.id, repeat: { pattern: job.cron } },
      }))
    );
  }
  const endB = performance.now();
  console.log(`Method B (addBulk batching):     ${(endB - startB).toFixed(2)} ms`);

  // Theoretical improvement calculation
  // Method A: (1000 / 50) batches * 2ms = 40ms? No.
  // Method A batch: 50 concurrent requests.
  //   In Node, Promise.all starts 50 timers concurrently. They all finish after ~2ms.
  //   So each batch takes ~2ms. Total = 20 batches * 2ms = 40ms.
  // Method B batch: 1 request. Takes 2ms. Total = 20 batches * 2ms = 40ms.
  // Wait, if latency is fully parallelizable, they might be similar in this mock.
  // But in real Redis, the server is single-threaded, and there is overhead per command parsing.
  // Let's add 'server processing time' simulation that is serial.
}

runBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
