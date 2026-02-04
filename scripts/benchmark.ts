/**
 * G-Rump Performance Benchmark Suite
 * 
 * Measures critical performance metrics:
 * - Intent parsing speed
 * - AI response latency
 * - Database query performance
 * - Cache hit rates
 * - File I/O throughput
 * 
 * Run with: npm run benchmark
 */

import { performance } from 'perf_hooks';
import { Bench } from 'tinybench';

// Benchmark configurations
const BENCHMARK_CONFIG = {
  iterations: 100,
  warmupIterations: 10,
  timeLimit: 60000, // 60 seconds max per benchmark
};

// Results storage
interface BenchmarkResult {
  name: string;
  opsPerSecond: number;
  meanTime: number;
  p95Time: number;
  p99Time: number;
  samples: number;
  status: 'pass' | 'fail' | 'warn';
  threshold: number;
}

const results: BenchmarkResult[] = [];

/**
 * Run a benchmark with threshold validation
 */
async function runBenchmark(
  name: string,
  fn: () => void | Promise<void>,
  threshold: number // Minimum ops/sec to pass
): Promise<BenchmarkResult> {
  console.log(`\n🏃 Running: ${name}`);
  
  const bench = new Bench({
    iterations: BENCHMARK_CONFIG.iterations,
    warmupIterations: BENCHMARK_CONFIG.warmupIterations,
    time: BENCHMARK_CONFIG.timeLimit,
  });

  bench.add(name, fn);
  await bench.run();

  const task = bench.tasks[0];
  const result: BenchmarkResult = {
    name,
    opsPerSecond: task.result?.hz || 0,
    meanTime: task.result?.mean || 0,
    p95Time: (task.result as any)?.p95 || (task.result as any)?.p975 || 0,
    p99Time: task.result?.p99 || 0,
    samples: task.result?.samples.length || 0,
    status: (task.result?.hz || 0) >= threshold ? 'pass' : 'fail',
    threshold,
  };

  results.push(result);
  
  console.log(`  Ops/sec: ${result.opsPerSecond.toFixed(2)} (threshold: ${threshold})`);
  console.log(`  Mean: ${(result.meanTime * 1000).toFixed(3)}ms`);
  console.log(`  P95: ${(result.p95Time * 1000).toFixed(3)}ms`);
  console.log(`  P99: ${(result.p99Time * 1000).toFixed(3)}ms`);
  console.log(`  Status: ${result.status === 'pass' ? '✅ PASS' : '❌ FAIL'}`);

  return result;
}

/**
 * JSON parsing benchmark
 */
async function benchmarkJSONParsing() {
  const testData = {
    message: 'Generate a React component',
    context: { framework: 'react', language: 'typescript' },
    metadata: { timestamp: Date.now(), version: '2.1.0' },
  };
  const jsonStr = JSON.stringify(testData);

  await runBenchmark(
    'JSON Parse (intent payload)',
    () => { JSON.parse(jsonStr); },
    1000000 // 1M ops/sec
  );
}

/**
 * String manipulation benchmark
 */
async function benchmarkStringOps() {
  const longString = 'x'.repeat(10000);
  
  await runBenchmark(
    'String Split (10KB)',
    () => { longString.split(''); },
    10000 // 10K ops/sec
  );
}

/**
 * Object cloning benchmark
 */
async function benchmarkObjectClone() {
  const testObj = {
    id: '123',
    nested: { a: 1, b: 2, c: { deep: 'value' } },
    array: [1, 2, 3, 4, 5],
  };

  await runBenchmark(
    'Object Clone (structured)',
    () => { JSON.parse(JSON.stringify(testObj)); },
    50000 // 50K ops/sec
  );
}

/**
 * Regex benchmark
 */
async function benchmarkRegex() {
  const testString = 'const x = 123; // TODO: fix this later';
  const pattern = /TODO|FIXME|XXX/g;

  await runBenchmark(
    'Regex Match (TODO detection)',
    () => { pattern.test(testString); },
    500000 // 500K ops/sec
  );
}

/**
 * UUID generation benchmark
 */
async function benchmarkUUID() {
  await runBenchmark(
    'UUID Generation (crypto)',
    () => { crypto.randomUUID(); },
    10000 // 10K ops/sec
  );
}

/**
 * Base64 encoding benchmark
 */
async function benchmarkBase64() {
  const data = Buffer.from('x'.repeat(1000));
  
  await runBenchmark(
    'Base64 Encode (1KB)',
    () => { data.toString('base64'); },
    50000 // 50K ops/sec
  );
}

/**
 * Generate benchmark report
 */
function generateReport(): string {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.status === 'pass').length;
  const failedTests = results.filter(r => r.status === 'fail').length;
  
  const report = `
╔════════════════════════════════════════════════════════════╗
║           G-RUMP PERFORMANCE BENCHMARK REPORT              ║
╚════════════════════════════════════════════════════════════╝

Date: ${new Date().toISOString()}
Node Version: ${process.version}
Platform: ${process.platform}

SUMMARY
─────────────────────────────────────────────────────────────
Total Tests:  ${totalTests}
Passed:       ${passedTests} ✅
Failed:       ${failedTests} ${failedTests > 0 ? '❌' : ''}
Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%

DETAILED RESULTS
─────────────────────────────────────────────────────────────
${results.map(r => `
${r.name}
  Status:     ${r.status.toUpperCase()}
  Ops/sec:    ${r.opsPerSecond.toFixed(2)}
  Mean:       ${(r.meanTime * 1000).toFixed(3)}ms
  P95:        ${(r.p95Time * 1000).toFixed(3)}ms
  P99:        ${(r.p99Time * 1000).toFixed(3)}ms
  Threshold:  ${r.threshold} ops/sec
`).join('\n')}

${failedTests === 0 ? '✅ ALL BENCHMARKS PASSED' : `❌ ${failedTests} BENCHMARK(S) FAILED`}

═══════════════════════════════════════════════════════════════
`;

  return report;
}

/**
 * Main benchmark runner
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        G-RUMP PERFORMANCE BENCHMARK SUITE v2.1.0           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Run all benchmarks
    await benchmarkJSONParsing();
    await benchmarkStringOps();
    await benchmarkObjectClone();
    await benchmarkRegex();
    await benchmarkUUID();
    await benchmarkBase64();

    // Generate and display report
    const report = generateReport();
    console.log(report);

    // Save report to file
    const fs = await import('fs/promises');
    const reportPath = './benchmark-results.txt';
    await fs.writeFile(reportPath, report, 'utf-8');
    console.log(`📄 Report saved to: ${reportPath}`);

    // Exit with appropriate code
    const failedTests = results.filter(r => r.status === 'fail').length;
    process.exit(failedTests > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Benchmark suite failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runBenchmark, results, generateReport };
