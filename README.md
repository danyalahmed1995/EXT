<p align="center">
  <img src="./src-tauri/icons/icon.png" alt="EXT" width="96" height="96" />
</p>

<h1 align="center">EXT</h1>

<p align="center">
  <strong>A local-first workspace for Markdown and plain text files.</strong>
</p>

<p align="center">
  Your files stay in your folders. EXT just gives them a fast, sharp, desktop home.
</p>

<p align="center">
  <a href="https://github.com/danyalahmed1995/EXT/actions/workflows/ci.yml">
    <img alt="CI" src="https://img.shields.io/github/actions/workflow/status/danyalahmed1995/EXT/ci.yml?branch=main&label=CI&style=for-the-badge" />
  </a>
  <a href="https://github.com/danyalahmed1995/EXT/actions/workflows/release.yml">
    <img alt="Release" src="https://img.shields.io/github/actions/workflow/status/danyalahmed1995/EXT/release.yml?label=Release&style=for-the-badge" />
  </a>
  <a href="https://github.com/danyalahmed1995/EXT/stargazers">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/danyalahmed1995/EXT?style=for-the-badge" />
  </a>
  <a href="https://github.com/danyalahmed1995/EXT/forks">
    <img alt="GitHub forks" src="https://img.shields.io/github/forks/danyalahmed1995/EXT?style=for-the-badge" />
  </a>
  <a href="./LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/danyalahmed1995/EXT?style=for-the-badge" />
  </a>
</p>

<p align="center">
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat-square" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178C6?style=flat-square" />
  <img alt="Local first" src="https://img.shields.io/badge/local--first-filesystem-7C3AED?style=flat-square" />
</p>

---

EXT is for people with Markdown and text files scattered across projects, notes, docs, repos, and half-finished idea caves.

It does not import your notes into a proprietary database. It opens folders that already exist on your computer, scans for `.md` and `.txt` files, and gives you one place to read, search, edit, preview, and organize them.

You can keep using Git, OneDrive, Dropbox, Syncthing, Obsidian, VS Code, Notepad, Sublime Text, or any other tool alongside EXT. The files remain normal files on disk.

## Why EXT exists

Most Markdown tools either want to become your whole world or stay too tiny to manage real folder chaos. EXT sits in the middle: a focused desktop workspace for local Markdown and text files, without turning your notes into someone else's database.

| You want | EXT gives you |
| --- | --- |
| Local folders, not a hosted vault | Workspace scanning over real `.md` and `.txt` files |
| Fast access across many folders | Smart views, filename search, tabs, and recent files |
| A proper editor without ceremony | CodeMirror 6, autosave, status bar, find/replace, line ending controls |
| Markdown preview that can survive large files | Demand-driven rendering, chunked preview work, large-doc protection |
| Desktop app behavior | System tray, native file actions, installer builds, release artifacts |

## Demo

A quick look at EXT in motion:

![EXT Demo Part 1](./public/demo-example/demo_part1.gif)
![EXT Demo Part 2](./public/demo-example/demo_part2.gif)
![EXT Demo Part 3](./public/demo-example/demo_part3.gif)
![EXT Demo Part 4](./public/demo-example/demo_part4.gif)
![EXT Demo Part 5](./public/demo-example/demo_part5.gif)

Demo media lives in the repository for README and development use. Production builds strip demo media and development examples from the packaged app.

## What EXT is

EXT is a local-first desktop workspace for Markdown and plain text files.

It gives you:

- one place to browse local Markdown and text files
- fast filename search across connected workspaces
- smart views for common file groups
- a clean editor with live Markdown preview
- tabs, outline navigation, and focus-friendly layouts
- basic file management without hiding your files
- line ending controls for `LF` and `CRLF`
- native handoff to your default external app
- keyboard-driven navigation
- themes and visual settings
- a small production package without bundled demo baggage

## What EXT is not

EXT is not a cloud notes platform, publishing service, collaboration suite, AI workspace, or WYSIWYG editor.

There are no accounts, hosted documents, proprietary sync layers, or hidden note databases. If you want sync, use the filesystem tools you already trust.

## Features

### Local-first workspaces

- Add existing folders as workspaces.
- EXT scans local folders directly.
- Only `.md` and `.txt` files are shown in the workspace file list.
- Common noisy directories such as `.git`, `node_modules`, build output, benchmark output, and cache folders are ignored.
- Files can still be opened and edited by other applications.
- Removing a workspace from EXT does not delete the folder from disk.

### File management

- Create Markdown and text files.
- Create folders.
- Rename files.
- Delete files with confirmation.
- Reveal files in the system file explorer.
- Copy absolute file paths.
- Open files in the system default app.
- Use file, tab, and editor context menus for quick file actions.

### File list path context

The file panel shows the filename first, then a compact path hint underneath it. That keeps the list readable while still making duplicate filenames easy to tell apart.

So when your workspace has three `README.md` files, EXT does not make you play folder roulette.

### Smart views

The sidebar includes quick views for common workflows:

- Recent
- Favorites
- All Markdown
- All Text
- Modified Today
- TODOs

### Search and find

- Global file search for quickly opening files by name.
- In-file find/replace for the current document.
- Search keeps the app feeling like a workspace, not a maze.

### Editor and preview

