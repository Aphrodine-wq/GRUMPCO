/**
 * Reminder Service
 * Stub implementation for reminder functionality.
 */

import logger from "../../middleware/logger.js";

export interface Reminder {
  id: string;
  userId: string;
  platform?: string;
  platformUserId?: string;
  message: string;
  triggerAt: Date;
  createdAt: Date;
  status: "pending" | "triggered" | "cancelled";
}

// In-memory store (replace with database in production)
const reminders = new Map<string, Reminder>();

/**
 * Create a reminder.
 * @param userId - User ID
 * @param message - Reminder message/content
 * @param triggerAt - When to trigger the reminder
 * @param platform - Optional platform (telegram, discord, etc.)
 * @param platformUserId - Optional platform-specific user ID
 */
export async function createReminder(
  userId: string,
  message: string,
  triggerAt: Date,
  platform?: string,
  platformUserId?: string,
): Promise<Reminder> {
  const id = `reminder_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const reminder: Reminder = {
    id,
    userId,
    platform,
    platformUserId,
    message,
    triggerAt,
    createdAt: new Date(),
    status: "pending",
  };

  reminders.set(id, reminder);
  logger.info({ reminderId: id, triggerAt }, "Created reminder");

  return reminder;
}

export async function getReminder(id: string): Promise<Reminder | null> {
  return reminders.get(id) || null;
}

export async function getUserReminders(userId: string): Promise<Reminder[]> {
  return Array.from(reminders.values()).filter(
    (r) => r.userId === userId && r.status === "pending",
  );
}

export async function cancelReminder(id: string): Promise<boolean> {
  const reminder = reminders.get(id);
  if (!reminder) return false;

  reminder.status = "cancelled";
  logger.info({ reminderId: id }, "Cancelled reminder");
  return true;
}

export async function triggerReminder(id: string): Promise<boolean> {
  const reminder = reminders.get(id);
  if (!reminder || reminder.status !== "pending") return false;

  reminder.status = "triggered";
  logger.info({ reminderId: id }, "Triggered reminder");
  return true;
}

export async function getPendingReminders(): Promise<Reminder[]> {
  const now = new Date();
  return Array.from(reminders.values()).filter(
    (r) => r.status === "pending" && r.triggerAt <= now,
  );
}

export async function deleteReminder(id: string): Promise<boolean> {
  return reminders.delete(id);
}

// Check for due reminders (call this periodically)
export async function checkDueReminders(): Promise<Reminder[]> {
  const dueReminders = await getPendingReminders();

  for (const reminder of dueReminders) {
    await triggerReminder(reminder.id);
  }

  return dueReminders;
}

/**
 * Process due reminders - alias for checkDueReminders
 */
export async function processDueReminders(): Promise<Reminder[]> {
  return checkDueReminders();
}
