/**
 * Gmail Pub/Sub Webhook
 * POST /api/integrations/gmail/push - receives Gmail watch notifications
 * Requires: Gmail API, Cloud Pub/Sub, OAuth configured.
 * See docs/GMAIL_SETUP.md for setup.
 */

import { Router, type Request, type Response } from "express";
import logger from "../middleware/logger.js";
import { enqueueGmailJob } from "../services/integrations/gmailJobQueue.js";

const router = Router();

/**
 * POST /api/integrations/gmail/push
 * Gmail Push notification endpoint (Pub/Sub subscription)
 */
router.post("/push", async (req: Request, res: Response) => {
  try {
    const body = req.body as { message?: { data?: string } };
    if (!body?.message?.data) {
      return res.status(400).json({ error: "Invalid Pub/Sub message format" });
    }
    const data = Buffer.from(body.message.data, "base64").toString("utf8");
    const parsed = JSON.parse(data) as {
      emailAddress?: string;
      historyId?: string;
    };
    logger.info(
      { email: parsed.emailAddress, historyId: parsed.historyId },
      "Gmail push received",
    );

    if (parsed.emailAddress && parsed.historyId) {
      await enqueueGmailJob("process-gmail-webhook", {
        emailAddress: parsed.emailAddress,
        historyId: parsed.historyId,
      });
    }

    return res.status(200).send();
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "Gmail push error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
