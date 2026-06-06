# The Power of Workspaces

EXT is not just a single-folder markdown editor. It is a full-scale **Workspace Manager**.

## What is a Workspace?
A workspace in EXT is simply a standard folder on your hard drive. When you add a folder as a Workspace, EXT securely maps that physical directory into its high-performance Rust backend. 

## Benefits of Workspaces

1. **True Local-First Data**
   Your notes are never locked inside a proprietary database. They remain exactly where you put them as standard `.md` files. You can sync them via OneDrive, GitHub, Dropbox, or any other tool.

2. **Total Segregation**
   Keep your personal journal, work documentation, and D&D campaign entirely separate. Each workspace maintains its own scope for searches and file organization.

3. **Instant Switching**
   Thanks to the native Tauri architecture, switching between workspaces containing thousands of files is virtually instantaneous.

4. **External Interoperability**
   Because EXT reads the raw files in real-time, you can use external scripts, Git pipelines, or other editors (like VS Code or Obsidian) simultaneously. EXT will instantly reflect any changes made externally.

## Managing Workspaces
- **Add**: Click `+ Add Folder` at the bottom of the sidebar.
- **Remove**: Right-click any workspace in the sidebar and select `Remove Workspace`. (This does *not* delete the files from your hard drive, it only unlinks them from EXT).
