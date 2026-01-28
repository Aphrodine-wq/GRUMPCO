#!/usr/bin/env node
/**
 * G-Rump MCP server – exposes SHIP, architecture, codegen, intent, chat as MCP tools.
 * Run: GRUMP_API_URL=http://localhost:3000 node dist/mcp/grump-server.js
 * Or: npm run mcp-server (from backend)
 * Cursor/Claude Code can add this as an MCP server (stdio transport).
 */

const API_BASE = process.env.GRUMP_API_URL || 'http://localhost:3000';

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path}`;
  return fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
  });
}

async function handleToolsList(): Promise<{ name: string; description: string; inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] } }[]> {
  return [
    {
      name: 'grump_ship_start',
      description: 'Start a SHIP session (design → spec → plan → code). Returns sessionId.',
      inputSchema: {
        type: 'object',
        properties: { projectDescription: { type: 'string', description: 'Natural language description of the app' } },
        required: ['projectDescription'],
      },
    },
    {
      name: 'grump_ship_execute',
      description: 'Execute a SHIP session (run design→spec→plan→code). Call after grump_ship_start.',
      inputSchema: {
        type: 'object',
        properties: { sessionId: { type: 'string', description: 'Session ID from grump_ship_start' } },
        required: ['sessionId'],
      },
    },
    {
      name: 'grump_ship_status',
      description: 'Get SHIP session status and phase results.',
      inputSchema: {
        type: 'object',
        properties: { sessionId: { type: 'string' } },
        required: ['sessionId'],
      },
    },
    {
      name: 'grump_architecture_generate',
      description: 'Generate architecture (Mermaid) from a project description.',
      inputSchema: {
        type: 'object',
        properties: { projectDescription: { type: 'string' } },
        required: ['projectDescription'],
      },
    },
    {
      name: 'grump_intent_parse',
      description: 'Parse natural language intent into structured features, actors, data flows.',
      inputSchema: {
        type: 'object',
        properties: { raw: { type: 'string', description: 'Natural language description' } },
        required: ['raw'],
      },
    },
    {
      name: 'grump_codegen_download',
      description: 'Get download URL for generated code ZIP. Use codegen sessionId from SHIP result.',
      inputSchema: {
        type: 'object',
        properties: { sessionId: { type: 'string', description: 'Codegen session ID' } },
        required: ['sessionId'],
      },
    },
  ];
}

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const text = (s: string) => ({ content: [{ type: 'text' as const, text: s }] });
  try {
    if (name === 'grump_ship_start') {
      const projectDescription = String(args?.projectDescription ?? '');
      const r = await apiFetch('/api/ship/start', { method: 'POST', body: JSON.stringify({ projectDescription }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return text(`Error: ${(d as { error?: string }).error ?? r.statusText}`);
      return text(`Session started: ${(d as { sessionId?: string }).sessionId}. Call grump_ship_execute with this sessionId to run.`);
    }
    if (name === 'grump_ship_execute') {
      const sessionId = String(args?.sessionId ?? '');
      const r = await apiFetch(`/api/ship/${sessionId}/execute`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return text(`Error: ${(d as { error?: string }).error ?? r.statusText}`);
      return text(`SHIP enqueued. Poll grump_ship_status with sessionId ${sessionId} for status.`);
    }
    if (name === 'grump_ship_status') {
      const sessionId = String(args?.sessionId ?? '');
      const r = await apiFetch(`/api/ship/${sessionId}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return text(`Error: ${(d as { error?: string }).error ?? r.statusText}`);
      const s = d as { phase?: string; status?: string; codeResult?: { session?: { sessionId?: string } } };
      let out = `Phase: ${s.phase}, Status: ${s.status}`;
      if (s.codeResult?.session?.sessionId) out += `\nCodegen sessionId for download: ${s.codeResult.session.sessionId}`;
      return text(out);
    }
    if (name === 'grump_architecture_generate') {
      const projectDescription = String(args?.projectDescription ?? '');
      const r = await apiFetch('/api/architecture/generate', { method: 'POST', body: JSON.stringify({ projectDescription }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return text(`Error: ${(d as { error?: string }).error ?? r.statusText}`);
      const arch = d as { mermaid?: string; summary?: string };
      return text(arch.mermaid ? `Mermaid:\n${arch.mermaid}\n\n${arch.summary ?? ''}` : JSON.stringify(d));
    }
    if (name === 'grump_intent_parse') {
      const raw = String(args?.raw ?? '');
      const r = await apiFetch('/api/intent/parse', { method: 'POST', body: JSON.stringify({ raw }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return text(`Error: ${(d as { error?: string }).error ?? r.statusText}`);
      return text(JSON.stringify(d, null, 2));
    }
    if (name === 'grump_codegen_download') {
      const sessionId = String(args?.sessionId ?? '');
      const r = await apiFetch(`/api/codegen/download/${sessionId}`, { method: 'GET' });
      if (!r.ok) return text(`Error: ${r.status} ${r.statusText}`);
      const url = `${API_BASE}/api/codegen/download/${sessionId}`;
      return text(`Download URL: ${url} (GET with same auth/cookies as backend).`);
    }
    return text(`Unknown tool: ${name}`);
  } catch (err) {
    return text(`Error: ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let req: { jsonrpc?: string; id?: string; method?: string; params?: { name?: string; arguments?: unknown } };
    try {
      req = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (req.jsonrpc !== '2.0' || req.id == null) continue;
    const id = req.id;
    const method = req.method;
    let result: unknown;
    try {
      if (method === 'initialize') {
        result = { protocolVersion: '2024-11-05', serverInfo: { name: 'grump', version: '1.0.0' }, capabilities: { tools: {} } };
      } else if (method === 'tools/list') {
        const tools = await handleToolsList();
        result = { tools };
      } else if (method === 'tools/call') {
        const name = (req.params as { name?: string })?.name;
        const args = (req.params as { arguments?: string })?.arguments;
        const parsed = typeof args === 'string' ? JSON.parse(args) : args ?? {};
        result = await handleToolCall(name ?? '', parsed);
      } else {
        result = null;
      }
    } catch (err) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: (err as Error).message } }) + '\n');
      continue;
    }
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
