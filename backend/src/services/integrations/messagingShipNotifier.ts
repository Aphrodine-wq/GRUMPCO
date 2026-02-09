/**
 * Messaging Ship Notifier
 * Subscribes messaging users to SHIP completion; notifies them when ship.completed or ship.failed fires.
 * Also supports proactive push to user's messaging subscriptions (Telegram, Discord, Slack, Twilio).
 */

import logger from "../../middleware/logger.js";
import { getDatabase } from "../../db/database.js";

export type MessagingPlatform = "telegram" | "discord" | "twilio" | "slack";

interface Subscription {
  platform: MessagingPlatform;
  platformUserId: string;
}

const subscriptions = new Map<string, Subscription>();

/** Discord client for sending messages (set by discordBot when it starts). */
let discordSendFn: ((channelId: string, text: string) => Promise<void>) | null =
  null;

/** Slack send function for sending messages (set by slack route). */
let slackSendFn: ((userId: string, text: string) => Promise<void>) | null =
  null;

export function setDiscordSendFn(
  fn: (channelId: string, text: string) => Promise<void>,
): void {
  discordSendFn = fn;
}

export function setSlackSendFn(
  fn: (userId: string, text: string) => Promise<void>,
): void {
  slackSendFn = fn;
}

export function subscribe(
  sessionId: string,
  platform: MessagingPlatform,
  platformUserId: string,
): void {
  subscriptions.set(sessionId, { platform, platformUserId });
  logger.debug(
    { sessionId, platform, platformUserId },
    "Messaging ship subscription added",
  );
}

export async function notify(
  sessionId: string,
  message: string,
): Promise<void> {
  const sub = subscriptions.get(sessionId);
  if (!sub) return;
  subscriptions.delete(sessionId);

  try {
    if (sub.platform === "telegram") {
      await sendTelegram(sub.platformUserId, message);
    } else if (sub.platform === "discord") {
      await sendDiscord(sub.platformUserId, message);
    } else if (sub.platform === "twilio") {
      await sendTwilio(sub.platformUserId, message);
    } else if (sub.platform === "slack") {
      await sendSlack(sub.platformUserId, message);
    }
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, sessionId, platform: sub.platform },
      "Messaging notify send failed",
    );
  }
}

export async function sendTelegram(
  chatId: string,
  text: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set, cannot send");
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4096) }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram send failed: ${res.status} ${errText}`);
  }
}

export async function sendDiscord(
  channelId: string,
  text: string,
): Promise<void> {
  if (!discordSendFn) {
    logger.warn("Discord send not configured, cannot send");
    return;
  }
  await discordSendFn(channelId, text.slice(0, 2000));
}

export async function sendSlack(userId: string, text: string): Promise<void> {
  if (!slackSendFn) {
    logger.warn("Slack send not configured, cannot send");
    return;
  }
  await slackSendFn(userId, text.slice(0, 3000));
}

/**
 * Send proactive notification to all of a user's messaging subscriptions.
 * Used by persistent agent (heartbeats, task completion) to push updates to Telegram, Discord, etc.
 */
export async function sendProactiveToUser(
  userId: string,
  message: string,
  options?: { platforms?: MessagingPlatform[] },
): Promise<void> {
  const db = getDatabase();
  const subs = await db.getMessagingSubscriptions(userId);
  if (subs.length === 0) return;

  const allowedPlatforms = options?.platforms;
  for (const sub of subs) {
    const platform = sub.platform as MessagingPlatform;
    if (allowedPlatforms && !allowedPlatforms.includes(platform)) continue;

    try {
      if (platform === "telegram") {
        await sendTelegram(sub.platform_user_id, message);
      } else if (platform === "discord") {
        await sendDiscord(sub.platform_user_id, message);
      } else if (platform === "slack") {
        await sendSlack(sub.platform_user_id, message);
      } else if (platform === "twilio") {
        await sendTwilio(sub.platform_user_id, message);
      }
    } catch (err) {
      logger.warn(
        {
          err: (err as Error).message,
          userId,
          platform,
          platformUserId: sub.platform_user_id,
        },
        "Proactive notification send failed",
      );
    }
  }
}

export async function sendTwilio(to: string, text: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const baseNum =
    process.env.TWILIO_WHATSAPP_NUMBER ||
    process.env.TWILIO_REPLY_TO_NUMBER ||
    "";
  const from = to.startsWith("whatsapp:")
    ? `whatsapp:${baseNum.replace(/^whatsapp:/, "")}`
    : process.env.TWILIO_REPLY_TO_NUMBER || baseNum;

  if (!accountSid || !authToken || !from) {
    logger.warn("Twilio not configured, cannot send");
    return;
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: text.slice(0, 1600),
  });
  const res = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twilio send failed: ${res.status} ${errText}`);
  }
}
