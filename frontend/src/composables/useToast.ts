import { ref, type Ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

const MAX_TOASTS = 3;

// Singleton state
const toasts: Ref<Toast[]> = ref([]);

let idCounter = 0;

function generateId(): string {
  return `toast-${++idCounter}-${Date.now()}`;
}

export interface UseToastReturn {
  toasts: Ref<Toast[]>;
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

export function useToast(): UseToastReturn {
  function showToast(
    message: string,
    type: ToastType = 'info',
    duration: number = 3000
  ): string {
    const id = generateId();
    
    const toast: Toast = {
      id,
      message,
      type,
      duration
    };
    
    // Add to beginning (newest first at top)
    toasts.value = [toast, ...toasts.value];
    
    // Limit visible toasts
    if (toasts.value.length > MAX_TOASTS) {
      toasts.value = toasts.value.slice(0, MAX_TOASTS);
    }
    
    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
    
    return id;
  }
  
  function dismissToast(id: string): void {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }
  
  function clearAllToasts(): void {
    toasts.value = [];
  }
  
  return {
    toasts,
    showToast,
    dismissToast,
    clearAllToasts
  };
}

// Convenience functions for direct import
export function showToast(
  message: string,
  type: ToastType = 'info',
  duration: number = 3000
): string {
  const { showToast: show } = useToast();
  return show(message, type, duration);
}

export function dismissToast(id: string): void {
  const { dismissToast: dismiss } = useToast();
  dismiss(id);
}
