/**
 * Session Attachments API
 * Store and list documents/images attached to a chat session (in-memory; keyed by session id).
 * POST /api/session-attachments/:sessionId – add attachments (JSON: { attachments: [{ name, mimeType, size, dataBase64? }] })
 * GET /api/session-attachments/:sessionId – list attachments
 * DELETE /api/session-attachments/:sessionId/:attachmentId – remove one
 */

import { Router, type Request, type Response } from 'express';
import { sendErrorResponse, sendServerError, ErrorCode } from '../utils/errorResponse.js';
import logger from '../middleware/logger.js';

const router = Router();

interface StoredAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataBase64?: string;
}

const store = new Map<string, StoredAttachment[]>();

function listAttachments(sessionId: string): StoredAttachment[] {
  return store.get(sessionId) ?? [];
}

function addAttachments(
  sessionId: string,
  items: Array<{
    name: string;
    mimeType: string;
    size: number;
    dataBase64?: string;
  }>
): StoredAttachment[] {
  const list = listAttachments(sessionId);
  const next: StoredAttachment[] = [...list];
  for (const item of items) {
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    next.push({
      id,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      dataBase64: item.dataBase64,
    });
  }
  store.set(sessionId, next);
  return next;
}

function removeAttachment(sessionId: string, attachmentId: string): boolean {
  const list = listAttachments(sessionId);
  const idx = list.findIndex((a) => a.id === attachmentId);
  if (idx === -1) return false;
  const next = list.filter((a) => a.id !== attachmentId);
  store.set(sessionId, next);
  return true;
}

/**
 * GET /api/session-attachments/:sessionId
 * List attachments for a session (returns id, name, mimeType, size only).
 */
router.get('/:sessionId', (req: Request, res: Response): void => {
  try {
    const { sessionId } = req.params;
    if (!sessionId?.trim()) {
      sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'sessionId required', {});
      return;
    }
    const list = listAttachments(sessionId).map((a) => ({
      id: a.id,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
    }));
    res.json({ attachments: list });
  } catch (err) {
    logger.warn({ err }, 'Session attachments list failed');
    sendServerError(res, err, { type: 'session_attachments' });
  }
});

/**
 * POST /api/session-attachments/:sessionId
 * Add attachments. Body: { attachments: [{ name, mimeType, size, dataBase64? }] }
 */
router.post('/:sessionId', (req: Request, res: Response): void => {
  try {
    const { sessionId } = req.params;
    if (!sessionId?.trim()) {
      sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'sessionId required', {});
      return;
    }
    const body = (req.body ?? {}) as {
      attachments?: Array<{
        name?: string;
        mimeType?: string;
        size?: number;
        dataBase64?: string;
      }>;
    };
    const raw = body.attachments;
    if (!Array.isArray(raw) || raw.length === 0) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        'attachments (non-empty array) required',
        {}
      );
      return;
    }
    const items = raw
      .filter(
        (a) =>
          a &&
          typeof a.name === 'string' &&
          typeof a.mimeType === 'string' &&
          typeof a.size === 'number'
      )
      .map((a) => ({
        name: (a.name as string).trim() || 'file',
        mimeType: (a.mimeType as string).trim() || 'application/octet-stream',
        size: Math.max(0, Number(a.size)),
        dataBase64: typeof a.dataBase64 === 'string' ? a.dataBase64 : undefined,
      }));
    if (items.length === 0) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        'Each attachment must have name, mimeType, size',
        {}
      );
      return;
    }
    const list = addAttachments(sessionId, items);
    const created = list.slice(-items.length).map((a) => ({
      id: a.id,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
    }));
    res.status(201).json({ attachments: created });
  } catch (err) {
    logger.warn({ err }, 'Session attachments add failed');
    sendServerError(res, err, { type: 'session_attachments' });
  }
});

/**
 * DELETE /api/session-attachments/:sessionId/:attachmentId
 */
router.delete('/:sessionId/:attachmentId', (req: Request, res: Response): void => {
  try {
    const { sessionId, attachmentId } = req.params;
    if (!sessionId?.trim() || !attachmentId?.trim()) {
      sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'sessionId and attachmentId required', {});
      return;
    }
    const ok = removeAttachment(sessionId, attachmentId);
    if (!ok) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    logger.warn({ err }, 'Session attachment delete failed');
    sendServerError(res, err, { type: 'session_attachments' });
  }
});

export default router;
