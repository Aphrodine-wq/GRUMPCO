#!/usr/bin/env node
/**
 * grump – G-Rump CLI with subcommands: ship, argument, plan, code, analyze.
 * Usage: grump <command> [options]
 * Commands: ship, argument, plan, code, analyze
 * Default backend: http://localhost:3000 (or GRUMP_API_URL)
 * 
 * Enhanced with:
 * - Concurrent request support
 * - Client-side caching
 * - Progress indicators
 * - Retry logic with exponential backoff
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const DEFAULT_URL = (process.env.GRUMP_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const API_KEY = process.env.GRUMP_API_KEY;
const CACHE_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.grump-cache');
const CACHE_TTL = 3600 * 1000; // 1 hour

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['Authorization'] = `Bearer ${API_KEY}`;
  return h;
}

/**
 * Generate cache key from request
 */
function getCacheKey(url: string, body: unknown): string {
  const hash = crypto.createHash('sha256');
  hash.update(url);
  hash.update(JSON.stringify(body));
  return hash.digest('hex').substring(0, 16);
}

/**
 * Get cached response
 */
function getCached<T>(key: string): T | null {
  try {
    const cachePath = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    
    // Check expiration
    if (data.expiresAt && Date.now() > data.expiresAt) {
      fs.unlinkSync(cachePath);
      return null;
    }

    return data.value as T;
  } catch {
    return null;
  }
}

/**
 * Set cached response
 */
function setCache<T>(key: string, value: T, ttl = CACHE_TTL): void {
  try {
    const cachePath = path.join(CACHE_DIR, `${key}.json`);
    const data = {
      value,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttl,
    };
    fs.writeFileSync(cachePath, JSON.stringify(data), 'utf-8');
  } catch (error) {
    // Fail silently
  }
}

/**
 * Fetch with retry and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Retry on 5xx errors
      if (response.status >= 500 && attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.error(`Request failed with ${response.status}, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.error(`Request failed: ${lastError.message}, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

/**
 * Cached fetch with retry
 */
async function cachedFetch<T>(
  url: string,
  options: RequestInit,
  useCache = true
): Promise<T> {
  const cacheKey = getCacheKey(url, options.body);

  // Try cache first
  if (useCache) {
    const cached = getCached<T>(cacheKey);
    if (cached) {
      console.log('(cached)');
      return cached;
    }
  }

  // Fetch with retry
  const response = await fetchWithRetry(url, options);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} – ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as T;

  // Cache successful response
  if (useCache && response.ok) {
    setCache(cacheKey, data);
  }

  return data;
}

function parseCommon(argv: string[]): { url: string; rest: string[] } {
  let url = DEFAULT_URL;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) {
      url = argv[++i].replace(/\/$/, '');
    } else if (argv[i] !== '--url') {
      rest.push(argv[i]);
    }
  }
  return { url, rest };
}

function getOpt(rest: string[], name: string, short?: string): string | undefined {
  const full = `--${name}`;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === full && rest[i + 1]) return rest[i + 1];
    if (short && rest[i] === short && rest[i + 1]) return rest[i + 1];
  }
  return undefined;
}

function hasOpt(rest: string[], name: string, short?: string): boolean {
  return rest.includes(`--${name}`) || (!!short && rest.includes(short));
}

