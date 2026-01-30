/**
 * G-Rump Preload Script - Lightning Fast Edition
 * 
 * Optimizations:
 * - Cached version lookup
 * - Immediate splash close on load
 * - Minimal API surface
 */

const { contextBridge, ipcRenderer } = require('electron');


// Cache version to avoid repeated file reads
let cachedVersion = '1.0.0';
function getVersion() {
  return cachedVersion;
}

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('grump', {
  platform: process.platform,
  isElectron: true,
  version: getVersion(),

  // Signal that the app is ready, close splash and show main window
  closeSplashShowMain: () => ipcRenderer.invoke('close-splash-show-main'),

  // Fast ready signal - call this ASAP in your app
  ready: () => {
    // Immediately signal ready
    ipcRenderer.invoke('close-splash-show-main');
  }
});

// Auto-signal ready after DOM is loaded (fallback)
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure first paint
    setTimeout(() => {
      ipcRenderer.invoke('close-splash-show-main');
    }, 50);
  });
}
