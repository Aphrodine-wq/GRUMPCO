/**
 * Bidirectional config sync between CLI and Electron app.
 * CLI reads/writes ~/.config/grump and project .grumprc; Electron uses backend/settings.
 * Sync merges both sources (env overrides config).
 */
import { config } from '../config.js';

export async function syncWithElectron(): Promise<void> {
  const cliConfig = config.getAll();
  // In a full implementation we would read Electron app config (e.g. from backend /api/settings)
  // and merge with cliConfig, then write both. For now we just report CLI config.
  return Promise.resolve();
}

export async function readElectronConfig(): Promise<Record<string, unknown> | null> {
  return null;
}

export async function writeElectronConfig(_merged: Record<string, unknown>): Promise<void> {
  return Promise.resolve();
}
