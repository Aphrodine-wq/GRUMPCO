import { Router } from "express";
import { skillRegistry } from "../skills/index.js";

const router = Router();

/**
 * GET /api/skills
 * List all available skills in the registry.
 */
router.get("/", (req, res) => {
  const skills = skillRegistry.getAllSkills().map((s) => ({
    id: s.manifest.id,
    name: s.manifest.name,
    version: s.manifest.version,
    description: s.manifest.description,
    category: s.manifest.category,
    icon: s.manifest.icon,
    tags: s.manifest.tags,
    capabilities: s.manifest.capabilities,
  }));
  res.json({ skills });
});

/**
 * GET /api/skills/:id
 * Get details for a specific skill.
 */
router.get("/:id", (req, res) => {
  const skill = skillRegistry.getSkill(req.params.id);
  if (!skill) {
    res.status(404).json({ error: "Skill not found" });
    return;
  }
  res.json({
    ...skill.manifest,
    tools: skill.tools?.definitions.map((t) => t.name),
    hasRoutes: !!skill.routes,
    hasPrompts: !!skill.prompts,
  });
});

export default router;
