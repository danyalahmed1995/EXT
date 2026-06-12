<p align="center">
  <img src="./src-tauri/icons/icon.png" alt="EXT" width="96" height="96" />
</p>

<h1 align="center">EXT</h1>

<p align="center">
  <strong>A local workspace for Markdown, MDX, JSON, YAML, shell scripts, and text files.</strong>
</p>

<p align="center">
  Open folders you already have. Read, edit, search, preview, and keep your files as normal files on disk.
</p>

<p align="center">
  <a href="https://github.com/danyalahmed1995/EXT/actions/workflows/ci.yml">
    <img alt="CI" src="https://img.shields.io/github/actions/workflow/status/danyalahmed1995/EXT/ci.yml?branch=main&label=CI&style=for-the-badge" />
  </a>
  <a href="https://github.com/danyalahmed1995/EXT/actions/workflows/release.yml">
    <img alt="Release" src="https://img.shields.io/github/actions/workflow/status/danyalahmed1995/EXT/release.yml?label=Release&style=for-the-badge" />
  </a>
  <a href="./LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/danyalahmed1995/EXT?style=for-the-badge" />
  </a>
</p>

<p align="center">
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat-square" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178C6?style=flat-square" />
  <img alt="Local files" src="https://img.shields.io/badge/local-filesystem-7C3AED?style=flat-square" />
</p>

---

EXT is a desktop app for people who keep useful files across folders, projects, notes, repos, and downloads.

It does not import your files into a vault. It does not sync them to a service. It does not hide them behind a database. You add folders, EXT scans the supported files, and you keep working with the same files every other editor already sees.

## What EXT opens

EXT treats these as editable local files:

- Markdown: `.md`, `.markdown`
- MDX: `.mdx`
- JSON: `.json`
- YAML: `.yml`, `.yaml`
- Text: `.txt`
- Shell scripts: `.sh`, `.bash`, `.zsh`, `.fish`, `.ksh`, `.csh`, `.tcsh`
- Shell config files: `.bashrc`, `.bash_profile`, `.profile`, `.zshrc`, `.zprofile`, `.zshenv`, `.zlogin`, `.zlogout`, `.kshrc`
- Extensionless shell scripts with a shell shebang

Images are shown when Markdown references them, but EXT does not add images to the workspace file list or manage image assets.

## What EXT does

### Workspaces

- Add local folders as workspaces.
- Browse files from multiple folders in one app.
- Use smart views for recent files, favorites, Markdown files, text files, modified files, and TODOs.
- Keep files in their original folders.
- Remove a workspace from EXT without deleting anything from disk.

### Editing

- Edit files with CodeMirror 6.
- Use tabs for open files.
- Switch between editor-only, split, and preview-only layouts.
- Autosave changes to disk.
- Use find and replace in the current file.
- See saved state, file type, encoding, line endings, and Git branch in the status bar.
- Convert line endings between `LF` and `CRLF`.

### Markdown and MDX preview

- Preview Markdown and MDX files.
- Render GitHub-Flavored Markdown.
- Render LaTeX/math-heavy Markdown safely.
- Use outline navigation from Markdown headings.
- Print normal Markdown/MDX previews through the native print dialog.
- Print output uses a plain white page, black text, readable tables, and readable code blocks.
- Printing is disabled for oversized files so the native print window does not crash.

MDX is treated as Markdown-like source. EXT does not execute imports, exports, JSX, or components.

### JSON, YAML, shell scripts, and text

- Edit JSON and YAML as source files.
- Edit valid or broken JSON/YAML without forcing schema validation.
- Edit shell scripts and shell config files as source files.
- Highlight shell syntax for normal and large supported shell files.
- Do not execute, source, lint, format, or run shell scripts.
- Use viewport-bounded highlighting for large structured/source files where needed.

### File actions

