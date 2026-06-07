# EXT Broken LaTeX Stress Pack

This pack tests graceful failure with large scientific markdown files.

Each main test file is exactly **5 MiB** and intentionally contains malformed LaTeX patterns.

Expected EXT behavior:

- The editor opens immediately.
- Preview never freezes the editor.
- Bad math fails per block or renders as raw text.
- One malformed formula does not poison the whole preview.
- File/tab switching remains responsive.
- The app does not crash or run out of memory.

Suggested manual test flow:

1. Add this folder to EXT as a workspace.
2. Open each `.md` file.
3. Toggle split view.
4. Click render preview where needed.
5. Scroll editor and preview aggressively.
6. Switch between broken files quickly.
7. Confirm editor typing stays smooth.
8. Check console/logs for recoverable per-block errors instead of app crashes.
