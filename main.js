/**
 * Keystone - Main Electron Process
 * Menu bar app with global shortcut, popover window, and tray icon
 */

const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, screen, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';

// App state
let mainWindow = null;
let tray = null;
let isQuitting = false;

// Data persistence path
const userDataPath = app.getPath('userData');
const dataFile = path.join(userDataPath, 'keystone-data.json');

// Default data
const defaultData = {
  items: [
    {
      id: 1,
      name: 'Senior frontend review',
      type: 'Prompt',
      description: 'Thoroughly review a pull request for quality, accessibility, and maintainability.',
      tags: ['Work', 'Code'],
      tone: 'purple',
      updated: '2 min ago',
      favorite: true,
      content: 'You are a senior frontend engineer. Review the code below for:\n\n1. Bugs and edge cases\n2. Accessibility (WCAG 2.2 AA)\n3. Performance and maintainability\n4. Clear, actionable improvements\n\nExplain the why behind each suggestion and include a concise summary at the end.'
    },
    {
      id: 2,
      name: 'Warm product launch copy',
      type: 'Prompt',
      description: 'Turn rough product notes into clear, confident launch messaging.',
      tags: ['Writing', 'Marketing'],
      tone: 'amber',
      updated: 'Yesterday',
      favorite: true,
      content: 'Act as a thoughtful product copywriter. Turn the notes below into launch copy that feels clear, warm, and confident. Avoid hype and jargon. Give me: a headline, a one-line value proposition, and three short benefits.\n\nNotes:\n[Paste notes here]'
    },
    {
      id: 3,
      name: 'SaaS dashboard starter',
      type: 'File',
      description: 'A clean, responsive dashboard foundation with tokens and components.',
      tags: ['Figma', 'UI kit'],
      tone: 'blue',
      updated: 'Jun 18',
      favorite: true,
      content: 'A starter design system for SaaS dashboards: color tokens, type scale, spacing, buttons, inputs, cards, navigation, and responsive layout patterns.',
      files: [['dashboard-starter.fig', '2.4 MB']]
    },
    {
      id: 4,
      name: 'Commit message helper',
      type: 'Snippet',
      description: 'Generate a conventional commit message from a short change summary.',
      tags: ['Git', 'Code'],
      tone: 'green',
      updated: 'Jun 16',
      content: 'git diff --staged | aichat "Write a concise conventional commit message for these changes. Output only the message."'
    },
    {
      id: 5,
      name: 'Meeting notes → actions',
      type: 'Prompt',
      description: 'Turn messy notes into clear decisions, owners, and next steps.',
      tags: ['Work', 'Writing'],
      tone: 'purple',
      updated: 'Jun 12',
      content: 'Turn these meeting notes into a scannable summary. Separate decisions, open questions, action items, and owners. Flag anything that has no owner or deadline.\n\nNotes:\n[Paste meeting notes here]'
    },
    {
      id: 6,
      name: 'Icon exploration board',
      type: 'File',
      description: 'Exploration board for the Keystone icon family.',
      tags: ['Figma', 'Brand'],
      tone: 'blue',
      updated: 'Jun 08',
      content: 'Icon exploration board with 24px grid, stroke studies, and export-ready SVG explorations.',
      files: [['icon-exploration.fig', '840 KB']]
    }
  ],
  settings: {
    globalShortcut: 'CommandOrControl+Shift+Space',
    launchAtLogin: false,
    showInDock: false
  }
};

// Load data from disk
function loadData() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      return { ...defaultData, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  return defaultData;
}

// Save data to disk
function saveData(data) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

let appData = loadData();

// Create the popover window
function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 480,
    height: 600,
    x: width - 500,
    y: isMac ? 28 : 0, // Account for macOS menu bar
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Load the renderer
  const rendererPath = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, 'dist/index.html')}`;
  
  mainWindow.loadURL(rendererPath);

  // Hide when clicking outside (blur)
  mainWindow.on('blur', () => {
    if (!isDev) {
      hideWindow();
    }
  });

  // Prevent window from being closed, just hide it
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      hideWindow();
    }
  });

  // DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  return mainWindow;
}

// Show the popover window
function showWindow() {
  if (!mainWindow) createMainWindow();
  
  // Position near tray icon (top-right)
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const trayBounds = tray?.getBounds();
  
  if (trayBounds) {
    const x = Math.max(0, Math.min(
      trayBounds.x - (mainWindow.getBounds().width / 2) + (trayBounds.width / 2),
      width - mainWindow.getBounds().width
    ));
    mainWindow.setPosition(x, isMac ? 28 : 0);
  } else {
    mainWindow.setPosition(width - 500, isMac ? 28 : 0);
  }
  
  mainWindow.show();
  mainWindow.focus();
  
  // Notify renderer to refresh data
  mainWindow.webContents.send('data-updated', appData);
}

// Hide the popover window
function hideWindow() {
  if (mainWindow) {
    mainWindow.hide();
  }
}

// Toggle window visibility
function toggleWindow() {
  if (mainWindow && mainWindow.isVisible()) {
    hideWindow();
  } else {
    showWindow();
  }
}

// Create tray icon
function createTray() {
  // Create a simple icon programmatically (retina-ready)
  const iconSize = 16;
  const canvas = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(`
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="16" height="16" rx="3" fill="#7C3AED"/>
        <path d="M4 6L8 8.5L12 6" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M8 8.5L8 12" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
    `).toString('base64')}`
  );
  
  tray = new Tray(canvas.resize({ width: 16, height: 16 }));
  tray.setToolTip('Keystone - Press ⌘⇧Space to open');
  
  // Left click toggles window
  tray.on('click', (event, bounds) => {
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;
    toggleWindow();
  });
  
  // Right click shows context menu
  tray.on('right-click', () => {
    showContextMenu();
  });
  
  // Double click (optional)
  tray.on('double-click', () => {
    toggleWindow();
  });
}

