/**
 * Toast Store Tests
 * 
 * Comprehensive tests for the toast notification system
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  toasts,
  showToast,
  dismissToast,
  clearAllToasts,
  resetToastState,
  type Toast,
  type ToastType,
} from './toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    resetToastState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('showToast', () => {
    it('should add a toast to the store', () => {
      showToast('Test message');
      
      const currentToasts = get(toasts);
      expect(currentToasts).toHaveLength(1);
      expect(currentToasts[0].message).toBe('Test message');
    });

    it('should return the toast ID', () => {
      const id = showToast('Test message');
      
      expect(id).toMatch(/^toast-\d+-\d+$/);
    });

    it('should set default type to info', () => {
      showToast('Test message');
      
      const currentToasts = get(toasts);
      expect(currentToasts[0].type).toBe('info');
    });

    it('should respect the type parameter', () => {
      const types: ToastType[] = ['success', 'error', 'info'];
      
      types.forEach(type => {
        resetToastState();
        showToast('Test', type);
        const currentToasts = get(toasts);
        expect(currentToasts[0].type).toBe(type);
      });
    });

    it('should set default duration to 3000ms', () => {
      showToast('Test message');
      
      const currentToasts = get(toasts);
      expect(currentToasts[0].duration).toBe(3000);
    });

    it('should respect custom duration', () => {
      showToast('Test message', 'info', 5000);
      
      const currentToasts = get(toasts);
      expect(currentToasts[0].duration).toBe(5000);
    });

    it('should add newest toasts at the beginning', () => {
      showToast('First');
      showToast('Second');
      showToast('Third');
      
      const currentToasts = get(toasts);
      expect(currentToasts.map(t => t.message)).toEqual(['Third', 'Second', 'First']);
    });

    it('should limit non-persistent toasts to MAX_TOASTS (3)', () => {
      showToast('First');
      showToast('Second');
      showToast('Third');
      showToast('Fourth');
      
      const currentToasts = get(toasts);
      expect(currentToasts).toHaveLength(3);
      expect(currentToasts.map(t => t.message)).not.toContain('First');
    });

    it('should not count persistent toasts against the limit', () => {
      showToast('Persistent 1', 'info', 0, { persistent: true });
      showToast('Persistent 2', 'info', 0, { persistent: true });
      showToast('Regular 1');
      showToast('Regular 2');
      showToast('Regular 3');
      
      const currentToasts = get(toasts);
      // 2 persistent + 3 regular = 5 total
      expect(currentToasts).toHaveLength(5);
    });

    it('should auto-dismiss after duration', () => {
      showToast('Auto dismiss', 'info', 3000);
      
      expect(get(toasts)).toHaveLength(1);
      
      vi.advanceTimersByTime(3000);
      
      expect(get(toasts)).toHaveLength(0);
    });

    it('should not auto-dismiss persistent toasts', () => {
      showToast('Persistent', 'info', 3000, { persistent: true });
      
      expect(get(toasts)).toHaveLength(1);
      
      vi.advanceTimersByTime(10000);
      
      expect(get(toasts)).toHaveLength(1);
    });

    it('should include actions in the toast', () => {
      const action = vi.fn();
      showToast('With action', 'info', 3000, {
        actions: [{ label: 'Retry', action, primary: true }],
      });
      
      const currentToasts = get(toasts);
      expect(currentToasts[0].actions).toHaveLength(1);
      expect(currentToasts[0].actions?.[0].label).toBe('Retry');
      expect(currentToasts[0].actions?.[0].primary).toBe(true);
    });

    it('should include onDismiss callback', () => {
      const onDismiss = vi.fn();
      showToast('With dismiss callback', 'info', 3000, { onDismiss });
      
      const currentToasts = get(toasts);
      expect(currentToasts[0].onDismiss).toBe(onDismiss);
    });
  });

  describe('dismissToast', () => {
    it('should remove a specific toast by ID', () => {
      const id1 = showToast('First');
      showToast('Second');
      showToast('Third');
      
      dismissToast(id1);
      
      const currentToasts = get(toasts);
      expect(currentToasts).toHaveLength(2);
      expect(currentToasts.find(t => t.id === id1)).toBeUndefined();
    });

    it('should do nothing if ID does not exist', () => {
      showToast('First');
      showToast('Second');
      
      dismissToast('non-existent-id');
      
      expect(get(toasts)).toHaveLength(2);
    });
  });

  describe('clearAllToasts', () => {
    it('should remove all toasts', () => {
      showToast('First');
      showToast('Second');
      showToast('Third', 'info', 0, { persistent: true });
      
      clearAllToasts();
      
      expect(get(toasts)).toHaveLength(0);
    });
  });

  describe('resetToastState', () => {
    it('should clear toasts and reset ID counter', () => {
      showToast('First');
      showToast('Second');
      
      resetToastState();
      
      expect(get(toasts)).toHaveLength(0);
      
      // ID counter should be reset - new toast should have ID starting with 1
      const newId = showToast('New');
      expect(newId).toMatch(/^toast-1-/);
    });
  });

  describe('toast ordering', () => {
    it('should maintain order with mixed persistent and non-persistent toasts', () => {
      showToast('Regular 1', 'info', 3000);
      showToast('Persistent', 'error', 0, { persistent: true });
      showToast('Regular 2', 'info', 3000);
      
      const currentToasts = get(toasts);
      expect(currentToasts[0].message).toBe('Regular 2');
      expect(currentToasts[1].message).toBe('Persistent');
      expect(currentToasts[2].message).toBe('Regular 1');
    });
  });

  describe('concurrent toasts', () => {
    it('should handle rapid toast creation', () => {
      for (let i = 0; i < 10; i++) {
        showToast(`Toast ${i}`);
      }
      
      const currentToasts = get(toasts);
      // Should be limited to MAX_TOASTS (3)
      expect(currentToasts).toHaveLength(3);
    });

    it('should handle sequential dismissals correctly', () => {
      const ids = Array.from({ length: 3 }, (_, i) => 
        showToast(`Toast ${i}`, 'info', 0, { persistent: true })
      );
      
      ids.forEach(id => dismissToast(id));
      
      expect(get(toasts)).toHaveLength(0);
    });
  });

  describe('toast types styling', () => {
    it('should create success toast', () => {
      showToast('Success!', 'success');
      expect(get(toasts)[0].type).toBe('success');
    });

    it('should create error toast', () => {
      showToast('Error!', 'error');
      expect(get(toasts)[0].type).toBe('error');
    });

    it('should create info toast', () => {
      showToast('Info', 'info');
      expect(get(toasts)[0].type).toBe('info');
    });
  });
});
