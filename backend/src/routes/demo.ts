/**
 * Demo mode: create a copy of the sample project and return workspace path + guided steps.
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import logger from '../middleware/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

/** Demo tutorial steps for the frontend */
export const DEMO_STEPS = [
  { target: '.chat-input', title: 'Demo workspace ready', content: 'Your demo project is set as the workspace. Try: "Add a /health endpoint that returns { status: \"ok\" }"', position: 'top' as const },
  { target: '[data-mode-selector]', title: 'Code mode', content: 'Stay in Code mode so the AI can use file and terminal tools.', position: 'bottom' as const },
  { target: '[data-tool-calls]', title: 'Watch tools', content: 'The AI will use file_read, file_write, and terminal_execute to implement your request.', position: 'left' as const },
];

function getDemoTemplatePath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'templates', 'demo-project'),
    path.join(process.cwd(), '..', 'templates', 'demo-project'),
    path.join(__dirname, '..', '..', 'templates', 'demo-project'),
  ];
  for (const dir of candidates) {
    if (fsSync.existsSync(dir)) {
      return dir;
    }
  }
  return null;
}

/**
 * POST /api/demo/start
 * Creates a copy of the demo template in a temp dir and returns workspace path + steps.
 */
router.post('/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const templatePath = getDemoTemplatePath();
    if (!templatePath) {
      logger.warn('Demo template not found (templates/demo-project)');
      res.status(503).json({
        error: 'Demo template not available. Ensure templates/demo-project exists.',
      });
      return;
    }

    const prefix = path.join(os.tmpdir(), 'grump-demo-');
    const workspacePath = await fs.mkdtemp(prefix);
    await fs.cp(templatePath, workspacePath, { recursive: true });

    logger.info({ workspacePath }, 'Demo workspace created');

    res.json({
      workspacePath,
      steps: DEMO_STEPS,
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Demo start failed');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create demo workspace',
    });
  }
});

export default router;
