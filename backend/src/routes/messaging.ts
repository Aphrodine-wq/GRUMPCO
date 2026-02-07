/**
 * Messaging webhooks – Twilio (SMS/voice/WhatsApp), Telegram.
 * POST /api/messaging/inbound – Twilio
 * POST /api/messaging/telegram – Telegram
 * POST /api/messaging/subscribe – Pair chat app for proactive push
 * DELETE /api/messaging/subscribe – Remove subscription
 * GET /api/messaging/subscriptions – List user's subscriptions
 *
 * Config: MESSAGING_PROVIDER=twilio, TWILIO_*; TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET.
 * Optional: PHONE_TO_USER_ID as JSON map for Twilio routing.
 */

import { Router, type Request, type Response } from "express";
import { processMessage } from "../services/messagingService.js";
import { sendTelegram, sendTwilio } from "../services/messagingShipNotifier.js";
import { getDatabase } from "../db/database.js";
import logger from "../middleware/logger.js";
import { timingSafeEqualString } from "../utils/security.js";

const router = Router();
const PLATFORMS = ["telegram", "discord", "twilio", "slack"] as const;
const isProduction = process.env.NODE_ENV === "production";

function verifyTwilioWebhook(req: Request): {
  ok: boolean;
  missingInProd?: boolean;
} {
  const secret = process.env.TWILIO_WEBHOOK_SECRET;
  if (isProduction && process.env.MESSAGING_PROVIDER === "twilio" && !secret) {
    return { ok: false, missingInProd: true };
  }
  if (!secret) return { ok: true };
  const header =
    req.headers["x-webhook-secret"] ?? req.headers["x-twilio-secret"];
  const provided = typeof header === "string" ? header : "";
  return { ok: timingSafeEqualString(provided, secret) };
}

function verifyTelegramWebhook(req: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;
  const q = (req.query?.secret ?? req.query?.token) as string | undefined;
  if (q) return timingSafeEqualString(q, secret);
  const header = req.headers["x-telegram-bot-api-secret-token"] as
    | string
    | undefined;
  if (header) return timingSafeEqualString(header, secret);
  return false;
}

/** Resolve phone number to user key (default: 'default' for now). */
function resolveUserKey(_from: string): string {
  const mapping = process.env.PHONE_TO_USER_ID;
  if (mapping) {
    try {
      const entries = JSON.parse(mapping) as Record<string, string>;
      const key = entries[_from] ?? entries[_from.replace(/\D/g, "")];
      if (key) return key;
    } catch {
      // ignore
    }
  }
  return "default";
}

/**
 * POST /api/messaging/inbound
 * Body (Twilio form): From, To, Body (SMS) or SpeechResult (voice), MessageSid.
 * For WhatsApp: From is whatsapp:+1234567890.
 */
router.post("/inbound", async (req: Request, res: Response) => {
  const verification = verifyTwilioWebhook(req);
  if (verification.missingInProd) {
    logger.warn("Twilio webhook secret not configured in production");
    res.status(503).json({
      error: "Messaging webhook secret not configured",
      type: "config_error",
    });
    return;
  }
  if (!verification.ok) {
    res.status(403).json({ error: "Invalid webhook secret" });
    return;
  }

  const provider = process.env.MESSAGING_PROVIDER ?? "twilio";
  if (provider !== "twilio") {
    res.status(200).send("");
    return;
  }

  const body = req.body ?? {};
  const from = (body.From ?? body.from ?? "").toString();
  const text = (
    body.Body ??
    body.body ??
    body.SpeechResult ??
    body.TranscriptionText ??
    ""
  )
    .toString()
    .trim();

  if (!from) {
    logger.warn(
      { body: JSON.stringify(body).slice(0, 200) },
      "Messaging inbound: missing From",
    );
    res.status(200).send("");
    return;
  }

  const userKey = resolveUserKey(from);
  if (userKey === "default" && process.env.PHONE_TO_USER_ID) {
    logger.debug({ from }, "Messaging: phone not mapped, ignoring");
    res.status(200).send("");
    return;
  }

  const reply = await processMessage("twilio", from, text || "(empty)");

  if (reply) {
    try {
      await sendTwilio(from, reply);
    } catch (err) {
      logger.warn({ err }, "Twilio send error");
    }
  }

  res.status(200).send("");
});

