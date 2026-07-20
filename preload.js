/**
 * Keystone - Preload Script
 * Secure bridge between main and renderer processes
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('keystoneAPI', {
  // Data operations
  getData: () => ipcRenderer.invoke('get-data'),
  saveItem: (item) => ipcRenderer.invoke('save-item', item),
  deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
  toggleFavorite: (id) => ipcRenderer.invoke('toggle-favorite', id),
  
  // Clipboard
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  
  // Settings
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  
  // Window control
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  
  // Event listeners
  onDataUpdated: (callback) => {
    ipcRenderer.on('data-updated', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('data-updated');
  },
  
  // Keyboard shortcuts
  onShortcut: (callback) => {
    ipcRenderer.on('global-shortcut', (event) => callback());
    return () => ipcRenderer.removeAllListeners('global-shortcut');
  }
});

// Expose minimal DOM APIs needed for clipboard fallback
contextBridge.exposeInMainWorld('clipboardFallback', {
  writeText: (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (e) {
      console.warn('Clipboard fallback failed:', e);
    }
    document.body.removeChild(textarea);
  }
});