/**
 * DM Pairing Service
 * Unknown senders receive pairing codes; explicit approval required before processing.
 * Used for messaging channels (Telegram, Discord, etc.).
 */

import { randomBytes } from "crypto";
import logger from "../middleware/logger.js";

interface PairingRecord {
  code: string;
  channel: string;
  senderId: string;
  senderName?: string;
  createdAt: string;
  approved: boolean;
}

// In-memory store (replace with DB when migration exists)
const pairings = new Map<string, PairingRecord>();

const CODE_LENGTH = 6;
const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateCode(): string {
  const buf = randomBytes(4);
  const num = buf.readUInt32BE(0) % Math.pow(10, CODE_LENGTH);
  return num.toString().padStart(CODE_LENGTH, "0");
}

/**
 * Check if sender is approved for the channel
 */
export function isSenderApproved(channel: string, senderId: string): boolean {
  const key = `${channel}:${senderId}`;
  const record = pairings.get(key);
  return record?.approved ?? false;
}

/**
 * Generate a pairing code for an unknown sender. Returns the code to display to the user.
 */
export function createPairingCode(
  channel: string,
  senderId: string,
  senderName?: string,
): { code: string; message: string } {
  const code = generateCode();
  const key = `${channel}:${senderId}`;
  pairings.set(key, {
    code,
    channel,
    senderId,
    senderName,
    createdAt: new Date().toISOString(),
    approved: false,
  });
  const message = `Pairing required. Enter this code in the app to approve: ${code}`;
  logger.info({ channel, senderId }, "Pairing code created");
  return { code, message };
}

/**
 * Approve a sender by validating the code they entered
 */
export function approvePairing(
  channel: string,
  senderId: string,
  code: string,
): { ok: boolean; error?: string } {
  const key = `${channel}:${senderId}`;
  const record = pairings.get(key);
  if (!record) {
    return { ok: false, error: "No pending pairing for this sender" };
  }
  const age = Date.now() - new Date(record.createdAt).getTime();
  if (age > CODE_TTL_MS) {
    pairings.delete(key);
    return { ok: false, error: "Pairing code expired" };
  }
  if (record.code !== code.trim()) {
    return { ok: false, error: "Invalid code" };
  }
  record.approved = true;
  logger.info({ channel, senderId }, "Pairing approved");
  return { ok: true };
}

/**
 * List pending pairings for a channel (for admin UI)
 */
export function listPendingPairings(channel: string): PairingRecord[] {
  return Array.from(pairings.values()).filter(
    (p) => p.channel === channel && !p.approved,
  );
}
