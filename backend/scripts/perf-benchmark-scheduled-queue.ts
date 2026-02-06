import { performance } from 'perf_hooks';

// Mock Queue class mimicking BullMQ minimal interface
class MockQueue {
  async add(name: string, data: any, opts: any) {
    // Simulate network latency (1ms) + overhead (0.1ms)
    await new Promise(resolve => setTimeout(resolve, 1.1));
    return {};
  }

  async addBulk(jobs: any[]) {
     // Simulate network latency (1ms) + overhead (0.1ms total for request)
     // This demonstrates the advantage of single round trip
    await new Promise(resolve => setTimeout(resolve, 1.1));
    return jobs.map(() => ({}));
  }
}

async function benchmark() {
    const q = new MockQueue();
    const jobs = Array.from({ length: 1000 }, (_, i) => ({
        id: `job-${i}`,
        cronExpression: '*/5 * * * *',
        action: 'ship',
        paramsJson: '{}'
    }));

    console.log(`Running benchmark with ${jobs.length} jobs...`);

    // Baseline: Sequential (Task Description)
    const startSeq = performance.now();
    for (const job of jobs) {
        await q.add('run', { ...job }, { jobId: job.id });
    }
    const endSeq = performance.now();
    const timeSeq = (endSeq - startSeq).toFixed(2);
    console.log(`Sequential: ${timeSeq}ms`);

    // Current: Promise.all Batch 50
    const startConc = performance.now();
    const BATCH_SIZE = 50;
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        const batch = jobs.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(job => q.add('run', { ...job }, { jobId: job.id })));
    }
    const endConc = performance.now();
    const timeConc = (endConc - startConc).toFixed(2);
    console.log(`Concurrent (Batch 50): ${timeConc}ms`);

    // Proposed: addBulk Batch 50
    const startBulk = performance.now();
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        const batch = jobs.slice(i, i + BATCH_SIZE);
        const bulkJobs = batch.map(job => ({
            name: 'run',
            data: { ...job },
            opts: { jobId: job.id }
        }));
        await q.addBulk(bulkJobs);
    }
    const endBulk = performance.now();
    const timeBulk = (endBulk - startBulk).toFixed(2);
    console.log(`Bulk (Batch 50): ${timeBulk}ms`);
}

benchmark().catch(console.error);
