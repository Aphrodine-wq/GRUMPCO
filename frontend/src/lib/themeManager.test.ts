import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetMocks, localStorageMock } from '../test/setup';

// Mock matchMedia (jsdom does not implement it)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock newOnboardingStore before importing themeManager
vi.mock('../stores/newOnboardingStore', async () => {
  const { writable } = await import('svelte/store');
  const store = writable({
    theme: 'dark',
    setupComplete: true,
    apiKeys: {},
    preferences: {},
    currentStep: 0,
    totalSteps: 0,
  });
  return {
    newOnboardingStore: store,
  };
});

import { applyTheme, applyAccentAndFont, initTheme } from './themeManager';
import { newOnboardingStore } from '../stores/newOnboardingStore';

describe('themeManager', () => {
  beforeEach(() => {
    resetMocks();
    // Reset document state
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--color-primary');
    document.documentElement.style.removeProperty('--color-primary-hover');
    document.documentElement.style.removeProperty('--app-font-size');
  });

  // ── applyTheme ─────────────────────────────────────────────────────────────

  describe('applyTheme', () => {
    it('should set data-theme to "dark" when store theme is dark', () => {
      newOnboardingStore.set({
        theme: 'dark',
        setupComplete: true,
        apiKeys: {},
        preferences: {},
        currentStep: 0,
        totalSteps: 0,
      } as any);
      applyTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should set data-theme to "light" when store theme is light', () => {
      newOnboardingStore.set({
        theme: 'light',
        setupComplete: true,
        apiKeys: {},
        preferences: {},
        currentStep: 0,
        totalSteps: 0,
      } as any);
      applyTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should resolve "system" theme using matchMedia', () => {
      newOnboardingStore.set({
        theme: 'system',
        setupComplete: true,
        apiKeys: {},
        preferences: {},
        currentStep: 0,
        totalSteps: 0,
      } as any);
      // jsdom default matchMedia returns false for dark mode
      applyTheme();
      const theme = document.documentElement.getAttribute('data-theme');
      expect(theme === 'light' || theme === 'dark').toBe(true);
    });
  });

  // ── applyAccentAndFont ─────────────────────────────────────────────────────

  describe('applyAccentAndFont', () => {
    it('should set accent color CSS variable from localStorage', () => {
      localStorage.setItem('g-rump-accent', 'purple');
      applyAccentAndFont();
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#7c3aed');
      expect(document.documentElement.style.getPropertyValue('--color-primary-hover')).toBe(
        '#6d28d9'
      );
    });

    it('should set font size CSS variable from localStorage', () => {
      localStorage.setItem('g-rump-font-size', 'large');
      applyAccentAndFont();
      expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('15px');
    });

    it('should set small font size correctly', () => {
      localStorage.setItem('g-rump-font-size', 'small');
      applyAccentAndFont();
      expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('13px');
    });

    it('should NOT set CSS properties for unknown accent color', () => {
      localStorage.setItem('g-rump-accent', 'neon-pink');
      applyAccentAndFont();
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    });

    it('should NOT set CSS properties for invalid font size', () => {
      localStorage.setItem('g-rump-font-size', 'extra-large');
      applyAccentAndFont();
      expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('');
    });

    it('should apply both accent and font when both are set', () => {
      localStorage.setItem('g-rump-accent', 'teal');
      localStorage.setItem('g-rump-font-size', 'medium');
      applyAccentAndFont();
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#0d9488');
      expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('14px');
    });
  });

  // ── initTheme ──────────────────────────────────────────────────────────────

  describe('initTheme', () => {
    it('should return a cleanup function', () => {
      const cleanup = initTheme();
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('should apply theme and accent on init', () => {
      localStorage.setItem('g-rump-accent', 'blue');
      newOnboardingStore.set({
        theme: 'dark',
        setupComplete: true,
        apiKeys: {},
        preferences: {},
        currentStep: 0,
        totalSteps: 0,
      } as any);

      const cleanup = initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#2563eb');
      cleanup();
    });

    it('should re-apply theme when store changes', () => {
      const cleanup = initTheme();

      newOnboardingStore.set({
        theme: 'light',
        setupComplete: true,
        apiKeys: {},
        preferences: {},
        currentStep: 0,
        totalSteps: 0,
      } as any);

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      cleanup();
    });
  });
});
