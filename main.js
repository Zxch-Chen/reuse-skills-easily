/**
 * Keystone - Main Electron Process
 * Menu bar app with global shortcut, popover window, and tray icon
 */

const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, screen, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
      favoriteOrder: 0,
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
      favoriteOrder: 1,
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
      favoriteOrder: 2,
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

// Backfill fields added after this item may have been created/saved, so
// older saved data (or defaultData) always has what sorting/ordering needs.
function normalizeItem(item) {
  return {
    copyCount: 0,
    favoriteOrder: null,
    updatedAt: Date.now(),
    ...item
  };
}

// Load data from disk
function loadData() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      const data = { ...defaultData, ...JSON.parse(raw) };
      data.items = data.items.map(normalizeItem);
      return data;
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  return { ...defaultData, items: defaultData.items.map(normalizeItem) };
}

// Save data to disk
function saveData(data) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

// Puts a newly-favorited item at the end of the current favorites order
function nextFavoriteOrder() {
  const orders = appData.items.filter(i => i.favorite && i.favoriteOrder != null).map(i => i.favoriteOrder);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

let appData = loadData();

// --- Synced skill sources: Claude Code, Codex CLI, and Cursor all store ---
// --- reusable skills/rules as local files. We watch their known locations ---
// --- and surface them here read-only, live, alongside your own items. ---

// Minimal `key: value` frontmatter reader — good enough for the flat
// name/description fields these tools use, not a full YAML parser.
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw.trim() };
  const data = {};
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) data[key] = value;
  });
  return { data, body: match[2].trim() };
}

function firstLine(text, maxLen = 140) {
  const line = (text || '').split('\n').find(l => l.trim().length > 0) || '';
  return line.length > maxLen ? line.slice(0, maxLen - 1) + '…' : line;
}

// Claude Code and Codex CLI both use ~/.<tool>/skills/<name>/SKILL.md with
// `name:`/`description:` frontmatter and a markdown body.
function scanSkillMdSources(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return results; // directory doesn't exist (tool not installed) - skip quietly
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(dir, entry.name, 'SKILL.md');
    try {
      const raw = fs.readFileSync(skillFile, 'utf-8');
      const { data, body } = parseFrontmatter(raw);
      results.push({
        name: data.name || entry.name,
        description: data.description || firstLine(body),
        content: body,
        sourcePath: skillFile
      });
    } catch (e) {
      // no SKILL.md in this folder, or unreadable - skip it
    }
  }
  return results;
}

// Cursor stores each rule as its own ~/.cursor/rules/<name>.mdc file with
// `description:`/`globs:`/`alwaysApply:` frontmatter and a markdown body.
function scanCursorRules(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return results;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.mdc')) continue;
    const filePath = path.join(dir, entry.name);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, body } = parseFrontmatter(raw);
      results.push({
        name: entry.name.replace(/\.mdc$/, ''),
        description: data.description || firstLine(body),
        content: body,
        sourcePath: filePath
      });
    } catch (e) {
      console.error(`Failed to read cursor rule ${filePath}:`, e);
    }
  }
  return results;
}

// Cursor's Settings > Rules > "User Rules" isn't a file - it's a value in a
// SQLite db Cursor keeps for its own UI state. sql.js (WASM, no native
// compile step) lets us read it without adding a native dependency.
const initSqlJs = require('sql.js');
let sqlJsPromise = null;
function getSqlJs() {
  if (!sqlJsPromise) sqlJsPromise = initSqlJs();
  return sqlJsPromise;
}

async function scanCursorUserRules(dbPath) {
  const results = [];
  if (!fs.existsSync(dbPath)) return results;
  try {
    const SQL = await getSqlJs();
    const db = new SQL.Database(fs.readFileSync(dbPath));
    const res = db.exec("SELECT value FROM ItemTable WHERE key = 'aicontext.personalContext'");
    db.close();

    if (res.length && res[0].values.length) {
      const raw = res[0].values[0][0];
      let content = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf-8');
      try {
        // The value is sometimes JSON-encoded (a quoted string); unwrap it if so
        const parsed = JSON.parse(content);
        if (typeof parsed === 'string') content = parsed;
      } catch (e) {
        // plain text already - use as-is
      }
      content = content.trim();
      if (content) {
        results.push({ name: 'User Rules', description: firstLine(content), content, sourcePath: dbPath });
      }
    }
  } catch (e) {
    console.error(`Failed to read Cursor User Rules from ${dbPath}:`, e);
  }
  return results;
}