- CodeMirror 6 editor.
- Autosave to local disk.
- Saved/unsaved state indicator.
- Editor Only, Split View, and Preview Only modes.
- GitHub-Flavored Markdown preview.
- LaTeX and math-heavy Markdown preview support.
- Markdown outline for heading navigation.
- Local image rendering in preview for valid Markdown image paths.
- Status bar metadata for file type, encoding, line endings, size, and save state.
- Demand-driven preview rendering for large Markdown files.

Image files are rendered when referenced from Markdown, but they are not added to the workspace file list and EXT does not manage image assets.

### Line endings

EXT detects the current file line ending style and shows it in the editor status bar.

Supported actions:

- show whether the current file uses `LF` or `CRLF`
- convert the current file from `LF` to `CRLF`
- convert the current file from `CRLF` to `LF`
- preserve the selected line ending style when saving

This keeps Windows, macOS, Linux, Git, and editor tooling from turning a tiny newline into a tiny civil war.

### Tabs and navigation

- Open multiple files in tabs.
- Switch between tabs quickly.
- Close the active tab from the tab bar or keyboard.
- Move between the sidebar, editor, preview, and open tabs without reaching for the mouse every time.
- Use focus mode when the editor needs the whole stage.

### Keyboard shortcuts

On macOS, use `Cmd` where the table says `Ctrl`/`Cmd`.

| Shortcut | Action |
| --- | --- |
| `Ctrl`/`Cmd` + `P` | Focus global file search / quick open |
| `Ctrl`/`Cmd` + `F` | Open find and replace for the current file |
| `Ctrl`/`Cmd` + `B` | Toggle the sidebar |
| `Ctrl`/`Cmd` + `1` | Focus the editor |
| `Ctrl`/`Cmd` + `2` | Focus the preview / split area |
| `Ctrl`/`Cmd` + `Tab` | Switch to the next open tab |
| `Ctrl`/`Cmd` + `Shift` + `Tab` | Switch to the previous open tab |
| `Ctrl`/`Cmd` + `W` | Close the current tab |

### Themes and visual settings

EXT includes a theme system with built-in themes and custom palette support.

Built-in styles include the default EXT dark theme plus additional looks such as Noir and Sci-Fi. Visual polish can be configured from settings, including animations, transitions, editor focus effects, sidebar effects, and reduced-motion behavior.

### System tray

Closing the window can minimize EXT to the system tray instead of quitting.

From the tray, users can:

- open the app
- restart the app
- exit the app

Unsaved changes are protected before restart or exit.

### Production package size

EXT keeps production builds lean by excluding development-only assets from packaged installers.

Production packages do not ship:

- demo GIF media
- development example workspace resources
- benchmark datasets
- generated stress-test Markdown files
- test fixtures, logs, coverage, and local build noise

Development assets remain in the repository for testing, screenshots, README demos, and benchmarks without bloating the app users install.

### Development examples

Production first launch starts cleanly and does not auto-inject an Examples workspace.

Development builds can still use local examples and demo files when needed. Existing saved user workspaces are left untouched.

## Downloads

Prebuilt installers are attached to GitHub Releases.

Available packages:

- Windows: `.exe` / `.msi`
- macOS: `.dmg`
- Linux: `.deb` and AppImage

### macOS downloads

- Apple Silicon Macs, M1/M2/M3/M4: download the `aarch64.dmg`
- Intel Macs, Core i5/i7/i9: download the `x86_64.dmg`

The macOS builds are currently unsigned and not notarized, so macOS may block them with a warning. These builds are technical preview builds.

## Tech stack

- Tauri v2
- Rust backend
- React frontend
- TypeScript
- Vite
- CodeMirror 6
- markdown-it
- DOMPurify

## Development

### Prerequisites

- Node.js
- Rust stable
- Tauri system prerequisites for your operating system

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

### Build frontend

```bash
npm run build
```

### Build installers locally

```bash
npm run tauri:build
```

Generated bundles are written under:

```text
src-tauri/target/release/bundle/
```

Platform-specific packages are best built on their native OS:

- Windows installers on Windows
- macOS DMG on macOS
- Linux packages on Linux

## Quality checks

Frontend:

```bash
npm run test
npm run build
```

Backend:

```bash
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

The repository includes GitHub Actions workflows for frontend and Rust/Tauri checks on pushes and pull requests.

## Benchmarking performance

To run the large Markdown preview responsiveness benchmark:

```bash
npm run benchmark:large-md
```

This benchmark tests the demand-driven rendering architecture against massive Markdown and LaTeX files, including stress files up to 130,000 lines.

It verifies:

- background Web Worker processing and HTML chunk generation speed
- main-thread DOM injection and DOMPurify sanitization latency
- editor responsiveness while preview work is happening
- stable memory behavior without OOM crashes

Benchmark files are development assets and are not shipped in production installers.

## Creating a release

1. Update the version.
2. Commit the change.
3. Create and push a tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

4. GitHub Actions builds release artifacts.

Release builds should use the tagged version for generated artifact names so installer versions match the release tag.

## Documentation

- `DESIGN.md` explains the architecture.
- `CONTRIBUTING.md` explains contribution rules and review expectations.

## License

EXT is licensed under the **GNU General Public License v3.0 or later** (`GPL-3.0-or-later`).

You are free to use, study, modify, and fork EXT. Personal forks and open-source contributions are welcome.

If you distribute a modified version of EXT, you must keep it under the same license and provide the corresponding source code. This keeps EXT and its forks open instead of allowing closed-source rebrands.

The EXT name, logo, icon, screenshots, and other brand assets are not covered by the GPL license grant. Do not use them in a way that suggests your fork or modified build is the official EXT app.