- Create files and folders.
- Rename files.
- Delete files with confirmation.
- Reveal files in the system file explorer.
- Copy absolute file paths.
- Open files in the system default app.
- Use context menus from files, tabs, and the editor.

### Large files

EXT is built to avoid freezing on large local files.

- Large Markdown files use demand-driven preview work.
- Large JSON, YAML, and shell files avoid full-document syntax work when that would hurt responsiveness.
- Very large files use safer editor paths instead of trying to render everything at once.
- Huge documents can still be opened externally when a dedicated editor is the better tool.

The goal is simple: keep EXT responsive. It is not trying to become the best tool for every giant file.

### Local Git branch indicator

When the active file is inside a Git repo, EXT shows the current local branch in the status bar. It hides outside Git folders.

This is local-only. EXT does not call GitHub APIs, ask for GitHub login, fetch, pull, push, or manage commits.

## What EXT is not

EXT is not:

- a cloud notes service
- a hosted vault
- a collaboration suite
- a WYSIWYG editor
- a terminal
- a Git client
- an IDE
- a publishing system

It is a local workspace and editor for common project/doc files.

## Demo

![EXT Demo Part 1](./public/demo-example/demo_part1.gif)
![EXT Demo Part 2](./public/demo-example/demo_part2.gif)
![EXT Demo Part 3](./public/demo-example/demo_part3.gif)
![EXT Demo Part 4](./public/demo-example/demo_part4.gif)
![EXT Demo Part 5](./public/demo-example/demo_part5.gif)

Demo media lives in the repository for README and development use. Production builds strip demo media and development examples from packaged apps.

## Downloads

Prebuilt installers are attached to GitHub Releases.

Available packages:

- Windows: `.exe` / `.msi`
- macOS: `.dmg`
- Linux: `.deb` and AppImage

### macOS builds

- Apple Silicon Macs, M1/M2/M3/M4: download the `aarch64.dmg`
- Intel Macs, Core i5/i7/i9: download the `x86_64.dmg`

The macOS builds are currently unsigned and not notarized, so macOS may show a warning. These are technical preview builds.

## Keyboard shortcuts

On macOS, use `Cmd` where the table says `Ctrl`/`Cmd`.

| Shortcut | Action |
| --- | --- |
| `Ctrl`/`Cmd` + `P` | Focus global file search / quick open |
| `Ctrl`/`Cmd` + `F` | Open find and replace |
| `Ctrl`/`Cmd` + `B` | Toggle the sidebar |
| `Ctrl`/`Cmd` + `1` | Focus the editor |
| `Ctrl`/`Cmd` + `2` | Focus the preview / split area |
| `Ctrl`/`Cmd` + `Tab` | Switch to the next tab |
| `Ctrl`/`Cmd` + `Shift` + `Tab` | Switch to the previous tab |
| `Ctrl`/`Cmd` + `W` | Close the current tab |

## Tech stack

- Tauri v2
- Rust backend
- React
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

### Reset local app state

To clear EXT's saved browser/development state and start with a fresh workspace list:

```bash
npm run reset:state
```

To also clear the desktop app state used by the Tauri build:

```bash
npm run reset:state:desktop
```

These commands remove saved EXT settings/workspaces from local development storage. They do not delete your actual workspace folders or files.

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

GitHub Actions run frontend and Rust/Tauri checks on pushes and pull requests.

## Benchmarking

To run the large-file responsiveness benchmark:

```bash
npm run benchmark:large-md
```

The benchmark covers large Markdown and LaTeX Markdown, plus large valid/broken JSON, YAML, MDX, and shell files where supported.

It checks that EXT stays responsive while heavy files are opened, highlighted, searched, previewed, or routed through the large-file safeguards.

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

If you distribute a modified version of EXT, you must keep it under the same license and provide the corresponding source code.

The EXT name, logo, icon, screenshots, and other brand assets are not covered by the GPL license grant. Do not use them in a way that suggests your fork or modified build is the official EXT app.
