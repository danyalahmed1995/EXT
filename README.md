# EXT
A local-first workspace for Markdown and text files.

## What is EXT?
EXT is not a generic Markdown editor. It is a dedicated desktop application that helps you organize, search, open, edit, and preview Markdown and text files scattered across multiple local folders. Your files stay exactly where they are on your hard drive, keeping you fully in control of your data without requiring cloud syncing or a centralized proprietary database.

## Features (MVP)
- **Local-First Filesystem:** Instantly read, write, and delete real files without importing them.
- **Auto-Scanning:** Recursively scans added folders for `.md` and `.txt` files while automatically ignoring noisy build directories (like `node_modules` or `.git`).
- **Dynamic Organization:** View your scattered files grouped by folder context, favorites, recent modifications, or file type.
- **Global Search:** Find files instantly across all your connected workspaces.
- **Polished Editor & Preview:** A premium split-view environment with syntax highlighting, GitHub-flavored markdown preview, and a beautiful frosted glass UI.
- **Persistence:** Remembers your connected workspaces and favorites between sessions securely.

## Tech Stack
- **Frontend:** React, TypeScript, Vite
- **Editor:** CodeMirror 6, Markdown-it
- **Backend:** Rust, Tauri
- **Styling:** Vanilla CSS Custom Properties (Glassmorphism design system)

## Setup & Run Instructions

### Prerequisites
1. [Node.js](https://nodejs.org) (v16+)
2. [Rust](https://www.rust-lang.org/tools/install)
3. Tauri CLI and OS specific prerequisites as defined in [Tauri Docs](https://tauri.app/v1/guides/getting-started/prerequisites)

### Development
1. Clone the repository and navigate to the root directory.
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Run the Tauri dev server:
   ```bash
   npm run tauri dev
   ```
This will automatically launch Vite and compile the Rust backend, opening the native desktop window.

### Build
To build a production executable:
```bash
npm run tauri build
```
The resulting executable will be available in `src-tauri/target/release`.

## License
MIT License.

## Contributing
Themes are powered by CSS variables. Feel free to modify `src/index.css` to craft new looks!
