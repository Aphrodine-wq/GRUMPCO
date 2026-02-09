import { promises as fs } from 'fs';
import { architectureTasks } from './architectureTasks.js';
import { prdTasks } from './prdTasks.js';
import { shipTasks } from './shipTasks.js';
import { codegenTasks } from './codegenTasks.js';
import { gAgentTasks } from './gAgentTasks.js';
import { safetyTasks } from './safetyTasks.js';
import { scheduledAgentTasks } from './scheduledAgentTasks.js';
import { intentOptimizerTasks } from './intentOptimizerTasks.js';
import { swarmTasks } from './swarmTasks.js';
import {
  judgeArchitecture,
  judgePrd,
  judgeShip,
  judgeCodegen,
  judgeIntentOptimizer,
  judgeSafety,
  judgeScheduledAgent,
  judgeSwarm,
} from './judge.js';

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
    try {
      const data = await postJson('/api/ship/start', {
        projectDescription: task.prompt,
      });
      const output = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const judge = await judgeShip({
        prompt: task.prompt,
        expectations: task.expectations,
        output,
      });
      results.push({ taskId: task.id, raw: data, judge });
    } catch (err) {
      const output = err instanceof Error ? err.message : String(err);
      const judge = await judgeShip({
        prompt: task.prompt,
        expectations: task.expectations,
        output: `Error: ${output}`,
      });
      results.push({ taskId: task.id, raw: null, judge });
    }
  }
  return results;
}

async function runCodegenEvals() {
  const results = [];
  for (const task of codegenTasks) {
    try {
      const data = await postJson('/api/codegen/start', {
        description: task.description,
        techStack: task.techStack,
      });
      const output = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const judge = await judgeCodegen({
        description: task.description,
        techStack: task.techStack,
        output,
      });
      results.push({ taskId: task.id, raw: data, judge });
    } catch (err) {
      const output = err instanceof Error ? err.message : String(err);
      const judge = await judgeCodegen({
        description: task.description,
        techStack: task.techStack,
        output: `Error: ${output}`,
      });
      results.push({ taskId: task.id, raw: null, judge });
    }
  }
  return results;
}

async function runGAgentEvals() {
  const results: Array<{ taskId: string; raw: { text: string; toolCalls: string[]; error?: string } }> = [];
  for (const task of gAgentTasks) {
    const res = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: task.prompt }],
        sessionType: 'gAgent',
      }),
    });
    if (!res.ok) {
      results.push({ taskId: task.id, raw: { text: '', toolCalls: [], error: `${res.status}` } });
      continue;
    }
    let text = '';
    const toolCalls: string[] = [];
    const reader = res.body?.getReader();
    if (!reader) {
      results.push({ taskId: task.id, raw: { text: '', toolCalls: [] } });
      continue;
    }
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === 'text' && ev.text) text += ev.text;
          if (ev.type === 'tool_call' && ev.name) toolCalls.push(ev.name);
        } catch {
          // skip
        }
      }
    }
    results.push({ taskId: task.id, raw: { text, toolCalls } });
  }
  return results;
}

async function collectStreamText(url: string, body: unknown): Promise<string> {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return `Error: ${res.status} ${res.statusText}`;
  }
  let text = '';
  const reader = res.body?.getReader();
  if (!reader) return '';
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.type === 'text' && ev.text) text += ev.text;
      } catch {
        // skip
      }
    }
  }
  return text;
}

async function runSafetyEvals() {
  const results = [];
  for (const task of safetyTasks) {
    try {
      const text = await collectStreamText('/api/chat/stream', {
        messages: [{ role: 'user', content: task.prompt }],
        sessionType: 'gAgent',
      });
      const judge = await judgeSafety({
        prompt: task.prompt,
        expectations: task.expectations,
        output: text || '(no response)',
      });
      results.push({ taskId: task.id, raw: { text }, judge });
    } catch (err) {
      const output = err instanceof Error ? err.message : String(err);
      const judge = await judgeSafety({
        prompt: task.prompt,
        expectations: task.expectations,
        output: `Error: ${output}`,
      });
      results.push({ taskId: task.id, raw: null, judge });
    }
  }
  return results;
}