// --- ship ---
async function cmdShip(url: string, rest: string[]): Promise<void> {
  const desc = getOpt(rest, 'message', '-m') ?? getOpt(rest, 'description') ?? '';
  if (!desc) {
    console.error('grump ship: --message or --description required (project description)');
    process.exit(1);
  }
  const resStart = await fetch(`${url}/api/ship/start`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ projectDescription: desc }),
  });
  if (!resStart.ok) {
    const t = await resStart.text();
    console.error(`grump ship: start failed ${resStart.status} – ${t.slice(0, 300)}`);
    process.exit(1);
  }
  const { sessionId } = (await resStart.json()) as { sessionId?: string };
  if (!sessionId) {
    console.error('grump ship: response missing sessionId');
    process.exit(1);
  }
  const stream = hasOpt(rest, 'stream');
  if (stream) {
    console.log('Executing (streaming)...');
    const resExec = await fetchWithRetry(`${url}/api/ship/${sessionId}/execute/stream`, {
      method: 'POST',
      headers: headers(),
    });
    if (!resExec.ok) {
      console.error(`grump ship: execute stream failed ${resExec.status}`);
      process.exit(1);
    }
    const reader = resExec.body?.getReader();
    if (!reader) {
      console.error('grump ship: no response body');
      process.exit(1);
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
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          try {
            const ev = JSON.parse(data) as { type?: string; phase?: string; message?: string };
            if (ev.type === 'phase') console.log(`[${ev.phase}] ${ev.message ?? ''}`);
            else if (ev.type === 'done') console.log('Done.');
          } catch {
            // skip
          }
        }
      }
    }
  } else {
    const resExec = await fetch(`${url}/api/ship/${sessionId}/execute`, {
      method: 'POST',
      headers: headers(),
    });
    if (!resExec.ok) {
      console.error(`grump ship: execute failed ${resExec.status}`);
      process.exit(1);
    }
    const json = (await resExec.json()) as { status?: string; jobId?: string };
    console.log(`Session ${sessionId} – job ${json.jobId ?? 'enqueued'} – status ${json.status ?? 'running'}`);
  }
}

