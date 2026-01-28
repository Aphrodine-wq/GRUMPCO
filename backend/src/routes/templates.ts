/**
 * Template marketplace routes.
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { listTemplates, getTemplate } from '../services/templateService.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  const tagsParam = req.query.tags;
  const tags = Array.isArray(tagsParam) ? (tagsParam as string[]) : tagsParam ? [String(tagsParam)] : undefined;
  const list = listTemplates(q, tags);
  res.json({ templates: list });
});

router.get('/:id', (req: Request, res: Response) => {
  const t = getTemplate(req.params.id);
  if (!t) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json(t);
});

export default router;