// Show context menu on right-click
function showContextMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Keystone',
      click: showWindow,
      accelerator: 'CommandOrControl+Shift+Space'
    },
    { type: 'separator' },
    {
      label: 'Quit Keystone',
      click: () => {
        isQuitting = true;
        app.quit();
      },
      accelerator: 'CommandOrControl+Q'
    }
  ]);
  
  tray.popUpContextMenu(contextMenu);
}

// Register global shortcut
function registerGlobalShortcut() {
  const shortcut = appData.settings?.globalShortcut || 'CommandOrControl+Shift+Space';
  
  const success = globalShortcut.register(shortcut, () => {
    toggleWindow();
  });
  
  if (!success) {
    console.error('Failed to register global shortcut:', shortcut);
  }
  
  return success;
}

// Unregister global shortcut
function unregisterGlobalShortcut() {
  globalShortcut.unregisterAll();
}

// IPC handlers
function setupIpc() {
  // Get all data
  ipcMain.handle('get-data', () => {
    return appData;
  });
  
  // Save item (create or update)
  ipcMain.handle('save-item', (event, item) => {
    const now = new Date();
    const updated = 'Just now';
    
    if (item.id && appData.items.find(i => i.id === item.id)) {
      // Update existing
      appData.items = appData.items.map(i => 
        i.id === item.id ? { ...i, ...item, updated } : i
      );
    } else {
      // Create new
      const newItem = {
        ...item,
        id: Date.now(),
        updated,
        favorite: false,
        tags: item.tags || ['Personal'],
        tone: item.tone || 'purple'
      };
      appData.items.unshift(newItem);
    }
    
    saveData(appData);
    // Notify renderer of data change
    if (mainWindow) mainWindow.webContents.send('data-updated', appData);
    return appData;
  });
  
  // Delete item
  ipcMain.handle('delete-item', (event, id) => {
    appData.items = appData.items.filter(i => i.id !== id);
    saveData(appData);
    if (mainWindow) mainWindow.webContents.send('data-updated', appData);
    return appData;
  });
  
  // Toggle favorite
  ipcMain.handle('toggle-favorite', (event, id) => {
    const item = appData.items.find(i => i.id === id);
    if (item) {
      item.favorite = !item.favorite;
      item.updated = 'Just now';
      saveData(appData);
      if (mainWindow) mainWindow.webContents.send('data-updated', appData);
    }
    return appData;
  });
  
  // Copy to clipboard
  ipcMain.handle('copy-to-clipboard', (event, text) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
    return { success: true };
  });
  
  // Update settings
  ipcMain.handle('update-settings', (event, settings) => {
    appData.settings = { ...appData.settings, ...settings };
    saveData(appData);
    
    // Re-register shortcut if changed
    if (settings.globalShortcut) {
      unregisterGlobalShortcut();
      registerGlobalShortcut();
    }
    
    if (mainWindow) mainWindow.webContents.send('data-updated', appData);
    return appData;
  });
  
  // Hide window
  ipcMain.handle('hide-window', () => {
    hideWindow();
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Prevent multiple instances
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }
  
  // macOS: hide from dock, run as agent
  if (isMac) {
    app.dock.hide();
    app.setLoginItemSettings({
      openAtLogin: appData.settings?.launchAtLogin || false,
      path: process.execPath
    });
  }
  
  // Windows/Linux: quit when all windows closed (except we don't have normal windows)
  app.on('window-all-closed', () => {
    // Don't quit - we're a menu bar app
  });
  
  // Create tray and window
  createTray();
  createMainWindow();
  registerGlobalShortcut();
  setupIpc();
  
  // macOS: re-create window when dock icon clicked (not applicable since we hide dock)
  app.on('activate', () => {
    if (!mainWindow) createMainWindow();
  });
});

// Cleanup on quit
app.on('will-quit', () => {
  unregisterGlobalShortcut();
  isQuitting = true;
});

// Handle second instance launch
app.on('second-instance', () => {
  showWindow();
});

// Security: prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (e, url) => {
    e.preventDefault();
    shell.openExternal(url);
  });
});

module.exports = { appData, saveData, loadData };