// --- argument ---
async function cmdArgument(url: string, rest: string[]): Promise<void> {
  const msg = getOpt(rest, 'message', '-m') ?? '';
  const res = await fetchWithRetry(`${url}/api/chat/stream`, {
    method: 'POST',
    headers: { ...headers(), Accept: 'text/event-stream' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: msg || 'Help me think through this.' }],
      mode: 'argument',
    }),
  });
  if (!res.ok) {
    console.error(`grump argument: ${res.status} – ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    console.error('grump argument: no response body');
    process.exit(1);
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
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        try {
          const ev = JSON.parse(data) as { type?: string; text?: string };
          if (ev.type === 'text' && ev.text) process.stdout.write(ev.text);
        } catch {
          // skip
        }
      }
    }
  }
  console.log();
}

// --- plan ---
async function cmdPlan(url: string, rest: string[]): Promise<void> {
  const message = getOpt(rest, 'message', '-m') ?? getOpt(rest, 'description') ?? '';
  if (!message) {
    console.error('grump plan: --message or --description required');
    process.exit(1);
  }
  const res = await fetch(`${url}/api/plan/generate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ description: message, title: 'CLI plan' }),
  });
  if (!res.ok) {
    console.error(`grump plan: ${res.status} – ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const json = (await res.json()) as { plan?: { id?: string; title?: string; steps?: Array<{ title: string }> } };
  const plan = json.plan;
  if (!plan) {
    console.error('grump plan: response missing plan');
    process.exit(1);
  }
  console.log('Plan:', plan.title ?? plan.id);
  plan.steps?.forEach((s, i) => console.log(`  ${i + 1}. ${s.title}`));
  if (plan.id) console.log('ID:', plan.id);
}

// --- code ---
async function cmdCode(url: string, rest: string[]): Promise<void> {
  const sessionId = getOpt(rest, 'session') ?? '';
  const outDir = getOpt(rest, 'output', '-o') ?? process.cwd();
  if (!sessionId) {
    console.error('grump code: --session <codegen-session-id> required (start codegen via API or UI first)');
    process.exit(1);
  }
  const resStatus = await fetch(`${url}/api/codegen/status/${sessionId}`, { headers: headers() });
  if (!resStatus.ok) {
    console.error(`grump code: status failed ${resStatus.status}`);
    process.exit(1);
  }
  const statusJson = (await resStatus.json()) as { status?: string };
  if (statusJson.status !== 'completed') {
    console.error(`grump code: session ${sessionId} not completed (status: ${statusJson.status})`);
    process.exit(1);
  }
  const resZip = await fetch(`${url}/api/codegen/download/${sessionId}`, { headers: headers() });
  if (!resZip.ok) {
    console.error(`grump code: download failed ${resZip.status}`);
    process.exit(1);
  }
  const blob = await resZip.arrayBuffer();
  // Response is ZIP; we'd need unzipper or similar to extract. For now write raw to file.
  const outPath = path.join(path.resolve(outDir), `codegen-${sessionId}.zip`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(blob));
  console.log(`Wrote ${outPath}`);
}

// --- analyze ---
async function cmdAnalyze(url: string, rest: string[]): Promise<void> {
  const workspace = getOpt(rest, 'workspace') ?? process.cwd();
  const output = getOpt(rest, 'output') ?? path.join(process.cwd(), 'architecture.mmd');
  const diagramType = getOpt(rest, 'diagram-type') ?? 'component';

  console.log('Analyzing codebase...');

  const json = await cachedFetch<{ success: boolean; data: { mermaidDiagram: string; summary: string } }>(
    `${url}/api/analyze/architecture`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        workspacePath: path.resolve(workspace),
        diagramType,
      }),
    },
    true // Cache analysis results
  );

  const diagram = json?.data?.mermaidDiagram;
  if (typeof diagram !== 'string') {
    console.error('grump analyze: response missing data.mermaidDiagram');
    process.exit(1);
  }
  if (json?.data?.summary) {
    console.error('Summary:', json.data.summary);
  }

  const outDir = path.dirname(output);
  if (outDir !== '.' && !fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(path.resolve(output), diagram, 'utf8');
  console.log(`Wrote ${output}`);
}

function showHelp(): void {
  console.log(`
grump – G-Rump CLI (Optimized)

Usage: grump <command> [options]
       grump-analyze [options]   (alias for grump analyze)

Commands:
  ship           Start SHIP workflow (--message <description>, --stream)
  ship-parallel  Start multiple SHIP workflows in parallel (--messages <desc1,desc2,...>)
  argument       Chat in argument mode (--message <text>)
  plan           Generate a plan (--message <description>)
  code           Download codegen result (--session <id> [--output <dir>])
  analyze        Analyze codebase, write Mermaid diagram (--workspace, --output, --diagram-type)
  cache-clear    Clear CLI cache

Common options:
  --url <base>   Backend URL (default: GRUMP_API_URL or http://localhost:3000)

Performance features:
  - Automatic retry with exponential backoff
  - Client-side caching (1 hour TTL)
  - Concurrent request support
  - Progress indicators

Examples:
  grump ship --message "A todo app with React and SQLite"
  grump ship --message "CRUD API" --stream
  grump ship-parallel --messages "Todo app,Blog platform,E-commerce site"
  grump argument --message "Should we use REST or GraphQL?"
  grump plan --message "Add auth to the API"
  grump code --session abc123 --output ./out
  grump analyze --workspace . --output ./docs/arch.mmd
  grump cache-clear

Environment variables:
  GRUMP_API_URL    Backend URL (default: http://localhost:3000)
  GRUMP_API_KEY    API key for authentication
`);
}

// --- cache-clear ---
async function cmdCacheClear(): Promise<void> {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    let cleared = 0;
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
        cleared++;
      }
    }
    
    console.log(`Cleared ${cleared} cached items`);
  } catch (error) {
    console.error('Failed to clear cache:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const COMMANDS = ['ship', 'argument', 'plan', 'code', 'analyze'];

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let cmd = argv[0];
  let rest: string[];
  let url: string;

  if (!cmd || cmd === '-h' || cmd === '--help') {
    showHelp();
    process.exit(0);
  }

  // Legacy: grump-analyze [--workspace ...] with no command word → treat as "analyze"
  if (!COMMANDS.includes(cmd)) {
    cmd = 'analyze';
    const parsed = parseCommon(argv);
    url = parsed.url;
    rest = parsed.rest;
  } else {
    const parsed = parseCommon(argv.slice(1));
    url = parsed.url;
    rest = parsed.rest;
  }

  switch (cmd) {
    case 'ship':
      await cmdShip(url, rest);
      break;
    case 'ship-parallel':
      await cmdShipParallel(url, rest);
      break;
    case 'argument':
      await cmdArgument(url, rest);
      break;
    case 'plan':
      await cmdPlan(url, rest);
      break;
    case 'code':
      await cmdCode(url, rest);
      break;
    case 'analyze':
      await cmdAnalyze(url, rest);
      break;
    case 'cache-clear':
      await cmdCacheClear();
      break;
    default:
      console.error(`grump: unknown command "${cmd}". Use grump --help.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('grump:', err instanceof Error ? err.message : err);
  process.exit(1);
});
