# Large File Mode Benchmark Notes

EXT uses metadata-first file opening to keep very large Markdown/text files out of the normal editor, preview, outline, search, and tab-cache pipeline. Large File Mode now provides a chunked reader/editor path for huge files without passing the full document into React state or CodeMirror.

## Thresholds

- Normal mode: below 20 MB
- Large file warning: 20 MB to 100 MB
- Large File Mode: above 100 MB
- 1 GiB safety path: files at or above 1 GiB must open without reading the full body into React state or CodeMirror

## Local Benchmark Fixtures

Use the local benchmark folder only for manual testing and profiling:

```text
D:\AI Work\EXT\Benchmark Files\ext-1-gig-md-pack
```

Do not commit, move, copy, or add these generated fixtures to version control.

## Manual Test Matrix

- Open the 1 GiB normal Markdown file.
- Open the 1 GiB valid-LaTeX Markdown file.
- Open the 1 GiB broken-LaTeX Markdown file.
- Confirm each opens into the Large File Mode panel.
- Confirm file name, size, path, extension, and modified date are shown.
- Confirm preview, full outline, full math rendering, full syntax highlighting, and full undo stack are disabled.
- Switch between huge-file tabs.
- Switch from a huge file to a normal file and back.
- Try streaming search inside a huge file.
- Cancel an in-progress streaming search.
- Confirm the app remains responsive and does not crash.

## Instrumentation

Watch the dev console and Tauri stdout for `[LargeFile]` messages around:

- file selection
- file-size detection
- read start/end
- metadata-only tab creation
- streaming search chunks
- external modification refresh

The normal `read_file` command rejects files above the Large File Mode threshold. Use chunked commands for large-file reads, progressive search, sparse indexing, and patch saves.

## Chunked Editing

Large File Mode loads a visible byte window into a plain text chunk editor. Navigating away from a modified chunk stores a patch with the original byte range and replacement text. The tab keeps the current offset, visible chunk, search results, sparse index state, and unsaved patches so switching tabs does not reload or reparse the full file.

Saving calls the streaming patch-save command. EXT writes the original file plus ordered patch replacements to a temp file, creates a recovery backup path, and replaces the original file after the temp file is fully written and synced. It never constructs the full final file in memory.

## Additional Manual Tests

- Jump to start, previous chunk, next chunk, end.
- Jump by percentage, for example `50%`.
- Jump by byte offset.
- Edit a visible chunk and switch tabs; confirm dirty state and patch state are preserved.
- Use Ctrl+S or the Save button for large-file patches.
- Use Discard to clear unsaved chunk patches.
- Confirm the sparse line index logs progress without blocking chunk navigation.
- Confirm search results can jump to the matching byte window.
