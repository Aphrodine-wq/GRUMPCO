/**
 * Skills API – generate SKILL.md from description, create user skills, register user tools.
 * Used by "add to skills from chat" flows and Skills screen.
 * Mounted at /api/skills-api to avoid clashing with /api/skills (skill registry).
 */

import { Router, type Request, type Response } from "express";
import { createSkill } from "../services/workspace/userSkillsService.js";
import { sendServerError } from "../utils/errorResponse.js";

const router = Router();

function getUserId(req: Request): string {
  const header = req.headers["x-user-id"];
  if (typeof header === "string" && header.trim()) return header.trim();
  const r = req as Request & { user?: { id?: string }; userId?: string };
  return r.user?.id ?? r.userId ?? "default";
}

/**
 * POST /api/skills-api/generate-skill-md
 * Generate a SKILL.md (Cursor skill) from a short description.
 * Body: { description: string }
 * Returns: { content: string } – the SKILL.md body to save to .cursor/skills/ or similar.
 */
router.post(
  "/generate-skill-md",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { description } = req.body as { description?: string };
      if (!description || typeof description !== "string") {
        res.status(400).json({ error: "description (string) required" });
        return;
      }
      const content = `# Skill: ${description.slice(0, 80)}${description.length > 80 ? "..." : ""}

## When to use
Use this skill when the user asks for: ${description.slice(0, 200)}.

## Steps
1. Clarify scope if needed.
2. Apply the skill logic.
3. Confirm result.

## Rules
- Prefer small, focused changes.
- Explain briefly what you did.
`;
      res.json({ content });
    } catch (err) {
      sendServerError(res, err);
    }
  },
);

/**
 * POST /api/skills-api/create
 * Create an in-house (user) skill. Appears in the skills list after creation.
 * Body: { name: string, description: string, tools?: Array<{ name: string, description: string }> }
 * Returns: { success: boolean, skillId?: string, error?: string }
 */
router.post("/create", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, tools } = (req.body ?? {}) as {
      name?: string;
      description?: string;
      tools?: Array<{ name: string; description: string }>;
    };
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name (non-empty string) required" });
      return;
    }
    if (!description || typeof description !== "string") {
      res.status(400).json({ error: "description (string) required" });
      return;
    }
    const userId = getUserId(req);
    const result = await createSkill(
      name.trim(),
      description.trim(),
      Array.isArray(tools) ? tools : [],
      {},
      userId,
    );
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    res.status(201).json({ success: true, skillId: result.skillId });
  } catch (err) {
    sendServerError(res, err);
  }
});

export default router;
