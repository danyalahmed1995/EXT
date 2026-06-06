# EXT Architecture & Design Document

This document provides a high-level overview of how EXT is structured. It is intended for developers who wish to understand the codebase, contribute new features, or fix bugs.

## Overview
EXT is built using the **Tauri** framework. This means the application has two entirely separate layers that communicate via asynchronous Inter-Process Communication (IPC):
1. **Frontend**: A React application built with TypeScript and bundled by Vite.
2. **Backend**: A native Rust application that handles secure file system operations.

---

## 1. Frontend Architecture (`/src`)

The frontend is responsible for the user interface, state management, and rendering text.

### `src/App.tsx` & `src/components/layout/AppShell.tsx`
These files compose the main layout of the application. `App.tsx` handles the assembly of the various modals, context menus, and the core `AppShell`. The `AppShell` defines the physical boundaries of the screen (sidebar on the left, file list in the middle, editor on the right).

### `src/hooks/useAppLogic.ts`
**This is the most critical file in the frontend.** 
It is a massive custom hook that acts as the central brain of the application. It holds all global state, including:
- The currently loaded `files` and configured `workspaces`.
- The `activeView` (e.g., specific workspace, 'favorites', 'recent', 'allMarkdown').
- Complex `useMemo` filters that derive `filteredFiles` so the UI remains highly performant during typing.
- All event handlers for creating, deleting, dragging, and renaming files.

*Note for contributors: If you are adding a new core behavior, you will likely need to update `useAppLogic.ts`. Keep performance in mind and heavily utilize `useMemo` and `useCallback` to prevent cascading re-renders.*

### Editor Components (`src/components/editor`)
- **`CodeMirrorEditor.tsx`**: A wrapper around CodeMirror 6. It handles native spellchecking, theme injection, syntax highlighting, and synchronizing text changes back to `useAppLogic`.
- **`EditorPanel.tsx`**: Manages the horizontal tab bar above the editor, allowing users to switch between multiple open files.

### Preview Components (`src/components/preview`)
- **`MarkdownPreview.tsx`**: Takes raw text and converts it into safe HTML using `markdown-it`. It heavily relies on `DOMPurify` to sanitize outputs to prevent Cross-Site Scripting (XSS) attacks.

### Navigation Components (`src/components/file-list` & `src/components/sidebar`)
- **`FileList.tsx`**: Renders the vertical list of files based on the `filteredFiles` state. Uses `@dnd-kit` to allow users to drag and drop files into a custom sort order. Wrapped in `React.memo` to prevent stuttering while the user types in the editor.
- **`Sidebar.tsx`**: Renders the leftmost navigation panel.

---

## 2. Backend Architecture (`/src-tauri/src`)

The Rust backend has one primary purpose: securely interact with the operating system's file system at native speeds.

### `lib.rs`
All Tauri commands are exposed here. These commands are called asynchronously from the React frontend.

**Key Functions:**
- **`scan_directory`**: Uses the `walkdir` crate to recursively read all files inside a registered workspace folder. It automatically ignores noisy directories like `.git` and `node_modules` to ensure extreme speed and low memory usage. It returns file metadata (size, modified time, extension).
- **`resolve_safe_path`**: A critical security function. Before *any* file operation (read, write, delete) occurs, the requested path is passed through this function to prevent Directory Traversal attacks (e.g., attempting to read `../../../etc/passwd`).
- **File Operations**: Functions like `save_file`, `read_file`, `delete_file`, and `create_folder` act as wrappers around standard Rust `std::fs` operations, returning standard `Result` objects back to the frontend.

---

## 3. Styling & Themes

EXT deliberately avoids utility-class frameworks like TailwindCSS to keep the DOM clean.
Instead, it relies entirely on **Vanilla CSS Custom Properties (Variables)** for its design system.

- **`src/styles/design-system.css`**: Defines all base spacing, typography, and structure.
- **`src/styles/themes/`**: Contains various CSS files defining color palettes (e.g., `dark-glass.css`, `light-minimal.css`).
- Components have dedicated `.css` files (e.g., `FileList.css`) that consume these variables.

To add a new theme or modify visual aesthetics, simply adjust the CSS variables. Do not hardcode HEX or RGB colors directly into component CSS files.
