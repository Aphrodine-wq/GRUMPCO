#!/usr/bin/env node
/**
 * Parse agent-evals.json and write a score summary.
 * Exits 1 if average correctness is below EVAL_CORRECTNESS_THRESHOLD (default 3.0).
 * Usage: node parseEvalsSummary.mjs [path-to-agent-evals.json]
 */
import { readFileSync, existsSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPath = join(__dirname, '../../../frontend/test-results/agent-evals.json');
const path = process.argv[2] || defaultPath;
const threshold = Number(process.env.EVAL_CORRECTNESS_THRESHOLD) || 3.0;

if (!existsSync(path)) {
  console.log('No agent-evals.json found, skipping summary');
  process.exit(0);
}

const data = JSON.parse(readFileSync(path, 'utf8'));
const scores = [
  ...(data.architecture || []).map((r) => r.judge?.scores?.correctness).filter((n) => typeof n === 'number'),
  ...(data.prd || []).map((r) => r.judge?.scores?.correctness).filter((n) => typeof n === 'number'),
];

if (scores.length === 0) {
  console.log('No eval scores found in agent-evals.json');
  process.exit(0);
}

const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
const archCount = (data.architecture || []).length;
const prdCount = (data.prd || []).length;

console.log('## Agent Eval Scores');
console.log(`- Architecture: ${archCount} tasks`);
console.log(`- PRD: ${prdCount} tasks`);
console.log(`- Average correctness: ${avg.toFixed(2)}/5`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    '## Agent Eval Scores',
    `- Architecture: ${archCount} tasks`,
    `- PRD: ${prdCount} tasks`,
    `- **Average correctness: ${avg.toFixed(2)}/5**`,
  ].join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}

if (avg < threshold) {
  console.error(`Eval average correctness ${avg.toFixed(2)} is below threshold ${threshold}`);
  process.exit(1);
}

process.exit(0);
