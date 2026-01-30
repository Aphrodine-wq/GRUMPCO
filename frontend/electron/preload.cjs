const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('grump', {
  platform: process.platform,
  isElectron: true,
  version: require('../package.json').version,
  
  // Signal that the app is ready, close splash and show main window
  closeSplashShowMain: () => ipcRenderer.invoke('close-splash-show-main')
});