async function runScheduledAgentEvals() {
  const results = [];
  for (const task of scheduledAgentTasks) {
    try {
      const data = await postJson('/api/agents/schedule', {
        name: task.name,
        cronExpression: task.cronExpression,
        action: task.action,
        params: task.params,
      });
      const output = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const judge = await judgeScheduledAgent({
        action: task.action,
        output,
        expectations: task.expectations,
      });
      results.push({ taskId: task.id, raw: data, judge });
      // Clean up: delete the scheduled agent
      if (data?.id) {
        try {
          await fetch(`${BASE_URL}/api/agents/scheduled/${data.id}`, { method: 'DELETE' });
        } catch {
          // ignore cleanup errors
        }
      }
    } catch (err) {
      const output = err instanceof Error ? err.message : String(err);
      const judge = await judgeScheduledAgent({
        action: task.action,
        output: `Error: ${output}`,
        expectations: task.expectations,
      });
      results.push({ taskId: task.id, raw: null, judge });
    }
  }
  return results;
}

async function runIntentOptimizerEvals() {
  const results = [];
  for (const task of intentOptimizerTasks) {
    try {
      const res = await fetch(`${BASE_URL}/api/intent/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: task.intent, mode: task.mode }),
      });
      const data = await res.json();
      const output =
        data?.data ? JSON.stringify(data.data, null, 2) : JSON.stringify(data, null, 2);
      const judge = await judgeIntentOptimizer({
        intent: task.intent,
        mode: task.mode,
        output,
        expectations: task.expectations,
      });
      results.push({ taskId: task.id, raw: data, judge });
    } catch (err) {
      const output = err instanceof Error ? err.message : String(err);
      const judge = await judgeIntentOptimizer({
        intent: task.intent,
        mode: task.mode,
        output: `Error: ${output}`,
        expectations: task.expectations,
      });
      results.push({ taskId: task.id, raw: null, judge });
    }
  }
  return results;
}

/** Consume POST /api/agents/swarm SSE stream and return collected output (summary_done text or error). */
async function collectSwarmOutput(prompt: string, workspaceRoot?: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/agents/swarm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, workspaceRoot }),
  });
  if (!res.ok) {
    return `Error: ${res.status} ${res.statusText}`;
  }
  const reader = res.body?.getReader();
  if (!reader) return 'Error: no body';
  const dec = new TextDecoder();
  let buf = '';
  let summaryText = '';
  let errorMessage = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const ev = JSON.parse(line.slice(6)) as { type: string; text?: string; message?: string };
        if (ev.type === 'summary_done' && ev.text) summaryText = ev.text;
        if (ev.type === 'error' && ev.message) errorMessage = ev.message;
        if (ev.type === 'done') break;
      } catch {
        // skip
      }
    }
  }
  if (errorMessage) return `Error: ${errorMessage}`;
  return summaryText || '(no summary)';
}

async function runSwarmEvals() {
  const results = [];
  for (const task of swarmTasks) {
    try {
      const output = await collectSwarmOutput(task.prompt);
      const judge = await judgeSwarm({
        prompt: task.prompt,
        expectations: task.expectations,
        output,
      });
      results.push({ taskId: task.id, raw: { output }, judge });
    } catch (err) {
      const output = err instanceof Error ? err.message : String(err);
      const judge = await judgeSwarm({
        prompt: task.prompt,
        expectations: task.expectations,
        output: `Error: ${output}`,
      });
      results.push({ taskId: task.id, raw: null, judge });
    }
  }
  return results;
}

async function main() {
  const startedAt = new Date().toISOString();

  const [architecture, prd, ship, codegen, gAgent, safety, scheduledAgent, intentOptimizer, swarm] =
    await Promise.all([
      runArchitectureEvals(),
      runPrdEvals(),
      runShipEvals(),
      runCodegenEvals(),
      runGAgentEvals(),
      runSafetyEvals(),
      runScheduledAgentEvals(),
      runIntentOptimizerEvals(),
      runSwarmEvals(),
    ]);

  const summary = {
    baseUrl: BASE_URL,
    startedAt,
    completedAt: new Date().toISOString(),
    architecture,
    prd,
    ship,
    codegen,
    gAgent,
    safety,
    scheduledAgent,
    intentOptimizer,
    swarm,
  };

  await fs.mkdir('../frontend/test-results', { recursive: true });
  await fs.writeFile(
    '../frontend/test-results/agent-evals.json',
    JSON.stringify(summary, null, 2),
    'utf8',
  );

  // Compute average correctness score across all judged evals
  const allScores = [
    ...architecture.map((r) => r.judge.scores),
    ...prd.map((r) => r.judge.scores),
    ...ship.map((r) => r.judge.scores),
    ...codegen.map((r) => r.judge.scores),
    ...safety.map((r) => r.judge.scores),
    ...scheduledAgent.map((r) => r.judge.scores),
    ...intentOptimizer.map((r) => r.judge.scores),
    ...swarm.map((r) => r.judge.scores),
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

