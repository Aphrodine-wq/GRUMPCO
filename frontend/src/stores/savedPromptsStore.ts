/**
 * Saved prompts – local-only storage (localStorage).
 * Used for "Insert saved prompt" in Command Palette and optional "Save prompt" in chat.
 */

const STORAGE_KEY = 'grump-saved-prompts';
const MAX_PROMPTS = 50;
const MAX_TEXT_LENGTH = 20000;

export interface SavedPrompt {
  id: string;
  text: string;
  createdAt: number;
  label?: string;
}

function load(): SavedPrompt[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPrompt[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(prompts: SavedPrompt[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  } catch {
    /* ignore */
  }
}

export function getSavedPrompts(): SavedPrompt[] {
  return load();
}

export function addSavedPrompt(text: string, label?: string): SavedPrompt {
  const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
  if (!trimmed) throw new Error('Prompt text is required');
  const prompts = load();
  const entry: SavedPrompt = {
    id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    text: trimmed,
    createdAt: Date.now(),
    label: label?.trim().slice(0, 80) || undefined,
  };
  const next = [entry, ...prompts].slice(0, MAX_PROMPTS);
  save(next);
  return entry;
}

export function removeSavedPrompt(id: string): void {
  const prompts = load().filter((p) => p.id !== id);
  save(prompts);
}
