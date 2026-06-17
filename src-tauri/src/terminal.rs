use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem, MasterPty, Child};
use serde::Serialize;
use std::env;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub struct TerminalInstance {
    pub master: Box<dyn MasterPty + Send>,
    pub child: Box<dyn Child + Send + Sync>,
    pub writer: Box<dyn std::io::Write + Send>,
}

pub struct TerminalState {
    pub instance: Arc<Mutex<Option<TerminalInstance>>>,
}

#[derive(Clone, Serialize)]
pub struct TerminalSpawnResult {
    pub success: bool,
    pub shell: String,
    pub error: Option<String>,
}

#[cfg(target_os = "windows")]
fn spawn_shell(
    pty_system: &dyn PtySystem,
    pty_size: PtySize,
    cwd: &str,
) -> Result<(Box<dyn MasterPty + Send>, Box<dyn Child + Send + Sync>, String), String> {
    let pair = pty_system.openpty(pty_size).map_err(|e| e.to_string())?;
    
    let mut cmd = CommandBuilder::new("pwsh.exe");
    cmd.cwd(cwd);
    if let Ok(child) = pair.slave.spawn_command(cmd) {
        return Ok((pair.master, child, "pwsh".to_string()));
    }
    
    let mut cmd2 = CommandBuilder::new("powershell.exe");
    cmd2.cwd(cwd);
    let child2 = pair.slave.spawn_command(cmd2).map_err(|e| e.to_string())?;
    Ok((pair.master, child2, "powershell".to_string()))
}

#[cfg(not(target_os = "windows"))]
fn spawn_shell(
    pty_system: &dyn PtySystem,
    pty_size: PtySize,
    cwd: &str,
) -> Result<(Box<dyn MasterPty + Send>, Box<dyn Child + Send + Sync>, String), String> {
    let shell = env::var("SHELL").unwrap_or_else(|_| {
        #[cfg(target_os = "macos")]
        { "/bin/zsh".to_string() }
        #[cfg(not(target_os = "macos"))]
        { "/bin/bash".to_string() }
    });
    
    let pair = pty_system.openpty(pty_size).map_err(|e| e.to_string())?;
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(cwd);
    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    
    let shell_name = Path::new(&shell)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
        
    Ok((pair.master, child, shell_name))
}

#[tauri::command]
pub fn spawn_terminal(
    cwd: String,
    app: AppHandle,
    state: State<'_, TerminalState>,
) -> Result<TerminalSpawnResult, String> {
    let mut instance_lock = state.instance.lock().unwrap();
    
    // Kill existing
    if let Some(mut existing) = instance_lock.take() {
        let _ = existing.child.kill();
    }
    
    let pty_system = NativePtySystem::default();
    let pty_size = PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    };
    
    match spawn_shell(&pty_system, pty_size, &cwd) {
        Ok((master, child, shell_name)) => {
            let master_clone = master.try_clone_reader().map_err(|e| e.to_string())?;
            let writer = master.take_writer().map_err(|e| e.to_string())?;
            
            *instance_lock = Some(TerminalInstance { master, child, writer });
            
            let (tx, rx) = std::sync::mpsc::channel::<Vec<u8>>();
            
            // Reader thread
            std::thread::spawn(move || {
                let mut reader = std::io::BufReader::new(master_clone);
                let mut buffer = [0u8; 8192];
                loop {
                    match std::io::Read::read(&mut reader, &mut buffer) {
                        Ok(0) => break, // EOF
                        Ok(n) => {
                            if tx.send(buffer[..n].to_vec()).is_err() {
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }
            });
            
            // Emitter thread
            let app_clone = app.clone();
            std::thread::spawn(move || {
                let mut accum = Vec::new();
                let timeout = std::time::Duration::from_millis(15);
                loop {
                    match rx.recv_timeout(timeout) {
                        Ok(chunk) => {
                            accum.extend_from_slice(&chunk);
                            // If accumulated data exceeds 64KB, flush immediately
                            if accum.len() >= 65536 {
                                let _ = app_clone.emit("terminal-output", accum.clone());
                                accum.clear();
                            }
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                            if !accum.is_empty() {
                                let _ = app_clone.emit("terminal-output", accum.clone());
                                accum.clear();
                            }
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                            if !accum.is_empty() {
                                let _ = app_clone.emit("terminal-output", accum.clone());
                            }
                            break;
                        }
                    }
                }
            });
            
            Ok(TerminalSpawnResult {
                success: true,
                shell: shell_name,
                error: None,
            })
        }
        Err(e) => Ok(TerminalSpawnResult {
            success: false,
            shell: "".to_string(),
            error: Some(e),
        }),
    }
}

#[tauri::command]
pub fn write_terminal(data: String, state: State<'_, TerminalState>) -> Result<(), String> {
    if let Some(instance) = state.instance.lock().unwrap().as_mut() {
        if let Err(e) = std::io::Write::write_all(&mut instance.writer, data.as_bytes()) {
            return Err(e.to_string());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn resize_terminal(rows: u16, cols: u16, state: State<'_, TerminalState>) -> Result<(), String> {
    if let Some(instance) = state.instance.lock().unwrap().as_mut() {
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        let _ = instance.master.resize(size);
    }
    Ok(())
}

#[tauri::command]
pub fn kill_terminal(state: State<'_, TerminalState>) -> Result<(), String> {
    let mut instance_lock = state.instance.lock().unwrap();
    if let Some(mut existing) = instance_lock.take() {
        let _ = existing.child.kill();
    }
    Ok(())
}
