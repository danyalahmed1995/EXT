use chrono::{DateTime, Utc};
use serde::Serialize;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

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
    pub relative_path: String,
    pub modified_at: String,
    pub size: u64,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub content: String,
}

#[tauri::command]
fn scan_directory(path: String, workspace_id: String, workspace_name: String) -> Result<ScanResult, String> {
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

    let mut counter = 0;

    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        if entry_path.is_file() {
            if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if ext_lower == "md" || ext_lower == "markdown" || ext_lower == "txt" {
                    let name = entry_path.file_name().unwrap_or_default().to_string_lossy().to_string();
                    let relative_path = entry_path.strip_prefix(root).unwrap_or(entry_path).to_string_lossy().to_string();
                    
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
                    let content = fs::read_to_string(&entry_path).unwrap_or_default();
                    
                    counter += 1;
                    
                    files.push(ScannedFile {
                        id: format!("{}-file-{}", workspace_id, counter),
                        workspace_id: workspace_id.clone(),
                        name,
                        extension: format!(".{}", ext_lower),
                        workspace: workspace_name.clone(),
                        relative_path: relative_path.replace("\\", "/"),
                        modified_at,
                        size,
                        is_favorite: false,
                        is_pinned: false,
                        content,
                    });
                }
            }
        }
    }

    if detected_icon == "folder" && files.len() > 0 {
        detected_icon = "markdown".to_string();
    }

    Ok(ScanResult {
        files,
        detected_icon,
    })
}

#[tauri::command]
fn create_file(workspace_path: String, workspace_id: String, workspace_name: String, file_name: String) -> Result<ScannedFile, String> {
    let root = Path::new(&workspace_path);
    let file_path = root.join(&file_name);
    
    // Check if the extension is valid
    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let ext_lower = ext.to_lowercase();
    if ext_lower != "md" && ext_lower != "markdown" && ext_lower != "txt" {
        return Err("Only .md and .txt files are supported".to_string());
    }

    if file_path.exists() {
        return Err("File already exists".to_string());
    }

    let content = if ext_lower == "md" || ext_lower == "markdown" {
        format!("# {}\n\n", file_path.file_stem().unwrap_or_default().to_string_lossy())
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
        extension: format!(".{}", ext_lower),
        workspace: workspace_name,
        relative_path: file_name,
        modified_at,
        size,
        is_favorite: false,
        is_pinned: false,
        content,
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
        relative_path: "README.md".to_string(),
        modified_at,
        size,
        is_favorite: false,
        is_pinned: false,
        content,
    })
}

#[tauri::command]
fn save_file(workspace_path: String, relative_path: String, content: String) -> Result<String, String> {
    let root = Path::new(&workspace_path);
    let file_path = root.join(&relative_path);
    
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
fn move_file(source_workspace_path: String, target_workspace_path: String, relative_path: String) -> Result<ScannedFile, String> {
    let source_root = Path::new(&source_workspace_path);
    let target_root = Path::new(&target_workspace_path);
    
    let source_path = source_root.join(&relative_path);
    let file_name = source_path.file_name().unwrap_or_default();
    let target_path = target_root.join(file_name);
    
    if !source_path.exists() {
        return Err("Source file does not exist".to_string());
    }
    if target_path.exists() {
        return Err("Target file already exists".to_string());
    }
    
    if let Err(e) = fs::rename(&source_path, &target_path) {
        // Fallback to copy+remove if crossing mounts
        if let Err(e2) = fs::copy(&source_path, &target_path) {
            return Err(format!("Failed to move file: {}", e2));
        }
        let _ = fs::remove_file(&source_path);
    }
    
    // Construct the new ScannedFile
    let ext = target_path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let modified_at = match fs::metadata(&target_path).and_then(|m| m.modified()) {
        Ok(sys_time) => {
            let dt: DateTime<Utc> = sys_time.into();
            dt.to_rfc3339()
        }
        Err(_) => Utc::now().to_rfc3339(),
    };
    
    let size = fs::metadata(&target_path).map(|m| m.len()).unwrap_or(0);
    let content = fs::read_to_string(&target_path).unwrap_or_default();
    
    Ok(ScannedFile {
        id: format!("moved-{}", Utc::now().timestamp_millis()), // ID will be updated on frontend
        workspace_id: String::new(), // Will be updated on frontend
        name: file_name.to_string_lossy().to_string(),
        extension: format!(".{}", ext.to_lowercase()),
        workspace: String::new(), // Will be updated on frontend
        relative_path: file_name.to_string_lossy().to_string(),
        modified_at,
        size,
        is_favorite: false,
        is_pinned: false,
        content,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![scan_directory, create_workspace, create_file, save_file, move_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