const SKILL_SOURCES = [
  { id: 'claude-skill', label: 'Claude Code', target: path.join(os.homedir(), '.claude', 'skills'), isDir: true, scan: scanSkillMdSources },
  { id: 'codex-skill', label: 'Codex CLI', target: path.join(os.homedir(), '.codex', 'skills'), isDir: true, scan: scanSkillMdSources },
  { id: 'cursor-rule', label: 'Cursor', target: path.join(os.homedir(), '.cursor', 'rules'), isDir: true, scan: scanCursorRules },
  { id: 'cursor-rule', label: 'Cursor', target: path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'), isDir: false, scan: scanCursorUserRules }
];

// Deterministic id from the source file path, so the same skill keeps the
// same id across rescans (FNV-1a string hash).
function stableId(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

let syncedItems = [];

// Async because Cursor's User Rules scan reads through sql.js; the plain
// file-based scans return arrays directly, which `await` just passes through.
async function refreshSyncedItems() {
  const found = [];
  for (const source of SKILL_SOURCES) {
    const skills = await source.scan(source.target);
    for (const skill of skills) {
      found.push({
        id: stableId(skill.sourcePath),
        name: skill.name,
        type: 'Prompt',
        description: skill.description,
        tags: [source.label],
        tone: 'purple',
        updated: 'Synced',
        favorite: false,
        content: skill.content,
        source: source.id,
        sourceLabel: source.label,
        sourcePath: skill.sourcePath
      });
    }
  }
  syncedItems = found;
  if (mainWindow) mainWindow.webContents.send('data-updated', composedData());
}

// appData.items (disk-persisted) holds only items you created yourself;
// synced items are recomputed from disk each scan and merged in at send-time.
function composedData() {
  return { ...appData, items: [...appData.items, ...syncedItems] };
}

const sourceWatchers = new Map(); // source.target -> fs.FSWatcher

// (Re)watches any source file/directory that exists but isn't yet watched, so
// a tool installed/set up after Keystone launched still gets picked up.
function ensureSourceWatchers(onChange) {
  for (const source of SKILL_SOURCES) {
    if (sourceWatchers.has(source.target) || !fs.existsSync(source.target)) continue;
    try {
      const watcher = source.isDir
        ? fs.watch(source.target, { recursive: true }, onChange)
        : fs.watch(source.target, onChange);
      sourceWatchers.set(source.target, watcher);
    } catch (e) {
      console.error(`Failed to watch ${source.target}:`, e);
    }
  }
}

function stopSourceWatchers() {
  for (const watcher of sourceWatchers.values()) watcher.close();
  sourceWatchers.clear();
}

let syncDebounceTimer = null;
function handleSourceChange() {
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(refreshSyncedItems, 300);
}

// Compact (default, Favorites-only, no sidebar) is a tall, narrow-ish
// popover; Expanded (Library browsing, with sidebar) is the wider 3-pane
// layout. Compact needs enough width for a skill's name plus its hover
// actions (favorite/edit/delete) and type badge to not crowd each other.
const WINDOW_MODES = {
  compact: { width: 460, height: 640 },
  expanded: { width: 1000, height: 600 }
};

// Create the popover window
function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const initialSize = WINDOW_MODES.compact;

  mainWindow = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    x: width - initialSize.width - 20,
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
    : `file://${path.join(__dirname, 'index.html')}`;
  
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

// Position the popover near the tray icon (top-right)
// Computes where the window should sit, anchored near the tray icon, for a
// given size - used both to reposition in place and to resize+reposition
// together as a single animated move (see set-window-mode below).
function computeAnchoredBounds(targetWidth, targetHeight) {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const trayBounds = tray?.getBounds();

  const x = trayBounds
    ? Math.max(0, Math.min(
        trayBounds.x - (targetWidth / 2) + (trayBounds.width / 2),
        width - targetWidth
      ))
    : width - targetWidth - 20;

  return { x, y: isMac ? 28 : 0, width: targetWidth, height: targetHeight };
}

function positionWindow() {
  const { width, height } = mainWindow.getBounds();
  mainWindow.setBounds(computeAnchoredBounds(width, height));
}

// Show the popover window. `focus: false` is used for hover reveals so we
// don't steal focus from whatever the user was doing.
function showWindow(focus = true) {
  if (!mainWindow) createMainWindow();

  positionWindow();

  if (focus) {
    // As an accessory app (no Dock icon), just focusing the window isn't
    // enough on macOS - the app itself needs to become frontmost, or the
    // window blurs (and our own blur handler hides it) almost immediately.
    if (isMac) app.focus({ steal: true });
    mainWindow.show();
    mainWindow.focus();
  } else {
    mainWindow.showInactive();
  }

  // Notify renderer to refresh data immediately (snappy open, last-known state)
  mainWindow.webContents.send('data-updated', composedData());

  // Catch up on any synced skills that changed while the popover was hidden
  // (refreshSyncedItems sends its own follow-up update once done), and start
  // watching any source directory that appeared since launch.
  refreshSyncedItems();
  ensureSourceWatchers(handleSourceChange);
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

// --- Hover-to-reveal, like macOS's Quick Note hot corner ---
// Electron has no native "hover over tray icon" event, so we poll the cursor
// position and show/hide the popover as it crosses the tray icon or window bounds.
let hoverInterval = null;
let hoverHideTimeout = null;
let isDragging = false; // suspends hover-hide during favorites drag-and-drop -
// cursor tracking during a native HTML5 drag can misreport as "left the
// window", which would hide the popover mid-drag and drop the reorder.
const HOVER_POLL_MS = 120;
const HOVER_HIDE_DELAY_MS = 300;
const HOVER_ZONE_PADDING = 6;

function pointInRect(point, rect, padding = 0) {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}

function clearHoverHideTimeout() {
  if (hoverHideTimeout) {
    clearTimeout(hoverHideTimeout);
    hoverHideTimeout = null;
  }
}

function scheduleHoverHide() {
  if (hoverHideTimeout || isDragging) return;
  hoverHideTimeout = setTimeout(() => {
    hoverHideTimeout = null;
    if (mainWindow && mainWindow.isVisible()) hideWindow();
  }, HOVER_HIDE_DELAY_MS);
}

function startHoverWatcher() {
  if (hoverInterval || !isMac) return;

  hoverInterval = setInterval(() => {
    if (!tray) return;

    const point = screen.getCursorScreenPoint();
    const inTray = pointInRect(point, tray.getBounds(), HOVER_ZONE_PADDING);
    const winBounds = mainWindow ? mainWindow.getBounds() : null;
    const inWindow = winBounds ? pointInRect(point, winBounds, HOVER_ZONE_PADDING) : false;

    if (inTray) {
      clearHoverHideTimeout();
      if (!mainWindow || !mainWindow.isVisible()) showWindow(false);
    } else if (inWindow) {
      clearHoverHideTimeout();
    } else if (mainWindow && mainWindow.isVisible() && !mainWindow.isFocused()) {
      // Only auto-hide windows that were hover-revealed (unfocused). A window
      // opened via click or the global shortcut is focused, and hides via the
      // existing 'blur' handler instead, so the shortcut isn't undone by a
      // stray mouse position.
      scheduleHoverHide();
    }
  }, HOVER_POLL_MS);
}

function stopHoverWatcher() {
  if (hoverInterval) {
    clearInterval(hoverInterval);
    hoverInterval = null;
  }
  clearHoverHideTimeout();
}

// Create tray icon
function createTray() {
  // nativeImage can't decode SVG, so load the pre-rendered PNGs (16px base, 32px for retina)
  const assetsPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '..', 'assets');

  const trayIcon = nativeImage.createFromPath(path.join(assetsPath, 'icon-16.png'));
  trayIcon.addRepresentation({
    scaleFactor: 2.0,
    buffer: fs.readFileSync(path.join(assetsPath, 'icon-32.png'))
  });

  tray = new Tray(trayIcon);
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
    return composedData();
  });

  // Save item (create or update). Synced skills are read-only - edit the
  // source file (Claude/Codex/Cursor) instead, and the sync will pick it up.
  // Also used to clone a synced skill into your own library: the renderer
  // calls this with no id and favorite:true.
  ipcMain.handle('save-item', (event, item) => {
    if (item.id && syncedItems.some(s => s.id === item.id)) {
      return composedData();
    }

    if (item.id && appData.items.find(i => i.id === item.id)) {
      // Update existing
      appData.items = appData.items.map(i =>
        i.id === item.id ? { ...i, ...item, updated: 'Just now', updatedAt: Date.now() } : i
      );
    } else {
      // Create new
      const favorite = !!item.favorite;
      const newItem = {
        ...item,
        id: Date.now(),
        updated: 'Just now',
        updatedAt: Date.now(),
        copyCount: 0,
        favorite,
        favoriteOrder: favorite ? nextFavoriteOrder() : null,
        tags: item.tags || ['Personal'],
        tone: item.tone || 'purple'
      };
      appData.items.unshift(newItem);
    }

    saveData(appData);
    // Notify renderer of data change
    if (mainWindow) mainWindow.webContents.send('data-updated', composedData());
    return composedData();
  });

  // Delete item
  ipcMain.handle('delete-item', (event, id) => {
    if (syncedItems.some(s => s.id === id)) {
      return composedData();
    }
    appData.items = appData.items.filter(i => i.id !== id);
    saveData(appData);
    if (mainWindow) mainWindow.webContents.send('data-updated', composedData());
    return composedData();
  });

  // Toggle favorite
  ipcMain.handle('toggle-favorite', (event, id) => {
    if (syncedItems.some(s => s.id === id)) {
      return composedData();
    }
    const item = appData.items.find(i => i.id === id);
    if (item) {
      item.favorite = !item.favorite;
      item.updated = 'Just now';
      item.updatedAt = Date.now();
      if (item.favorite && item.favoriteOrder == null) {
        item.favoriteOrder = nextFavoriteOrder();
      }
      saveData(appData);
      if (mainWindow) mainWindow.webContents.send('data-updated', composedData());
    }
    return composedData();
  });

  // Persist a new drag-and-drop order for the favorites list
  ipcMain.handle('reorder-favorites', (event, orderedIds) => {
    orderedIds.forEach((id, index) => {
      const item = appData.items.find(i => i.id === id);
      if (item) item.favoriteOrder = index;
    });
    saveData(appData);
    if (mainWindow) mainWindow.webContents.send('data-updated', composedData());
    return composedData();
  });

  // Copy to clipboard. When copying a real (non-synced) item, tracks a copy
  // count for the "Most copied" favorites sort - saved silently, without a
  // data-updated broadcast, so it doesn't interrupt the click's own
  // in-progress "Copied!" animation on the renderer side - the broadcast is
  // delayed just past that animation's duration so it never gets interrupted,
  // while still keeping copy counts fresh for the "Most copied" sort shortly after.
  ipcMain.handle('copy-to-clipboard', (event, text, id) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
    if (id != null) {
      const item = appData.items.find(i => i.id === id);
      if (item) {
        item.copyCount = (item.copyCount || 0) + 1;
        saveData(appData);
        setTimeout(() => {
          if (mainWindow) mainWindow.webContents.send('data-updated', composedData());
        }, 600);
      }
    }
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

    if (mainWindow) mainWindow.webContents.send('data-updated', composedData());
    return composedData();
  });

  // Hide window
  ipcMain.handle('hide-window', () => {
    hideWindow();
  });

  // Resize between the compact (default, Favorites) and expanded (Library
  // browsing, with sidebar) layouts, keeping it anchored near the tray icon.
  ipcMain.handle('set-window-mode', (event, mode) => {
    const size = WINDOW_MODES[mode];
    if (!mainWindow || !size) return;
    // One coordinated animated move, not a separate resize + a snap-instant
    // reposition after it - those were fighting each other and looked janky.
    mainWindow.setBounds(computeAnchoredBounds(size.width, size.height), true);
  });

  // Suspends hover-hide while a favorites drag-and-drop is in progress
  ipcMain.handle('set-dragging', (event, dragging) => {
    isDragging = dragging;
    if (dragging) clearHoverHideTimeout();
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
  startHoverWatcher();
  refreshSyncedItems();
  ensureSourceWatchers(handleSourceChange);
  
  // Opening an already-running instance via Spotlight/Finder/Dock fires this
  // (not 'second-instance', which only fires for a genuinely new process),
  // so it needs to actually show the popover, not just ensure it exists.
  app.on('activate', () => {
    if (!mainWindow) {
      createMainWindow();
    } else {
      showWindow();
    }
  });
});

// Cleanup on quit
app.on('will-quit', () => {
  unregisterGlobalShortcut();
  stopHoverWatcher();
  stopSourceWatchers();
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