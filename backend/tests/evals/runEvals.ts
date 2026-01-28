import { promises as fs } from 'fs';
import { architectureTasks } from './architectureTasks.js';
import { prdTasks } from './prdTasks.js';
import { shipTasks } from './shipTasks.js';
import { codegenTasks } from './codegenTasks.js';
import { judgeArchitecture, judgePrd } from './judge.js';

const BASE_URL = process.env.EVAL_BASE_URL ?? 'http://localhost:3000';

async function postJson(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request to ${path} failed: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

async function runArchitectureEvals() {
  const results = [];
  for (const task of architectureTasks) {
    const data = await postJson('/api/architecture', { description: task.prompt });
    const output = data.architecture ?? JSON.stringify(data);
    const judge = await judgeArchitecture({
      prompt: task.prompt,
      expectations: task.expectations,
      output,
    });
    results.push({ taskId: task.id, judge });
  }
  return results;
}

async function runPrdEvals() {
  const results = [];
  for (const task of prdTasks) {
    const data = await postJson('/api/prd', {
      title: task.title,
      description: task.description,
      architectureSummary: task.architectureSummary,
    });
    const output = data.prd ?? JSON.stringify(data);
    const judge = await judgePrd({
      title: task.title,
      description: task.description,
      architectureSummary: task.architectureSummary,
      expectations: task.expectations,
      output,
    });
    results.push({ taskId: task.id, judge });
  }
  return results;
}

async function runShipEvals() {
  const results = [];
  for (const task of shipTasks) {
    const data = await postJson('/api/ship/start', {
      description: task.prompt,
      // Keep payload minimal; rely on backend defaults.
    });
    results.push({ taskId: task.id, raw: data });
  }
  return results;
}

async function runCodegenEvals() {
  const results = [];
  for (const task of codegenTasks) {
    const data = await postJson('/api/codegen/start', {
      description: task.description,
      techStack: task.techStack,
    });
    results.push({ taskId: task.id, raw: data });
  }
  return results;
}

async function main() {
  const startedAt = new Date().toISOString();

  const [architecture, prd, ship, codegen] = await Promise.all([
    runArchitectureEvals(),
    runPrdEvals(),
    runShipEvals(),
    runCodegenEvals(),
  ]);

  const summary = {
    baseUrl: BASE_URL,
    startedAt,
    completedAt: new Date().toISOString(),
    architecture,
    prd,
    ship,
    codegen,
  };

  await fs.mkdir('../frontend/test-results', { recursive: true });
  await fs.writeFile(
    '../frontend/test-results/agent-evals.json',
    JSON.stringify(summary, null, 2),
    'utf8',
  );

  // Optionally compute a simple average correctness score and log it
  const allScores = [
    ...architecture.map((r) => r.judge.scores),
    ...prd.map((r) => r.judge.scores),
  ];
  if (allScores.length > 0) {
    const avgCorrectness =
      allScores.reduce((sum, s) => sum + s.correctness, 0) / allScores.length;
    console.log(`Average correctness score: ${avgCorrectness.toFixed(2)}/5`);
  }
}

main().catch((err) => {
  console.error('Agent evals failed', err);
  process.exit(1);
});

