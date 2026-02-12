import { describe, it, expect, beforeEach } from 'vitest';
import { resetMocks } from '../test/setup';
import { getSavedPrompts, addSavedPrompt, removeSavedPrompt } from './savedPromptsStore';

const STORAGE_KEY = 'grump-saved-prompts';

describe('savedPromptsStore', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ── getSavedPrompts ────────────────────────────────────────────────────────

  it('should return empty array when nothing is saved', () => {
    expect(getSavedPrompts()).toEqual([]);
  });

  it('should return prompts from localStorage', () => {
    const existing = [{ id: 'sp_1', text: 'Hello', createdAt: 1000 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    const result = getSavedPrompts();
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Hello');
  });

  it('should return empty array on corrupt localStorage data', () => {
    localStorage.setItem(STORAGE_KEY, '{{invalid json');
    expect(getSavedPrompts()).toEqual([]);
  });

  it('should return empty array if stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    expect(getSavedPrompts()).toEqual([]);
  });

  // ── addSavedPrompt ─────────────────────────────────────────────────────────

  it('should add a prompt and persist to localStorage', () => {
    const entry = addSavedPrompt('Write a REST API');
    expect(entry.text).toBe('Write a REST API');
    expect(entry.id).toMatch(/^sp_/);
    expect(entry.createdAt).toBeGreaterThan(0);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('Write a REST API');
  });

  it('should add prompt with a label', () => {
    const entry = addSavedPrompt('Build dashboard', 'Dashboard');
    expect(entry.label).toBe('Dashboard');
  });

  it('should trim whitespace from text', () => {
    const entry = addSavedPrompt('  padded text  ');
    expect(entry.text).toBe('padded text');
  });

  it('should throw on empty / whitespace-only text', () => {
    expect(() => addSavedPrompt('')).toThrow('Prompt text is required');
    expect(() => addSavedPrompt('   ')).toThrow('Prompt text is required');
  });

  it('should truncate text at MAX_TEXT_LENGTH (20000)', () => {
    const longText = 'x'.repeat(25000);
    const entry = addSavedPrompt(longText);
    expect(entry.text).toHaveLength(20000);
  });

  it('should truncate label at 80 characters', () => {
    const longLabel = 'a'.repeat(100);
    const entry = addSavedPrompt('test', longLabel);
    expect(entry.label!.length).toBeLessThanOrEqual(80);
  });

  it('should prepend new prompts to the front of the list', () => {
    addSavedPrompt('First');
    addSavedPrompt('Second');
    const prompts = getSavedPrompts();
    expect(prompts[0].text).toBe('Second');
    expect(prompts[1].text).toBe('First');
  });

  it('should cap at MAX_PROMPTS (50)', () => {
    for (let i = 0; i < 55; i++) {
      addSavedPrompt(`Prompt ${i}`);
    }
    const prompts = getSavedPrompts();
    expect(prompts).toHaveLength(50);
    expect(prompts[0].text).toBe('Prompt 54'); // newest first
  });

  it('should set label to undefined when label is empty string', () => {
    const entry = addSavedPrompt('test', '');
    expect(entry.label).toBeUndefined();
  });

  // ── removeSavedPrompt ──────────────────────────────────────────────────────

  it('should remove a prompt by ID', () => {
    const entry = addSavedPrompt('Delete me');
    expect(getSavedPrompts()).toHaveLength(1);

    removeSavedPrompt(entry.id);
    expect(getSavedPrompts()).toHaveLength(0);
  });

  it('should not error when removing non-existent ID', () => {
    addSavedPrompt('Keep me');
    removeSavedPrompt('sp_does_not_exist');
    expect(getSavedPrompts()).toHaveLength(1);
  });

  it('should persist removal to localStorage', () => {
    const entry = addSavedPrompt('To remove');
    removeSavedPrompt(entry.id);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(0);
  });
});
