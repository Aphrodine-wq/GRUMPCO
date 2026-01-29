import { Router, Request, Response } from 'express';
import { loadRemoteWorkspace } from '../services/remoteWorkspaceService.js';
import logger from '../middleware/logger.js';

const router = Router();

/**
 * POST /api/workspace/remote
 * Body: { repoUrl: string }
 */
router.post('/remote', async (req: Request, res: Response) => {
    const { repoUrl } = req.body;

    if (!repoUrl) {
        return res.status(400).json({ error: 'repoUrl is required' });
    }

    try {
        logger.info({ repoUrl }, 'Loading remote workspace');
        const workspace = await loadRemoteWorkspace(repoUrl);
        res.json(workspace);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load repository';
        logger.error({ error: message, repoUrl }, 'Failed to load remote workspace');
        res.status(500).json({ error: message });
    }
});

export default router;
