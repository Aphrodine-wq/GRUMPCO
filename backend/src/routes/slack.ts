/**
 * Slack integration – OAuth and Events API webhook.
 * User connects workspace via OAuth; bot receives messages and routes to messagingService.
 */

import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { getRequestLogger } from "../middleware/logger.js";
import { getDatabase } from "../db/database.js";
import { processMessage } from "../services/messagingService.js";
import { encryptValue } from "../services/cryptoService.js";

const router = Router();
const log = getRequestLogger();

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const API_BASE =
  process.env.PUBLIC_BASE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  "http://localhost:3000";

function isSlackConfigured(): boolean {
  return !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET && SLACK_SIGNING_SECRET);
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function verifySlackSignature(req: Request): boolean {
  if (!SLACK_SIGNING_SECRET) return false;
  const timestampHeader = req.headers["x-slack-request-timestamp"];
  const signatureHeader = req.headers["x-slack-signature"];
  if (!timestampHeader || !signatureHeader) return false;

  const timestamp = Array.isArray(timestampHeader)
    ? timestampHeader[0]
    : timestampHeader;
  const signature = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampNumber) > 60 * 5) return false;

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) return false;

  const base = `v0:${timestamp}:${rawBody.toString("utf8")}`;
  const digest = crypto
    .createHmac("sha256", SLACK_SIGNING_SECRET)
    .update(base)
    .digest("hex");
  const expected = `v0=${digest}`;
  return timingSafeEqualString(signature, expected);
}

/**
 * GET /api/slack/oauth
 * Redirect user to Slack OAuth authorize URL.
 * Optional query: ?userId=grump_user_id - passed as state for pairing on callback.
 */
router.get("/oauth", (req: Request, res: Response) => {
  if (!isSlackConfigured()) {
    res.status(503).json({ error: "Slack not configured" });
    return;
  }
  const redirectUri = `${API_BASE}/api/slack/callback`;
  const scopes = "chat:write,channels:history,im:history,commands,users:read";
  const state = (req.query?.userId ?? req.query?.state ?? "") as string;
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID ?? "",
    scope: scopes,
    redirect_uri: redirectUri,
    ...(state && { state }),
  });
  const url = `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  res.redirect(url);
});

/**
 * GET /api/slack/callback
 * OAuth callback – exchange code for token and store.
 */
router.get("/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing code" });
    return;
  }
  const grumpUserId = typeof state === "string" ? state.trim() || null : null;
  if (!isSlackConfigured()) {
    res.status(503).json({ error: "Slack not configured" });
    return;
  }
  try {
    const redirectUri = `${API_BASE}/api/slack/callback`;
    const r = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID ?? "",
        client_secret: SLACK_CLIENT_SECRET ?? "",
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = (await r.json()) as {
      ok?: boolean;
      error?: string;
      access_token?: string;
      team?: { id?: string; name?: string };
      authed_user?: { id?: string };
      scope?: string;
    };
    if (!data.ok || !data.access_token) {
      log.warn({ error: data.error }, "Slack OAuth exchange failed");
      res.status(400).json({ error: data.error ?? "OAuth failed" });
      return;
    }

    // Store access_token in DB keyed by user/workspace
    try {
      const db = getDatabase();
      const workspaceId = data.team?.id || "unknown";
      const workspaceName = data.team?.name || null;
      const slackUserId = data.authed_user?.id || "default";
      const tokenId = `slack_${slackUserId}_${workspaceId}`;
      const now = new Date().toISOString();

      await db.saveSlackToken({
        id: tokenId,
        user_id: slackUserId,
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        access_token_enc: JSON.stringify(encryptValue(data.access_token)),
        bot_user_id: data.authed_user?.id || null,
        scope: data.scope || null,
        created_at: now,
        updated_at: now,
      });

      // Save Slack user pairing when we have G-Rump user ID (from state)
      if (grumpUserId && slackUserId) {
        await db.saveSlackUserPairing({
          slack_user_id: slackUserId,
          workspace_id: workspaceId,
          grump_user_id: grumpUserId,
          created_at: now,
        });
        log.info(
          { slackUserId, workspaceId, grumpUserId },
          "Slack user pairing saved",
        );
      }

      log.info(
        { workspaceId, workspaceName, userId: slackUserId },
        "Slack OAuth success - token stored",
      );
    } catch (err) {
      log.error({ err }, "Failed to store Slack token");
    }

    res.redirect(`${FRONTEND_URL}/settings?slack=connected`);
  } catch (err) {
    log.error({ err }, "Slack OAuth error");
    res.status(500).json({ error: "OAuth failed" });
  }
});

/**
 * POST /api/slack/events
 * Slack Events API webhook – receive messages and route to chat/ship.
 */
router.post("/events", async (req: Request, res: Response) => {
  if (!SLACK_SIGNING_SECRET) {
    res.status(503).json({ error: "Slack not configured" });
    return;
  }
  if (!verifySlackSignature(req)) {
    res.status(401).json({ error: "Invalid Slack signature" });
    return;
  }
  const body = req.body as {
    type?: string;
    challenge?: string;
    event?: {
      type?: string;
      user?: string;
      channel?: string;
      text?: string;
      team?: string;
    };
  };
  // URL verification challenge
  if (body.type === "url_verification" && body.challenge) {
    res.json({ challenge: body.challenge });
    return;
  }

  // Process events and route to messagingService
  if (body.event?.type === "message" && body.event.text) {
    const { user, channel, text, team } = body.event;
    if (!user || !text) {
      res.status(200).send();
      return;
    }

    try {
      // Process message through messagingService (user = Slack user ID for conversation key)
      const reply = await processMessage("slack", user, text);

      // Send reply back to Slack using any token for this workspace
      if (reply && team) {
        try {
          const db = getDatabase();
          const tokenRecord = await db.getSlackTokenByWorkspace(team);
          if (tokenRecord) {
            const { decryptValue } =
              await import("../services/cryptoService.js");
            const accessToken = decryptValue(
              JSON.parse(tokenRecord.access_token_enc),
            );
            await sendSlackMessage(accessToken, channel || "", reply);
          }
        } catch (err) {
          log.warn({ err, user, team }, "Failed to send Slack reply");
        }
      }
    } catch (err) {
      log.error({ err, user }, "Error processing Slack message");
    }
  }

  res.status(200).send();
});

/**
 * Send a message to Slack channel
 */
async function sendSlackMessage(
  accessToken: string,
  channel: string,
  text: string,
): Promise<void> {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      text: text.slice(0, 3000),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Slack API error: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }
}

export default router;
