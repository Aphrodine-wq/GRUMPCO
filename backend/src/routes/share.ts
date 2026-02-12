/**
 * Share API Routes
 * POST /api/share - Create a shareable link for a diagram/artifact
 * GET /api/share/:id - Retrieve shared content
 */

import { Router, type Request, type Response } from 'express';
import { getRequestLogger } from '../middleware/logger.js';
import { sendServerError, sendErrorResponse, ErrorCode } from '../utils/errorResponse.js';
import { randomBytes } from 'crypto';

const router = Router();

interface BundleItem {
  type: 'diagram' | 'architecture' | 'prd' | 'plan' | 'code';
  content: string;
  title?: string;
  mermaidCode?: string;
}

interface SharePayload {
  type: 'diagram' | 'architecture' | 'prd' | 'code' | 'bundle';
  content: string;
  title?: string;
  description?: string;
  mermaidCode?: string;
  expiresIn?: number; // hours, default 168 (7 days)
  /** For type 'bundle': items to include (diagram, PRD, plan, etc.) */
  items?: BundleItem[];
}

interface SharedItem {
  id: string;
  type: SharePayload['type'];
  content: string;
  title?: string;
  description?: string;
  mermaidCode?: string;
  createdAt: string;
  expiresAt: string;
  views: number;
}

// In-memory storage (can be replaced with persistent DB storage)
const sharedItems = new Map<string, SharedItem>();

/**
 * Generate a unique share ID
 */
function generateShareId(): string {
  return randomBytes(8).toString('base64url');
}

/**
 * Clean up expired items periodically
 */
function cleanupExpiredItems(): void {
  const now = new Date();
  for (const [id, item] of sharedItems.entries()) {
    if (new Date(item.expiresAt) < now) {
      sharedItems.delete(id);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupExpiredItems, 10 * 60 * 1000);

/**
 * POST /api/share
 * Create a shareable link for content
 */
router.post(
  '/',
  async (req: Request<Record<string, never>, object, SharePayload>, res: Response) => {
    const log = getRequestLogger();
    const { type, content, title, description, mermaidCode, expiresIn = 168 } = req.body;

    if (!type || !content) {
      sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'type and content are required');
      return;
    }

    if (!['diagram', 'architecture', 'prd', 'code', 'bundle'].includes(type)) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        'type must be one of: diagram, architecture, prd, code, bundle'
      );
      return;
    }

    let payloadContent = content;
    if (type === 'bundle' && req.body.items && Array.isArray(req.body.items)) {
      payloadContent = JSON.stringify({ items: req.body.items, title });
    }

    if (expiresIn < 1 || expiresIn > 720) {
      // 1 hour to 30 days
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        'expiresIn must be between 1 and 720 hours'
      );
      return;
    }

    try {
      const shareId = generateShareId();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + expiresIn * 60 * 60 * 1000);

      const sharedItem: SharedItem = {
        id: shareId,
        type,
        content: payloadContent,
        title,
        description,
        mermaidCode,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        views: 0,
      };

      // Store in memory
      sharedItems.set(shareId, sharedItem);

      log.info({ shareId, type, expiresIn }, 'Shareable link created');

      res.status(201).json({
        success: true,
        shareId,
        shareUrl: `/share/${shareId}`,
        expiresAt: sharedItem.expiresAt,
      });
    } catch (e) {
      log.error({ error: (e as Error).message }, 'Failed to create shareable link');
      sendServerError(res, e as Error);
    }
  }
);

/**
 * GET /api/share/:id
 * Retrieve shared content
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const log = getRequestLogger();
  const { id } = req.params;

  if (!id || id.length < 4) {
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'Invalid share ID');
    return;
  }

  try {
    const sharedItem = sharedItems.get(id);

    if (!sharedItem) {
      sendErrorResponse(res, ErrorCode.NOT_FOUND, 'Shared content not found or has expired');
      return;
    }

    // Check expiration
    if (new Date(sharedItem.expiresAt) < new Date()) {
      sharedItems.delete(id);
      sendErrorResponse(res, ErrorCode.GONE, 'This shared link has expired');
      return;
    }

    // Increment view count
    sharedItem.views++;

    log.info(
      { shareId: id, type: sharedItem.type, views: sharedItem.views },
      'Shared item accessed'
    );

    res.json({
      success: true,
      item: {
        type: sharedItem.type,
        content: sharedItem.content,
        title: sharedItem.title,
        description: sharedItem.description,
        mermaidCode: sharedItem.mermaidCode,
        createdAt: sharedItem.createdAt,
        expiresAt: sharedItem.expiresAt,
        views: sharedItem.views,
      },
    });
  } catch (e) {
    log.error({ error: (e as Error).message }, 'Failed to retrieve shared content');
    sendServerError(res, e as Error);
  }
});

/**
 * DELETE /api/share/:id
 * Delete a shared item
 */
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const log = getRequestLogger();
  const { id } = req.params;

  if (!id) {
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'Share ID is required');
    return;
  }

  try {
    const existed = sharedItems.has(id);
    sharedItems.delete(id);

    if (existed) {
      log.info({ shareId: id }, 'Shared item deleted');
      res.json({ success: true, message: 'Shared item deleted' });
    } else {
      sendErrorResponse(res, ErrorCode.NOT_FOUND, 'Shared item not found');
    }
  } catch (e) {
    log.error({ error: (e as Error).message }, 'Failed to delete shared item');
    sendServerError(res, e as Error);
  }
});

/**
 * GET /api/share
 * List all shared items (for admin/debugging)
 */
router.get('/', async (_req: Request, res: Response) => {
  const log = getRequestLogger();

  try {
    // Clean up expired items first
    cleanupExpiredItems();

    const items = Array.from(sharedItems.values()).map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      views: item.views,
    }));

    log.debug({ count: items.length }, 'Listed shared items');

    res.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (e) {
    log.error({ error: (e as Error).message }, 'Failed to list shared items');
    sendServerError(res, e as Error);
  }
});

export default router;
