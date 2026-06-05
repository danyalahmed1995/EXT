# EXT

A fast, local-first workspace for Markdown and text files scattered across your folders.

> Add folders. See files. Search. Edit. Preview. Save.

## Features

### Working (v0.1 Prototype)

- ✅ Three-pane layout (sidebar, file list, editor/preview)
- ✅ Material Dark Purple theme with CSS variables
- ✅ Sidebar with smart views and workspace list
- ✅ Smart folder/project icons (TypeScript, Python, Rust, etc.)
- ✅ File list with favorites, extension badges, and relative dates
- ✅ CodeMirror 6 editor with Markdown syntax highlighting
- ✅ Live Markdown preview with sanitized HTML
- ✅ Editor / Split / Preview view modes
- ✅ Resizable panes
- ✅ Tab system with unsaved indicators

### Planned

- 📋 Add folders and scan real files
- 📋 File watching for external changes
- 📋 Global search across files
- 📋 Real file read/write with conflict detection
- 📋 Settings panel
- 📋 Theme switcher
- 📋 Quick open (Ctrl+P)
- 📋 Keyboard shortcuts

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 |
| Backend | Rust |
| Frontend | React 19 + TypeScript |
| Build tool | Vite |
| Editor | CodeMirror 6 |
| Markdown | markdown-it + DOMPurify |
| Styling | CSS variables + Material tokens |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) toolchain
- Windows: Visual Studio C++ Build Tools

### Install

```bash
npm install
```

### Run (frontend only)

```bash
npm run dev
```

### Run (full Tauri app)

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Roadmap

### v0.1 — UI Prototype ✅
- App shell with three-pane layout
- Material dark theme
- Mock data for all views
- CodeMirror editor + Markdown preview

### v0.2 — Core Functionality
- Add folders and scan `.md`, `.markdown`, `.txt`
- SQLite file index
- Open, edit, save files
- File watching

### v0.3 — Search & Smart Views
- Global filename + content search
- Smart views (Recent, Favorites, TODOs, etc.)
- Favorites and pinning

### v0.4 — Polish
- Theme system (Dark Purple, Dark Blue, Light)
- Settings panel
- Keyboard shortcuts
- Quick open
- Packaging and installers

## License

[MIT](./LICENSE)
