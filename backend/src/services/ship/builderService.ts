/**
 * Builder service – session CRUD, Mermaid generation (senior/CEO prompt),
 * section-aware codegen stream, file writes, git init/commit and optional create-remote+push.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { getRequestLogger } from "../../middleware/logger.js";
import { generateDiagram } from "../ai-providers/claudeService.js";
import { getStream } from "../ai-providers/llmGateway.js";
import { getToken, createRepo } from "../integrations/githubService.js";
import type { UserPreferences } from "../../prompts/index.js";
import type { ConversationMessage, RefinementContext } from "../../types/index.js";

const BUILDER_DIR = ".builder";
const SESSION_FILE = "session.json";
const LIST_FILE = "builder-sessions.json";

export type BuilderDestination = "local" | "git";

export interface BuilderSessionData {
  id: string;
  projectName: string;
  path: string;
  destination: BuilderDestination;
  status: string;
  mermaid?: string;
  completedSectionIds?: string[];
  /** Default AI provider for this project (e.g. nim, openrouter). */
  defaultProvider?: string;
  /** Default model ID for this project. */
  defaultModelId?: string;
  updatedAt: string;
}

const sessions = new Map<string, BuilderSessionData>();

function listFilePath(): string {
  return join(process.cwd(), "data", LIST_FILE);
}

function loadSessionList(): void {
  try {
    const p = listFilePath();
    if (!existsSync(p)) return;
    const raw = readFileSync(p, "utf8");
    const arr = JSON.parse(raw) as BuilderSessionData[];
    for (const s of arr) sessions.set(s.id, s);
  } catch {
    /* ignore */
  }
}

