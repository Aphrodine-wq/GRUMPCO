import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  persistent?: boolean;
  actions?: ToastAction[];
  onDismiss?: () => void;
}

const MAX_TOASTS = 3;

let idCounter = 0;

function generateId(): string {
  return `toast-${++idCounter}-${Date.now()}`;
}

export const toasts = writable<Toast[]>([]);

export function showToast(
  message: string,
  type: ToastType = 'info',
  duration: number = 3000,
  options?: {
    persistent?: boolean;
    actions?: ToastAction[];
    onDismiss?: () => void;
  }
): string {
  const id = generateId();
  
  const toast: Toast = {
    id,
    message,
    type,
    duration: options?.persistent ? 0 : duration,
    persistent: options?.persistent,
    actions: options?.actions,
    onDismiss: options?.onDismiss,
  };
  
  toasts.update(t => {
    const updated = [toast, ...t];
    // Limit visible toasts (but keep persistent ones)
    const nonPersistent = updated.filter(t => !t.persistent);
    if (nonPersistent.length > MAX_TOASTS) {
      const persistent = updated.filter(t => t.persistent);
      const limited = nonPersistent.slice(0, MAX_TOASTS);
      return [...persistent, ...limited];
    }
    return updated;
  });
  
  // Auto-dismiss after duration (unless persistent)
  if (duration > 0 && !options?.persistent) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }
  
  return id;
}

export function dismissToast(id: string): void {
  toasts.update(t => t.filter(toast => toast.id !== id));
}

export function clearAllToasts(): void {
  toasts.set([]);
}

export function resetToastState(): void {
  toasts.set([]);
  idCounter = 0;
}
