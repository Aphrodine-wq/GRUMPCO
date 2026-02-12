import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { toasts, showToast, dismissToast, clearAllToasts, resetToastState } from './toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    resetToastState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with an empty toast list', () => {
    expect(get(toasts)).toEqual([]);
  });

  it('should add a toast with showToast', () => {
    showToast('Hello!', 'info');

    const current = get(toasts);
    expect(current.length).toBe(1);
    expect(current[0].message).toBe('Hello!');
    expect(current[0].type).toBe('info');
  });

  it('should use info as default type', () => {
    showToast('Default type');

    const current = get(toasts);
    expect(current[0].type).toBe('info');
  });

  it('should use 3000ms as default duration', () => {
    showToast('Timed');

    const current = get(toasts);
    expect(current[0].duration).toBe(3000);
  });

  it('should return a unique id for each toast', () => {
    const id1 = showToast('First');
    const id2 = showToast('Second');

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it('should add success toast', () => {
    showToast('Success!', 'success');

    const current = get(toasts);
    expect(current[0].type).toBe('success');
  });

  it('should add error toast', () => {
    showToast('Error!', 'error');

    const current = get(toasts);
    expect(current[0].type).toBe('error');
  });

  it('should enforce MAX_TOASTS limit of 3 non-persistent toasts', () => {
    showToast('Toast 1');
    showToast('Toast 2');
    showToast('Toast 3');
    showToast('Toast 4');

    const current = get(toasts);
    const nonPersistent = current.filter((t) => !t.persistent);
    expect(nonPersistent.length).toBeLessThanOrEqual(3);
  });

  it('should dismiss a toast by id', () => {
    const id = showToast('Dismissable');

    expect(get(toasts).length).toBe(1);

    dismissToast(id);

    expect(get(toasts).length).toBe(0);
  });

  it('should only dismiss the specified toast', () => {
    const id1 = showToast('Keep');
    const id2 = showToast('Remove');

    dismissToast(id2);

    const current = get(toasts);
    expect(current.length).toBe(1);
    expect(current[0].id).toBe(id1);
  });

  it('should clear all toasts', () => {
    showToast('A');
    showToast('B');
    showToast('C');

    expect(get(toasts).length).toBe(3);

    clearAllToasts();

    expect(get(toasts).length).toBe(0);
  });

  it('should reset state including counter', () => {
    showToast('Before reset');

    resetToastState();

    expect(get(toasts).length).toBe(0);
  });

  it('should create persistent toast with duration 0', () => {
    showToast('Persistent', 'info', 3000, { persistent: true });

    const current = get(toasts);
    expect(current[0].persistent).toBe(true);
    expect(current[0].duration).toBe(0);
  });

  it('should include actions when provided', () => {
    const action = vi.fn();
    showToast('With action', 'info', 3000, {
      actions: [{ label: 'Undo', action, primary: true }],
    });

    const current = get(toasts);
    expect(current[0].actions).toHaveLength(1);
    expect(current[0].actions![0].label).toBe('Undo');
    expect(current[0].actions![0].primary).toBe(true);
  });

  it('should include onDismiss callback', () => {
    const onDismiss = vi.fn();
    showToast('Callback', 'info', 3000, { onDismiss });

    const current = get(toasts);
    expect(current[0].onDismiss).toBe(onDismiss);
  });

  it('should auto-dismiss after duration', () => {
    showToast('Auto-dismiss', 'info', 2000);

    expect(get(toasts).length).toBe(1);

    vi.advanceTimersByTime(2000);

    expect(get(toasts).length).toBe(0);
  });

  it('should not auto-dismiss persistent toasts', () => {
    showToast('Stays', 'info', 3000, { persistent: true });

    vi.advanceTimersByTime(5000);

    expect(get(toasts).length).toBe(1);
  });

  it('should keep persistent toasts when non-persistent exceed limit', () => {
    showToast('Persistent', 'info', 3000, { persistent: true });
    showToast('Toast 1');
    showToast('Toast 2');
    showToast('Toast 3');
    showToast('Toast 4');

    const current = get(toasts);
    const persistent = current.filter((t) => t.persistent);
    expect(persistent.length).toBe(1);
    expect(persistent[0].message).toBe('Persistent');
  });

  it('should add newest toast to the front', () => {
    showToast('First');
    showToast('Second');

    const current = get(toasts);
    expect(current[0].message).toBe('Second');
    expect(current[1].message).toBe('First');
  });
});