function saveSessionList(): void {
  try {
    const dir = dirname(listFilePath());
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const arr = Array.from(sessions.values());
    writeFileSync(listFilePath(), JSON.stringify(arr, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

loadSessionList();

function loadSessionFromDisk(sessionPath: string): BuilderSessionData | null {
  try {
    const p = join(sessionPath, BUILDER_DIR, SESSION_FILE);
    if (!existsSync(p)) return null;
    const raw = readFileSync(p, "utf8");
    return JSON.parse(raw) as BuilderSessionData;
  } catch {
    return null;
  }
}

function saveSessionToDisk(session: BuilderSessionData): void {
  const dir = join(session.path, BUILDER_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = join(dir, SESSION_FILE);
  const updated = { ...session, updatedAt: new Date().toISOString() };
  writeFileSync(p, JSON.stringify(updated, null, 2), "utf8");
  saveSessionList();
}

/** Senior engineer / CEO mindset prompt for Builder Mermaid generation */
const BUILDER_DIAGRAM_SYSTEM = `You are a senior software engineer with 20 years of experience in production systems and a CEO-driven mindset. Your diagrams must be clear, business-aligned, and risk-aware. Focus on high-level architecture: bounded contexts, main flows, and critical integrations. Choose the single most appropriate Mermaid diagram type (flowchart, C4, sequence, etc.) for the user's system. Return ONLY valid Mermaid code inside a single \`\`\`mermaid code block. Use subgraphs to represent major sections/components so they can be built incrementally.`;

/**
 * List all Builder sessions (from in-memory cache; createSession adds to it).
 */
export function listSessions(): BuilderSessionData[] {
  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Create a new Builder session: create project folder and .builder/session.json.
 */
export function createSession(params: {
  projectName: string;
  workspaceRoot: string;
  destination: BuilderDestination;
  defaultProvider?: string;
  defaultModelId?: string;
}): BuilderSessionData {
  const log = getRequestLogger();
  const { projectName, workspaceRoot, destination, defaultProvider, defaultModelId } = params;
  const path = join(workspaceRoot, projectName);
  if (existsSync(path)) {
    const existing = loadSessionFromDisk(path);
    if (existing) {
      sessions.set(existing.id, existing);
      return existing;
    }
  }
  mkdirSync(path, { recursive: true });
  const id = randomUUID();
  const session: BuilderSessionData = {
    id,
    projectName,
    path,
    destination,
    status: "created",
    completedSectionIds: [],
    defaultProvider,
    defaultModelId,
    updatedAt: new Date().toISOString(),
  };
  sessions.set(id, session);
  saveSessionToDisk(session);
  log.info({ sessionId: id, path }, "Builder session created");
  return session;
}

/**
 * Get a Builder session by id. Refreshes from project .builder/session.json if present.
 */
export function getSession(sessionId: string): BuilderSessionData | null {
  const cached = sessions.get(sessionId);
  if (cached && existsSync(cached.path)) {
    const disk = loadSessionFromDisk(cached.path);
    if (disk && disk.id === sessionId) {
      sessions.set(sessionId, disk);
      return disk;
    }
  }
  return cached ?? null;
}

/**
 * Get session by id or throw.
 */
export function getSessionOrThrow(sessionId: string): BuilderSessionData {
  const session = getSession(sessionId);
  if (!session) throw new Error("Builder session not found");
  return session;
}

/**
 * Generate Mermaid diagram from prompt and optional refinement messages (1–2).
 * Uses senior-engineer/CEO system prompt; AI chooses diagram type.
 */
export async function generateMermaid(
  sessionId: string,
  prompt: string,
  refinementMessages: string[] = []
): Promise<string> {
  const session = getSessionOrThrow(sessionId);
  const log = getRequestLogger();

  const conversationHistory: ConversationMessage[] = [];
  let refinementContext: RefinementContext | undefined;
  if (session.mermaid && refinementMessages.length > 0) {
    refinementContext = { baseDiagram: session.mermaid };
    refinementMessages.forEach((msg, i) => {
      conversationHistory.push({ role: "user", content: msg });
      conversationHistory.push({
        role: "assistant",
        content: `Refinement ${i + 1} applied. Updated diagram follows.`,
      });
    });
  }

  const preferences: UserPreferences = {
    promptMode: "builder",
    complexity: "detailed",
  };
  const mermaid = await generateDiagram(
    prompt,
    preferences,
    conversationHistory.length ? conversationHistory : undefined,
    refinementContext
  );

  session.mermaid = mermaid;
  session.status = "mermaid_ready";
  session.updatedAt = new Date().toISOString();
  sessions.set(sessionId, session);
  saveSessionToDisk(session);
  log.info({ sessionId }, "Builder Mermaid generated");
  return mermaid;
}

/** Fallback model for Builder codegen when none specified */
const CODGEN_MODEL = "moonshotai/kimi-k2.5";

/**
 * Stream codegen for one section: narrative + file events (NDJSON), write files to session path.
 * Uses session.defaultProvider/defaultModelId unless overridden by provider/modelId.
 */
export async function streamBuildSection(
  sessionId: string,
  sectionId: string,
  sections: Array<{ id: string; title: string }>,
  mermaid: string,
  onEvent: (event: { type: "narrative" | "file"; text?: string; path?: string; snippet?: string }) => void,
  options?: { provider?: string; modelId?: string }
): Promise<void> {
  const session = getSessionOrThrow(sessionId);
  const log = getRequestLogger();
  const section = sections.find((s) => s.id === sectionId);
  const sectionTitle = section?.title ?? sectionId;

  const provider = options?.provider ?? session.defaultProvider ?? "nim";
  const modelId = options?.modelId ?? session.defaultModelId ?? CODGEN_MODEL;

  const systemPrompt = `You are a senior software engineer. Given a Mermaid architecture diagram and a section to implement, generate only the code for that section. Output exactly in this format:
- For narrative: a line starting with "NARRATIVE:" followed by the message (e.g. "Creating auth module...")
- For each file: a line "FILE: <relativePath>" then a fenced code block with \`\`\` and the file content, then \`\`\`
Use only NARRATIVE: and FILE: lines. Generate real, minimal but correct code (e.g. TypeScript/JavaScript, package.json, README) for the section "${sectionTitle}".`;

  const userMessage = `Mermaid diagram:
\`\`\`mermaid
${mermaid}
\`\`\`

Implement only the section: ${sectionTitle} (id: ${sectionId}). Output NARRATIVE: lines and FILE: blocks.`;

  const stream = getStream(
    {
      model: modelId,
      max_tokens: 16384,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    },
    { provider: provider as any, modelId }
  );

  let buffer = "";
  let currentPath: string | null = null;
  let inBlock = false;
  let blockContent = "";

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta?.type === "text_delta" &&
      typeof event.delta.text === "string"
    ) {
      const text = event.delta.text;
      buffer += text;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("NARRATIVE:")) {
          const text = line.slice("NARRATIVE:".length).trim();
          if (text) onEvent({ type: "narrative", text });
          continue;
        }
        if (line.startsWith("FILE:")) {
          if (currentPath && blockContent) {
            const fullPath = join(session.path, currentPath);
            mkdirSync(dirname(fullPath), { recursive: true });
            writeFileSync(fullPath, blockContent, "utf8");
            onEvent({ type: "file", path: currentPath, snippet: blockContent.slice(0, 200) });
          }
          currentPath = line.slice("FILE:".length).trim();
          blockContent = "";
          inBlock = false;
          continue;
        }
        if (currentPath !== null) {
          if (line.trim() === "```") {
            if (inBlock) {
              const fullPath = join(session.path, currentPath);
              mkdirSync(dirname(fullPath), { recursive: true });
              writeFileSync(fullPath, blockContent, "utf8");
              onEvent({ type: "file", path: currentPath, snippet: blockContent.slice(0, 200) });
              currentPath = null;
            }
            inBlock = !inBlock;
            blockContent = "";
          } else if (inBlock) {
            blockContent += line + "\n";
          }
        }
      }
    }
  }

  if (buffer.trim()) {
    if (currentPath !== null && inBlock) blockContent += buffer + "\n";
    else if (buffer.startsWith("NARRATIVE:")) {
      const text = buffer.slice("NARRATIVE:".length).trim();
      if (text) onEvent({ type: "narrative", text });
    }
  }
  if (currentPath && blockContent) {
    const fullPath = join(session.path, currentPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, blockContent, "utf8");
    onEvent({ type: "file", path: currentPath, snippet: blockContent.slice(0, 200) });
  }

  const completed = [...(session.completedSectionIds ?? []), sectionId];
  session.completedSectionIds = completed;
  session.updatedAt = new Date().toISOString();
  sessions.set(sessionId, session);
  saveSessionToDisk(session);
  log.info({ sessionId, sectionId }, "Builder section build completed");
}

/**
 * Initialize Git in session path and optionally create remote and push.
 */
export async function runGit(
  sessionId: string,
  options: { createRemote?: boolean } = {}
): Promise<{ repoUrl?: string; pushed?: boolean }> {
  const session = getSessionOrThrow(sessionId);
  const log = getRequestLogger();
  const { path, projectName } = session;

  if (!existsSync(join(path, ".git"))) {
    execSync("git init", { cwd: path });
    execSync('git config user.email "grump@local"', { cwd: path });
    execSync('git config user.name "G-Rump"', { cwd: path });
    execSync("git add -A", { cwd: path });
    execSync('git commit -m "Initial commit from G-Rump Builder"', { cwd: path });
    log.info({ sessionId, path }, "Git initialized and first commit created");
  }

  if (options.createRemote) {
    const token = getToken();
    if (!token) throw new Error("No GitHub token. Complete OAuth first.");
    const cloneUrl = await createRepo(projectName, token);
    const authUrl = cloneUrl.replace("https://", `https://${token}@`);
    execSync(`git remote add origin ${authUrl}`, { cwd: path });
    execSync("git branch -M main", { cwd: path });
    execSync("git push -u origin main", { cwd: path });
    log.info({ sessionId, cloneUrl }, "Pushed to GitHub");
    return { repoUrl: cloneUrl.replace(/\.git$/, ""), pushed: true };
  }

  return { pushed: false };
}
