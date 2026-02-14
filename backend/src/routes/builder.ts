/**
 * Builder routes – sessions, mermaid generation, build stream, git.
 */

import { Router, type Request, type Response } from 'express';
import { getRequestLogger } from '../middleware/logger.js';
import { sendServerError } from '../utils/errorResponse.js';
import {
  listSessions,
  createSession,
  getSession,
  getSessionOrThrow,
  generateMermaid,
  streamBuildSection,
  runGit,
} from '../services/ship/builderService.js';

const router = Router();
const log = getRequestLogger();

/**
 * GET /api/builder/sessions
 * List all Builder sessions.
 */
router.get('/sessions', async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = listSessions();
    res.json({ sessions: list });
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Builder list sessions failed');
    sendServerError(res, error);
  }
});

/**
 * POST /api/builder/sessions
 * Create a new Builder session (project folder + session record).
 * Body: { projectName, workspaceRoot, destination: 'local' | 'git' }
 */
router.post('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectName, workspaceRoot, destination, defaultProvider, defaultModelId } =
      req.body as {
        projectName?: string;
        workspaceRoot?: string;
        destination?: 'local' | 'git';
        defaultProvider?: string;
        defaultModelId?: string;
      };
    if (!projectName || typeof projectName !== 'string' || !projectName.trim()) {
      res.status(400).json({ error: 'projectName is required' });
      return;
    }
    if (!workspaceRoot || typeof workspaceRoot !== 'string' || !workspaceRoot.trim()) {
      res.status(400).json({ error: 'workspaceRoot is required' });
      return;
    }
    const dest = destination === 'git' ? 'git' : 'local';
    const session = createSession({
      projectName: projectName.trim(),
      workspaceRoot: workspaceRoot.trim(),
      destination: dest,
      defaultProvider: typeof defaultProvider === 'string' ? defaultProvider : undefined,
      defaultModelId: typeof defaultModelId === 'string' ? defaultModelId : undefined,
    });
    res.status(201).json(session);
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Builder create session failed');
    sendServerError(res, error);
  }
});

/**
 * GET /api/builder/sessions/:sessionId
 * Get a Builder session (full details including mermaid, completedSectionIds).
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const session = getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Builder session not found' });
      return;
    }
    res.json(session);
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Builder get session failed');
    sendServerError(res, error);
  }
});

/**
 * POST /api/builder/sessions/:sessionId/mermaid
 * Generate Mermaid from prompt and optional refinement messages.
 * Body: { prompt: string, refinementMessages?: string[] }
 */
router.post('/sessions/:sessionId/mermaid', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { prompt, refinementMessages } = req.body as {
      prompt?: string;
      refinementMessages?: string[];
    };
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }
    const mermaid = await generateMermaid(
      sessionId,
      prompt.trim(),
      Array.isArray(refinementMessages) ? refinementMessages : []
    );
    res.json({ mermaid });
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Builder generate mermaid failed');
    sendServerError(res, error);
  }
});

/**
 * POST /api/builder/sessions/:sessionId/build
 * Stream codegen for one section (NDJSON: narrative + file events).
 * Body: { sectionId: string }
 * Sections and mermaid come from session; frontend sends sectionId only.
 */
router.post('/sessions/:sessionId/build', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const session = getSessionOrThrow(sessionId);
    const { sectionId, provider, modelId } = req.body as {
      sectionId?: string;
      provider?: string;
      modelId?: string;
    };
    if (!sectionId || typeof sectionId !== 'string' || !sectionId.trim()) {
      res.status(400).json({ error: 'sectionId is required' });
      return;
    }
    if (!session.mermaid) {
      res.status(400).json({ error: 'Session has no mermaid diagram; generate mermaid first' });
      return;
    }
    const sections = parseMermaidSections(session.mermaid);
    if (!sections.length) {
      res
        .status(400)
        .json({ error: 'No sections parsed from mermaid; check diagram has subgraphs or nodes' });
      return;
    }
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders?.();

    const send = (event: {
      type: 'narrative' | 'file';
      text?: string;
      path?: string;
      snippet?: string;
    }) => {
      res.write(JSON.stringify(event) + '\n');
      res.flushHeaders?.();
    };

    await streamBuildSection(sessionId, sectionId.trim(), sections, session.mermaid, send, {
      provider: typeof provider === 'string' ? provider : undefined,
      modelId: typeof modelId === 'string' ? modelId : undefined,
    });
    res.end();
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Builder build section failed');
    if (!res.headersSent) sendServerError(res, error);
    else res.end();
  }
});

/**
 * Parse Mermaid to sections (mirror frontend parser for stable ids).
 */
function parseMermaidSections(mermaidCode: string): Array<{ id: string; title: string }> {
  const sections: Array<{ id: string; title: string }> = [];
  const seen = new Set<string>();
  function toId(raw: string): string {
    return (
      raw
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'section'
    );
  }
  const body = mermaidCode
    .trim()
    .replace(/^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram)\s+/i, '');
  const subgraphRe = /subgraph\s+([^\n[\]]+)(?:\[([^\]]*)\])?\s*[\n\s]*([\s\S]*?)end/g;
  let m: RegExpExecArray | null;
  while ((m = subgraphRe.exec(body)) !== null) {
    const rawId = m[1].trim();
    const bracketLabel = m[2]?.trim();
    const id = toId(rawId);
    const title = bracketLabel || rawId;
    if (id && !seen.has(id)) {
      seen.add(id);
      sections.push({ id, title });
    }
  }
  if (sections.length > 0) return sections;
  const nodeRe = /(\w+|"[^"]*"|'[^']*')\s*(?:\[([^\]]*)\])?\s*(?:\(([^)]*)\))?/g;
  const used = new Set<string>();
  while ((m = nodeRe.exec(body)) !== null) {
    let rawId = m[1].trim();
    if (rawId.startsWith('"') && rawId.endsWith('"')) rawId = rawId.slice(1, -1);
    if (rawId.startsWith("'") && rawId.endsWith("'")) rawId = rawId.slice(1, -1);
    const bracketLabel = m[2]?.trim();
    const parenLabel = m[3]?.trim();
    const title = bracketLabel || parenLabel || rawId;
    const id = toId(rawId);
    if (id && id !== 'end' && id !== 'subgraph' && !used.has(id)) {
      used.add(id);
      sections.push({ id, title });
    }
  }
  return sections;
}

/**
 * POST /api/builder/sessions/:sessionId/git
 * Init, add, commit; optional createRemote to create GitHub repo and push.
 * Body: { createRemote?: boolean }
 */
router.post('/sessions/:sessionId/git', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { createRemote } = (req.body as { createRemote?: boolean }) ?? {};
    const result = await runGit(sessionId, { createRemote: !!createRemote });
    res.json(result);
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Builder git failed');
    sendServerError(res, error);
  }
});

export default router;
