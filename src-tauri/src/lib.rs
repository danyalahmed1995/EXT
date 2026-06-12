use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use walkdir::WalkDir;

const LARGE_FILE_MODE_THRESHOLD_BYTES: u64 = 100 * 1024 * 1024;
const NORMAL_EDITOR_HARD_LIMIT_BYTES: u64 = 100 * 1024 * 1024;
const DEFAULT_CHUNK_BYTES: u64 = 1024 * 1024;
const MAX_CHUNK_BYTES: u64 = 8 * 1024 * 1024;
const SAVE_PROGRESS_EMIT_BYTES: u64 = 16 * 1024 * 1024;

fn resolve_safe_path(workspace_path: &str, relative_path: &str) -> Result<PathBuf, String> {
    let root = Path::new(workspace_path);
    let joined = root.join(relative_path);

    // Normalize path to check for directory traversal
    let joined_str = joined.to_string_lossy();
    if joined_str.contains("..") {
        eprintln!("SECURITY: Path traversal attempt blocked: {}", joined_str);
        return Err("Path traversal detected".to_string());
    }

    Ok(joined)
}

fn is_markdown_extension(ext: &str) -> bool {
    matches!(ext.to_lowercase().as_str(), "md" | "markdown" | "mdx")
}

fn is_supported_editable_extension(ext: &str) -> bool {
    matches!(
        ext.to_lowercase().as_str(),
        "md" | "markdown" | "mdx" | "txt" | "json" | "yml" | "yaml"
    )
}

fn is_shell_extension(ext: &str) -> bool {
    matches!(
        ext.to_lowercase().as_str(),
        "sh" | "bash" | "zsh" | "fish" | "ksh" | "csh" | "tcsh"
    )
}

fn is_shell_config_file(filename: &str) -> bool {
    matches!(
        filename.to_lowercase().as_str(),
        ".bashrc"
            | ".bash_profile"
            | ".bash_login"
            | ".profile"
            | ".zshrc"
            | ".zprofile"
            | ".zshenv"
            | ".zlogin"
            | ".zlogout"
            | ".kshrc"
    )
}

fn is_shell_script_by_shebang(path: &Path) -> bool {
    let mut file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut buffer = [0; 64];
    let bytes_read = match std::io::Read::read(&mut file, &mut buffer) {
        Ok(n) => n,
        Err(_) => return false,
    };

    if bytes_read < 2 || &buffer[0..2] != b"#!" {
        return false;
    }

    let first_line = String::from_utf8_lossy(&buffer[..bytes_read]);
    let shebang = first_line.lines().next().unwrap_or("").trim();

    matches!(
        shebang,
        "#!/bin/sh"
            | "#!/bin/bash"
            | "#!/usr/bin/bash"
            | "#!/usr/bin/env sh"
            | "#!/usr/bin/env bash"
            | "#!/usr/bin/env zsh"
            | "#!/usr/bin/env fish"
            | "#!/usr/bin/env ksh"
            | "#!/usr/bin/env csh"
            | "#!/usr/bin/env tcsh"
    )
}

