# EXT Design

This document explains how EXT is structured and how contributors should think about the codebase.

EXT is a local-first desktop workspace for `.md` and `.txt` files. The main rule is simple: keep the app fast, understandable, and respectful of files on disk.

## Goals

EXT should:

- read and write real files directly
- avoid proprietary storage
- stay lightweight
- keep Markdown and text workflows simple
- feel polished without becoming heavy
- handle large folders and large files carefully
- fail safely when filesystem operations go wrong

EXT should not become a cloud notes platform, collaboration suite, plugin host, AI workspace, or publishing service.

## Architecture overview

EXT uses Tauri v2.

The app has two main layers:

1. Frontend: React, TypeScript, Vite, CodeMirror, Markdown rendering, app state, and UI.
2. Backend: Rust commands for filesystem access, workspace scanning, path safety, window/tray behavior, and local setup tasks.

The frontend talks to the backend through Tauri commands. Filesystem work should stay on the Rust side when possible.

## Frontend

### App shell

Main layout responsibilities are split across the top-level app and layout components.

The app shell owns the visible structure:

- sidebar
- smart views
- workspace list
- file list
- editor area
- preview area
- tabs
- dialogs
- context menus
- settings

The layout should stay predictable. Avoid hiding core behavior inside unrelated components.

### App state

Core app state is handled through the main app logic hook and related utilities.

State includes:

- connected workspaces
- scanned files
- active view
- active file
- open tabs or recent files
- favorites
- editor content
- save state
- dirty state
- Markdown outline
- preview/editor mode
- theme
- visual settings
- system settings persisted across restarts

Keep one clear source of truth for each state value. Avoid duplicating paths, selected files, or active workspace data in multiple places unless there is a clear reason.

### File list and smart views

The file list is derived from scanned workspace data.

Smart views should be treated as filters over the same file model:

- Recent
- Favorites
- All Markdown
- All Text
- Modified Today
- TODOs

Filtering should be memoized where it matters. Typing in the editor should not cause expensive file list work.

### Editor

The editor is built around CodeMirror 6.

Editor requirements:

- do not recreate the editor instance unnecessarily
- keep typing smooth
- debounce expensive side effects
- keep autosave safe
- preserve unsaved content during file switching and external-change prompts
- dispose editor resources correctly

The editor should support plain text and Markdown without assuming every file is Markdown.

### Preview

Markdown preview is rendered from the current editor content.

Preview requirements:

- sanitize rendered HTML with DOMPurify
- support GitHub-Flavored Markdown behavior where configured
- resolve local image paths from the current Markdown file directory
- show a safe broken-image state when paths are missing
- avoid expensive re-rendering on every keystroke for large documents
- keep Preview Only, Editor Only, and Split View modes stable

Remote image fetching should not be added unless it is explicitly reviewed from a security and privacy angle.

### Outline

The outline is a navigation helper for Markdown files.

It should parse headings and expose jump targets. It should not become a backlinks system, graph view, tag database, or knowledge-management layer.

Outline parsing should be debounced for large documents.

### Themes and visual effects

EXT uses CSS custom properties for its design system.

Rules:

- use theme variables
- avoid hardcoded colors in components
- respect reduced-motion settings
- keep animations short
- do not animate CodeMirror internals in a way that hurts typing
- keep effects configurable from settings

Theme changes and view transitions should feel smooth but must not block core interaction.

### Settings persistence

Settings should survive restarts and recover from bad data.

Persisted data may include:

- workspaces
- favorites
- recent files
- active theme
- visual settings
- close-to-tray behavior
- editor/view preferences

If persisted data is missing, invalid, or stale, use defaults and keep the app running.

## Backend

The Rust backend owns filesystem and native desktop behavior.

### Tauri commands

Commands should be small and explicit. Prefer typed request/response structures over loose data.

Common command groups:

- scan workspace
- read file
- save file
- create file
- create folder
- rename file
- delete file
- reveal in file explorer
- resolve preview asset paths
- load/save settings
- initialize example workspace

### Workspace scanning

Workspace scanning should:

- include only `.md` and `.txt` files
- ignore noisy directories such as `.git`, `node_modules`, `.next`, build folders, and dependency folders
- return metadata needed by the frontend
- avoid unnecessary full rescans
- handle permission errors without crashing

### Path safety

Every filesystem operation must validate paths.

Rules:

- file operations must stay inside connected workspaces unless the operation is explicitly safe
- reject path traversal attempts
- normalize paths before comparing
- handle symlinks carefully
- return structured errors to the frontend
- do not use `unwrap()` or `expect()` in normal production paths

### File operations

File operations should be defensive.

Handle:

- missing files
- deleted folders
- permission denied
- rename collisions
- invalid file names
- external modifications
- failed saves

The frontend should receive enough information to show a useful error without exposing file contents.

### System tray and window lifecycle

The close button may hide the app to the system tray instead of quitting.

The tray menu supports:

- Open
- Restart
- Exit

The backend/window layer must distinguish between:

- close-to-tray
- real exit
- restart

Do not let the tray Exit action get intercepted by the normal close-to-tray handler.

### Logging

Logging is local only.

Logs may include:

- operation name
- timestamp
- error kind
- affected path when useful

Logs must not include document contents. No analytics or telemetry should be added.

## Security

Security rules:

- sanitize Markdown preview HTML
- validate all local paths
- keep destructive operations inside connected workspaces
- do not fetch remote content by default
- do not upload user files
- do not add telemetry
- do not log document contents

## Performance

EXT should feel light even with large workspaces.

Watch for:

- unnecessary rescans
- repeated Markdown rendering
- repeated outline parsing
- unnecessary React re-renders
- large arrays rebuilt during typing
- leaked event listeners
- leaked file watchers
- stale timers or animation frames
- CodeMirror instances not disposed

Use memoization, debouncing, and cleanup where they clearly help. Do not add complex abstractions for small gains.

## Continuous integration

The repository uses GitHub Actions to check frontend and backend changes.

Frontend checks include:

- dependency install
- tests
- production build

Backend checks include:

- Rust toolchain setup
- Tauri system dependencies on Linux runners
- `cargo fmt --check`
- `cargo clippy -- -D warnings`
- `cargo test`

CI should stay strict enough to catch broken builds and careless changes before review.

## Contribution expectations

Before changing core behavior, read this file and `CONTRIBUTING.md`.

Good changes are:

- small
- testable
- easy to review
- consistent with local-first scope
- careful with filesystem safety
- honest about tradeoffs

Avoid broad rewrites unless there is a clear bug or maintenance reason.
