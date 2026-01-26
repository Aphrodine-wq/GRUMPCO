use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

// Store the backend process handle
static BACKEND_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

fn start_backend(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let resource_path = app_handle.path().resource_dir()?;
    let backend_path = resource_path.join("..").join("..").join("..").join("..").join("backend");
    
    // In development, use the source backend path
    let backend_dir = if backend_path.join("dist").join("index.js").exists() {
        backend_path
    } else {
        // Try relative to current exe for dev mode
        let exe_path = std::env::current_exe()?;
        let dev_backend = exe_path
            .parent().unwrap()
            .parent().unwrap()
            .parent().unwrap()
            .parent().unwrap()
            .parent().unwrap()
            .join("backend");
        
        if dev_backend.join("dist").join("index.js").exists() {
            dev_backend
        } else {
            // Fallback to project root relative path
            std::env::current_dir()?.join("..").join("backend")
        }
    };
    
    log::info!("Starting backend from: {:?}", backend_dir);
    
    let child = Command::new("node")
        .arg("dist/index.js")
        .current_dir(&backend_dir)
        .spawn()?;
    
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
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
