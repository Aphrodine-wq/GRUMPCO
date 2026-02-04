/**
 * Offline mode: detect online/offline, queue requests when offline, sync when back online.
 */

export function getIsOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function subscribeToOnlineStatus(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback(navigator.onLine);
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  handler();
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}