/**
 * POST /api/messaging/telegram
 * Body (Telegram JSON): { message: { chat: { id }, text } }
 */
router.post("/telegram", async (req: Request, res: Response) => {
  if (!verifyTelegramWebhook(req)) {
    res.status(403).json({ error: "Invalid webhook secret" });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set");
    res
      .status(503)
      .json({ error: "Telegram not configured", type: "config_error" });
    return;
  }

  const body = req.body as {
    message?: { chat?: { id?: number }; text?: string };
  };
  const message = body?.message;
  const chatId = message?.chat?.id;
  const text = (message?.text ?? "").toString().trim();

  if (chatId == null) {
    res.status(200).json({ ok: true });
    return;
  }

  const reply = await processMessage(
    "telegram",
    String(chatId),
    text || "(empty)",
  );

  try {
    await sendTelegram(String(chatId), reply);
  } catch (err) {
    logger.warn({ err }, "Telegram send error");
  }

  res.status(200).json({ ok: true });
});

/**
 * POST /api/messaging/subscribe
 * Pair chat app identity with G-Rump user for proactive push (heartbeats, task completion).
 * Body: { platform, platformUserId }
 */
router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? "default";
    const body = req.body ?? {};
    const platform = String(body.platform ?? "").toLowerCase();
    const platformUserId = String(
      body.platformUserId ?? body.platform_user_id ?? "",
    ).trim();

    if (!platform || !platformUserId) {
      res
        .status(400)
        .json({ error: "platform and platformUserId are required" });
      return;
    }
    if (!PLATFORMS.includes(platform as (typeof PLATFORMS)[number])) {
      res.status(400).json({
        error: `platform must be one of: ${PLATFORMS.join(", ")}`,
      });
      return;
    }

    const db = getDatabase();
    const id = `sub_${userId}_${platform}_${platformUserId.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const now = new Date().toISOString();
    await db.saveMessagingSubscription({
      id,
      user_id: userId,
      platform,
      platform_user_id: platformUserId,
      created_at: now,
    });

    res.status(201).json({
      ok: true,
      subscription: { id, userId, platform, platformUserId, createdAt: now },
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "Failed to create messaging subscription",
    );
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

/**
 * DELETE /api/messaging/subscribe
 * Remove a messaging subscription.
 * Body: { platform, platformUserId }
 */
router.delete("/subscribe", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? "default";
    const body = req.body ?? {};
    const platform = String(body.platform ?? "").toLowerCase();
    const platformUserId = String(
      body.platformUserId ?? body.platform_user_id ?? "",
    ).trim();

    if (!platform || !platformUserId) {
      res
        .status(400)
        .json({ error: "platform and platformUserId are required" });
      return;
    }

    const db = getDatabase();
    await db.deleteMessagingSubscription(userId, platform, platformUserId);
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "Failed to delete messaging subscription",
    );
    res.status(500).json({ error: "Failed to delete subscription" });
  }
});

/**
 * GET /api/messaging/subscriptions
 * List current user's messaging subscriptions.
 */
router.get("/subscriptions", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? "default";
    const db = getDatabase();
    const subs = await db.getMessagingSubscriptions(userId);
    res.json({ subscriptions: subs });
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "Failed to list messaging subscriptions",
    );
    res.status(500).json({ error: "Failed to list subscriptions" });
  }
});

/**
 * POST /api/messaging/discord
 * Discord webhook for bot interactions.
 * Body: Discord interaction payload or message event from bot.
 */
router.post("/discord", async (req: Request, res: Response) => {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set");
    res
      .status(503)
      .json({ error: "Discord not configured", type: "config_error" });
    return;
  }

  const body = req.body ?? {};

  // Handle Discord interaction verification (type 1 = PING)
  if (body.type === 1) {
    res.json({ type: 1 });
    return;
  }

  // Handle message-based interactions
  const channelId = body.channel_id ?? body.channelId;
  const text =
    body.content ??
    body.data?.options?.[0]?.value ??
    body.message?.content ??
    "";
  const userId = body.member?.user?.id ?? body.author?.id ?? body.user?.id;

  if (!channelId || !text) {
    res.status(200).json({ ok: true });
    return;
  }

  const reply = await processMessage(
    "discord",
    userId ?? channelId,
    text.toString().trim() || "(empty)",
  );

  // Send reply via Discord bot
  try {
    const { sendDiscord } = await import(
      "../services/messagingShipNotifier.js"
    );
    await sendDiscord(channelId, reply);
  } catch (err) {
    logger.warn({ err }, "Discord send error");
  }

  res.status(200).json({ ok: true });
});

/**
 * POST /api/messaging/slack
 * Slack Events API webhook for receiving messages.
 * Handles URL verification challenge and message events.
 */
router.post("/slack", async (req: Request, res: Response) => {
  const body = req.body ?? {};

  // Slack URL verification challenge
  if (body.type === "url_verification" && body.challenge) {
    res.status(200).json({ challenge: body.challenge });
    return;
  }

  const slackToken =
    process.env.SLACK_BOT_TOKEN || process.env.SLACK_SIGNING_SECRET;
  if (!slackToken) {
    logger.warn("SLACK_BOT_TOKEN not set");
    res
      .status(503)
      .json({ error: "Slack not configured", type: "config_error" });
    return;
  }

  // Handle event callbacks
  if (body.type === "event_callback" && body.event) {
    const event = body.event;

    // Only process message events (not bot messages)
    if (
      event.type === "message" &&
      !event.bot_id &&
      !event.subtype &&
      event.text
    ) {
      const userId = event.user;
      const channelId = event.channel;
      const text = event.text.toString().trim();

      const reply = await processMessage(
        "slack",
        userId ?? channelId,
        text || "(empty)",
      );

      // Send reply via Slack
      try {
        const { sendSlack } = await import(
          "../services/messagingShipNotifier.js"
        );
        await sendSlack(channelId, reply);
      } catch (err) {
        logger.warn({ err }, "Slack send error");
      }
    }
  }

  res.status(200).json({ ok: true });
});

/**
 * POST /api/messaging/whatsapp
 * WhatsApp webhook (via Twilio WhatsApp Business API).
 * Same as inbound but specifically for WhatsApp messages.
 */
router.post("/whatsapp", async (req: Request, res: Response) => {
  const verification = verifyTwilioWebhook(req);
  if (!verification.ok) {
    res.status(403).json({ error: "Invalid webhook secret" });
    return;
  }

  const body = req.body ?? {};
  // WhatsApp messages come via Twilio with whatsapp: prefix
  let from = (body.From ?? body.from ?? "").toString();
  const text = (
    body.Body ??
    body.body ??
    ""
  )
    .toString()
    .trim();

  if (!from) {
    res.status(200).send("");
    return;
  }

  // Ensure whatsapp: prefix for routing
  if (!from.startsWith("whatsapp:")) {
    from = `whatsapp:${from}`;
  }

  const reply = await processMessage("twilio", from, text || "(empty)");

  if (reply) {
    try {
      await sendTwilio(from, reply);
    } catch (err) {
      logger.warn({ err }, "WhatsApp send error");
    }
  }

  res.status(200).send("");
});

/**
 * GET /api/messaging/channels
 * Returns which messaging channels are configured and available.
 */
router.get("/channels", async (_req: Request, res: Response) => {
  const channels = [
    {
      id: "twilio_sms",
      name: "SMS (Twilio)",
      icon: "💬",
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      webhookUrl: "/api/messaging/inbound",
      description: "Send and receive SMS messages via Twilio",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: "📱",
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_WHATSAPP_NUMBER),
      webhookUrl: "/api/messaging/whatsapp",
      description: "WhatsApp messaging via Twilio Business API",
    },
    {
      id: "telegram",
      name: "Telegram",
      icon: "✈️",
      configured: !!process.env.TELEGRAM_BOT_TOKEN,
      webhookUrl: "/api/messaging/telegram",
      description: "Telegram bot integration",
    },
    {
      id: "discord",
      name: "Discord",
      icon: "🎮",
      configured: !!process.env.DISCORD_BOT_TOKEN,
      webhookUrl: "/api/messaging/discord",
      description: "Discord bot for server messaging",
    },
    {
      id: "slack",
      name: "Slack",
      icon: "💼",
      configured: !!(process.env.SLACK_BOT_TOKEN || process.env.SLACK_SIGNING_SECRET),
      webhookUrl: "/api/messaging/slack",
      description: "Slack bot integration via Events API",
    },
  ];

  res.json({ channels });
});

export default router;
