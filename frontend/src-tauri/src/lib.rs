use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

// Store the backend process handle
static BACKEND_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

fn extract_resource(app_handle: &tauri::AppHandle, resource_name: &str, target_path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    // Check if already extracted
    if target_path.exists() {
        log::info!("Resource already extracted: {:?}", target_path);
        return Ok(());
    }

    // Get resource file
    let resource = app_handle
        .path()
        .resource_dir()?
        .join(resource_name);

    if !resource.exists() {
        return Err(format!("Resource not found: {:?}", resource).into());
    }

    // Create parent directory if needed
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)?;
    }

    // Copy resource to target
    fs::copy(&resource, target_path)?;
    log::info!("Extracted resource {:?} to {:?}", resource, target_path);

    // On Windows, ensure executable permissions (pkg bundles are already executable)
    #[cfg(windows)]
    {
        // Windows doesn't need chmod, but we can set file attributes if needed
    }

    Ok(())
}

fn find_backend_executable(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    // Strategy 1: Development mode - use Node.js from backend directory
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev_path = manifest_dir
        .parent()? // frontend
        .parent()? // project root
        .join("backend");

    if dev_path.join("dist").join("index.js").exists() {
        log::info!("Found backend at development path: {:?}", dev_path);
        return Some(dev_path.join("dist").join("index.js"));
    }

    // Strategy 2: Production - extract bundled executable
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        let backend_exe = app_data_dir.join("grump-backend.exe");
        
        // Try to extract from resources
        if let Err(e) = extract_resource(app_handle, "grump-backend.exe", &backend_exe) {
            log::warn!("Failed to extract backend executable: {}", e);
        } else if backend_exe.exists() {
            log::info!("Using bundled backend executable: {:?}", backend_exe);
            return Some(backend_exe);
        }
    }

    log::error!("Could not find backend executable");
    None
}

fn load_env_file(backend_dir: &Path) -> HashMap<String, String> {
    let mut env_vars = HashMap::new();
    let env_path = backend_dir.join(".env");

    log::info!("Looking for .env at: {:?}", env_path);

    match fs::read_to_string(&env_path) {
        Ok(contents) => {
            log::info!("Successfully read .env file from: {:?}", env_path);
            for line in contents.lines() {
                let line = line.trim();
                // Skip comments and empty lines
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                // Parse KEY=VALUE
                if let Some(pos) = line.find('=') {
                    let key = line[..pos].trim().to_string();
                    let value = line[pos + 1..].trim();
                    // Remove surrounding quotes if present
                    let value = value.trim_matches('"').trim_matches('\'').to_string();
                    let preview = if value.len() > 10 { &value[..10] } else { &value };
                    log::info!("Loaded env var: {} = {}...", key, preview);
                    env_vars.insert(key, value);
                }
            }
        }
        Err(e) => {
            log::warn!(".env file not found at {:?}: {}", env_path, e);
        }
    }

    env_vars
}

fn start_backend(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let backend_path = find_backend_executable(app_handle)
        .ok_or("Could not locate backend executable")?;

    log::info!("Starting backend from: {:?}", backend_path);

    // Determine if this is a bundled executable or Node.js script
    let is_bundled = backend_path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext == "exe")
        .unwrap_or(false);

    let mut cmd = if is_bundled {
        // Run bundled executable directly
        Command::new(&backend_path)
    } else {
        // Development mode: run with Node.js
        let backend_dir = backend_path.parent()
            .ok_or("Invalid backend path")?;
        let env_vars = load_env_file(backend_dir);
        
        let mut node_cmd = Command::new("node");
        node_cmd.arg(&backend_path)
            .current_dir(backend_dir);
        
        // Pass environment variables
        for (key, value) in &env_vars {
            node_cmd.env(key, value);
        }
        
        if !env_vars.contains_key("NODE_ENV") {
            node_cmd.env("NODE_ENV", "development");
        }
        
        node_cmd
    };

    // For bundled executable, set working directory to app data
    if is_bundled {
        if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
            cmd.current_dir(&app_data_dir);
            
            // Try to load .env from app data directory
            let env_path = app_data_dir.join(".env");
            if env_path.exists() {
                let env_vars = load_env_file(&app_data_dir);
                for (key, value) in &env_vars {
                    cmd.env(key, value);
                }
            }
        }
        
        // Set NODE_ENV if not already set
        cmd.env("NODE_ENV", "production");
    }

    let child = cmd.spawn()?;

    log::info!("Backend started with PID: {}", child.id());

    let mut process = BACKEND_PROCESS.lock().unwrap();
    *process = Some(child);

    Ok(())
}

fn stop_backend() {
    let mut process = BACKEND_PROCESS.lock().unwrap();
    if let Some(mut child) = process.take() {
        log::info!("Stopping backend process");
        let _ = child.kill();
        let _ = child.wait();
    }
}

/// Close splash window and show main window. Called from frontend when app is ready.
#[tauri::command]
fn close_splash_show_main(app: tauri::AppHandle) -> Result<(), String> {
    let splash = app
        .get_webview_window("splashscreen")
        .ok_or_else(|| "splash window not found".to_string())?;
    let main_win = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    splash.close().map_err(|e| e.to_string())?;
    main_win.show().map_err(|e| e.to_string())?;
    main_win.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![close_splash_show_main])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            // Extract bundled resources on first run
            if let Ok(app_data_dir) = app.handle().path().app_data_dir() {
                // Extract backend executable
                let backend_exe = app_data_dir.join("grump-backend.exe");
                if let Err(e) = extract_resource(app.handle(), "grump-backend.exe", &backend_exe) {
                    log::warn!("Failed to extract backend: {}", e);
                }
                
                // Extract intent compiler
                let intent_exe = app_data_dir.join("grump-intent.exe");
                if let Err(e) = extract_resource(app.handle(), "grump-intent.exe", &intent_exe) {
                    log::warn!("Failed to extract intent compiler: {}", e);
                }
            }
            
            // Start the backend server
            if let Err(e) = start_backend(app.handle()) {
                log::error!("Failed to start backend: {}", e);
            }
            
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    stop_backend();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
