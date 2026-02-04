/**
 * Skills API – generate SKILL.md from description, register user tools.
 * Used by "add to skills from chat" flows.
 * Mounted at /api/skills-api to avoid clashing with /api/skills (skill registry).
 */

import { Router, type Request, type Response } from 'express';
import { sendServerError } from '../utils/errorResponse.js';

const router = Router();

/**
 * POST /api/skills-api/generate-skill-md
 * Generate a SKILL.md (Cursor skill) from a short description.
 * Body: { description: string }
 * Returns: { content: string } – the SKILL.md body to save to .cursor/skills/ or similar.
 */
router.post('/generate-skill-md', async (req: Request, res: Response): Promise<void> => {
  try {
    const { description } = req.body as { description?: string };
    if (!description || typeof description !== 'string') {
      res.status(400).json({ error: 'description (string) required' });
      return;
    }
    const content = `# Skill: ${description.slice(0, 80)}${description.length > 80 ? '...' : ''}

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
});

export default router;