#[tauri::command]
fn open_devtools(window: tauri::WebviewWindow) {
    #[cfg(debug_assertions)]
    window.open_devtools();
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub files: Vec<ScannedFile>,
    pub detected_icon: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFile {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub extension: String,
    pub workspace: String,
    pub absolute_path: String,
    pub relative_path: String,
    pub modified_at: String,
    pub size: u64,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub has_todos: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub name: String,
    pub extension: String,
    pub absolute_path: String,
    pub relative_path: String,
    pub modified_at: String,
    pub size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChunk {
    pub text: String,
    pub offset: u64,
    pub end_offset: u64,
    pub bytes_read: u64,
    pub next_offset: u64,
    pub is_eof: bool,
    pub newline_count: usize,
    pub begins_mid_line: bool,
    pub ends_mid_line: bool,
    pub newline_style: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub line: u64,
    pub byte_offset: u64,
    pub preview: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchChunkResult {
    pub matches: Vec<SearchMatch>,
    pub scanned_bytes: u64,
    pub lines_scanned: u64,
    pub next_offset: u64,
    pub is_eof: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LargeFilePatch {
    pub start: u64,
    pub end: u64,
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LargeFileSaveResult {
    pub modified_at: String,
    pub size: u64,
    pub patch_count: usize,
    pub backup_path: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LargeFileSaveProgress {
    pub request_id: String,
    pub written_bytes: u64,
    pub total_bytes: u64,
    pub phase: String,
}

fn detect_newline_style(text: &str) -> String {
    let crlf = text.matches("\r\n").count();
    let lf = text
        .bytes()
        .filter(|b| *b == b'\n')
        .count()
        .saturating_sub(crlf);
    match (crlf > 0, lf > 0) {
        (true, true) => "Mixed".to_string(),
        (true, false) => "CRLF".to_string(),
        (false, true) => "LF".to_string(),
        (false, false) => "Unknown".to_string(),
    }
}

#[tauri::command]
fn scan_directory(
    path: String,
    workspace_id: String,
    workspace_name: String,
    ignored_dirs: Vec<String>,
) -> Result<ScanResult, String> {
    let mut files = Vec::new();
    let root = Path::new(&path);

    if !root.exists() || !root.is_dir() {
        return Err(format!("Invalid directory path: {}", path));
    }

    let mut detected_icon = "folder".to_string();
    if root.join("package.json").exists() {
        detected_icon = "typescript".to_string();
    } else if root.join("Cargo.toml").exists() {
        detected_icon = "rust".to_string();
    } else if root.join("requirements.txt").exists() || root.join("pyproject.toml").exists() {
        detected_icon = "python".to_string();
    }

    let dirs: Vec<&str> = ignored_dirs.iter().map(|s| s.as_str()).collect();

    let walker = WalkDir::new(root).into_iter().filter_entry(|e| {
        let is_hidden = e
            .file_name()
            .to_str()
            .map(|s| s.starts_with("."))
            .unwrap_or(false);
        let is_ignored = e
            .file_name()
            .to_str()
            .map(|s| dirs.contains(&s))
            .unwrap_or(false);
        // Exclude configured ignored dirs entirely, while still allowing .github through.
        !is_ignored && (!is_hidden || e.depth() == 0 || e.file_name() == ".github")
    });

    for entry in walker.filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        if entry_path.is_file() {
            let file_name_str = entry_path.file_name().unwrap_or_default().to_string_lossy();
            let ext_lower = entry_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| s.to_lowercase())
                .unwrap_or_default();

            let mut is_supported = false;
            let mut detected_ext = String::new();

            if !ext_lower.is_empty() && (is_supported_editable_extension(&ext_lower) || is_shell_extension(&ext_lower)) {
                is_supported = true;
                detected_ext = format!(".{}", ext_lower);
            } else if is_shell_config_file(&file_name_str) {
                is_supported = true;
                detected_ext = file_name_str.to_string();
            } else if ext_lower.is_empty() && is_shell_script_by_shebang(entry_path) {
                is_supported = true;
                detected_ext = "__shebang_shell".to_string();
            }

            if is_supported {
                let name = file_name_str.to_string();
                let relative_path = entry_path
                    .strip_prefix(root)
                    .unwrap_or(entry_path)
                    .to_string_lossy()
                    .to_string();

                let modified_at = match entry.metadata() {
                    Ok(m) => match m.modified() {
                        Ok(sys_time) => {
                            let dt: DateTime<Utc> = sys_time.into();
                            dt.to_rfc3339()
                        }
                        Err(_) => Utc::now().to_rfc3339(),
                    },
                    Err(_) => Utc::now().to_rfc3339(),
                };

                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

                // Quick scan for TODOs without keeping content in memory
                let mut has_todos = false;
                if size > 0 && size < 2 * 1024 * 1024 {
                    if let Ok(content) = fs::read_to_string(entry_path) {
                        has_todos = content.contains("TODO")
                            || content.contains("- [ ]")
                            || content.contains("- [x]")
                            || content.contains("- [X]");
                    }
                }

                files.push(ScannedFile {
                    id: format!("{}-{}", workspace_id, relative_path.replace("\\", "/")),
                    workspace_id: workspace_id.clone(),
                    name,
                    extension: detected_ext,
                    workspace: workspace_name.clone(),
                    absolute_path: entry_path.to_string_lossy().to_string(),
                    relative_path: relative_path.replace("\\", "/"),
                    modified_at,
                    size,
                    is_favorite: false,
                    is_pinned: false,
                    has_todos,
                });
            }
        }
    }

    if detected_icon == "folder" && !files.is_empty() {
        detected_icon = "markdown".to_string();
    }

    Ok(ScanResult {
        files,
        detected_icon,
    })
}

#[tauri::command]
fn create_file(
    workspace_path: String,
    workspace_id: String,
    workspace_name: String,
    file_name: String,
) -> Result<ScannedFile, String> {
    let file_path = resolve_safe_path(&workspace_path, &file_name)?;

    let ext_lower = file_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let file_name_str = file_path.file_name().unwrap_or_default().to_string_lossy();

    let mut is_supported = false;
    let mut detected_ext = String::new();

    if !ext_lower.is_empty() && (is_supported_editable_extension(&ext_lower) || is_shell_extension(&ext_lower)) {
        is_supported = true;
        detected_ext = format!(".{}", ext_lower);
    } else if is_shell_config_file(&file_name_str) {
        is_supported = true;
        detected_ext = file_name_str.to_string();
    } else if ext_lower.is_empty() {
        // Assume extensionless shebang file if no extension, creating it empty is fine
        is_supported = true;
        detected_ext = "__shebang_shell".to_string();
    }

    if !is_supported {
        return Err(
            "Only supported text, markdown, json, yaml, and shell files can be created".to_string(),
        );
    }

    if file_path.exists() {
        return Err("File already exists".to_string());
    }

    let content = if is_markdown_extension(&ext_lower) {
        format!(
            "# {}\n\n",
            file_path.file_stem().unwrap_or_default().to_string_lossy()
        )
    } else {
        String::new()
    };

    if let Err(e) = fs::write(&file_path, &content) {
        return Err(format!("Failed to create file: {}", e));
    }

    let modified_at = match fs::metadata(&file_path).and_then(|m| m.modified()) {
        Ok(sys_time) => {
            let dt: DateTime<Utc> = sys_time.into();
            dt.to_rfc3339()
        }
        Err(_) => Utc::now().to_rfc3339(),
    };

    let size = fs::metadata(&file_path).map(|m| m.len()).unwrap_or(0);

    Ok(ScannedFile {
        id: format!("{}-file-{}", workspace_id, Utc::now().timestamp_millis()),
        workspace_id,
        name: file_name.clone(),
        extension: detected_ext,
        workspace: workspace_name,
        absolute_path: file_path.to_string_lossy().to_string(),
        relative_path: file_name,
        modified_at,
        size,
        is_favorite: false,
        is_pinned: false,
        has_todos: false,
    })
}

#[tauri::command]
fn create_workspace(name: String, base_path: String) -> Result<ScannedFile, String> {
    let root = Path::new(&base_path).join(&name);

    // Create the directory if it doesn't exist
    if let Err(e) = fs::create_dir_all(&root) {
        return Err(format!("Failed to create workspace directory: {}", e));
    }

    let readme_path = root.join("README.md");
    let content = format!("# {}\n\nStart writing here...\n", name);

    // Create the README.md file
    if let Err(e) = fs::write(&readme_path, &content) {
        return Err(format!("Failed to create README.md: {}", e));
    }

    let modified_at = match fs::metadata(&readme_path).and_then(|m| m.modified()) {
        Ok(sys_time) => {
            let dt: DateTime<Utc> = sys_time.into();
            dt.to_rfc3339()
        }
        Err(_) => Utc::now().to_rfc3339(),
    };

    let size = fs::metadata(&readme_path).map(|m| m.len()).unwrap_or(0);

    Ok(ScannedFile {
        id: format!("{}-readme", name),
        workspace_id: format!("ws-{}", name),
        name: "README.md".to_string(),
        extension: ".md".to_string(),
        workspace: name.clone(),
        absolute_path: readme_path.to_string_lossy().to_string(),
        relative_path: "README.md".to_string(),
        modified_at,
        size,
        is_favorite: false,
        is_pinned: false,
        has_todos: false,
    })
}

#[tauri::command]
fn save_file(
    workspace_path: String,
    relative_path: String,
    content: String,
) -> Result<String, String> {
    let file_path = resolve_safe_path(&workspace_path, &relative_path)?;

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    if let Err(e) = fs::write(&file_path, &content) {
        return Err(format!("Failed to save file: {}", e));
    }

    let modified_at = match fs::metadata(&file_path).and_then(|m| m.modified()) {
        Ok(sys_time) => {
            let dt: DateTime<Utc> = sys_time.into();
            dt.to_rfc3339()
        }
        Err(_) => Utc::now().to_rfc3339(),
    };

    Ok(modified_at)
}

#[tauri::command]
fn move_file(
    source_workspace_path: String,
    target_workspace_path: String,
    relative_path: String,
) -> Result<ScannedFile, String> {
    let source_path = resolve_safe_path(&source_workspace_path, &relative_path)?;
    let target_root = Path::new(&target_workspace_path);

    let file_name = source_path.file_name().unwrap_or_default();
    let target_path = target_root.join(file_name);

    if !source_path.exists() {
        return Err("Source file does not exist".to_string());
    }
    if target_path.exists() {
        return Err("Target file already exists".to_string());
    }

    if let Err(_e) = fs::rename(&source_path, &target_path) {
        // Fallback to copy+remove if crossing mounts
        if let Err(e2) = fs::copy(&source_path, &target_path) {
            return Err(format!("Failed to move file: {}", e2));
        }
        let _ = fs::remove_file(&source_path);
    }

    // Construct the new ScannedFile
    let ext = target_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let modified_at = match fs::metadata(&target_path).and_then(|m| m.modified()) {
        Ok(sys_time) => {
            let dt: DateTime<Utc> = sys_time.into();
            dt.to_rfc3339()
        }
        Err(_) => Utc::now().to_rfc3339(),
    };

    let size = fs::metadata(&target_path).map(|m| m.len()).unwrap_or(0);

    Ok(ScannedFile {
        id: format!("moved-{}", Utc::now().timestamp_millis()), // ID will be updated on frontend
        workspace_id: String::new(),                            // Will be updated on frontend
        name: file_name.to_string_lossy().to_string(),
        extension: format!(".{}", ext.to_lowercase()),
        workspace: String::new(), // Will be updated on frontend
        absolute_path: target_path.to_string_lossy().to_string(),
        relative_path: file_name.to_string_lossy().to_string(),
        modified_at,
        size,
        is_favorite: false,
        is_pinned: false,
        has_todos: false, // Could be determined if we read it, but for move it's fine.
    })
}
#[tauri::command]
fn delete_file(workspace_path: String, relative_path: String) -> Result<(), String> {
    let file_path = resolve_safe_path(&workspace_path, &relative_path)?;

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    if let Err(e) = fs::remove_file(&file_path) {
        return Err(format!("Failed to delete file: {}", e));
    }

    Ok(())
}

#[tauri::command]
fn get_file_metadata(
    workspace_path: String,
    relative_path: String,
) -> Result<FileMetadata, String> {
    let file_path = resolve_safe_path(&workspace_path, &relative_path)?;

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    let metadata =
        fs::metadata(&file_path).map_err(|e| format!("Failed to read metadata: {}", e))?;
    let modified_at = match metadata.modified() {
        Ok(sys_time) => {
            let dt: DateTime<Utc> = sys_time.into();
            dt.to_rfc3339()
        }
        Err(_) => Utc::now().to_rfc3339(),
    };

    Ok(FileMetadata {
        name: file_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        extension: file_path
            .extension()
            .and_then(|e| e.to_str())
            .map(|ext| format!(".{}", ext.to_lowercase()))
            .unwrap_or_default(),
        absolute_path: file_path.to_string_lossy().to_string(),
        relative_path,
        modified_at,
        size: metadata.len(),
    })
}

#[tauri::command]
fn read_file(
    workspace_path: String,
    relative_path: String,
    allow_large_file_read: Option<bool>,
) -> Result<String, String> {
    let file_path = resolve_safe_path(&workspace_path, &relative_path)?;

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    let metadata =
        fs::metadata(&file_path).map_err(|e| format!("Failed to read metadata: {}", e))?;
    println!(
        "[LargeFile] read_file metadata path={} size={} bytes",
        file_path.to_string_lossy(),
        metadata.len()
    );

    if metadata.len() > LARGE_FILE_MODE_THRESHOLD_BYTES && !allow_large_file_read.unwrap_or(false) {
        return Err(format!(
            "File is {} bytes and must be opened with the streaming text editor",
            metadata.len()
        ));
    }
    if metadata.len() > NORMAL_EDITOR_HARD_LIMIT_BYTES {
        return Err(format!(
            "File is {} bytes and exceeds the normal editor hard limit",
            metadata.len()
        ));
    }

    let started_at = std::time::Instant::now();
    println!(
        "[LargeFile] read_file start path={} size={}",
        file_path.to_string_lossy(),
        metadata.len()
    );
    let content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    println!(
        "[LargeFile] read_file end path={} bytes={} elapsed_ms={}",
        file_path.to_string_lossy(),
        content.len(),
        started_at.elapsed().as_millis()
    );
    Ok(content)
}

#[tauri::command]
fn read_file_chunk(
    workspace_path: String,
    relative_path: String,
    offset: u64,
    max_bytes: Option<u64>,
) -> Result<FileChunk, String> {
    let file_path = resolve_safe_path(&workspace_path, &relative_path)?;

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    let file_size = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?
        .len();
    let read_size = max_bytes
        .unwrap_or(DEFAULT_CHUNK_BYTES)
        .clamp(1, MAX_CHUNK_BYTES);
    let safe_offset = offset.min(file_size);
    let mut file = File::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))?;

    let begins_mid_line = if safe_offset == 0 {
        false
    } else {
        let mut probe = [0_u8; 1];
        file.seek(SeekFrom::Start(safe_offset - 1))
            .map_err(|e| format!("Failed to seek file: {}", e))?;
        file.read_exact(&mut probe)
            .map_err(|e| format!("Failed to probe chunk start: {}", e))?;
        probe[0] != b'\n'
    };

    file.seek(SeekFrom::Start(safe_offset))
        .map_err(|e| format!("Failed to seek file: {}", e))?;

    let mut buffer = vec![0_u8; read_size as usize];
    let bytes_read = file
        .read(&mut buffer)
        .map_err(|e| format!("Failed to read chunk: {}", e))?;
    buffer.truncate(bytes_read);
    let text = String::from_utf8_lossy(&buffer).to_string();
    let newline_count = text.bytes().filter(|b| *b == b'\n').count();
    let next_offset = safe_offset + bytes_read as u64;
    let ends_mid_line = if next_offset >= file_size || bytes_read == 0 {
        false
    } else {
        let mut probe = [0_u8; 1];
        file.seek(SeekFrom::Start(next_offset))
            .map_err(|e| format!("Failed to seek file: {}", e))?;
        file.read_exact(&mut probe)
            .map_err(|e| format!("Failed to probe chunk end: {}", e))?;
        probe[0] != b'\n'
    };

    Ok(FileChunk {
        text,
        offset: safe_offset,
        end_offset: next_offset,
        bytes_read: bytes_read as u64,
        next_offset,
        is_eof: next_offset >= file_size,
        newline_count,
        begins_mid_line,
        ends_mid_line,
        newline_style: detect_newline_style(&String::from_utf8_lossy(&buffer)),
    })
}

#[tauri::command]
fn search_file_chunk(
    workspace_path: String,
    relative_path: String,
    query: String,
    offset: u64,
    line_offset: u64,
    max_bytes: Option<u64>,
    max_results: Option<usize>,
) -> Result<SearchChunkResult, String> {
    if query.is_empty() {
        return Ok(SearchChunkResult {
            matches: Vec::new(),
            scanned_bytes: 0,
            lines_scanned: 0,
            next_offset: offset,
            is_eof: true,
        });
    }

    let chunk = read_file_chunk(workspace_path, relative_path, offset, max_bytes)?;
    let query_lower = query.to_lowercase();
    let max_results = max_results.unwrap_or(100).clamp(1, 500);
    let mut matches = Vec::new();
    let mut line_number = line_offset;
    let mut byte_cursor = chunk.offset;

    for segment in chunk.text.split_inclusive('\n') {
        line_number += 1;
        let line = segment.trim_end_matches(&['\r', '\n'][..]);
        if matches.len() < max_results && line.to_lowercase().contains(&query_lower) {
            let preview: String = line.chars().take(240).collect();
            matches.push(SearchMatch {
                line: line_number,
                byte_offset: byte_cursor,
                preview,
            });
        }
        byte_cursor += segment.len() as u64;
    }

    Ok(SearchChunkResult {
        matches,
        scanned_bytes: chunk.bytes_read,
        lines_scanned: line_number.saturating_sub(line_offset),
        next_offset: chunk.next_offset,
        is_eof: chunk.is_eof,
    })
}

fn stream_copy_range(
    source: &mut File,
    target: &mut File,
    from: u64,
    to: u64,
    progress: &mut impl FnMut(u64) -> Result<(), String>,
) -> Result<(), String> {
    if to <= from {
        return Ok(());
    }

    source
        .seek(SeekFrom::Start(from))
        .map_err(|e| format!("Failed to seek source: {}", e))?;
    let mut remaining = to - from;
    let mut buffer = vec![0_u8; DEFAULT_CHUNK_BYTES as usize];

    while remaining > 0 {
        let read_len = remaining.min(buffer.len() as u64) as usize;
        let n = source
            .read(&mut buffer[..read_len])
            .map_err(|e| format!("Failed to stream source: {}", e))?;
        if n == 0 {
            return Err("Unexpected EOF while streaming save".to_string());
        }
        target
            .write_all(&buffer[..n])
            .map_err(|e| format!("Failed to write temp file: {}", e))?;
        progress(n as u64)?;
        remaining -= n as u64;
    }

    Ok(())
}

fn emit_large_file_save_progress(
    app: &tauri::AppHandle,
    request_id: &Option<String>,
    written_bytes: u64,
    total_bytes: u64,
    phase: &str,
) {
    if let Some(id) = request_id {
        let _ = app.emit(
            "large-file-save-progress",
            LargeFileSaveProgress {
                request_id: id.clone(),
                written_bytes,
                total_bytes,
                phase: phase.to_string(),
            },
        );
    }
}

#[tauri::command]
fn save_large_file_patches(
    app: tauri::AppHandle,
    workspace_path: String,
    relative_path: String,
    patches: Vec<LargeFilePatch>,
    request_id: Option<String>,
) -> Result<LargeFileSaveResult, String> {
    let started_at = std::time::Instant::now();
    let file_path = resolve_safe_path(&workspace_path, &relative_path)?;

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    let file_size = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?
        .len();
    let mut sorted_patches = patches;
    sorted_patches.sort_by_key(|patch| patch.start);

    let mut previous_end = 0;
    for patch in &sorted_patches {
        if patch.start > patch.end {
            return Err("Invalid patch range".to_string());
        }
        if patch.end > file_size {
            return Err("Patch extends beyond file size".to_string());
        }
        if patch.start < previous_end {
            return Err("Overlapping large-file patches cannot be saved".to_string());
        }
        previous_end = patch.end;
    }

    if sorted_patches.is_empty() {
        let modified_at = match fs::metadata(&file_path).and_then(|m| m.modified()) {
            Ok(sys_time) => {
                let dt: DateTime<Utc> = sys_time.into();
                dt.to_rfc3339()
            }
            Err(_) => Utc::now().to_rfc3339(),
        };
        return Ok(LargeFileSaveResult {
            modified_at,
            size: file_size,
            patch_count: 0,
            backup_path: None,
        });
    }

    let parent = file_path
        .parent()
        .ok_or_else(|| "Cannot resolve parent folder".to_string())?;
    let file_name = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let stamp = Utc::now().timestamp_millis();
    let temp_path = parent.join(format!(".{}.ext-save-{}.tmp", file_name, stamp));
    let backup_path = parent.join(format!(".{}.ext-backup-{}", file_name, stamp));

    println!(
        "[LargeFile] save start path={} size={} patches={}",
        file_path.to_string_lossy(),
        file_size,
        sorted_patches.len()
    );

    let mut source = File::open(&file_path).map_err(|e| format!("Failed to open source: {}", e))?;
    let mut target =
        File::create(&temp_path).map_err(|e| format!("Failed to create temp file: {}", e))?;
    let replaced_bytes = sorted_patches
        .iter()
        .map(|patch| patch.end.saturating_sub(patch.start))
        .sum::<u64>();
    let inserted_bytes = sorted_patches
        .iter()
        .map(|patch| patch.text.len() as u64)
        .sum::<u64>();
    let total_output_bytes = file_size
        .saturating_sub(replaced_bytes)
        .saturating_add(inserted_bytes);
    let mut written_bytes = 0_u64;
    let mut last_progress_emit = 0_u64;
    emit_large_file_save_progress(
        &app,
        &request_id,
        written_bytes,
        total_output_bytes,
        "Preparing",
    );

    let mut report_progress = |bytes: u64| -> Result<(), String> {
        written_bytes = written_bytes.saturating_add(bytes);
        if written_bytes.saturating_sub(last_progress_emit) >= SAVE_PROGRESS_EMIT_BYTES
            || written_bytes >= total_output_bytes
        {
            last_progress_emit = written_bytes;
            emit_large_file_save_progress(
                &app,
                &request_id,
                written_bytes.min(total_output_bytes),
                total_output_bytes,
                "Writing",
            );
        }
        Ok(())
    };

    let mut cursor = 0;
    for patch in &sorted_patches {
        stream_copy_range(
            &mut source,
            &mut target,
            cursor,
            patch.start,
            &mut report_progress,
        )?;
        target
            .write_all(patch.text.as_bytes())
            .map_err(|e| format!("Failed to write patch: {}", e))?;
        report_progress(patch.text.len() as u64)?;
        cursor = patch.end;
    }
    stream_copy_range(
        &mut source,
        &mut target,
        cursor,
        file_size,
        &mut report_progress,
    )?;
    target
        .flush()
        .map_err(|e| format!("Failed to flush temp file: {}", e))?;
    target
        .sync_all()
        .map_err(|e| format!("Failed to sync temp file: {}", e))?;
    drop(target);
    drop(source);

    fs::rename(&file_path, &backup_path)
        .map_err(|e| format!("Failed to create backup before replace: {}", e))?;
    emit_large_file_save_progress(
        &app,
        &request_id,
        written_bytes,
        total_output_bytes,
        "Replacing",
    );

    if let Err(e) = fs::rename(&temp_path, &file_path) {
        let _ = fs::rename(&backup_path, &file_path);
        return Err(format!(
            "Failed to replace original file; backup restored: {}",
            e
        ));
    }
    emit_large_file_save_progress(
        &app,
        &request_id,
        total_output_bytes,
        total_output_bytes,
        "Complete",
    );

    let new_size = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to read saved metadata: {}", e))?
        .len();
    let modified_at = match fs::metadata(&file_path).and_then(|m| m.modified()) {
        Ok(sys_time) => {
            let dt: DateTime<Utc> = sys_time.into();
            dt.to_rfc3339()
        }
        Err(_) => Utc::now().to_rfc3339(),
    };

    println!(
        "[LargeFile] save end path={} new_size={} elapsed_ms={} backup={}",
        file_path.to_string_lossy(),
        new_size,
        started_at.elapsed().as_millis(),
        backup_path.to_string_lossy()
    );

    Ok(LargeFileSaveResult {
        modified_at,
        size: new_size,
        patch_count: sorted_patches.len(),
        backup_path: Some(backup_path.to_string_lossy().to_string()),
    })
}

#[tauri::command]
fn create_folder(
    workspace_path: String,
    relative_path: String,
    folder_name: String,
) -> Result<(), String> {
    let root = Path::new(&workspace_path);
    let mut dir_path = root.to_path_buf();
    if !relative_path.is_empty() {
        dir_path = dir_path.join(&relative_path);
    }
    dir_path = dir_path.join(&folder_name);

    if dir_path.exists() {
        return Err("Folder already exists".to_string());
    }

    fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create folder: {}", e))
}

#[tauri::command]
fn rename_file(
    workspace_path: String,
    relative_path: String,
    new_name: String,
) -> Result<ScannedFile, String> {
    let root = Path::new(&workspace_path);
    let source_path = resolve_safe_path(&workspace_path, &relative_path)?;

    if !source_path.exists() {
        return Err("File does not exist".to_string());
    }

    let target_path = source_path.with_file_name(&new_name);

    if target_path.exists() && source_path != target_path {
        return Err("A file with the new name already exists".to_string());
    }

    if let Err(e) = fs::rename(&source_path, &target_path) {
        return Err(format!("Failed to rename file: {}", e));
    }

    let ext = target_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let modified_at = match fs::metadata(&target_path).and_then(|m| m.modified()) {
        Ok(sys_time) => {
            let dt: DateTime<Utc> = sys_time.into();
            dt.to_rfc3339()
        }
        Err(_) => Utc::now().to_rfc3339(),
    };

    let size = fs::metadata(&target_path).map(|m| m.len()).unwrap_or(0);

    let new_relative_path = target_path
        .strip_prefix(root)
        .unwrap_or(&target_path)
        .to_string_lossy()
        .to_string();

    Ok(ScannedFile {
        id: format!("renamed-{}", Utc::now().timestamp_millis()), // ID handled on frontend
        workspace_id: String::new(),
        name: new_name.clone(),
        extension: format!(".{}", ext.to_lowercase()),
        workspace: String::new(),
        absolute_path: target_path.to_string_lossy().to_string(),
        relative_path: new_relative_path.replace("\\", "/"),
        modified_at,
        size,
        is_favorite: false,
        is_pinned: false,
        has_todos: false,
    })
}

#[tauri::command]
fn get_file_modified_time(workspace_path: String, relative_path: String) -> Result<String, String> {
    let file_path = resolve_safe_path(&workspace_path, &relative_path)?;

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    match fs::metadata(&file_path).and_then(|m| m.modified()) {
        Ok(sys_time) => {
            let dt: DateTime<Utc> = sys_time.into();
            Ok(dt.to_rfc3339())
        }
        Err(e) => Err(format!("Failed to get modified time: {}", e)),
    }
}

#[tauri::command]
fn get_absolute_path(workspace_path: String, relative_path: String) -> Result<String, String> {
    let mut file_path = resolve_safe_path(&workspace_path, &relative_path)?;

    // Attempt to canonicalize to resolve `.` paths safely
    if let Ok(canonical) = file_path.canonicalize() {
        file_path = canonical;
    }

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn rename_workspace_folder(workspace_path: String, new_name: String) -> Result<String, String> {
    let source_path = Path::new(&workspace_path);
    if !source_path.exists() {
        return Err("Workspace folder does not exist".to_string());
    }

    let target_path = source_path.with_file_name(&new_name);
    if target_path.exists() && source_path != target_path {
        return Err("A folder with the new name already exists".to_string());
    }

    if let Err(e) = fs::rename(source_path, &target_path) {
        return Err(format!("Failed to rename workspace folder: {}", e));
    }

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
fn reveal_in_explorer(workspace_path: String, relative_path: Option<String>) -> Result<(), String> {
    let mut path = Path::new(&workspace_path).to_path_buf();

    if let Some(rel) = relative_path {
        path = path.join(rel);
    }

    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // For linux, there's no standard way to select a file, so we open the parent dir
        let dir = if path.is_file() {
            path.parent().unwrap_or(&path)
        } else {
            &path
        };
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn copy_file_to_clipboard(absolute_path: String) -> Result<(), String> {
    let _ = &absolute_path;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!("Set-Clipboard -Path '{}'", absolute_path.replace("'", "''")),
            ])
            .spawn()
            .map_err(|e| format!("Failed to copy file to clipboard: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("osascript")
            .args([
                "-e",
                &format!(
                    "set the clipboard to POSIX file \"{}\"",
                    absolute_path.replace("\"", "\\\"")
                ),
            ])
            .spawn()
            .map_err(|e| format!("Failed to copy file to clipboard: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn force_exit(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[tauri::command]
fn force_restart(app_handle: tauri::AppHandle) {
    app_handle.restart();
}

#[tauri::command]
fn initialize_example_workspace(app_handle: tauri::AppHandle) -> Result<String, String> {
    let resource_dir = app_handle.path().resource_dir().unwrap_or_default();

    // Start by checking standard dev paths in debug mode to avoid empty placeholder dirs
    let mut source_dir = resource_dir.join("Examples");

    #[cfg(debug_assertions)]
    {
        if let Ok(cwd) = std::env::current_dir() {
            let dev_path1 = cwd.join("../Examples");
            let dev_path2 = cwd.join("Examples");
            if dev_path1.exists() && dev_path1.join("Welcome.md").exists() {
                source_dir = dev_path1;
            } else if dev_path2.exists() && dev_path2.join("Welcome.md").exists() {
                source_dir = dev_path2;
            }
        }
    }

    // If not found in dev paths, try the resource bundles
    if !source_dir.join("Welcome.md").exists() {
        let res_path1 = resource_dir.join("Examples");
        let res_path2 = resource_dir.join("_up_").join("Examples");
        if res_path1.exists() && res_path1.join("Welcome.md").exists() {
            source_dir = res_path1;
        } else if res_path2.exists() && res_path2.join("Welcome.md").exists() {
            source_dir = res_path2;
        }
    }

    if source_dir.exists() && source_dir.join("Welcome.md").exists() {
        // Canonicalize to resolve any '..' in the path, which would trigger the anti-traversal security checks
        let resolved_path = std::fs::canonicalize(&source_dir).unwrap_or(source_dir);
        // Windows canonicalize adds \\?\, so we strip it for cleaner paths if possible
        let path_str = resolved_path.to_string_lossy().to_string();
        let clean_path = if let Some(stripped) = path_str.strip_prefix(r"\\?\") {
            stripped.to_string()
        } else {
            path_str
        };
        Ok(clean_path)
    } else {
        Err(format!(
            "Could not find Examples directory. Searched from {:?}",
            resource_dir
        ))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            create_workspace,
            create_file,
            create_folder,
            rename_file,
            save_file,
            move_file,
            delete_file,
            reveal_in_explorer,
            read_file,
            read_file_chunk,
            search_file_chunk,
            save_large_file_patches,
            get_file_metadata,
            copy_file_to_clipboard,
            get_file_modified_time,
            get_absolute_path,
            rename_workspace_folder,
            force_exit,
            force_restart,
            open_devtools,
            initialize_example_workspace
        ])
        .setup(|app| {
            let open_i = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            let restart_i = MenuItem::with_id(app, "restart", "Restart", true, None::<&str>)?;
            let exit_i = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&open_i, &restart_i, &exit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "restart" => {
                        let _ = app.emit("tray-restart-requested", ());
                    }
                    "exit" => {
                        let _ = app.emit("tray-exit-requested", ());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                    | TrayIconEvent::DoubleClick { .. } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder.build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                println!("Window hidden to tray");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn normalize_line_endings(content: &str) -> String {
    // Converts all CRLF to LF, then converts all LF to CRLF
    // This standardizes line endings for cross-platform files
    let lf_only = content.replace("\r\n", "\n");
    lf_only.replace("\n", "\r\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_safe_path() {
        let safe = resolve_safe_path("/var/workspace", "folder/file.md");
        assert!(safe.is_ok());

        let unsafe_path = resolve_safe_path("/var/workspace", "../../../etc/passwd");
        assert!(unsafe_path.is_err());
    }

    #[test]
    fn test_supported_editable_extensions() {
        for ext in [
            "md", "markdown", "mdx", "txt", "json", "yml", "yaml", "JSON", "YAML", "MDX",
        ] {
            assert!(is_supported_editable_extension(ext));
        }

        for ext in ["toml", "xml", "ini", "env", "js", "ts"] {
            assert!(!is_supported_editable_extension(ext));
        }
    }

    #[test]
    fn test_mdx_is_markdown() {
        assert!(is_markdown_extension("mdx"));
        assert!(is_markdown_extension("MDX"));
        assert!(is_markdown_extension("Mdx"));
    }

    #[test]
    fn test_lf_to_crlf_normalization() {
        // Mixed LF and CRLF
        let mixed_content = "Line 1\nLine 2\r\nLine 3\n";
        let normalized = normalize_line_endings(mixed_content);

        // It should convert all to CRLF
        assert_eq!(normalized, "Line 1\r\nLine 2\r\nLine 3\r\n");
    }
}
