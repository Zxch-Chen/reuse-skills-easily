# Keystone

A focused macOS-style library for saving and reusing prompts, snippets, design files, and other working artifacts across apps.

## Overview

Keystone is a **menu bar app** for macOS that lets you:
- Save and organize prompts, code snippets, and design file references
- Access everything instantly via global shortcut (`⌘⇧Space`)
- Copy to clipboard with one click
- Persist data locally (no cloud required)
- Filter by type, search, favorite items

## Screenshots

*(Run the app to see the macOS-native interface)*

## Quick Start (Development)

### Prerequisites
- Node.js 18+
- macOS (for building .dmg/.zip)

### Install Dependencies
```bash
npm install
```

### Run in Development Mode
```bash
npm run dev
```
This starts Vite dev server and Electron with hot reload.

### Build for Production
```bash
# Build for current architecture
npm run build

# Build universal macOS binaries (Intel + Apple Silicon)
npm run build:mac
```

Outputs:
- `dist-electron/Keystone-1.0.0.dmg` — macOS installer
- `dist-electron/Keystone-1.0.0-mac.zip` — Portable zip

## Features

### Menu Bar Integration
- Runs as agent app (no Dock icon)
- Retina tray icon in top-right menu bar
- Click to open popover, right-click for menu

### Global Shortcut
- Default: `⌘⇧Space` (configurable)
- Opens/closes popover instantly
- Works from any app

### Library Management
- **Three types**: Prompts, Snippets, Design Files
- **Collections**: All, Favorites, by type
- **Search**: Real-time filtering by name, description, tags, content
- **Tags**: Color-coded (purple, blue, green, amber)
- **Favorites**: Star items for quick access

### Item Details
- Syntax-highlighted content view
- Copy to clipboard button
- Attached file references (for design files)
- Metadata: collection, tags, last updated

### Data Persistence
- Stored in `~/Library/Application Support/Keystone/keystone-data.json`
- Survives app updates and restarts
- No external dependencies

### Native macOS Feel
- Transparent popover with blur backdrop
- Smooth animations
- Respects dark/light mode
- Proper window positioning near menu bar
- Hide on blur (click outside to dismiss)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘⇧Space` | Toggle popover (global) |
| `⌘K` | Focus search |
| `Escape` | Close popover / close modal |
| `Enter` | Save in modal / select card |

## Project Structure

```
keystone/
├── main.js                 # Electron main process
├── preload.js              # Secure IPC bridge
├── package.json            # Config & build settings
├── vite.config.js          # Vite bundler config
├── src/
│   └── renderer/
│       ├── index.html      # Main UI (HTML + CSS)
│       └── main.js         # Renderer logic (ES module)
├── assets/                 # Icons & DMG assets
│   ├── icon.svg            # Source icon
│   ├── icon-*.png          # PNG icons (16-1024px)
│   ├── icon.iconset/       # iconset for .icns
│   ├── dmg-background.png  # DMG window background
│   └── dmg-icon.icns       # DMG volume icon
├── build/
│   └── entitlements.mac.plist  # macOS hardening
└── scripts/
    ├── generate-icons.js   # Generate icons (macOS only)
    ├── simple-png.js       # Fallback PNG generator
    └── create-dmg-background.js
```

## Building Icons (macOS)

On macOS, run the icon generator to create proper `.icns` and all PNG sizes:

```bash
node scripts/generate-icons.js
```

This uses `sips` and `iconutil` (built into macOS) to create:
- `assets/icon.icns` — App icon
- `assets/icon-*.png` — All required sizes with logo

## Building DMG Background (macOS)

```bash
node scripts/create-dmg-background.js
```

Requires `canvas` npm package (native, install with `npm install canvas`).

## Configuration

### Global Shortcut
Change in Settings (coming soon) or edit `keystone-data.json`:
```json
{
  "settings": {
    "globalShortcut": "CommandOrControl+Shift+Space"
  }
}
```

### Launch at Login
```json
{
  "settings": {
    "launchAtLogin": true
  }
}
```

## Data Format

Items stored in `keystone-data.json`:
```json
{
  "items": [
    {
      "id": 1234567890,
      "name": "Item name",
      "type": "Prompt|Snippet|File",
      "description": "Brief description",
      "tags": ["tag1", "tag2"],
      "tone": "purple|blue|green|amber",
      "updated": "Just now",
      "favorite": false,
      "content": "Full content...",
      "files": [["filename.fig", "2.4 MB"]]
    }
  ],
  "settings": { ... }
}
```

## Development Notes

### Adding New IPC Channels
1. Add handler in `main.js` → `setupIpc()`
2. Expose in `preload.js` → `contextBridge.exposeInMainWorld`
3. Call from renderer via `window.keystoneAPI.method()`

### Security
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- All IPC via `contextBridge` (no direct `ipcRenderer` in renderer)

### Popover Positioning
Window positioned near tray icon on macOS:
```js
const trayBounds = tray.getBounds();
mainWindow.setPosition(trayBounds.x - width/2 + trayBounds.width/2, 28);
```

## Troubleshooting

### Electron won't install (certificate errors)
```bash
# Use Chinese mirror
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install electron@29 --save-dev

# Or disable SSL (not recommended for production)
NODE_TLS_REJECT_UNAUTHORIZED=0 npm install electron@29 --save-dev
```

### App won't open on macOS (Gatekeeper)
```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine /Applications/Keystone.app

# Or allow in System Settings → Privacy & Security
```

### Global shortcut not working
- Check System Settings → Keyboard → Shortcuts → Services
- Ensure no conflict with other apps
- Try different shortcut in settings

## License

MIT — Jordan Davis