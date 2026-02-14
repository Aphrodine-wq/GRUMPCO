/**
 * Session attachment CRUD logic extracted from RefactoredChatInterface.
 * Pure async functions that accept session ID + API wrappers.
 */
import {
  listSessionAttachments,
  addSessionAttachments,
  removeSessionAttachment,
  type SessionAttachment,
} from '../api';
import { showToast } from '../../stores/toastStore';

/**
 * Load all attachments for a session.
 */
export async function loadAttachments(sessionId: string | undefined): Promise<SessionAttachment[]> {
  if (!sessionId) return [];
  try {
    return await listSessionAttachments(sessionId);
  } catch {
    return [];
  }
}

/**
 * Process and upload files as session attachments.
 * Returns the updated full list of attachments.
 */
export async function addAttachments(
  sessionId: string | undefined,
  files: FileList | null,
  currentAttachments: SessionAttachment[]
): Promise<SessionAttachment[]> {
  if (!sessionId || !files?.length) return currentAttachments;
  const maxSize = 500 * 1024;
  const items: Array<{ name: string; mimeType: string; size: number; dataBase64?: string }> = [];

  for (const file of Array.from(files)) {
    if (file.size > maxSize) continue;
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = r.result as string;
        resolve(s.includes(',') ? (s.split(',')[1] ?? '') : s);
      };
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    items.push({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      dataBase64,
    });
  }

  if (items.length === 0) return currentAttachments;

  try {
    const added = await addSessionAttachments(sessionId, items);
    showToast('Attachments added', 'success');
    return [...currentAttachments, ...added];
  } catch {
    showToast('Failed to add attachments', 'error');
    return currentAttachments;
  }
}

/**
 * Remove a single attachment from a session.
 * Returns the updated attachments list.
 */
export async function removeAttachment(
  sessionId: string | undefined,
  attachmentId: string,
  currentAttachments: SessionAttachment[]
): Promise<SessionAttachment[]> {
  if (!sessionId) return currentAttachments;
  try {
    await removeSessionAttachment(sessionId, attachmentId);
    showToast('Attachment removed', 'success');
    return currentAttachments.filter((a) => a.id !== attachmentId);
  } catch {
    showToast('Failed to remove attachment', 'error');
    return currentAttachments;
  }
}
