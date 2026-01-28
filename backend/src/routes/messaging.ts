/**
 * Messaging webhook – Twilio (or similar) inbound SMS/voice → run chat, optional reply.
 * POST /api/messaging/inbound
 *
 * Config: MESSAGING_PROVIDER=twilio, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * TWILIO_REPLY_TO_NUMBER, TWILIO_WEBHOOK_SECRET (optional; if set, require X-Webhook-Secret header).
 * Optional: PHONE_TO_USER_ID as JSON map {"+1234567890":"user-id"} to route phone → user.
 */

import { Router, Request, Response } from 'express';
import { claudeServiceWithTools } from '../services/claudeServiceWithTools.js';
import logger from '../middleware/logger.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

function verifyWebhook(req: Request): { ok: boolean; missingInProd?: boolean } {
  const secret = process.env.TWILIO_WEBHOOK_SECRET;
  if (isProduction && process.env.MESSAGING_PROVIDER === 'twilio' && !secret) {
    return { ok: false, missingInProd: true };
  }
  if (!secret) return { ok: true };
  const header = req.headers['x-webhook-secret'] ?? req.headers['x-twilio-secret'];
  return { ok: header === secret };
}

/** Resolve phone number to user key (default: 'default' for now). */
function resolveUserKey(_from: string): string {
  const mapping = process.env.PHONE_TO_USER_ID;
  if (mapping) {
    try {
      const entries = JSON.parse(mapping) as Record<string, string>;
      const key = entries[_from] ?? entries[_from.replace(/\D/g, '')];
      if (key) return key;
    } catch {
      // ignore
    }
  }
  return 'default';
}

/** In-memory conversation per From (no persistence for beta). */
const conversationByFrom = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();

async function runChatAndGetReply(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  let lastText = '';
  try {
    const stream = claudeServiceWithTools.generateChatStream(
      messages,
      undefined,
      undefined,
      'normal',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
    for await (const ev of stream) {
      if (ev.type === 'text' && ev.text) lastText += ev.text;
      if (ev.type === 'error') lastText += (ev as { message?: string }).message ?? 'Error.';
      if (ev.type === 'done') break;
    }
  } catch (err) {
    logger.warn({ err }, 'Messaging chat stream error');
    lastText = 'Sorry, something went wrong.';
  }
  return lastText.trim().slice(0, 1600) || 'Done.';
}

/**
 * POST /api/messaging/inbound
 * Body (Twilio form): From, To, Body (SMS) or SpeechResult (voice), MessageSid.
 * Mount with express.urlencoded({ extended: true }) if not already applied.
 */
router.post('/inbound', async (req: Request, res: Response) => {
  const verification = verifyWebhook(req);
  if (verification.missingInProd) {
    logger.warn('Twilio webhook secret not configured in production');
    res.status(503).json({ error: 'Messaging webhook secret not configured', type: 'config_error' });
    return;
  }
  if (!verification.ok) {
    res.status(403).json({ error: 'Invalid webhook secret' });
    return;
  }

  const provider = process.env.MESSAGING_PROVIDER ?? 'twilio';
  if (provider !== 'twilio') {
    res.status(200).send('');
    return;
  }

  const body = req.body ?? {};
  const from = (body.From ?? body.from ?? '').toString();
  const text = (body.Body ?? body.body ?? body.SpeechResult ?? body.TranscriptionText ?? '').toString().trim();

  if (!from) {
    logger.warn({ body: JSON.stringify(body).slice(0, 200) }, 'Messaging inbound: missing From');
    res.status(200).send('');
    return;
  }

  const userKey = resolveUserKey(from);
  if (userKey === 'default' && process.env.PHONE_TO_USER_ID) {
    logger.debug({ from }, 'Messaging: phone not mapped, ignoring');
    res.status(200).send('');
    return;
  }

  const prev = conversationByFrom.get(from) ?? [];
  const nextMessages = [...prev, { role: 'user' as const, content: text || '(empty)' }];
  conversationByFrom.set(from, nextMessages);

  const reply = await runChatAndGetReply(nextMessages);
  const assistantMsg = { role: 'assistant' as const, content: reply };
  conversationByFrom.set(from, [...nextMessages, assistantMsg]);

  const replyNumber = process.env.TWILIO_REPLY_TO_NUMBER ?? (body?.To ?? body?.to);
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (replyNumber && accountSid && authToken && reply) {
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const params = new URLSearchParams({
        To: from,
        From: replyNumber.toString(),
        Body: reply,
      });
      const twilioRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
        body: params.toString(),
      });
      if (!twilioRes.ok) {
        logger.warn({ status: twilioRes.status, text: await twilioRes.text() }, 'Twilio send failed');
      }
    } catch (err) {
      logger.warn({ err }, 'Twilio send error');
    }
  }

  res.status(200).send('');
});

export default router;
